# CCS Dashboard - Docker Build Process

## Overview

The `ccs-dashboard` Docker image is built from this repository using the Docker configuration in the `docker/` directory.

## Build Files Location

- **Dockerfile**: `docker/Dockerfile`
- **docker-compose.yml**: `docker/docker-compose.yml`
- **entrypoint.sh**: `docker/entrypoint.sh`
- **Documentation**: `docker/README.md`

## Build Commands

### Option 1: Docker Build (Manual)

From the repository root:

```bash
docker build -f docker/Dockerfile -t ccs-dashboard:latest .
```

### Option 2: Docker Compose (Recommended)

From the repository root:

```bash
docker-compose -f docker/docker-compose.yml up --build -d
```

Or from anywhere:

```bash
docker-compose -f /path/to/ccs/docker/docker-compose.yml up --build -d
```

## Build Process Details

### Multi-stage Build

The Dockerfile uses a multi-stage build:

1. **Build Stage** (`node:20-bookworm-slim AS build`)
   - Installs Bun v1.2.21 (pinned version)
   - Copies `package.json`, `bun.lock`, `bunfig.toml`
   - Installs dependencies with `--frozen-lockfile`
   - Copies source code
   - Runs `bun run build:all`
   - Validates build artifacts (`dist/`, `lib/`)

2. **Runtime Stage** (`node:20-bookworm-slim AS runtime`)
   - Installs Bun v1.2.21
   - Installs production dependencies only
   - Copies build artifacts from build stage
   - Installs global AI CLI tools:
     - `@google/gemini-cli`
     - `@vibe-kit/grok-cli`
     - `@anthropic-ai/claude-code`
     - `@kaitranntt/ccs`
     - `opencode` (via curl install script)
   - Sets up entrypoint script
   - Exposes ports 3000 and 8317

### Entrypoint

- Script: `/usr/local/bin/ccs-entrypoint`
- Creates CCS home directory (`/home/node/.ccs`)
- Fixes permissions if running as root
- Drops privileges to `node` user
- Executes the CMD

### Default CMD

```bash
node dist/ccs.js config --port ${CCS_PORT}
```

Where `CCS_PORT` defaults to `3000`.

## Container Configuration

### Exposed Ports

- **3000** - Dashboard UI
- **8317** - CLIProxy service
- **1455** - OAuth callback (Codex integration)

### Environment Variables

Key environment variables:

- `CCS_PORT=3000` - Dashboard port
- `CCS_DEBUG` - Enable verbose logging
- `NO_COLOR` - Disable ANSI colors
- `CCS_SKIP_PREFLIGHT` - Skip API key validation
- `CCS_WEBSEARCH_SKIP` - Skip WebSearch integration
- `CCS_PROXY_*` - Proxy configuration (HOST, PORT, PROTOCOL, AUTH_TOKEN, etc.)

### Data Storage

Persistent data is stored using **bind mounts** to local directories (stateless container design):

**Host Directory Structure:**
```
docker/inject_dir/
├── ccs/         → /home/node/.ccs (CCS config/data)
├── claude/      → /home/node/.claude (Claude CLI credentials)
├── opencode/    → /home/node/.opencode (OpenCode data)
└── grok/        → /home/node/.grok-cli (Grok CLI data)
```

**Benefits:**
- Easy backup/restore with standard file tools
- Direct access to container data from host
- Portable: copy `inject_dir` to move container state
- Fully stateless container (all data external)

**Setup:**
```bash
cd docker
mkdir -p inject_dir/{ccs,claude,opencode,grok}
```

See `docker/inject_dir/README.md` for details.

## Health Check

The container includes a healthcheck:

```bash
curl -fsS --max-time 2 http://localhost:3000/ >/dev/null && \
curl -sS --max-time 2 http://127.0.0.1:8317/ >/dev/null
```

Configuration:
- Interval: 10s
- Timeout: 3s
- Retries: 12
- Start period: 30s

## Resource Limits

Default limits (configurable in docker-compose.yml):

- Memory: 1GB limit, 256MB reservation
- CPUs: 2 cores limit, 0.5 cores reservation

## Testing the Build

After building a new image, verify it works:

1. **Build the test image**:
   ```bash
   docker build -f docker/Dockerfile -t ccs-dashboard:test .
   ```

2. **Create test data directory**:
   ```bash
   mkdir -p /tmp/ccs-test/{ccs,claude,opencode,grok}
   ```

3. **Run a test container**:
   ```bash
   docker run -d \
     --name ccs-dashboard-test \
     -p 4000:3000 \
     -p 9317:8317 \
     -p 2455:1455 \
     -e CCS_PORT=3000 \
     -v /tmp/ccs-test/ccs:/home/node/.ccs \
     -v /tmp/ccs-test/claude:/home/node/.claude \
     -v /tmp/ccs-test/opencode:/home/node/.opencode \
     -v /tmp/ccs-test/grok:/home/node/.grok-cli \
     ccs-dashboard:test
   ```

4. **Check health**:
   ```bash
   docker logs ccs-dashboard-test
   docker ps -a --filter "name=ccs-dashboard-test"
   ```

5. **Test endpoints**:
   ```bash
   curl -fsS http://localhost:4000/   # Dashboard UI
   curl -sS http://localhost:9317/    # CLIProxy
   ```

6. **Cleanup**:
   ```bash
   docker stop ccs-dashboard-test
   docker rm ccs-dashboard-test
   rm -rf /tmp/ccs-test
   docker rmi ccs-dashboard:test
   ```

## Production Deployment

### Using docker-compose (Recommended)

```bash
# Change to docker directory
cd docker

# Create data directories (first run only)
mkdir -p inject_dir/{ccs,claude,opencode,grok}

# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using docker run

```bash
# Create data directory
mkdir -p /path/to/inject_dir/{ccs,claude,opencode,grok}

# Run container
docker run -d \
  --name ccs-dashboard \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 8317:8317 \
  -p 1455:1455 \
  -e CCS_PORT=3000 \
  -v /path/to/inject_dir/ccs:/home/node/.ccs \
  -v /path/to/inject_dir/claude:/home/node/.claude \
  -v /path/to/inject_dir/opencode:/home/node/.opencode \
  -v /path/to/inject_dir/grok:/home/node/.grok-cli \
  ccs-dashboard:latest
```

## Troubleshooting

### Build fails

- Ensure you have Docker buildkit enabled
- Check network connectivity for dependency downloads
- Verify you're running from the repository root

### Container won't start

- Check logs: `docker logs <container-name>`
- Verify port availability: `lsof -i :3000 -i :8317`
- Check volume permissions

### Services not responding

- Wait for the start period (30s) before checking health
- Verify ports are properly mapped: `docker port <container-name>`
- Check firewall rules if accessing remotely

## Notes

- Never modify running containers directly - always rebuild the image
- Use `docker-compose` for production to ensure configuration persistence
- The container name format `docker-ccs-dashboard-1` indicates docker-compose was used
- Keep sensitive data in volumes, not in the image

## References

- Docker README: `docker/README.md`
- Main README: `README.md`
- CCS Documentation: https://docs.ccs.kaitran.ca/
