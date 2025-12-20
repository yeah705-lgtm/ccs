# CCS Product Development Requirements (PDR)

Last Updated: 2025-12-19

## Product Overview

**Product Name**: CCS (Claude Code Switch)

**Tagline**: The universal AI profile manager for Claude Code

**Description**: CLI wrapper enabling seamless switching between multiple Claude accounts and alternative AI providers (GLM, Gemini, Codex) with a React-based dashboard for configuration management.

---

## Problem Statement

Developers using Claude Code face these challenges:

1. **Single Account Limitation**: Cannot run multiple Claude subscriptions simultaneously
2. **Provider Lock-in**: Stuck with Anthropic's API, cannot use alternatives
3. **No Concurrent Sessions**: Cannot work on different projects with different accounts
4. **Complex Configuration**: Manual env var and config file management

---

## Solution

CCS provides:

1. **Multi-Account Claude**: Isolated instances via `CLAUDE_CONFIG_DIR`
2. **OAuth Providers**: Zero-config Gemini, Codex, Antigravity integration
3. **API Profiles**: GLM, Kimi, any Anthropic-compatible API
4. **Visual Dashboard**: React SPA for configuration management
5. **Automatic WebSearch**: MCP fallback for third-party providers

---

## Target Users

| User Type | Use Case | Primary Features |
|-----------|----------|------------------|
| Individual Developer | Work/personal separation | Multi-account Claude |
| Agency/Contractor | Client account isolation | Profile switching |
| Cost-conscious Dev | GLM for bulk operations | API profiles |
| Enterprise | Custom LLM integration | OpenAI-compatible endpoints |

---

## Functional Requirements

### FR-001: Profile Switching
- Switch between profiles with `ccs <profile>` command
- Support default profile when no argument provided
- Pass through all Claude CLI arguments

### FR-002: Multi-Account Claude
- Create isolated Claude instances
- Maintain separate sessions, todolists, logs per account
- Share commands, skills, agents across accounts

### FR-003: OAuth Provider Integration
- Support Gemini, Codex, Antigravity OAuth flows
- Browser-based authentication
- Token caching and refresh

### FR-004: API Profile Management
- Configure custom API endpoints
- Support Anthropic-compatible APIs
- Model mapping and configuration

### FR-005: Dashboard UI
- Visual profile management
- Real-time health monitoring
- Usage analytics

### FR-006: Health Diagnostics
- Verify Claude CLI installation
- Check config file integrity
- Validate symlinks and permissions

### FR-007: WebSearch Fallback
- Auto-configure MCP web search for third-party profiles
- Support Gemini CLI, Brave, Tavily providers
- Graceful fallback chain

---

## Non-Functional Requirements

### NFR-001: Performance
- CLI startup < 100ms
- Dashboard load < 2s
- Minimal memory footprint

### NFR-002: Reliability
- Idempotent operations
- Graceful error handling
- Automatic recovery where possible

### NFR-003: Security
- Local-only proxy binding (127.0.0.1)
- No credential exposure in logs
- Secure token storage

### NFR-004: Cross-Platform
- Support Linux, macOS, Windows
- Bash 3.2+, PowerShell 5.1+, Node.js 14+
- Identical behavior across platforms

### NFR-005: Maintainability
- Files < 200 lines
- Domain-based organization
- Barrel exports for clean imports

---

## Technical Requirements

### TR-001: Runtime Dependencies
- Node.js 14+ or Bun 1.0+
- Claude Code CLI installed
- Internet access for OAuth/API calls

### TR-002: Optional Dependencies
- CLIProxyAPI binary (auto-managed)
- Gemini CLI for WebSearch
- Additional MCP servers

### TR-003: Configuration
- YAML-based config (`~/.ccs/config.yaml`)
- JSON settings per profile
- Environment variable overrides

---

## Architecture Constraints

### AC-001: CLI-First Design
- All features accessible via CLI
- Dashboard is convenience layer, not required
- Scriptable and automatable

### AC-002: Non-Invasive
- Never modify `~/.claude/settings.json`
- Use environment variables for configuration
- Reversible changes only

### AC-003: Proxy Pattern
- Use local proxy for provider routing
- Claude CLI communicates with localhost
- Proxy handles upstream API calls

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Startup time | < 100ms | TBD |
| Dashboard load | < 2s | TBD |
| Error rate | < 1% | TBD |
| Test coverage | > 80% | TBD |
| File size compliance | 100% < 200 lines | 85% |

---

## Release Criteria

### v1.0 Release (Current)
- [x] Multi-account Claude support
- [x] OAuth provider integration (Gemini, Codex, AGY)
- [x] API profile management
- [x] Dashboard UI
- [x] Health diagnostics
- [x] WebSearch fallback
- [x] Cross-platform support

### v1.1 Release (Planned)
- [ ] Settings page modularization
- [ ] Enhanced analytics
- [ ] Profile templates
- [ ] Improved error messages

### v2.0 Release (Future)
- [ ] Team collaboration features
- [ ] Cloud sync for profiles
- [ ] Plugin system
- [ ] CLI extension framework

---

## Dependencies

### External Services
- Anthropic Claude API
- Google Gemini API
- GitHub Codex API
- Z.AI GLM API

### Third-Party Libraries
- Express.js (web server)
- React (dashboard)
- Vite (build tool)
- shadcn/ui (UI components)
- CLIProxyAPI (proxy binary)

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude CLI API changes | Medium | High | Version pinning, compatibility layer |
| Provider API deprecation | Low | High | Fallback chain, multiple providers |
| OAuth token expiry | Medium | Medium | Auto-refresh, clear error messages |
| Binary compatibility | Low | Medium | Multi-platform builds, fallback |

---

## Related Documentation

- [Codebase Summary](./codebase-summary.md) - Technical structure
- [Code Standards](./code-standards.md) - Development conventions
- [System Architecture](./system-architecture.md) - Architecture diagrams
- [Project Roadmap](./project-roadmap.md) - Development phases
