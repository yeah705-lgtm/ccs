# CCS Dashboard - Build Verification Report

**Purpose**: Verify the Docker build process produces a working container

---

## Verification Process

### 1. Build Test Image

Build the Docker image with a test tag:

```bash
docker build -f docker/Dockerfile -t ccs-dashboard:test .
```

**Expected result**: Build completes successfully (exit code 0)

### 2. Deploy Test Container

Run a test container with non-conflicting ports:

```bash
docker run -d \
  --name ccs-dashboard-test \
  -p 4000:3000 \
  -p 9317:8317 \
  -p 2455:1455 \
  -e CCS_PORT=3000 \
  -v ccs_home_test:/home/node/.ccs \
  ccs-dashboard:test
```

**Expected result**: Container starts successfully

### 3. Service Health Check

Verify both services respond:

| Service | Internal Port | Test Port | Check Command |
|---------|---------------|-----------|---------------|
| Dashboard UI | 3000 | 4000 | `curl -fsS http://localhost:4000/` |
| CLIProxy | 8317 | 9317 | `curl -sS http://localhost:9317/` |
| OAuth Callback | 1455 | 2455 | Port mapping verified |

**Expected results**:
- ✅ Dashboard responds with HTTP 200
- ✅ CLIProxy responds with HTTP 200
- ✅ No errors in container logs

### 4. Log Verification

Check container logs for successful startup:

```bash
docker logs ccs-dashboard-test
```

**Expected log output**:
```
CCS Config Dashboard

[i] Starting CLIProxy service...
[i] Downloading CLIProxy Plus v6.8.4-0...
[OK] CLIProxy Plus ready
[OK] CLIProxy started on port 8317

[i] Starting dashboard server...
[auto-sync] Starting watcher on /home/node/.ccs/*.settings.json
[auto-sync] Watcher started
[OK] Dashboard: http://localhost:3000
```

### 5. Container Status

Verify container is running:

```bash
docker ps -a --filter "name=ccs-dashboard-test"
```

**Expected result**: Container status shows `Up` (not `Exited` or `Restarting`)

### 6. Cleanup

Remove test artifacts:

```bash
docker stop ccs-dashboard-test
docker rm ccs-dashboard-test
docker volume rm ccs_home_test
docker rmi ccs-dashboard:test
```

---

## Verification Checklist

Use this checklist when verifying a new build:

- [ ] Dockerfile builds without errors
- [ ] Container starts successfully
- [ ] Dashboard UI is accessible (port 3000)
- [ ] CLIProxy is accessible (port 8317)
- [ ] OAuth callback port is exposed (port 1455)
- [ ] Container logs show no errors
- [ ] Container status is `Up` and healthy
- [ ] Both services respond to HTTP requests
- [ ] Test cleanup completed

---

## Common Issues

### Build Failures

**Symptom**: Docker build fails with dependency errors

**Solutions**:
- Verify network connectivity
- Check Docker buildkit is enabled
- Ensure you're running from repository root
- Clear Docker build cache: `docker builder prune`

### Container Won't Start

**Symptom**: Container exits immediately after start

**Diagnosis**:
```bash
docker logs ccs-dashboard-test
docker inspect ccs-dashboard-test
```

**Solutions**:
- Check environment variables are set correctly
- Verify volume permissions
- Ensure required directories exist

### Services Not Responding

**Symptom**: HTTP requests timeout or fail

**Diagnosis**:
```bash
docker port ccs-dashboard-test
docker exec -it ccs-dashboard-test curl -s http://localhost:3000/
```

**Solutions**:
- Wait for startup period (30s)
- Check port mappings are correct
- Verify firewall rules (if remote access)
- Check container logs for service errors

### Port Conflicts

**Symptom**: Error about port already in use

**Diagnosis**:
```bash
lsof -i :3000
lsof -i :8317
lsof -i :1455
```

**Solutions**:
- Stop conflicting services
- Use different external ports in docker run command
- Check for zombie containers: `docker ps -a`

---

## Production Verification

For production deployments:

1. **Pre-deployment**:
   - Verify test build succeeds
   - Review uncommitted changes
   - Backup current configuration

2. **Deployment**:
   - Use docker-compose for consistency
   - Monitor logs during startup
   - Wait for health checks to pass

3. **Post-deployment**:
   - Verify both services are accessible
   - Check metrics/monitoring
   - Validate OAuth callback works
   - Test key features

4. **Rollback plan**:
   - Keep previous image tagged
   - Document rollback commands
   - Have backup configuration ready

---

## Success Criteria

A build is considered verified when:

✅ **Build Process**
- Dockerfile compiles without errors
- All dependencies install successfully
- Build artifacts are created

✅ **Container Runtime**
- Container starts and stays running
- No critical errors in logs
- Health checks pass

✅ **Service Availability**
- Dashboard UI responds on port 3000
- CLIProxy responds on port 8317
- OAuth callback port is mapped

✅ **Functionality**
- Auto-sync watcher starts
- CLIProxy Plus downloads and starts
- Config directory is created

---

## Notes

- Always test with non-production ports to avoid conflicts
- Use test volumes to keep test data separate
- Clean up test resources after verification
- Document any deviations from expected behavior
- Keep this document updated with new findings

---

**Last Updated**: 2026-02-08
