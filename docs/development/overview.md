# Development Guide

This guide covers setting up your development environment for the Catalyst TAK Adapter.

## Development Environment Setup

### Prerequisites

- Node.js
- Bun runtime
- Docker and Docker Compose
- Firefox browser
- Git

## Project Structure

```
catalyst-tak-adapter/
├── Dockerfile            # Docker configuration
├── README.md             # Project overview and instructions
├── config.toml.example   # Example configuration file
├── docker-compose.yml    # Docker Compose configuration
├── examples/             # Example configurations and queries
├── fly.toml              # Fly.io configuration
├── index.ts              # Entry point for the adapter
├── src/                  # Source code directory
│   ├── adapters/         # Adapter implementations
│   ├── config/           # Configuration handling
│   └── tak/              # TAK-specific implementations
└── docs/                 # Documentation
```

### TAK Server Setup
1. Check out our fork of the [CLOUD-RF Tak-Server repo](https://github.com/orbisoperations/tak-server).

*You will need to also follow the step to download the right tak server docker image from tak.gov and place it in the root of the directory.*
   ```bash
   git clone https://github.com/orbisoperations/tak-server
   ```

2. Download the TAK server Docker image from tak.gov and place it in the root directory.

3. Since most of our team runs on MAC/OSX, you will need your IP address:

```bash
ipconfig getifaddr en0
```

4. Run `scipts/setup.sh` to configure and start the tak server. Take care to enter the IP address you found above.
*WebTAK will not work if you use localhost or 127.0.0.1 for no reason we can discern.*

### Browser Setup

1. Use Firefox for development
2. Configure certificates:
   - Navigate to Settings > Privacy & Security
   - Import the .p12 certificate into 'Your Certificates' and ensure you trust the CA.
   - Go to Authorities tab and enable website trust for TAK.

### Adapter Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/orbisoperations/tak-server
   cd catalyst-tak-adapter
   ```

2. Copy TAK credentials into adapter directory:
   ```bash
   # copy user1 or user2 credentials from TAK server
   # make sure the files are named key.pem and cert.pem
   cp /path/to/tak/creds/user1.key ./key.pem
   cp /path/to/tak/creds/user1.pem ./cert.pem
   ```

3. Decrypt the user key:
   ```bash
   openssl rsa -in key.pem -out key.pem
   # Password: atakatak
   ```
    This password is the default password that was generated when the TAK server was setup.

4. Run the adapter:
   ```bash
   bun run index.ts
   ```

