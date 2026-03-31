package com.yourorg.figurajira.rest;

import com.atlassian.jira.issue.Issue;
import com.atlassian.jira.plugin.webfragment.contextproviders.AbstractJiraContextProvider;
import com.atlassian.jira.plugin.webfragment.model.JiraHelper;
import com.atlassian.jira.user.ApplicationUser;
import com.yourorg.figurajira.config.PluginConfig;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;

import java.util.Map;

/**
 * Provides context variables to the figma-panel.vm Velocity template.
 *
 * Variables injected:
 *   - issueKey:     the Jira issue key (e.g. PROJ-123)
 *   - isConfigured: whether the plugin has API GW URL + API key set
 *   - contextPath:  Jira context path for resource URL construction
 *
 * The panel template uses issueKey to build the iframe src URL.
 */
public class FigmaPanelContextProvider extends AbstractJiraContextProvider {

    private final PluginConfig pluginConfig;

    public FigmaPanelContextProvider(PluginSettingsFactory settingsFactory) {
        this.pluginConfig = new PluginConfig(settingsFactory);
    }

    @Override
    public Map<String, Object> getContextMap(ApplicationUser user, JiraHelper jiraHelper) {
        Map<String, Object> context = super.getContextMap(user, jiraHelper);

        Issue issue = (Issue) jiraHelper.getContextParams().get("issue");
        if (issue != null) {
            context.put("issueKey", issue.getKey());
        }

        context.put("isConfigured", pluginConfig.isConfigured());
        context.put("pluginKey", "com.yourorg.figma-jira-dc");

        return context;
    }
}
