# jira-dc-plugin

The Jira Data Center P2 plugin for Figma for Jira DC.

This plugin is intentionally thin. It owns extension point registration, a REST proxy to the AWS sync-service, plugin configuration storage, and the React frontend (issue panel + admin page). It does not contain Figma API calls, sync logic, persistence, or thumbnail generation — all of that lives in the AWS sync-service.

---

## What the Plugin Does

1. Registers a web panel on Jira issue pages that renders the React `FigmaPanel` component in an iframe
2. Exposes REST endpoints at `/rest/figma-jira/1.0/...` that proxy to the AWS API Gateway
3. Stores the API Gateway URL and API key in SAL PluginSettings (accessible from the Jira admin page)
4. Serves the React frontend as Jira web resources

The Java source contains no business logic. `SyncServiceProxy.java` constructs the outbound HTTP request, injects the `x-api-key` and `X-Jira-User` headers, and forwards the response.

---

## The `com.yourorg` Placeholder

The Java package and Maven groupId use `com.yourorg` as a placeholder. Before building, replace it with your organization's actual package name throughout:

| File | What to change |
|---|---|
| `pom.xml` | `<groupId>com.yourorg</groupId>` and `<atlassian.plugin.key>com.yourorg.figma-jira-dc</atlassian.plugin.key>` |
| `src/main/resources/atlassian-plugin.xml` | `key="com.yourorg.figma-jira-dc"` and all module keys prefixed with `com.yourorg` |
| All Java source files | Package declaration `package com.yourorg.figurajira;` and any import statements |
| Directory `src/main/java/com/yourorg/` | Rename to match your actual package (e.g. `com.acme`) |

A straightforward approach is to find-and-replace `com.yourorg` across the entire `apps/jira-dc-plugin/` directory before the first build.

---

## Structure

```
src/main/
├── java/com/yourorg/figurajira/
│   ├── config/PluginConfig.java             # Plugin settings read/write via SAL
│   └── rest/
│       └── SyncServiceProxy.java            # Thin HTTP proxy to AWS API Gateway
├── resources/
│   ├── atlassian-plugin.xml                 # Plugin descriptor (modules, web resources, REST endpoints)
│   ├── templates/figma-panel.vm             # Velocity template for the issue web panel
│   └── frontend/                            # React + Vite source
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── panel/FigmaPanel.tsx         # Issue panel component (full CRUD, status badge)
│           └── admin/AdminPage.tsx          # Admin config page component
└── pom.xml                                  # Maven build descriptor
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Java | 11 | Atlassian P2 requires Java 11 exactly |
| Maven | 3.8+ | `mvn package` to build the JAR |
| Atlassian Plugin SDK | latest | Provides `atlas-run`, `atlas-package`, local Jira DC runner |
| pnpm | 10+ | Build the React frontend |
| Jira DC license | any | Required to run `mvn amps:run` locally |

### Installing the Atlassian Plugin SDK

Follow the official guide: [developer.atlassian.com — Install the SDK](https://developer.atlassian.com/server/framework/atlassian-sdk/install-the-atlassian-sdk-on-a-linux-or-mac-system/)

The SDK configures Maven with Atlassian's repositories and provides the `atlas-*` command wrappers. After installation, `atlas-version` should print the SDK version.

---

## Build

### 1. Build the React frontend

The React frontend must be built before the Maven build packages the JAR. The Vite output goes into `src/main/resources/static/`, which Maven includes in the plugin JAR.

```bash
cd apps/jira-dc-plugin/src/main/resources/frontend
pnpm install
pnpm build
```

### 2. Build the plugin JAR

```bash
cd apps/jira-dc-plugin
mvn package
# Output: target/figma-jira-dc-<version>.jar
```

Note: `mvn package` has not been run in the development environment — the `pom.xml` and Java source follow Atlassian AMPS conventions but have not been verified against a live Maven build. If the build fails, the most likely cause is a version mismatch in `atlassian-rest-common` or `amps` relative to your target Jira DC version. Check `pom.xml` and update the versions to match your Jira DC instance.

---

## Local Jira DC Development

The Atlassian Plugin SDK can start a local Jira DC instance with the plugin hot-deployed:

```bash
cd apps/jira-dc-plugin
mvn amps:run
# Jira available at: http://localhost:2990/jira
# Default credentials: admin / admin
```

For active React development, run the Vite dev server separately:

```bash
cd src/main/resources/frontend
pnpm dev
# Open: http://localhost:5173/src/panel/index.html?issueKey=PROJ-123
```

The panel dev server does not require a running Jira instance. It renders the React component directly in the browser for faster UI iteration.

---

## How the Plugin Connects to AWS

The plugin reads two configuration values from SAL PluginSettings (set via the Jira admin page):

| Setting | Description |
|---|---|
| API Gateway URL | Base URL for the AWS sync-service (e.g. `https://abc123.execute-api.us-east-1.amazonaws.com/prod`) |
| API key | The `x-api-key` value from API Gateway |

`SyncServiceProxy.java` injects these on every outbound request. The Lambda functions receive the request via API Gateway after the key is validated.

Configuration steps:
1. Deploy the CDK stack and note the `ApiGatewayUrl` and API key outputs
2. Install the JAR in Jira Admin → Manage apps → Upload app
3. Go to Admin → Add-ons → Figma Integration
4. Enter the URL and API key, then save

---

## Items Not Yet Complete

The following must be resolved before the plugin is production-ready:

| Item | Notes |
|---|---|
| Java admin servlet | A GET/POST servlet for reading and writing plugin config from the admin page does not exist yet. `AdminPage.tsx` has a TODO where the save action should call this servlet. |
| i18n properties file | `figma-jira-i18n.properties` is referenced in `atlassian-plugin.xml` but the file has not been created. The Maven build will fail without it, or at minimum the plugin descriptor will have unresolved keys. Create the file with the keys referenced in `atlassian-plugin.xml`. |
| iframe height tuning | The web panel iframe height is set to a fixed value in the Velocity template. Auto-resize behavior for the Jira DC sidebar has not been implemented. |
| `atlassian-rest-common` version | Verify the version in `pom.xml` matches your target Jira DC version before building. |
| Unit tests for `SyncServiceProxy` | No unit tests exist for the Java proxy. Adding tests with a mock `HttpClient` is recommended before production. |
