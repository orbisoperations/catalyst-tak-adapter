# Deployment Guide

This guide covers deployment options and best practices for the Catalyst TAK Adapter.

## Deployment Options

- [Docker Deployment](./docker.md)
- [Fly.io Deployment](./fly-io.md)

## Docker Deployment

### Building the Container

```bash
docker build -t catalyst-tak-adapter .
```

### Running the Container

```bash
docker run catalyst-tak-adapter \
  -v /path/to/config.toml:/usr/src/app/config.toml \
  -v /path/to/key.pem:/usr/src/app/key.pem \
  -v /path/to/cert.pem:/usr/src/app/cert.pem \
  -v /path/to/db:/usr/src/app/db
```

### Using Docker Compose

```bash
docker-compose up -d
```

## Fly.io Deployment

### Prerequisites

- Fly.io account and CLI installed
- Project configured for Fly.io deployment

### Deployment Steps

1. Generate SSH keys:
   ```bash
   [ -f ~/.ssh/flytmp ] && rm -f ~/.ssh/{flytmp,flytmp-cert.pub} & 
   fly ssh issue personal ~/.ssh/flytmp --hours 1 -o $YOUR_ORG_HERE
   ```

2. Open tunnel:
   ```bash
   fly proxy 10022:22 -a $YOUR_APP_NAME $APP_IP_ADDR
   ```

3. Transfer credentials:
   ```bash
   sftp -o "StrictHostKeyChecking=no" \
        -o "UserKnownHostsFile=/dev/null" \
        -P 10022 -i ~/.ssh/flytmp root@localhost
   ```

## See Also

- [Configuration Guide](../configuration/overview.md)
