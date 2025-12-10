/**
 * JSONL Parser for Claude Code Usage Analytics
 *
 * High-performance streaming parser for ~/.claude/projects/ JSONL files.
 * Replaces better-ccusage dependency with optimized custom implementation.
 *
 * Key features:
 * - Streaming line-by-line parsing (memory efficient)
 * - Only parses "assistant" entries with usage data
 * - Parallel file processing with configurable concurrency
 * - Graceful error handling for malformed entries
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Raw usage data from JSONL entry */
export interface RawUsageEntry {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  sessionId: string;
  timestamp: string;
  projectPath: string;
  version?: string;
}

/** Internal structure matching JSONL assistant entries */
interface JsonlAssistantEntry {
  type: 'assistant';
  sessionId: string;
  timestamp: string;
  version?: string;
  cwd?: string;
  message: {
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

/** Parser options */
export interface ParserOptions {
  /** Max files to parse concurrently (default: 10) */
  concurrency?: number;
  /** Skip files older than this date */
  minDate?: Date;
  /** Custom projects directory (default: ~/.claude/projects) */
  projectsDir?: string;
}

// ============================================================================
// CORE PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a single JSONL line into RawUsageEntry if valid
 * Returns null for non-assistant entries or entries without usage data
 */
export function parseUsageEntry(line: string, projectPath: string): RawUsageEntry | null {
  if (!line.trim()) return null;

  try {
    const entry = JSON.parse(line);

    // Only process assistant entries with usage data
    if (entry.type !== 'assistant') return null;
    if (!entry.message?.usage) return null;
    if (!entry.message?.model) return null;

    const usage = entry.message.usage;
    const assistant = entry as JsonlAssistantEntry;

    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheCreationTokens: usage.cache_creation_input_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      model: assistant.message.model,
      sessionId: assistant.sessionId || '',
      timestamp: assistant.timestamp || new Date().toISOString(),
      projectPath,
      version: assistant.version,
    };
  } catch {
    // Malformed JSON - skip silently
    return null;
  }
}

/**
 * Stream-parse a single JSONL file
 * Yields RawUsageEntry for each valid assistant entry
 */
export async function parseJsonlFile(
  filePath: string,
  projectPath: string
): Promise<RawUsageEntry[]> {
  const entries: RawUsageEntry[] = [];

  if (!fs.existsSync(filePath)) {
    return entries;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const entry = parseUsageEntry(line, projectPath);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Parse all JSONL files in a single project directory
 */
export async function parseProjectDirectory(projectDir: string): Promise<RawUsageEntry[]> {
  const entries: RawUsageEntry[] = [];

  if (!fs.existsSync(projectDir)) {
    return entries;
  }

  // Get project path from directory name (e.g., "-home-kai-project" -> "/home/kai/project")
  const projectPath = path.basename(projectDir).replace(/-/g, '/');

  try {
    const files = fs.readdirSync(projectDir);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    // Parse files sequentially within a project to avoid too many open handles
    for (const file of jsonlFiles) {
      const filePath = path.join(projectDir, file);
      const fileEntries = await parseJsonlFile(filePath, projectPath);
      entries.push(...fileEntries);
    }
  } catch {
    // Directory access error - skip silently
  }

  return entries;
}

// ============================================================================
// DIRECTORY SCANNING
// ============================================================================

/**
 * Get default Claude projects directory
 */
export function getDefaultProjectsDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'projects');
}

/**
 * Find all project directories under ~/.claude/projects/
 */
export function findProjectDirectories(projectsDir?: string): string[] {
  const dir = projectsDir || getDefaultProjectsDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

/**
 * Scan all projects and parse all JSONL files
 * Main entry point for usage data extraction
 *
 * @param options - Parser configuration
 * @returns All parsed usage entries from all projects
 */
export async function scanProjectsDirectory(options: ParserOptions = {}): Promise<RawUsageEntry[]> {
  const { concurrency = 10, projectsDir } = options;
  const allEntries: RawUsageEntry[] = [];

  const projectDirs = findProjectDirectories(projectsDir);

  if (projectDirs.length === 0) {
    return allEntries;
  }

  // Process projects in batches for controlled concurrency
  for (let i = 0; i < projectDirs.length; i += concurrency) {
    const batch = projectDirs.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((dir) => parseProjectDirectory(dir)));

    for (const entries of batchResults) {
      allEntries.push(...entries);
    }
  }

  // Filter by date if specified
  if (options.minDate) {
    const minTime = options.minDate.getTime();
    return allEntries.filter((entry) => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= minTime;
    });
  }

  return allEntries;
}

/**
 * Get count of JSONL files across all projects (for progress reporting)
 */
export function countJsonlFiles(projectsDir?: string): number {
  const projectDirs = findProjectDirectories(projectsDir);
  let count = 0;

  for (const dir of projectDirs) {
    try {
      const files = fs.readdirSync(dir);
      count += files.filter((f) => f.endsWith('.jsonl')).length;
    } catch {
      // Skip inaccessible directories
    }
  }

  return count;
}
