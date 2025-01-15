# catalyst-tak-adapter

The Catalyst Tak Adapter is a service designed to bridge TAK environments to a rich data integration fabric.

## Quick Start

### Setup
1. Build the project:
   ```bash
   # Using bun
   bun run build
   
   # Using docker
   docker build -t catalyst-tak-adapter .
   ```

2. Prepare required files:
   - Configuration file (config.toml)
   - TAK key and certificates in PEM format
   - Storage volume (optional)

3. Run the container:
   ```bash
   docker run tak-adapter \
     -v /path/to/config.toml:/usr/src/app/config.toml \
     -v /path/to/key.pem:/usr/src/app/key.pem \
     -v /path/to/cert.pem:/usr/src/app/cert.pem \
     -v /path/to/db:/usr/src/app/db
   ```

### Development Setup
1. Set up the TAK development server
2. Configure browser certificates
3. Run the adapter locally using `bun run index.ts`

## Documentation

Detailed documentation is available in the [docs](./docs) directory:

- [Development Guide](./docs/development/overview.md) - Setup, architecture, and contribution guidelines
- [Configuration Guide](./docs/configuration/overview.md) - Detailed configuration options and examples
- [Deployment Guide](./docs/deployment/overview.md) - Deployment instructions and best practices

For a complete configuration reference and advanced usage scenarios, please refer to the documentation.