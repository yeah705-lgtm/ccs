/**
 * Reserved profile names that cannot be used for user-defined profiles.
 * These names are reserved for CLIProxy providers and CLI commands.
 */
export const RESERVED_PROFILE_NAMES = [
  // CLIProxy providers (built-in OAuth)
  'gemini',
  'codex',
  'agy',
  'qwen',
  'iflow',
  // CLI commands and special names
  'default',
  'config',
  'cliproxy',
] as const;

export type ReservedProfileName = (typeof RESERVED_PROFILE_NAMES)[number];

/**
 * Check if a name is reserved and cannot be used for user profiles.
 * @param name - The profile name to check
 * @returns true if the name is reserved
 */
export function isReservedName(name: string): boolean {
  return RESERVED_PROFILE_NAMES.includes(name.toLowerCase() as ReservedProfileName);
}

/**
 * Validate a profile name and throw if reserved.
 * @param name - The profile name to validate
 * @throws Error if the name is reserved
 */
export function validateProfileName(name: string): void {
  if (isReservedName(name)) {
    throw new Error(
      `Profile name '${name}' is reserved. Reserved names: ${RESERVED_PROFILE_NAMES.join(', ')}`
    );
  }
}
