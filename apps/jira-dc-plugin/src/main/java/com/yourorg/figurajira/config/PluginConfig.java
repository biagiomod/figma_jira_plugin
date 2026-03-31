package com.yourorg.figurajira.config;

import com.atlassian.sal.api.pluginsettings.PluginSettings;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;

/**
 * Reads and writes plugin-level configuration using Jira's SAL PluginSettings API.
 *
 * Stored settings:
 *   - AWS API Gateway base URL  (e.g. https://xxx.execute-api.us-east-1.amazonaws.com/v1)
 *   - API key                   (shared secret between Jira plugin and AWS API Gateway)
 *
 * These are the only values this plugin stores. No Figma tokens, no user credentials.
 * All secrets live in AWS Secrets Manager — not here.
 *
 * PluginSettings persists across restarts in Jira's shared configuration store.
 * In Jira Data Center, settings are cluster-replicated automatically.
 */
public class PluginConfig {

    private static final String KEY_API_GW_URL = "figma-jira.apiGatewayUrl";
    private static final String KEY_API_KEY    = "figma-jira.apiKey";

    private final PluginSettings settings;

    public PluginConfig(PluginSettingsFactory factory) {
        this.settings = factory.createGlobalSettings();
    }

    public String getApiGatewayUrl() {
        Object val = settings.get(KEY_API_GW_URL);
        return val instanceof String ? (String) val : "";
    }

    public void setApiGatewayUrl(String url) {
        settings.put(KEY_API_GW_URL, url != null ? url.trim() : "");
    }

    public String getApiKey() {
        Object val = settings.get(KEY_API_KEY);
        return val instanceof String ? (String) val : "";
    }

    public void setApiKey(String apiKey) {
        settings.put(KEY_API_KEY, apiKey != null ? apiKey.trim() : "");
    }

    /**
     * Returns true if the plugin is configured with both a URL and an API key.
     * Used by the proxy to short-circuit unconfigured deployments with a clear error.
     */
    public boolean isConfigured() {
        return !getApiGatewayUrl().isEmpty() && !getApiKey().isEmpty();
    }
}
