# Producer Configuration

This section describes how to configure the Producer component, which exposes TAK data to Catalyst through a GraphQL endpoint.

## Configuration Section

The Producer configuration is defined in the `[producer]` section of your TOML configuration file:

```toml
[producer]
catalyst_jwks_url="https://gateway.catalyst.devintelops.io/.well-known/jwks.json"
catalyst_app_id="your-app-id"
local_db_path="./db"
graphql_port=8080
graphql_host="0.0.0.0"
```

## Configuration Options

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `catalyst_jwks_url` | No | JWKS endpoint for JWT validation | https://gateway.catalyst.devintelops.io/.well-known/jwks.json |
| `catalyst_app_id` | Yes | Application ID for Catalyst integration | None |
| `local_db_path` | No | Path to local database storage | ./db |
| `graphql_port` | No | Port for GraphQL server | 8080 |
| `graphql_host` | No | Host for GraphQL server | 0.0.0.0 |

## Storage Configuration

### Local Database
The producer maintains a local database for data persistence:
- Default location: `./db/producer`
- Docker mount point: `/usr/src/app/db`
- Data cleanup: Automatic based on staleness settings

### Database Options
```toml
[producer]
local_db_path="custom/db/path"    # Custom database location
```

## GraphQL Server

### Server Configuration
```toml
[producer]
graphql_port=8080                 # Custom port
graphql_host="0.0.0.0"           # Listen on all interfaces
```

### Security
- JWT validation using JWKS
- Token scoping
- Application ID verification

## Example Configurations

### Basic Configuration
```toml
[producer]
catalyst_app_id="your-app-id"
```

### Custom Server Configuration
```toml
[producer]
catalyst_app_id="your-app-id"
graphql_port=3000
graphql_host="localhost"
local_db_path="/data/tak"
```

### Production Configuration
```toml
[producer]
catalyst_jwks_url="https://your-jwks-endpoint/.well-known/jwks.json"
catalyst_app_id="your-app-id"
graphql_port=8080
graphql_host="0.0.0.0"
local_db_path="/var/lib/tak-adapter/db"
```

