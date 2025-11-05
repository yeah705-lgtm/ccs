# CCS - Claude Code Switch (Windows PowerShell)
# Cross-platform Claude CLI profile switcher
# https://github.com/kaitranntt/ccs

param(
    [Parameter(Position=0)]
    [string]$ProfileOrFlag = "default",

    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

# --- Color/Format Functions ---
function Write-ErrorMsg {
    param([string]$Message)
    Write-Host ""
    Write-Host "╔═════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║  ERROR                                      ║" -ForegroundColor Red
    Write-Host "╚═════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    Write-Host ""
}

# --- Claude CLI Detection Logic ---

function Find-ClaudeCli {
    [OutputType([string])]
    param()

    # Priority 1: CCS_CLAUDE_PATH environment variable (if user wants custom path)
    $CcsClaudePath = $env:CCS_CLAUDE_PATH
    if ($CcsClaudePath) {
        # Basic validation: file exists
        if (Test-Path $CcsClaudePath -PathType Leaf) {
            return $CcsClaudePath
        }
        # Invalid CCS_CLAUDE_PATH - show warning and fall back to PATH
        Write-Host "[!] Warning: CCS_CLAUDE_PATH is set but file not found: $CcsClaudePath" -ForegroundColor Yellow
        Write-Host "    Falling back to system PATH lookup..." -ForegroundColor Yellow
    }

    # Priority 2: Use 'claude' from PATH (trust the system)
    # This is the standard case - if user installed Claude CLI, it's in their PATH
    return "claude"
}

function Show-ClaudeNotFoundError {
    Write-ErrorMsg @"
Claude CLI not found in PATH

CCS requires Claude CLI to be installed and available in your PATH.

Solutions:
  1. Install Claude CLI:
     https://docs.claude.com/en/docs/claude-code/installation

  2. Verify installation:
     Get-Command claude

  3. If installed but not in PATH, add it:
     # Find Claude installation
     where.exe claude

     # Or set custom path
     `$env:CCS_CLAUDE_PATH = 'C:\path\to\claude.exe'

Restart your terminal after installation.
"@
}

# Version (updated by scripts/bump-version.sh)
$CcsVersion = "2.4.1"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Installation function for commands and skills
function Install-CommandsAndSkills {
    # Try both possible locations for .claude directory
    $SourceDir = $null
    $PossibleDirs = @(
        (Join-Path $ScriptDir ".claude"),                    # Development: tools/ccs/.claude
        (Join-Path $env:USERPROFILE ".ccs\.claude")          # Installed: ~/.ccs/.claude
    )

    foreach ($Dir in $PossibleDirs) {
        if (Test-Path $Dir) {
            $SourceDir = $Dir
            break
        }
    }

    $HomeDir = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
    $TargetDir = Join-Path $HomeDir ".claude"

    Write-Host "[Installing CCS Commands and Skills]" -ForegroundColor Cyan
    Write-Host "│  Source: $SourceDir"
    Write-Host "│  Target: $TargetDir"
    Write-Host "│"

    # Check if source directory exists
    if (-not $SourceDir) {
        Write-Host "│"
        $DevelopmentPath = Join-Path $ScriptDir ".claude"
        $InstalledPath = Join-Path $env:USERPROFILE ".ccs\.claude"
        Write-ErrorMsg @"
Source directory not found.

Checked locations:
  - $DevelopmentPath (development)
  - $InstalledPath (installed)

Solution:
  1. If developing: Ensure you're in the CCS repository
  2. If installed: Reinstall CCS with: irm ccs.kaitran.ca/install | iex
"@
        exit 1
    }

    # Create target directories if they don't exist
    $CommandsDir = Join-Path $TargetDir "commands"
    $SkillsDir = Join-Path $TargetDir "skills"

    if (-not (Test-Path $CommandsDir)) {
        New-Item -ItemType Directory -Path $CommandsDir -Force | Out-Null
    }
    if (-not (Test-Path $SkillsDir)) {
        New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
    }

    $InstalledCount = 0
    $SkippedCount = 0

    # Install commands
    $SourceCommandsDir = Join-Path $SourceDir "commands"
    if (Test-Path $SourceCommandsDir) {
        Write-Host "│  Installing commands..." -ForegroundColor Yellow
        Get-ChildItem $SourceCommandsDir -Filter "*.md" | ForEach-Object {
            $CmdName = $_.BaseName
            $TargetFile = Join-Path $CommandsDir "$CmdName.md"

            if (Test-Path $TargetFile) {
                Write-Host "│  |  [i]  Skipping existing command: $CmdName.md" -ForegroundColor Yellow
                $SkippedCount++
            } else {
                try {
                    Copy-Item $_.FullName $TargetFile -ErrorAction Stop
                    Write-Host "│  |  [OK] Installed command: $CmdName.md" -ForegroundColor Green
                    $InstalledCount++
                } catch {
                    Write-Host "│  |  [!]  Failed to install command: $CmdName.md" -ForegroundColor Red
                    Write-Host "│       Error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "│  [i]  No commands directory found" -ForegroundColor Gray
    }

    Write-Host "│"

    # Install skills
    $SourceSkillsDir = Join-Path $SourceDir "skills"
    if (Test-Path $SourceSkillsDir) {
        Write-Host "│  Installing skills..." -ForegroundColor Yellow
        Get-ChildItem $SourceSkillsDir -Directory | ForEach-Object {
            $SkillName = $_.Name
            $TargetSkillDir = Join-Path $SkillsDir $SkillName

            if (Test-Path $TargetSkillDir) {
                Write-Host "│  |  [i]  Skipping existing skill: $SkillName" -ForegroundColor Yellow
                $SkippedCount++
            } else {
                try {
                    Copy-Item $_.FullName $TargetSkillDir -Recurse -ErrorAction Stop
                    Write-Host "│  |  [OK] Installed skill: $SkillName" -ForegroundColor Green
                    $InstalledCount++
                } catch {
                    Write-Host "│  |  [!]  Failed to install skill: $SkillName" -ForegroundColor Red
                    Write-Host "│       Error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "│  [i]  No skills directory found" -ForegroundColor Gray
    }

    Write-Host "[DONE]"
    Write-Host ""
    Write-Host "[OK] Installation complete!" -ForegroundColor Green
    Write-Host "  Installed: $InstalledCount items"
    Write-Host "  Skipped: $SkippedCount items (already exist)"
    Write-Host ""
    Write-Host "You can now use the /ccs command in Claude CLI for task delegation." -ForegroundColor Cyan
    Write-Host "Example: /ccs glm /plan 'add user authentication'" -ForegroundColor Cyan
}

# Uninstallation function for commands and skills
function Uninstall-CommandsAndSkills {
    $HomeDir = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
    $TargetDir = Join-Path $HomeDir ".claude"
    $RemovedCount = 0
    $NotFoundCount = 0

    Write-Host "[Uninstalling CCS Commands and Skills]" -ForegroundColor Cyan
    Write-Host "│  Target: $TargetDir"
    Write-Host "│"

    # Check if target directory exists
    if (-not (Test-Path $TargetDir)) {
        Write-Host "│"
        Write-Host "│  [i]  Claude directory not found: $TargetDir" -ForegroundColor Gray
        Write-Host "│       Nothing to uninstall."
        Write-Host "[DONE]"
        Write-Host ""
        Write-Host "[OK] Uninstall complete!" -ForegroundColor Green
        Write-Host "  Removed: 0 items (nothing was installed)"
        return
    }

    # Remove commands
    $CommandsDir = Join-Path $TargetDir "commands"
    if (Test-Path $CommandsDir) {
        Write-Host "│  Removing commands..." -ForegroundColor Yellow
        $CmdFile = Join-Path $CommandsDir "ccs.md"
        if (Test-Path $CmdFile) {
            try {
                Remove-Item $CmdFile -Force -ErrorAction Stop
                Write-Host "│  |  [OK] Removed command: ccs.md" -ForegroundColor Green
                $RemovedCount++
            } catch {
                Write-Host "│  |  [!] Failed to remove command: ccs.md" -ForegroundColor Red
                Write-Host "│       Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "│  |  [i]  CCS command not found" -ForegroundColor Gray
            $NotFoundCount++
        }
    } else {
        Write-Host "│  [i]  Commands directory not found" -ForegroundColor Gray
        $NotFoundCount++
    }

    Write-Host "│"

    # Remove skills
    $SkillsDir = Join-Path $TargetDir "skills"
    if (Test-Path $SkillsDir) {
        Write-Host "│  Removing skills..." -ForegroundColor Yellow
        $SkillDir = Join-Path $SkillsDir "ccs-delegation"
        if (Test-Path $SkillDir) {
            try {
                Remove-Item $SkillDir -Recurse -Force -ErrorAction Stop
                Write-Host "│  |  [OK] Removed skill: ccs-delegation" -ForegroundColor Green
                $RemovedCount++
            } catch {
                Write-Host "│  |  [!] Failed to remove skill: ccs-delegation" -ForegroundColor Red
                Write-Host "│       Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "│  |  [i]  CCS skill not found" -ForegroundColor Gray
            $NotFoundCount++
        }
    } else {
        Write-Host "│  [i]  Skills directory not found" -ForegroundColor Gray
        $NotFoundCount++
    }

    Write-Host "[DONE]"
    Write-Host ""
    Write-Host "[OK] Uninstall complete!" -ForegroundColor Green
    Write-Host "  Removed: $RemovedCount items"
    Write-Host "  Not found: $NotFoundCount items (already removed)"
    Write-Host ""
    Write-Host "The /ccs command is no longer available in Claude CLI." -ForegroundColor Cyan
    Write-Host "To reinstall: ccs --install" -ForegroundColor Cyan
}

# Special case: version command (check BEFORE profile detection)
# Check both $ProfileOrFlag and first element of $RemainingArgs
$FirstArg = if ($ProfileOrFlag -ne "default") { $ProfileOrFlag } elseif ($RemainingArgs.Count -gt 0) { $RemainingArgs[0] } else { $null }
if ($FirstArg -eq "version" -or $FirstArg -eq "--version" -or $FirstArg -eq "-v") {
    Write-Host "CCS (Claude Code Switch) version $CcsVersion"

    # Show install location
    $InstallLocation = (Get-Command ccs -ErrorAction SilentlyContinue).Source
    if ($InstallLocation) {
        Write-Host "Installed at: $InstallLocation"
    }

    Write-Host "https://github.com/kaitranntt/ccs"
    exit 0
}

# Special case: help command (check BEFORE profile detection)
if ($FirstArg -eq "--help" -or $FirstArg -eq "-h" -or $FirstArg -eq "help") {
    $ClaudeCli = Find-ClaudeCli

    try {
        if ($RemainingArgs) {
            & $ClaudeCli --help @RemainingArgs
        } else {
            & $ClaudeCli --help
        }
        exit $LASTEXITCODE
    } catch {
        Show-ClaudeNotFoundError
        exit 1
    }
}

# Special case: install command (check BEFORE profile detection)
if ($FirstArg -eq "--install") {
    Install-CommandsAndSkills
    exit $LASTEXITCODE
}

# Special case: uninstall command (check BEFORE profile detection)
if ($FirstArg -eq "--uninstall") {
    Uninstall-CommandsAndSkills
    exit $LASTEXITCODE
}

# Smart profile detection: if first arg starts with '-', it's a flag not a profile
if ($ProfileOrFlag -match '^-') {
    # First arg is a flag → use default profile, keep all args
    $Profile = "default"
    # Prepend $ProfileOrFlag to $RemainingArgs (it's actually a flag, not a profile)
    if ($RemainingArgs) {
        $RemainingArgs = @($ProfileOrFlag) + $RemainingArgs
    } else {
        $RemainingArgs = @($ProfileOrFlag)
    }
} else {
    # First arg is a profile name
    $Profile = $ProfileOrFlag
    # $RemainingArgs already contains correct args (PowerShell handles this)
}

# Special case: "default" profile just runs claude directly (no profile switching)
if ($Profile -eq "default") {
    try {
        if ($RemainingArgs) {
            & claude @RemainingArgs
        } else {
            & claude
        }
        exit $LASTEXITCODE
    } catch {
        Write-Host "Error: Failed to execute claude" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}

# Config file location (supports environment variable override)
$ConfigFile = if ($env:CCS_CONFIG) {
    $env:CCS_CONFIG
} else {
    "$env:USERPROFILE\.ccs\config.json"
}

# Check config exists
if (-not (Test-Path $ConfigFile)) {
    Write-ErrorMsg @"
Config file not found: $ConfigFile

Solutions:
  1. Reinstall CCS:
     irm ccs.kaitran.ca/install | iex

  2. Or create config manually:
     New-Item -ItemType Directory -Force -Path '$env:USERPROFILE\.ccs'
     Set-Content -Path '$env:USERPROFILE\.ccs\config.json' -Value '{
       "profiles": {
         "glm": "~/.ccs/glm.settings.json",
         "default": "~/.claude/settings.json"
       }
     }'
"@
    exit 1
}

# Validate profile name (alphanumeric, dash, underscore only)
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-ErrorMsg @"
Invalid profile name: $Profile

Use only alphanumeric characters, dash, or underscore.
"@
    exit 1
}

# Read and parse JSON config
try {
    $ConfigContent = Get-Content $ConfigFile -Raw -ErrorAction Stop
    $Config = $ConfigContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-ErrorMsg @"
Invalid JSON in $ConfigFile

Fix the JSON syntax or reinstall:
  irm ccs.kaitran.ca/install | iex
"@
    exit 1
}

# Validate config has profiles object
if (-not $Config.profiles) {
    Write-ErrorMsg @"
Config must have 'profiles' object

See .ccs.example.json for correct format
Or reinstall:
  irm ccs.kaitran.ca/install | iex
"@
    exit 1
}

# Get settings path for profile
$SettingsPath = $Config.profiles.$Profile

if (-not $SettingsPath) {
    $AvailableProfiles = ($Config.profiles.PSObject.Properties.Name | ForEach-Object { "  - $_" }) -join "`n"
    Write-ErrorMsg @"
Profile '$Profile' not found in $ConfigFile

Available profiles:
$AvailableProfiles
"@
    exit 1
}

# Path expansion and normalization
# 1. Handle Unix-style tilde expansion (~/path -> %USERPROFILE%\path)
if ($SettingsPath -match '^~[/\\]') {
    $SettingsPath = $SettingsPath -replace '^~', $env:USERPROFILE
}

# 2. Expand Windows environment variables (%USERPROFILE%, etc.)
$SettingsPath = [System.Environment]::ExpandEnvironmentVariables($SettingsPath)

# 3. Convert forward slashes to backslashes (Unix path compatibility)
$SettingsPath = $SettingsPath -replace '/', '\'

# Validate settings file exists
if (-not (Test-Path $SettingsPath)) {
    Write-ErrorMsg @"
Settings file not found: $SettingsPath

Solutions:
  1. Create the settings file for profile '$Profile'
  2. Update the path in $ConfigFile
  3. Or reinstall: irm ccs.kaitran.ca/install | iex
"@
    exit 1
}

# Validate settings file is valid JSON (basic check)
try {
    $SettingsContent = Get-Content $SettingsPath -Raw -ErrorAction Stop
    $Settings = $SettingsContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-ErrorMsg @"
Invalid JSON in $SettingsPath

Details: $_

Solutions:
  1. Validate JSON at https://jsonlint.com
  2. Or reset to template:
     Set-Content -Path '$SettingsPath' -Value '{`"env`":{}}`'
  3. Or reinstall: irm ccs.kaitran.ca/install | iex
"@
    exit 1
}

# Detect Claude CLI executable
$ClaudeCli = Find-ClaudeCli

# Execute Claude with the profile settings
try {
    if ($RemainingArgs) {
        & $ClaudeCli --settings $SettingsPath @RemainingArgs
    } else {
        & $ClaudeCli --settings $SettingsPath
    }
    exit $LASTEXITCODE
} catch {
    Show-ClaudeNotFoundError
    exit 1
}
