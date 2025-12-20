# CCS System Architecture

Last Updated: 2025-12-19

High-level architecture documentation for the CCS (Claude Code Switch) system.

---

## System Overview

CCS is a CLI wrapper that enables seamless switching between multiple Claude accounts and alternative AI providers (GLM, Gemini, Codex). It consists of two main components:

1. **CLI Application** (`src/`) - Node.js TypeScript CLI
2. **Dashboard UI** (`ui/`) - React web application served by Express

```
+===========================================================================+
|                              CCS System                                    |
+===========================================================================+
|                                                                           |
|   +------------------+      +-----------------+      +----------------+   |
|   |   User Terminal  | ---> |   CCS CLI       | ---> | Claude Code    |   |
|   |   (ccs command)  |      |   (src/ccs.ts)  |      | CLI            |   |
|   +------------------+      +-----------------+      +----------------+   |
|                                    |                        |             |
|                                    v                        v             |
|   +------------------+      +-----------------+      +----------------+   |
|   |   Dashboard UI   | <--> |   Express       | ---> | Provider APIs  |   |
|   |   (React SPA)    |      |   Web Server    |      | (Claude/GLM/   |   |
|   +------------------+      +-----------------+      |  Gemini/etc)   |   |
|                                    |                 +----------------+   |
|                                    v                                      |
|                             +-----------------+                           |
|                             |   CLIProxyAPI   |                           |
|                             |   (Binary)      |                           |
|                             +-----------------+                           |
|                                                                           |
+===========================================================================+
```

---

## Component Architecture

### CLI Layer

```
+===========================================================================+
|                           CLI Architecture                                 |
+===========================================================================+

  User Input (ccs <profile> [args])
        |
        v
  +-------------+
  |   ccs.ts    |  Entry point, command routing
  +-------------+
        |
        +---> [Version/Help/Doctor/etc.] ---> Exit
        |
        v
  +-------------+
  |  Profile    |  Determines execution path
  |  Detection  |
  +-------------+
        |
        +---> [Native Claude Account] ---> execClaude()
        |                                       |
        +---> [CLIProxy Provider] ---> execClaudeWithCLIProxy()
        |                                       |
        +---> [GLMT Profile] ---> execClaudeWithProxy()
        |
        v
  +-------------+
  |  Claude CLI |  Underlying Anthropic CLI
  +-------------+
```

### Profile Mechanisms (Priority Order)

```
  Profile Resolution
        |
        v
  1. CLIProxy Hardcoded ----+---> gemini, codex, agy
     (OAuth-based)          |     Zero-config OAuth providers
                            |
  2. CLIProxy Variants -----+---> config.cliproxy section
     (User-defined)         |     Custom provider configurations
                            |
  3. Settings-based --------+---> config.profiles section
     (API key profiles)     |     GLM, GLMT, Kimi, custom
                            |
  4. Account-based ---------+---> profiles.json
     (Claude instances)     |     Isolated via CLAUDE_CONFIG_DIR
                            |
        v
     Profile Config
```

---

## Module Architecture

### CLI Modules (`src/`)

```
+===========================================================================+
|                         CLI Module Structure                               |
+===========================================================================+

  +------------------+     +------------------+     +------------------+
  |     commands/    |     |      auth/       |     |     config/      |
  |------------------|     |------------------|     |------------------|
  | doctor-command   |     | account-switcher |     | unified-config-  |
  | help-command     |     | profile-detector |     |   loader         |
  | install-command  |     | commands/        |     | migration-manager|
  | sync-command     |     +------------------+     +------------------+
  | update-command   |
  +------------------+
           |                       |                        |
           +-----------------------+------------------------+
                                   |
                                   v
  +------------------+     +------------------+     +------------------+
  |    cliproxy/     |     |     copilot/     |     |      glmt/       |
  |------------------|     |------------------|     |------------------|
  | cliproxy-executor|     | copilot-package- |     | glmt-proxy       |
  | config-generator |     |   manager        |     | delta-accumulator|
  | account-manager  |     | [copilot logic]  |     | pipeline/        |
  | auth/            |     +------------------+     +------------------+
  | binary/          |
  | services/        |
  +------------------+
           |                       |                        |
           +-----------------------+------------------------+
                                   |
                                   v
  +------------------+     +------------------+     +------------------+
  |    web-server/   |     |      utils/      |     |     errors/      |
  |------------------|     |------------------|     |------------------|
  | routes/ (15+)    |     | ui/ (boxes,      |     | error-handler    |
  | health/          |     |     colors,      |     | exit-codes       |
  | usage/           |     |     spinners)    |     | cleanup          |
  | services/        |     | websearch/       |     +------------------+
  | model-pricing    |     | shell-executor   |
  +------------------+     +------------------+

                                   |
                                   v
  +------------------+     +------------------+
  |      types/      |     |   management/    |
  |------------------|     |------------------|
  | config.ts        |     | checks/          |
  | cli.ts           |     | repair/          |
  | delegation.ts    |     | [diagnostics]    |
  | glmt.ts          |     +------------------+
  +------------------+
```

### UI Modules (`ui/src/`)

```
+===========================================================================+
|                         UI Module Structure                                |
+===========================================================================+

  +------------------+
  |     pages/       |  Route-level components
  |------------------|
  | analytics.tsx    |
  | api.tsx          |
  | cliproxy.tsx     |
  | copilot.tsx      |
  | health.tsx       |
  | settings.tsx     |
  +------------------+
           |
           v
  +------------------+     +------------------+     +------------------+
  |   components/    |     |    contexts/     |     |     hooks/       |
  |------------------|     |------------------|     |------------------|
  | account/         |     | privacy-context  |     | use-accounts     |
  | analytics/       |     | theme-context    |     | use-cliproxy     |
  | cliproxy/        |     | websocket-context|     | use-health       |
  | copilot/         |     +------------------+     | use-profiles     |
  | health/          |                             | use-websocket    |
  | layout/          |                             +------------------+
  | monitoring/      |
  | profiles/        |
  | setup/           |
  | shared/          |
  | ui/ (shadcn)     |
  +------------------+
           |
           v
  +------------------+     +------------------+
  |      lib/        |     |    providers/    |
  |------------------|     |------------------|
  | api.ts           |     | websocket-       |
  | model-catalogs   |     |   provider       |
  | utils.ts         |     +------------------+
  +------------------+
```

---

## Data Flow Architecture

### CLI Execution Flow

```
+===========================================================================+
|                        CLI Execution Flow                                  |
+===========================================================================+

  1. Parse Arguments
        |
        v
  2. Detect Profile Type
        |
        +---> Native Claude ---> 3a. Load Account Settings
        |                              |
        |                              v
        |                        4a. Set CLAUDE_CONFIG_DIR
        |                              |
        |                              v
        |                        5a. Spawn Claude CLI
        |
        +---> CLIProxy -------> 3b. Ensure Binary Installed
        |                              |
        |                              v
        |                        4b. Generate Config
        |                              |
        |                              v
        |                        5b. Start CLIProxyAPI
        |                              |
        |                              v
        |                        6b. Set Proxy Env Vars
        |                              |
        |                              v
        |                        7b. Spawn Claude CLI
        |
        +---> GLMT -----------> 3c. Start Embedded Proxy
                                       |
                                       v
                                 4c. Spawn Claude CLI
```

### Dashboard Data Flow

```
+===========================================================================+
|                      Dashboard Data Flow                                   |
+===========================================================================+

  Browser (React SPA)
        |
        | HTTP Requests + WebSocket
        v
  Express Server (src/web-server/)
        |
        +---> /api/accounts ---> auth/account-manager
        |
        +---> /api/profiles ---> config/unified-config-loader
        |
        +---> /api/cliproxy ---> cliproxy/
        |
        +---> /api/health ----> management/checks/
        |
        +---> /api/usage -----> usage/aggregator
        |
        v
  WebSocket (Real-time)
        |
        +---> Health status updates
        +---> Auth state changes
        +---> Usage analytics
```

---

## Provider Integration Architecture

### CLIProxyAPI Flow

```
+===========================================================================+
|                      CLIProxyAPI Integration                               |
+===========================================================================+

  Claude CLI
        |
        | ANTHROPIC_BASE_URL = localhost:XXXX
        v
  +------------------+
  |   CLIProxyAPI    |  Local proxy binary
  |   (binary)       |
  +------------------+
        |
        +---> OAuth Authentication (Gemini, Codex, AGY)
        |           |
        |           v
        |     +------------------+
        |     |   OAuth Server   |  Browser-based auth
        |     +------------------+
        |
        +---> Request Transformation
        |           |
        |           v
        |     Anthropic Format --> Provider Format
        |
        +---> Provider APIs
                    |
                    +---> Google (Gemini)
                    +---> GitHub (Codex)
                    +---> Antigravity
                    +---> OpenAI-compatible endpoints
```

### GLMT Proxy Flow

```
+===========================================================================+
|                        GLMT Proxy Integration                              |
+===========================================================================+

  Claude CLI
        |
        | ANTHROPIC_BASE_URL = localhost:XXXX
        v
  +------------------+
  |   GLMT Proxy     |  Embedded Node.js proxy (src/glmt/)
  |   (glmt-proxy.ts)|
  +------------------+
        |
        v
  +------------------+
  | Delta Accumulator|  Stream transformation
  +------------------+
        |
        v
  +------------------+
  |   Pipeline       |  Request/Response transformation
  +------------------+
        |
        v
  +------------------+
  |   GLM API        |  Z.AI / Kimi API
  +------------------+
```

---

## Configuration Architecture

### Config File Hierarchy

```
+===========================================================================+
|                     Configuration Hierarchy                                |
+===========================================================================+

  ~/.ccs/
    |
    +---> config.yaml              # Main CCS config (unified)
    |
    +---> profiles.json            # Claude account registry
    |
    +---> <profile>.settings.json  # Per-profile settings
    |
    +---> cliproxy/
    |       |
    |       +---> config.yaml      # CLIProxy configuration
    |       +---> auth/            # OAuth tokens
    |       +---> bin/             # CLIProxy binary
    |
    +---> shared/                  # Symlinked resources
            |
            +---> commands/        # Claude Code commands
            +---> skills/          # Custom skills
            +---> agents/          # Agent configurations
```

### Config Loading Order

```
  1. Environment Variables (highest priority)
        |
        v
  2. CLI Arguments
        |
        v
  3. Profile-specific settings (~/.ccs/<profile>.settings.json)
        |
        v
  4. Main config (~/.ccs/config.yaml)
        |
        v
  5. Default values (lowest priority)
```

---

## WebSocket Architecture

### Real-time Communication

```
+===========================================================================+
|                     WebSocket Communication                                |
+===========================================================================+

  Dashboard (React)                     Server (Express)
        |                                      |
        |<------ Connection Established ------>|
        |                                      |
        |<------ health:update ----------------|  Health status
        |                                      |
        |<------ auth:status ------------------|  Auth changes
        |                                      |
        |<------ usage:update -----------------|  Usage stats
        |                                      |
        |------- action:refresh -------------->|  User requests
        |                                      |
```

---

## Security Architecture

### Authentication Flow

```
+===========================================================================+
|                      Authentication Flow                                   |
+===========================================================================+

  OAuth Providers (Gemini, Codex, AGY)
  -----------------------------------

  1. User runs: ccs gemini
        |
        v
  2. Check token cache (~/.ccs/cliproxy/auth/)
        |
        +---> [Valid token] ---> Use cached token
        |
        +---> [No/Expired token]
                    |
                    v
  3. Open browser for OAuth
        |
        v
  4. Callback with auth code
        |
        v
  5. Exchange for access token
        |
        v
  6. Cache token locally


  API Key Profiles (GLM, Kimi)
  ----------------------------

  1. User configures API key in settings
        |
        v
  2. Key stored in ~/.ccs/<profile>.settings.json
        |
        v
  3. Key passed via ANTHROPIC_AUTH_TOKEN env var
```

### Security Boundaries

```
  +------------------+
  | User Terminal    |
  +------------------+
        |
        | Local only (no network exposure)
        v
  +------------------+
  | CCS CLI          |
  +------------------+
        |
        | Localhost only (127.0.0.1)
        v
  +------------------+
  | CLIProxy/GLMT    |  Binds to localhost only
  +------------------+
        |
        | TLS encrypted
        v
  +------------------+
  | Provider APIs    |  External endpoints
  +------------------+
```

---

## Build and Distribution

### Build Pipeline

```
+===========================================================================+
|                        Build Pipeline                                      |
+===========================================================================+

  src/ (TypeScript)                    ui/src/ (React TSX)
        |                                      |
        v                                      v
  TypeScript Compiler                  Vite Build
        |                                      |
        v                                      v
  dist/ (JavaScript)                   dist/ui/ (Static assets)
        |                                      |
        +---------------+---------------------+
                        |
                        v
               npm package (@kaitranntt/ccs)
                        |
                        v
               npm registry / GitHub releases
```

### Package Contents

```
  @kaitranntt/ccs
        |
        +---> dist/           # Compiled CLI
        +---> dist/ui/        # Built dashboard
        +---> lib/            # Native scripts
        |       +---> ccs     # Bash bootstrap
        |       +---> ccs.ps1 # PowerShell bootstrap
        +---> package.json
```

---

## Deployment Architecture

### Local Installation

```
  npm install -g @kaitranntt/ccs
        |
        v
  Global node_modules
        |
        +---> Creates symlink: ccs --> dist/ccs.js
        |
        +---> First run creates: ~/.ccs/
```

### Runtime Dependencies

```
  +------------------+     +------------------+
  |   Node.js 14+    |     |   Claude CLI     |
  |   (required)     |     |   (required)     |
  +------------------+     +------------------+

  +------------------+     +------------------+
  |   CLIProxyAPI    |     |   Gemini CLI     |
  |   (auto-managed) |     |   (optional)     |
  +------------------+     +------------------+
```

---

## Related Documentation

- [Codebase Summary](./codebase-summary.md) - Detailed directory structure
- [Code Standards](./code-standards.md) - Coding conventions
- [Project Roadmap](./project-roadmap.md) - Development phases
- [WebSearch](./websearch.md) - WebSearch feature details
