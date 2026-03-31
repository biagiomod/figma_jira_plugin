package com.yourorg.figurajira.rest;

import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import com.yourorg.figurajira.config.PluginConfig;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.*;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Thin REST proxy — forwards all requests from the Jira issue panel
 * to the AWS sync service API Gateway.
 *
 * This class does exactly three things per request:
 *   1. Reads plugin config (API GW URL + API key)
 *   2. Adds x-api-key, X-Jira-User, X-Jira-Issue headers
 *   3. Forwards the request body unchanged and returns the response unchanged
 *
 * No business logic lives here. No Figma API calls. No DB access.
 * If the sync service is unreachable, a 503 is returned with a clear message.
 *
 * Path: /rest/figma-jira/1.0/...
 *   All sub-paths are forwarded by appending them to the configured API GW base URL.
 */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SyncServiceProxy {

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int SOCKET_TIMEOUT_MS  = 29_000;  // Under Lambda's 30s timeout

    private final PluginConfig pluginConfig;
    private final JiraAuthenticationContext authContext;

    // TODO: Replace with a properly lifecycle-managed HttpClient (Spring bean or component)
    // This creates a new client per class instantiation, which is fine for P2 singletons.
    private final CloseableHttpClient httpClient;

    public SyncServiceProxy(
            PluginSettingsFactory settingsFactory,
            JiraAuthenticationContext authContext) {
        this.pluginConfig = new PluginConfig(settingsFactory);
        this.authContext = authContext;
        this.httpClient = HttpClients.custom()
                .setDefaultRequestConfig(RequestConfig.custom()
                        .setConnectTimeout(CONNECT_TIMEOUT_MS)
                        .setSocketTimeout(SOCKET_TIMEOUT_MS)
                        .build())
                .build();
    }

    // -----------------------------------------------------------------------
    // POST /links/parse
    // -----------------------------------------------------------------------

    @POST
    @Path("links/parse")
    public Response parseLink(String body, @Context HttpServletRequest request) {
        return forward("POST", "links/parse", body, request);
    }

    // -----------------------------------------------------------------------
    // GET /issues/{issueKey}/links
    // -----------------------------------------------------------------------

    @GET
    @Path("issues/{issueKey}/links")
    public Response getLinks(
            @PathParam("issueKey") String issueKey,
            @Context HttpServletRequest request) {
        return forward("GET", "issues/" + issueKey + "/links", null, request);
    }

    // -----------------------------------------------------------------------
    // POST /issues/{issueKey}/links
    // -----------------------------------------------------------------------

    @POST
    @Path("issues/{issueKey}/links")
    public Response createLink(
            @PathParam("issueKey") String issueKey,
            String body,
            @Context HttpServletRequest request) {
        return forward("POST", "issues/" + issueKey + "/links", body, request);
    }

    // -----------------------------------------------------------------------
    // DELETE /issues/{issueKey}/links/{linkId}
    // -----------------------------------------------------------------------

    @DELETE
    @Path("issues/{issueKey}/links/{linkId}")
    public Response deleteLink(
            @PathParam("issueKey") String issueKey,
            @PathParam("linkId") String linkId,
            @Context HttpServletRequest request) {
        return forward("DELETE", "issues/" + issueKey + "/links/" + linkId, null, request);
    }

    // -----------------------------------------------------------------------
    // PATCH /issues/{issueKey}/links/{linkId}/status
    // -----------------------------------------------------------------------

    @PATCH
    @Path("issues/{issueKey}/links/{linkId}/status")
    public Response updateStatus(
            @PathParam("issueKey") String issueKey,
            @PathParam("linkId") String linkId,
            String body,
            @Context HttpServletRequest request) {
        return forward("PATCH", "issues/" + issueKey + "/links/" + linkId + "/status", body, request);
    }

    // -----------------------------------------------------------------------
    // POST /issues/{issueKey}/links/{linkId}/sync
    // -----------------------------------------------------------------------

    @POST
    @Path("issues/{issueKey}/links/{linkId}/sync")
    public Response syncLink(
            @PathParam("issueKey") String issueKey,
            @PathParam("linkId") String linkId,
            @Context HttpServletRequest request) {
        return forward("POST", "issues/" + issueKey + "/links/" + linkId + "/sync", null, request);
    }

    // -----------------------------------------------------------------------
    // Core proxy logic
    // -----------------------------------------------------------------------

    private Response forward(String method, String subPath, String body, HttpServletRequest servletRequest) {
        if (!pluginConfig.isConfigured()) {
            return Response.status(503)
                    .entity("{\"error\":{\"code\":\"PLUGIN_NOT_CONFIGURED\","
                            + "\"message\":\"Figma integration is not configured. "
                            + "Please visit Jira Admin > Add-ons > Figma Integration to set up.\"}}")
                    .build();
        }

        String baseUrl = pluginConfig.getApiGatewayUrl().replaceAll("/+$", "");
        String targetUrl = baseUrl + "/" + subPath;

        String jiraUser = getCurrentJiraUsername();
        String issueKey = extractIssueKeyFromPath(subPath);

        try {
            HttpRequestBase httpRequest = buildHttpRequest(method, targetUrl, body);

            // Add trust boundary headers
            httpRequest.setHeader("x-api-key", pluginConfig.getApiKey());
            httpRequest.setHeader("Content-Type", "application/json");
            httpRequest.setHeader("Accept", "application/json");

            // Audit/metadata headers — not used for authorization in Lambda
            httpRequest.setHeader("X-Jira-User", jiraUser);
            if (issueKey != null) {
                httpRequest.setHeader("X-Jira-Issue", issueKey);
            }

            try (var httpResponse = httpClient.execute(httpRequest)) {
                int status = httpResponse.getStatusLine().getStatusCode();
                String responseBody = httpResponse.getEntity() != null
                        ? EntityUtils.toString(httpResponse.getEntity(), StandardCharsets.UTF_8)
                        : "";

                return Response.status(status)
                        .entity(responseBody)
                        .type(MediaType.APPLICATION_JSON)
                        .build();
            }
        } catch (IOException e) {
            // Sync service unreachable
            return Response.status(503)
                    .entity("{\"error\":{\"code\":\"SYNC_SERVICE_UNAVAILABLE\","
                            + "\"message\":\"Could not reach the Figma sync service. "
                            + "Check connectivity and admin configuration.\"}}")
                    .build();
        }
    }

    private HttpRequestBase buildHttpRequest(String method, String url, String body) throws IOException {
        switch (method.toUpperCase()) {
            case "GET":    return new HttpGet(url);
            case "DELETE": return new HttpDelete(url);
            case "POST": {
                HttpPost post = new HttpPost(url);
                if (body != null) post.setEntity(new StringEntity(body, StandardCharsets.UTF_8));
                return post;
            }
            case "PATCH": {
                HttpPatch patch = new HttpPatch(url);
                if (body != null) patch.setEntity(new StringEntity(body, StandardCharsets.UTF_8));
                return patch;
            }
            default:
                throw new IllegalArgumentException("Unsupported HTTP method: " + method);
        }
    }

    private String getCurrentJiraUsername() {
        try {
            var user = authContext.getLoggedInUser();
            return user != null ? user.getUsername() : "anonymous";
        } catch (Exception e) {
            return "unknown";
        }
    }

    /** Extracts the issue key from a path like "issues/PROJ-123/links" */
    private String extractIssueKeyFromPath(String path) {
        if (path == null || !path.startsWith("issues/")) return null;
        String[] parts = path.split("/");
        return parts.length >= 2 ? parts[1] : null;
    }
}
