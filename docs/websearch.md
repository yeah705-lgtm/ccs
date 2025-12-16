# WebSearch Configuration Guide

CCS provides automatic web search capability for all profiles, including third-party providers that cannot access Anthropic's native WebSearch API.

## How WebSearch Works

### Native Claude Accounts

When using a native Claude subscription account, WebSearch is handled by Anthropic's server-side API ($10/1000 searches, usage-based billing).

### Third-Party Profiles

Third-party profiles (OAuth and API-based) cannot use Anthropic's WebSearch because:
- Claude Code CLI executes tools locally
- CLIProxyAPI only receives conversation messages
- Tool execution never reaches the third-party backend

CCS solves this by automatically configuring MCP (Model Context Protocol) web search servers.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Claude Code CLI                             │
│                                                               │
│  WebSearch Tool Request                                       │
│       │                                                       │
│       ├── Native Claude Account? → Anthropic WebSearch API   │
│       │                            ($10/1000 searches)        │
│       │                                                       │
│       └── Third-party Profile? → MCP Fallback Chain          │
│                                   │                           │
│                                   ├── 1. web-search-prime     │
│                                   ├── 2. Brave Search (free)  │
│                                   └── 3. Tavily (paid)        │
└──────────────────────────────────────────────────────────────┘
```

## MCP Providers

| Provider | Type | Cost | API Key Required | Notes |
|----------|------|------|------------------|-------|
| web-search-prime | HTTP MCP | Free | No | Primary, always available |
| Brave Search | stdio MCP | Free tier | `BRAVE_API_KEY` | 15k queries/month |
| Tavily | stdio MCP | Paid | `TAVILY_API_KEY` | AI-optimized search |

## Configuration

### Via Dashboard

1. Open dashboard: `ccs config`
2. Navigate to **Settings** page
3. Configure WebSearch options:
   - **Enable/Disable**: Toggle auto-configuration
   - **Provider**: Choose preferred provider
   - **Fallback**: Enable/disable fallback chain

### Via Config File

Edit `~/.ccs/config.yaml`:

```yaml
websearch:
  enabled: true                    # Enable auto-config (default: true)
  provider: auto                   # auto | web-search-prime | brave | tavily
  fallback: true                   # Enable fallback chain (default: true)
  webSearchPrimeUrl: "https://..."  # Optional: custom endpoint
```

### Provider Options

- **auto** (default): Uses web-search-prime, adds Brave/Tavily if API keys available
- **web-search-prime**: Free, no API key needed
- **brave**: Requires `BRAVE_API_KEY` env var
- **tavily**: Requires `TAVILY_API_KEY` env var

## Setting Up Optional Providers

### Brave Search (Free Tier)

1. Get API key: [brave.com/search/api](https://brave.com/search/api)
2. Set environment variable:
   ```bash
   export BRAVE_API_KEY="your-api-key"
   ```
3. Restart CCS - Brave will be added to fallback chain

**Free tier limits**: 15,000 queries/month, 1 query/second

### Tavily (AI-Optimized)

1. Get API key: [tavily.com](https://tavily.com)
2. Set environment variable:
   ```bash
   export TAVILY_API_KEY="your-api-key"
   ```
3. Restart CCS - Tavily will be added to fallback chain

## MCP Configuration

CCS writes MCP configuration to `~/.claude/.mcp.json`. Example:

```json
{
  "mcpServers": {
    "web-search-prime": {
      "type": "http",
      "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
      "headers": {}
    },
    "brave-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "..." }
    }
  }
}
```

## Troubleshooting

### WebSearch Not Working

1. **Check config**: Ensure `websearch.enabled: true` in config
2. **Verify MCP**: Check `~/.claude/.mcp.json` exists
3. **Debug mode**: Run with `CCS_DEBUG=1 ccs gemini` for verbose output

### MCP Server Errors

1. **Network issues**: web-search-prime requires internet access
2. **npx failures**: Brave/Tavily require Node.js and npx
3. **API key issues**: Verify env vars are set correctly

### Existing MCP Config

CCS respects existing web search MCP configuration. If you have manually configured web search MCPs, CCS will not overwrite them.

To reset:
1. Remove web search entries from `~/.claude/.mcp.json`
2. Run any CCS third-party profile to regenerate

## Security Considerations

- API keys are stored in environment variables only
- Never commit API keys to version control
- Use `.env` files with proper permissions (chmod 600)
- Dashboard settings are stored in `~/.ccs/config.yaml` (no API keys)
