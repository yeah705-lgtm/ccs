#!/usr/bin/env node
/**
 * CCS Image Analyzer Hook - Read Tool Interceptor
 *
 * Intercepts Claude's Read tool for image/PDF files and analyzes them via CLIProxy.
 * Returns detailed text descriptions instead of allowing direct visual access.
 *
 * Environment Variables (set by CCS):
 *   CCS_IMAGE_ANALYSIS_SKIP=1                 - Skip this hook entirely
 *   CCS_IMAGE_ANALYSIS_ENABLED=1              - Enable image analysis (default: 1)
 *   CCS_IMAGE_ANALYSIS_PROVIDER_MODELS        - Provider:model mapping (e.g., agy:gemini-2.5-flash,gemini:gemini-2.5-flash)
 *   CCS_CURRENT_PROVIDER                      - Current CLIProxy provider (e.g., agy, gemini, codex)
 *   CCS_IMAGE_ANALYSIS_TIMEOUT=60             - Timeout in seconds (default: 60)
 *   CCS_PROFILE_TYPE                          - Profile type (account/default skip)
 *   CCS_DEBUG=1                               - Enable debug output
 *
 * Exit codes:
 *   0 - Allow tool (pass-through to native Read)
 *   2 - Block tool (deny with analysis/message)
 *
 * @module hooks/image-analyzer-transformer
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

const isWindows = process.platform === 'win32';

// ============================================================================
// CONFIGURATION
// ============================================================================

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.tiff'];
const PDF_EXTENSIONS = ['.pdf'];

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_SEC = 60;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CLIPROXY_HOST = '127.0.0.1';
const CLIPROXY_PORT = parseInt(process.env.CCS_CLIPROXY_PORT || '8317', 10);
const CLIPROXY_PATH = '/v1/messages';
// API key passed via env from cliproxy-executor, defaults to CCS internal key
const CLIPROXY_API_KEY = process.env.CCS_CLIPROXY_API_KEY || 'ccs-internal-managed';

// ============================================================================
// ERROR CODES (for categorization)
// ============================================================================

const ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CLIPROXY_UNAVAILABLE: 'CLIPROXY_UNAVAILABLE',
  AUTH_FAILED: 'AUTH_FAILED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  API_ERROR: 'API_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  UNKNOWN: 'UNKNOWN',
};

// Default analysis prompt
const DEFAULT_PROMPT = `Analyze this image/document thoroughly and provide a detailed description.

Include:
1. Overall content and purpose
2. Text content (if any) - transcribe important text
3. Visual elements (diagrams, charts, UI components)
4. Layout and structure
5. Colors, styling, notable design elements
6. Any actionable information (buttons, links, code)

Be comprehensive - this description replaces direct visual access.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Output debug information to stderr
 * Only outputs when CCS_DEBUG=1
 */
function debugLog(message, data = {}) {
  if (!process.env.CCS_DEBUG) return;

  const lines = [`[CCS Hook] ${message}`];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  console.error(lines.join('\n'));
}

/**
 * Get detailed debug context
 */
function getDebugContext(filePath, stats) {
  const currentProvider = process.env.CCS_CURRENT_PROVIDER || 'unknown';
  const providerModels = parseProviderModels(process.env.CCS_IMAGE_ANALYSIS_PROVIDER_MODELS);
  const model = providerModels[currentProvider] || DEFAULT_MODEL;
  const timeout = parseInt(process.env.CCS_IMAGE_ANALYSIS_TIMEOUT || DEFAULT_TIMEOUT_SEC, 10);
  const isDefaultModel = !providerModels[currentProvider];

  return {
    file: path.basename(filePath),
    size: stats ? `${(stats.size / 1024).toFixed(1)} KB` : 'unknown',
    provider: currentProvider,
    model: model,
    config: isDefaultModel ? 'default' : 'user-configured',
    timeout: `${timeout}s`,
    endpoint: `http://${CLIPROXY_HOST}:${CLIPROXY_PORT}${CLIPROXY_PATH}`,
  };
}

/**
 * Get current provider/model context for error messages
 */
function getProviderContext() {
  const provider = process.env.CCS_CURRENT_PROVIDER || 'unknown';
  const providerModels = parseProviderModels(process.env.CCS_IMAGE_ANALYSIS_PROVIDER_MODELS);
  const model = providerModels[provider] || DEFAULT_MODEL;
  return { provider, model };
}

/**
 * Parse provider_models env var to object
 * Format: provider:model,provider:model
 */
function parseProviderModels(envValue) {
  if (!envValue) return {};
  const result = {};
  envValue.split(',').forEach((pair) => {
    const [provider, model] = pair.split(':');
    if (provider && model && model.trim()) {
      result[provider.trim()] = model.trim();
    }
  });
  return result;
}

/**
 * Get model for current provider from provider_models mapping
 */
function getModelForProvider() {
  const currentProvider = process.env.CCS_CURRENT_PROVIDER || '';
  const providerModels = parseProviderModels(process.env.CCS_IMAGE_ANALYSIS_PROVIDER_MODELS);
  return providerModels[currentProvider] || DEFAULT_MODEL;
}

/**
 * Check if file is an analyzable image or PDF
 */
function isAnalyzableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) || PDF_EXTENSIONS.includes(ext);
}

/**
 * Get MIME type from file extension
 */
function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Encode file to base64
 */
function encodeFileToBase64(filePath) {
  const content = fs.readFileSync(filePath);
  return content.toString('base64');
}

/**
 * Check if CLIProxy is available
 */
function isCliProxyAvailable() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: CLIPROXY_HOST,
        port: CLIPROXY_PORT,
        path: '/',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Analyze file via CLIProxy vision API
 */
function analyzeViaCliProxy(base64Data, mediaType, model, timeoutMs) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: DEFAULT_PROMPT },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const req = http.request(
      {
        hostname: CLIPROXY_HOST,
        port: CLIPROXY_PORT,
        path: CLIPROXY_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'x-api-key': CLIPROXY_API_KEY,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('error', (err) => {
          reject(err);
        });

        res.on('end', () => {
          // Categorize by status code
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error(`AUTH_ERROR:${res.statusCode}`));
            return;
          }

          if (res.statusCode === 429) {
            const retryAfter = res.headers['retry-after'];
            reject(new Error(`RATE_LIMIT:${retryAfter || ''}`));
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`API_ERROR:${res.statusCode}:${data}`));
            return;
          }

          if (!data || !data.trim()) {
            reject(new Error('Empty response from CLIProxy'));
            return;
          }

          try {
            const response = JSON.parse(data);
            const text = response.content?.[0]?.text;

            if (!text) {
              reject(new Error('No text content in response'));
              return;
            }

            resolve(text);
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Format analysis description for Claude (matches websearch format)
 */
function formatDescription(filePath, description, model, fileSize) {
  const sizeKB = fileSize ? (fileSize / 1024).toFixed(1) : '?';
  return [
    `[Image Analysis via CLIProxy]`,
    '',
    `File: ${path.basename(filePath)} (${sizeKB} KB)`,
    `Model: ${model}`,
    '',
    '---',
    '',
    description,
    '',
    '---',
    '*Use this description to understand the image content.*',
  ].join('\n');
}

// ============================================================================
// SPECIALIZED ERROR HANDLERS
// ============================================================================

/**
 * Format error output for Claude hook
 */
function formatErrorOutput(filePath, errorCode, message, troubleshooting) {
  const { provider, model } = getProviderContext();

  const lines = [
    `[Image Analysis - Error]`,
    '',
    `File: ${path.basename(filePath)}`,
    `Provider: ${provider} | Model: ${model}`,
    '',
    `Error: ${message}`,
  ];

  if (troubleshooting && troubleshooting.length > 0) {
    lines.push('');
    lines.push('Troubleshooting:');
    troubleshooting.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step}`);
    });
  }

  lines.push('');
  lines.push('For help: ccs config image-analysis --help');

  return {
    decision: 'block',
    reason: `Image analysis failed: ${errorCode}`,
    systemMessage: `[Image Analysis] Failed: ${message}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: lines.join('\n'),
    },
  };
}

/**
 * File too large error
 */
function outputFileTooLargeError(filePath, actualSizeMB, maxSizeMB) {
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.FILE_TOO_LARGE,
    `File too large (${actualSizeMB.toFixed(2)}MB > ${maxSizeMB}MB limit)`,
    [
      'Reduce image resolution or use compression',
      'For screenshots: use PNG optimizer (pngquant, optipng)',
      'For photos: resize to max 2048px width',
      `Current limit: ${maxSizeMB}MB per file`,
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * CLIProxy unavailable error
 */
function outputCliProxyUnavailableError(filePath, endpoint) {
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.CLIPROXY_UNAVAILABLE,
    `CLIProxy not available at ${endpoint}`,
    [
      'CLIProxy service may not be running',
      'Start with: ccs config (opens dashboard, starts CLIProxy)',
      'Or manually: ccs cliproxy start',
      `Verify: curl ${endpoint}`,
      'Check status: ccs doctor',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Authentication error
 */
function outputAuthError(filePath, statusCode) {
  const { provider } = getProviderContext();
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.AUTH_FAILED,
    `Authentication failed (HTTP ${statusCode})`,
    [
      `Re-authenticate: ccs ${provider} --auth`,
      `Check accounts: ccs ${provider} --accounts`,
      'Verify OAuth token is valid',
      'Check: ccs doctor',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Timeout error
 */
function outputTimeoutError(filePath, timeoutSec) {
  const { model } = getProviderContext();
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.TIMEOUT,
    `Request timed out after ${timeoutSec}s`,
    [
      'Large files or complex images take longer',
      `Increase timeout: ccs config image-analysis --timeout ${timeoutSec * 2}`,
      'Or via env: CCS_IMAGE_ANALYSIS_TIMEOUT=120',
      `Current model (${model}) may be slow - try a faster variant`,
      'Check CLIProxy health: curl http://127.0.0.1:8317',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Rate limit error
 */
function outputRateLimitError(filePath, retryAfterSec) {
  const { provider } = getProviderContext();
  const retryHint = retryAfterSec ? `Retry after ${retryAfterSec}s` : 'Wait a moment and retry';
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.RATE_LIMIT,
    'Rate limit exceeded',
    [
      retryHint,
      `Provider ${provider} has usage limits`,
      'Consider switching accounts: ccs ' + provider + ' --accounts',
      'Check quota: ccs cliproxy doctor',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Generic API error
 */
function outputApiError(filePath, statusCode, responseBody) {
  // Try to extract error message from response
  let errorDetail = `HTTP ${statusCode}`;
  try {
    const parsed = JSON.parse(responseBody);
    if (parsed.error?.message) {
      errorDetail = parsed.error.message;
    } else if (parsed.message) {
      errorDetail = parsed.message;
    }
  } catch {
    // Use raw body if not JSON (truncated)
    if (responseBody && responseBody.length < 100) {
      errorDetail = responseBody;
    }
  }

  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.API_ERROR,
    `API error: ${errorDetail}`,
    [
      'Check CLIProxy logs: ccs cleanup --show-logs',
      'Verify provider is authenticated: ccs doctor',
      'Try a different provider or model',
      'Report persistent issues: https://github.com/kaitranntt/ccs/issues',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * File permission error
 */
function outputFileAccessError(filePath, error) {
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.UNKNOWN,
    `File access denied: ${error}`,
    [
      'Check file permissions: ls -l ' + filePath,
      isWindows ? 'Run terminal as Administrator if needed' : 'Use sudo or adjust file ownership',
      'Verify file is readable by current user',
      'Move file to accessible location',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Unknown/fallback error (replaces old outputError)
 */
function outputUnknownError(filePath, error) {
  const output = formatErrorOutput(
    filePath,
    ERROR_CODES.UNKNOWN,
    error || 'Unknown error occurred',
    [
      'Check CLIProxy is running: curl http://127.0.0.1:8317',
      'Verify authentication: ccs doctor',
      'Check file is valid image/PDF',
      'Enable debug: CCS_DEBUG=1 ccs <provider>',
    ]
  );
  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Output success response and exit
 */
function outputSuccess(filePath, description, model, fileSize) {
  debugLog('Returning analysis result', {
    file: path.basename(filePath),
    model: model,
    descriptionLength: `${description.length} chars`,
  });

  const formattedDescription = formatDescription(filePath, description, model, fileSize);

  const output = {
    decision: 'block',
    reason: `Image analyzed: ${path.basename(filePath)}`,
    systemMessage: `[Image Analysis] ${path.basename(filePath)} analyzed via CLIProxy (${model})`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formattedDescription,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Determine if hook should skip, with debug logging
 */
function shouldSkipHook() {
  // Explicit skip signal
  if (process.env.CCS_IMAGE_ANALYSIS_SKIP === '1') {
    debugLog('Skipping: CCS_IMAGE_ANALYSIS_SKIP=1');
    return true;
  }

  // Explicit disable
  if (process.env.CCS_IMAGE_ANALYSIS_ENABLED === '0') {
    debugLog('Skipping: image analysis disabled (CCS_IMAGE_ANALYSIS_ENABLED=0)');
    return true;
  }

  // Account/default profiles - use native Read
  const profileType = process.env.CCS_PROFILE_TYPE;
  if (profileType === 'account' || profileType === 'default') {
    debugLog(`Skipping: profile type "${profileType}" uses native Read`);
    return true;
  }

  // Check if current provider has a vision model configured
  const currentProvider = process.env.CCS_CURRENT_PROVIDER || '';
  const providerModels = parseProviderModels(process.env.CCS_IMAGE_ANALYSIS_PROVIDER_MODELS);

  if (!providerModels[currentProvider]) {
    debugLog(`Skipping: provider "${currentProvider}" not in provider_models`, {
      configured_providers: Object.keys(providerModels).join(', ') || 'none',
    });
    return true;
  }

  return false;
}

// ============================================================================
// MAIN HOOK LOGIC
// ============================================================================

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
 * Main hook processing logic
 */
async function processHook() {
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

    if (!filePath) {
      process.exit(0);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // Let native Read handle the error
      process.exit(0);
    }

    // Check if file is analyzable
    if (!isAnalyzableFile(filePath)) {
      process.exit(0);
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size >= MAX_FILE_SIZE_BYTES) {
      outputFileTooLargeError(filePath, stats.size / 1024 / 1024, MAX_FILE_SIZE_MB);
      return;
    }

    // Check CLIProxy availability
    const cliProxyAvailable = await isCliProxyAvailable();
    if (!cliProxyAvailable) {
      debugLog('Skipping: CLIProxy not available', {
        endpoint: `http://${CLIPROXY_HOST}:${CLIPROXY_PORT}`,
        action: 'passing through to native Read',
      });
      // Pass through to native Read
      process.exit(0);
    }

    const model = getModelForProvider();
    const timeout = parseInt(process.env.CCS_IMAGE_ANALYSIS_TIMEOUT || DEFAULT_TIMEOUT_SEC, 10);
    const timeoutMs = Math.max(1, Math.min(600, timeout)) * 1000;

    // Get debug context before analysis
    const debugContext = getDebugContext(filePath, stats);
    debugLog('Starting image analysis', debugContext);

    // Encode file to base64
    const base64Data = encodeFileToBase64(filePath);
    const mediaType = getMediaType(filePath);

    debugLog('File encoded', {
      mediaType: mediaType,
      base64Length: `${(base64Data.length / 1024).toFixed(1)}KB`,
    });

    // Analyze via CLIProxy
    const description = await analyzeViaCliProxy(base64Data, mediaType, model, timeoutMs);

    debugLog('Analysis complete', {
      responseLength: `${description.length} chars`,
    });

    // Output success
    outputSuccess(filePath, description, model, stats.size);
  } catch (err) {
    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Error:', err.message);
    }

    // Try to extract file path from parsed input
    let filePath = 'unknown file';
    try {
      const data = JSON.parse(input);
      filePath = data.tool_input?.file_path || 'unknown file';
    } catch {
      // Ignore parse errors
    }

    // Categorize error by message pattern
    const errMsg = err.message || '';

    if (errMsg.startsWith('AUTH_ERROR:')) {
      const statusCode = parseInt(errMsg.split(':')[1], 10);
      outputAuthError(filePath, statusCode);
    } else if (errMsg.startsWith('RATE_LIMIT:')) {
      const retryAfter = errMsg.split(':')[1];
      outputRateLimitError(filePath, retryAfter ? parseInt(retryAfter, 10) : null);
    } else if (errMsg.startsWith('API_ERROR:')) {
      const parts = errMsg.split(':');
      const statusCode = parseInt(parts[1], 10);
      const body = parts.slice(2).join(':');
      outputApiError(filePath, statusCode, body);
    } else if (errMsg === 'TIMEOUT' || errMsg.includes('timed out') || errMsg.includes('timeout')) {
      const timeout = parseInt(process.env.CCS_IMAGE_ANALYSIS_TIMEOUT || DEFAULT_TIMEOUT_SEC, 10);
      outputTimeoutError(filePath, timeout);
    } else if (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND')) {
      outputCliProxyUnavailableError(filePath, `http://${CLIPROXY_HOST}:${CLIPROXY_PORT}`);
    } else if (errMsg.includes('EACCES') || errMsg.includes('EPERM')) {
      outputFileAccessError(filePath, errMsg);
    } else {
      outputUnknownError(filePath, errMsg);
    }
  }
}
