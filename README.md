# catalyst-tak-adapter

The Catalyst Tak Adapter is a service designed to bridge TAK environments to a rich data integration fabric.

## Quick Start

### Available Commands

You can use the following commands (via `bun run <command>` or `npm run <command>` if using npm):

| Command           | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `start`           | Start the adapter (`index.ts`).                              |
| `dev`             | Start the adapter in watch mode for development.             |
| `config:template` | Generate a template config file (`config.template.toml`).    |
| `test`            | Run all tests.                                               |
| `testw`           | Run all tests in watch mode.                                 |
| `docker-compose`  | Start the app and dependencies using Docker Compose.         |
| `build`           | Build the Docker image for the adapter.                      |
| `prepare`         | Run Husky (for preparing git hooks, e.g., pre-commit hooks). |

---

## Setup

1. Build the project:

   ```bash
   # Using bun
   bun run build
   # Using docker
   docker build -t catalyst-tak-adapter .
   ```

2. Prepare required files:

   - **Configuration file** (`config.toml` or custom path)
   - TAK key and certificates in PEM format
   - Storage volume (optional)

   > **Tip:**
   >
   > - You can generate a template config file with:
   >   ```bash
   >   bun run config:template
   >   # This will create config.template.toml in the project root
   >   ```
   > - An example config is provided as `config.example.toml`.
   > - You can override the config file location by setting the `CONFIG_PATH` environment variable.

3. Run the container:
   ```bash
   bun run docker-compose
   ```

### Configuration & Secrets

- The adapter loads configuration from a TOML file (default: `config.toml` in the root, or as set by `CONFIG_PATH`).
- **Secrets** (such as tokens, keys, and sensitive endpoints) can be provided via environment variables. These take precedence over values in the config file.
  - Required secret environment variables for deploymet on Fly.io:
    - `FLY_SECRET_TAK_KEY_FILE`
    - `FLY_SECRET_TAK_CERT_FILE`
    - `FLY_SECRET_TAK_ENDPOINT`
    - `FLY_SECRET_TAK_CONNECTION_ID`
    - `FLY_SECRET_CONSUMER_CATALYST_TOKEN`
    - `FLY_SECRET_CONSUMER_CATALYST_QUERY`
    - `FLY_SECRET_PRODUCER_CATALYST_APP_ID`
- See [Configuration Guide](./docs/configuration/overview.md) for all options, defaults, and environment variables.

### Development Setup

1. **Set up the TAK development server**

   - See [Development Guide](./docs/development/overview.md) for full instructions.
   - Clone the [CLOUD-RF Tak-Server repo](https://github.com/orbisoperations/tak-server) and follow the steps to download and set up the TAK server Docker image.
   - Get your local IP address (for Mac):
     ```bash
     ipconfig getifaddr en0
     ```
   - Run the setup script and use your IP address (not localhost).

2. **Configure browser certificates**

   - Use Firefox for development.
   - Import the `.p12` certificate into Firefox (Settings > Privacy & Security > Certificates).
   - Trust the CA for TAK.

3. **Prepare adapter credentials**

   - Copy TAK user credentials into the adapter directory as `key.pem` and `cert.pem`.
   - Decrypt the user key if needed:

     ```bash
     openssl rsa -in key.pem -out key.pem
     # Password: atakatak (default)
     ```

4. **Run the adapter locally**

   ```bash
   bun run index.ts
   ```

## Deployment

### Fly.io Deployment

**Prerequisites:**

- Fly.io account and CLI installed
- Project configured for Fly.io deployment

You can deploy the Catalyst TAK Adapter using Docker or Fly.io. See the [Deployment Guide](./docs/deployment/overview.md) for full details and advanced options.

## Documentation

Detailed documentation is available in the [docs](./docs) directory:

- [Development Guide](./docs/development/overview.md) - Setup, architecture, and contribution guidelines
- [Configuration Guide](./docs/configuration/overview.md) - Detailed configuration options, environment variables, and examples
  - [TAK Config](./docs/configuration/tak-config.md)
  - [Producer Config](./docs/configuration/producer-config.md)
  - [Consumer Config](./docs/configuration/consumer-config.md)
  - [Parser Config](./docs/configuration/parser-config.md)
- [Deployment Guide](./docs/deployment/overview.md) - Deployment instructions and best practices

For a complete configuration reference and advanced usage scenarios, please refer to the documentation.
