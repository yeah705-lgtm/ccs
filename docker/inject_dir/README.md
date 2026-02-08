# inject_dir - Container Data Directory

This directory contains all persistent data for the CCS Dashboard container.

## Structure

```
inject_dir/
├── ccs/         → /home/node/.ccs (CCS config and data)
├── claude/      → /home/node/.claude (Claude CLI credentials)
├── opencode/    → /home/node/.opencode (OpenCode data)
└── grok/        → /home/node/.grok-cli (Grok CLI data)
```

## Purpose

Using bind mounts to local directories (instead of Docker named volumes) provides:

- **Visibility**: Easy access to container data from the host
- **Backup**: Simple to backup/restore with standard file tools
- **Portability**: Copy `inject_dir` to move container state
- **Stateless container**: All data lives outside the container

## Setup

Subdirectories are created automatically when you run:

```bash
docker-compose up -d
```

Or manually:

```bash
mkdir -p inject_dir/{ccs,claude,opencode,grok}
```

## Permissions

The container runs as user `node` (UID 1000). If you encounter permission issues:

```bash
sudo chown -R 1000:1000 inject_dir/
```

## Backup

To backup all container data:

```bash
tar czf ccs-backup-$(date +%Y%m%d).tar.gz inject_dir/
```

To restore:

```bash
tar xzf ccs-backup-YYYYMMDD.tar.gz
```

## Reset

To start fresh (⚠️ deletes all data):

```bash
docker-compose down
rm -rf inject_dir/*
mkdir -p inject_dir/{ccs,claude,opencode,grok}
docker-compose up -d
```

## Notes

- This directory is excluded from git (see `.gitignore`)
- Each subdirectory corresponds to a specific service/tool
- Config files, credentials, and runtime data are stored here
