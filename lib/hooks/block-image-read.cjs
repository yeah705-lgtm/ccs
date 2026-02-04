#!/usr/bin/env node
/**
 * CCS Image Read Blocking Hook
 *
 * Blocks Claude's Read tool from reading image files to prevent context overflow.
 * Each image can consume 100K+ tokens, causing immediate context exhaustion.
 *
 * This is a PreToolUse hook that runs BEFORE the tool is executed.
 *
 * Behavior (matches WebSearch pattern):
 * - ENABLED by default for third-party profiles (settings, cliproxy)
 * - DISABLED for native Claude accounts (account, default profiles)
 * - User can override via config: hooks.block_image_read.enabled: false
 *
 * Usage:
 *   Configured in ~/.claude/settings.json:
 *   {
 *     "hooks": {
 *       "PreToolUse": [{
 *         "matcher": "Read",
 *         "hooks": [{
 *           "type": "command",
 *           "command": "node ~/.ccs/hooks/block-image-read.cjs",
 *           "timeout": 5
 *         }]
 *       }]
 *     }
 *   }
 *
 * Environment Variables (set by CCS):
 *   CCS_BLOCK_IMAGE_READ=1    - Enable blocking (default for third-party)
 *   CCS_BLOCK_IMAGE_READ=0    - Disable blocking
 *   CCS_PROFILE_TYPE          - Profile type (account, default, settings, cliproxy)
 *   CCS_DEBUG=1               - Enable debug output
 *
 * Exit codes:
 *   0 - Allow tool (pass-through)
 *   2 - Block tool (deny with message)
 *
 * @module hooks/block-image-read
 */

// Image file extensions to block
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif|bmp|tiff|tif|ico|svg|heic|heif|avif)$/i;

// Read input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  processHook();
});

// Handle stdin not being available
process.stdin.on('error', () => {
  process.exit(0);
});

/**
 * Check if hook should skip (for native Claude accounts).
 * Matches WebSearch hook pattern.
 */
function shouldSkipHook() {
  // Account/default profiles use native Claude - don't block
  const profileType = process.env.CCS_PROFILE_TYPE;
  if (profileType === 'account' || profileType === 'default') {
    if (process.env.CCS_DEBUG) {
      console.error(`[CCS Hook] Skipping image block for profile type: ${profileType}`);
    }
    return true;
  }

  // Explicit disable via config
  if (process.env.CCS_BLOCK_IMAGE_READ === '0') {
    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Image read blocking disabled by config');
    }
    return true;
  }

  return false;
}

/**
 * Main hook processing logic
 */
function processHook() {
  try {
    // Skip for native accounts or explicit disable
    if (shouldSkipHook()) {
      process.exit(0);
    }

    const data = JSON.parse(input);

    // Only handle Read tool
    if (data.tool_name !== 'Read') {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path || '';

    if (process.env.CCS_DEBUG) {
      console.error(`[CCS Hook] Read intercepted: ${filePath}`);
    }

    // Check if file is an image
    if (IMAGE_EXTENSIONS.test(filePath)) {
      if (process.env.CCS_DEBUG) {
        console.error(`[CCS Hook] Blocking image read: ${filePath}`);
      }
      outputBlock(filePath);
      return;
    }

    // Allow non-image files
    process.exit(0);
  } catch (err) {
    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Parse error:', err.message);
    }
    // Don't block on parse errors
    process.exit(0);
  }
}

/**
 * Output block response and exit
 */
function outputBlock(filePath) {
  // Extract just the filename for cleaner display
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const message = [
    '[Image Read Blocked - Context Protection]',
    '',
    `File: ${fileName}`,
    `Path: ${filePath}`,
    '',
    'Image files consume 100K+ tokens each and will exhaust context.',
    '',
    'The image was generated successfully. To view it:',
    '  - Open the file path above in your image viewer',
    '  - Use your file manager to navigate to the location',
    '  - On macOS: open "' + filePath + '"',
    '  - On Linux: xdg-open "' + filePath + '"',
    '  - On Windows: start "" "' + filePath + '"',
    '',
    'If you need to analyze the image, use the ai-multimodal skill',
    'which processes images via Gemini API without loading into context.',
  ].join('\n');

  const output = {
    decision: 'block',
    reason: 'Image file blocked to prevent context overflow',
    // User-facing message (shows in CLI output)
    systemMessage: `[Image Read Blocked] ${fileName} - Open file directly to view.`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      // Claude reads this - explains what happened and alternatives
      permissionDecisionReason: message,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}
