# Docker Deployment

This guide covers deploying the Catalyst TAK Adapter using Docker.

## Overview
Docker images can be built on any platform that supports Docker (Linux, macOS, Windows). Once built, these images can be run on any containerization platform, ensuring that the application behaves the same way everywhere.

## Prerequisites

- Docker or Docker Compose installed
- TAK User certificates (key.pem and cert.pem)
- Configuration file (config.toml) - see [example](config.toml.example)

## Building the Container

### Using Docker Build
```bash
docker build -t catalyst-tak-adapter .
```

### Using Docker Compose Build
```bash
docker-compose build
```

## Running the Container

### Using Docker Run
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

## Volume Mounts

| Local Path | Container Path | Purpose |
|------------|---------------|----------|
| config.toml | /usr/src/app/config.toml | Configuration file |
| key.pem | /usr/src/app/key.pem | SSL key |
| cert.pem | /usr/src/app/cert.pem | SSL certificate |
| ./db | /usr/src/app/db | Persistent storage |

## Docker Compose Configuration

Example `docker-compose.yml`:
```yaml
services:
  adapter:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - "./key.pem:/usr/src/app/key.pem"
      - "./cert.pem:/usr/src/app/cert.pem"
      - "./config.docker.toml:/usr/src/app/config.toml"
    networks:
      tak-network:
    restart: unless-stopped

networks:
  tak-network:
    name: tak-server_tak
    external: true
```
**Note:** This configuration example assumes an existing network `tak-network'

## See Also

- [Configuration Guide](../configuration/overview.md)
