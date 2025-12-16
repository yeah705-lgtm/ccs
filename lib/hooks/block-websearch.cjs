#!/usr/bin/env node
/**
 * CCS WebSearch Blocking Hook
 *
 * Blocks Claude's native WebSearch tool and redirects to MCP alternative.
 * This is a PreToolUse hook that runs BEFORE the tool is executed.
 *
 * WebSearch is a server-side tool executed by Anthropic's API.
 * Third-party providers (gemini, agy, codex, qwen) don't have access.
 *
 * Usage:
 *   Configured in ~/.claude/settings.json:
 *   {
 *     "hooks": {
 *       "PreToolUse": [{
 *         "matcher": "WebSearch",
 *         "hooks": [{
 *           "type": "command",
 *           "command": "node ~/.ccs/hooks/block-websearch.cjs",
 *           "timeout": 5
 *         }]
 *       }]
 *     }
 *   }
 *
 * Exit codes:
 *   0 - Allow tool (pass-through)
 *   2 - Block tool (deny with message)
 *
 * @module hooks/block-websearch
 */

// Read input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only block WebSearch tool
    if (data.tool_name === 'WebSearch') {
      const query = data.tool_input?.query || '';

      const output = {
        decision: 'block',
        reason: 'WebSearch unavailable with current provider',
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `WebSearch is not available with third-party providers. Use mcp__web-search-prime__webSearchPrime tool instead with the same query: "${query}"`,
        },
      };

      console.log(JSON.stringify(output));
      process.exit(2); // Exit code 2 = block
    }

    // Allow all other tools
    process.exit(0);
  } catch (err) {
    // Don't block on parse errors - allow tool to proceed
    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Parse error:', err.message);
    }
    process.exit(0);
  }
});

// Handle stdin not being available
process.stdin.on('error', () => {
  process.exit(0);
});
