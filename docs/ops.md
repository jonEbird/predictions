# Operations Guide

This document covers operational procedures for managing the Bucknuts Predictions application in production.

## Architecture Overview

```
Internet (via Cloudflare)
         ↓
    Nginx (Port 80)
         ↓
  SvelteKit App (Docker, Port 3000)
         ↓
  SQLite Database (Volume Mount)
```

### Components

**Nginx** - Reverse proxy server
- Handles SSL termination (via Cloudflare)
- Serves static uploaded media files (`/uploads/*`)
- Proxies application requests to Docker container
- Configuration: `/etc/nginx/sites-available/buckeyepredictions.conf`

**Docker Compose** - Container orchestration
- Manages the SvelteKit application container
- Automatically restarts on failure
- Mounts persistent volumes for data and uploads
- Configuration: `/var/www/predictions/docker-compose.yml`

**SvelteKit Application** - Node.js web server
- Runs inside Docker container on port 3000
- Accesses SQLite database via volume mount
- Image: `ghcr.io/jonebird/predictions:latest`

**SQLite Database** - Data storage
- File-based database at `/var/www/predictions/data/predictions.db`
- Mounted into container at `/app/data/predictions.db`

**Uploads Directory** - User-generated content
- Mugshots, group pictures, prize images
- Located at `/var/www/predictions/uploads/`
- Served directly by Nginx (not proxied through app)

## Deployment Model

This application uses a **container-based deployment** model without code checkout on the server.

### CI/CD Pipeline

1. **Develop locally** - Make changes, commit to Git
2. **Push to GitHub** - Triggers GitHub Actions workflow
3. **Build & Publish** - GitHub Actions builds Docker image and publishes to GitHub Container Registry (ghcr.io)
4. **Deploy** - Restart service on server to pull latest image

**Important:** The server does NOT have a code checkout. All deployment happens via Docker images.

### Configuration Files on Server

The following files are checked out on the server for configuration purposes:

```
/var/www/predictions/
├── docker-compose.yml          # Container orchestration
├── .env                        # Environment variables (DATABASE_URL, etc.)
├── data/                       # SQLite database (volume mount)
│   └── predictions.db
└── uploads/                    # User uploads (volume mount)
    ├── mugshots/
    ├── groups/
    └── prizes/
```

These files persist across deployments. The application code runs entirely within the container.

## Common Operations

### Deploying a New Version

After pushing code to GitHub:

```bash
# Wait for GitHub Actions to complete (check https://github.com/jonEbird/predictions/actions)

# SSH to server
ssh root@predictions

# Restart service (pulls latest image automatically)
sudo systemctl restart predictions

# Watch logs to verify successful startup
docker logs -f predictions-app
```

The systemd service automatically pulls the latest image before starting.

### Viewing Logs

**Application logs:**
```bash
# Follow live logs
docker logs -f predictions-app

# View last 100 lines
docker logs --tail=100 predictions-app

# View logs from specific time
docker logs --since=1h predictions-app
```

**Nginx logs:**
```bash
# Access logs
sudo tail -f /var/log/nginx/buckeyepredictions_access.log

# Error logs
sudo tail -f /var/log/nginx/buckeyepredictions_error.log
```

**Systemd service logs:**
```bash
# View service status
sudo systemctl status predictions

# View recent logs
sudo journalctl -u predictions -n 50

# Follow logs
sudo journalctl -u predictions -f
```

### Restarting Services

**Application (recommended):**
```bash
sudo systemctl restart predictions
```

**Nginx (after config changes):**
```bash
# Test configuration first
sudo nginx -t

# Reload without downtime
sudo systemctl reload nginx

# Or restart if needed
sudo systemctl restart nginx
```

**Full system restart:**
```bash
sudo reboot
```

Services auto-start on boot via systemd.

### Database Operations

**Backup database:**
```bash
cd /var/www/predictions

# Create timestamped backup
sqlite3 data/predictions.db ".backup data/predictions.db.backup-$(date +%Y%m%d)"

# Or export as SQL
sqlite3 data/predictions.db .dump > data/predictions-$(date +%Y%m%d).sql
```

**Restore database:**
```bash
cd /var/www/predictions

# Stop application first
sudo systemctl stop predictions

# Restore from backup
cp data/predictions.db.backup-YYYYMMDD data/predictions.db

# Restart application
sudo systemctl start predictions
```

**Query database:**
```bash
cd /var/www/predictions
sqlite3 data/predictions.db

# Example queries
sqlite> SELECT COUNT(*) FROM users;
sqlite> SELECT * FROM games ORDER BY gameTime DESC LIMIT 5;
sqlite> .exit
```

### Updating Configuration

**Environment variables (.env):**
```bash
cd /var/www/predictions

# Edit .env file
nano .env

# Restart to apply changes
sudo systemctl restart predictions
```

**Docker Compose (docker-compose.yml):**
```bash
cd /var/www/predictions

# Edit docker-compose.yml
nano docker-compose.yml

# Recreate container
docker-compose down
docker-compose up -d
```

**Nginx configuration:**
```bash
# Pull latest config from repo
cd /var/www/predictions
git pull

# Copy to nginx
sudo cp vps/nginx/buckeyepredictions.conf /etc/nginx/sites-available/buckeyepredictions.conf

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring

### Health Checks

**Application health:**
```bash
curl http://localhost:3000
curl http://buckeyepredictions.com
```

**Docker status:**
```bash
docker ps | grep predictions-app
docker stats predictions-app
```

**Service status:**
```bash
sudo systemctl status predictions
sudo systemctl status nginx
```

### Resource Usage

**Disk space:**
```bash
df -h /var/www/predictions
du -sh /var/www/predictions/data
du -sh /var/www/predictions/uploads
```

**Database size:**
```bash
ls -lh /var/www/predictions/data/predictions.db
```

**Container resources:**
```bash
docker stats predictions-app
```

## Troubleshooting

### Application Won't Start

1. Check logs:
   ```bash
   docker logs predictions-app
   sudo journalctl -u predictions -n 50
   ```

2. Verify database exists:
   ```bash
   ls -lh /var/www/predictions/data/predictions.db
   ```

3. Check environment variables:
   ```bash
   cat /var/www/predictions/.env
   docker exec predictions-app env | grep DATABASE_URL
   ```

4. Try manual container start:
   ```bash
   cd /var/www/predictions
   docker-compose down
   docker-compose up
   ```

### Database Connection Errors

Check that `DATABASE_URL` in `.env` points to the volume mount:
```bash
# Should be:
DATABASE_URL=file:/app/data/predictions.db

# NOT:
DATABASE_URL=file:./predictions.db
```

### Broken Images/Uploads

1. Verify files exist:
   ```bash
   ls -lh /var/www/predictions/uploads/mugshots/
   ```

2. Check nginx config has uploads location block:
   ```bash
   grep -A5 "location /uploads" /etc/nginx/sites-available/buckeyepredictions.conf
   ```

3. Test direct file access:
   ```bash
   curl -I http://buckeyepredictions.com/uploads/mugshots/mark.jpg
   ```

### 502 Bad Gateway

Application container is not running:
```bash
docker ps | grep predictions-app
sudo systemctl status predictions
docker logs predictions-app
```

### Nginx Errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -100 /var/log/nginx/buckeyepredictions_error.log

# Verify upstream is accessible
curl http://localhost:3000
```

## File Locations

### Server Paths

| Path | Purpose |
|------|---------|
| `/var/www/predictions/` | Application base directory |
| `/var/www/predictions/docker-compose.yml` | Container configuration |
| `/var/www/predictions/.env` | Environment variables |
| `/var/www/predictions/data/` | Database storage (persistent) |
| `/var/www/predictions/uploads/` | User uploads (persistent) |
| `/etc/nginx/sites-available/buckeyepredictions.conf` | Nginx config |
| `/etc/systemd/system/predictions.service` | Systemd service file |
| `/var/log/nginx/buckeyepredictions_*.log` | Nginx logs |

### Important: What's NOT on the Server

The following are NOT checked out on the server:
- Source code (`src/`)
- Node modules
- Build artifacts
- Development tools

All application code runs from the Docker image built by GitHub Actions.

## User Management

### Adding a New User (Admin Only)

Only user ID 1 (admin) can register new users:

1. Log in as admin
2. Navigate to `/register`
3. Fill in user details
4. New user can log in with provided credentials

### Checking Users

```bash
cd /var/www/predictions
sqlite3 data/predictions.db

sqlite> SELECT id, name, email FROM users;
sqlite> .exit
```

## Backups

### Automated Backups

Currently backups are manual. Consider setting up:

```bash
# Add to crontab
0 2 * * * cd /var/www/predictions && sqlite3 data/predictions.db ".backup data/predictions.db.backup-$(date +\%Y\%m\%d)"
```

### Backup Checklist

Before major changes, backup:
- [ ] Database: `/var/www/predictions/data/predictions.db`
- [ ] Uploads: `/var/www/predictions/uploads/`
- [ ] Environment: `/var/www/predictions/.env`

## Security Notes

- Nginx only listens on port 80 (Cloudflare handles SSL)
- Application container not exposed directly to internet
- Firewall (UFW) allows only ports 22, 80, 443
- Cloudflare provides DDoS protection and SSL/TLS
- Database is file-based, no network exposure

## Getting Help

- **GitHub Issues:** https://github.com/jonEbird/predictions/issues
- **Logs:** Always check `docker logs predictions-app` first
- **Nginx docs:** `/usr/share/doc/nginx/`
- **Docker docs:** https://docs.docker.com/
