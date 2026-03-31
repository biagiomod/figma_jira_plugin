# jira-dc-plugin

Jira Data Center plugin for Figma for Jira DC.

This plugin is intentionally thin. It owns:
- Jira extension point registration (web panel, admin link)
- REST proxy endpoints at `/rest/figma-jira/1.0/...`
- Plugin configuration storage (API GW URL + API key via SAL PluginSettings)
- React frontend served as Jira web resources (issue panel + admin page)

It does NOT own: Figma API calls, persistence, sync logic, thumbnail generation.

## Structure

```
src/main/
├── java/com/yourorg/figurajira/
│   ├── config/PluginConfig.java             # Plugin settings read/write
│   └── rest/
│       ├── SyncServiceProxy.java            # Thin HTTP proxy to AWS
│       └── FigmaPanelContextProvider.java   # Velocity template context
├── resources/
│   ├── atlassian-plugin.xml                 # Plugin descriptor
│   ├── templates/figma-panel.vm             # Issue panel Velocity template
│   ├── figma-jira-i18n.properties           # i18n strings
│   └── frontend/                            # React source
│       ├── src/panel/FigmaPanel.tsx         # Issue panel React component
│       └── src/admin/AdminPage.tsx          # Admin config React component
```

## Prerequisites

- Java 11
- Maven 3.8+
- Atlassian Plugin SDK (`atlas-run` for local Jira DC)
- Valid Jira DC evaluation or commercial license
- pnpm (for building the React frontend)

## Build

```bash
# Build React frontend first (output goes into src/main/resources/static/)
cd src/main/resources/frontend
pnpm install
pnpm build

# Build plugin JAR
cd ../../../../../../   # back to jira-dc-plugin/
mvn package
```

## Local Jira DC

```bash
# Starts a local Jira DC instance with the plugin installed
mvn amps:run
# Jira available at: http://localhost:2990/jira
# Default credentials: admin / admin
```

## TODOs

- [ ] Implement Java admin servlet (GET/POST plugin config) for the admin page form
- [ ] Add i18n properties file (`figma-jira-i18n.properties`)
- [ ] Wire `FigmaPanelContextProvider` into `atlassian-plugin.xml` correctly
- [ ] Add unit tests for `SyncServiceProxy` (mock HttpClient)
- [ ] Tune iframe height / auto-resize behaviour for Jira DC sidebar
- [ ] Verify `atlassian-rest-common` version matches your Jira DC version

## Customisation

Replace `com.yourorg` throughout with your organisation's actual package name.
Update `groupId` in `pom.xml` and `atlassian.plugin.key` accordingly.
