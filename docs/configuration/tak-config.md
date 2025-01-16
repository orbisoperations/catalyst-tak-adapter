# TAK Configuration

This section describes how to configure the TAK server connection settings.

## Configuration Section

The TAK configuration is defined in the `[tak]` section of your TOML configuration file:

```toml
[tak]
key_file="key.pem"
cert_file="cert.pem"
connection_id="TestConnection"
endpoint="ssl://127.0.0.1:8089"
```

## Configuration Options

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `key_file` | Yes | Path to the TAK user key file (PEM format) | None |
| `cert_file` | Yes | Path to the TAK user certificate file (PEM format) | None |
| `connection_id` | Yes | Unique identifier for the TAK server connection | None |
| `endpoint` | Yes | TAK server endpoint URL (format: ssl://hostname:port) | None |

## SSL Certificate Requirements

- Both key and certificate files must be in PEM format
- The key file must be decrypted before use
- When running in Docker, mount these files at:
  - Key: `/usr/src/app/key.pem`
  - Certificate: `/usr/src/app/cert.pem`


## Example Configurations

### Basic Configuration
```toml
[tak]
key_file="key.pem"
cert_file="cert.pem"
connection_id="MyConnection"
endpoint="ssl://tak-server.example.com:8089"
```

### Development Configuration
```toml
[tak]
key_file="dev/key.pem"
cert_file="dev/cert.pem"
connection_id="DevConnection"
endpoint="ssl://127.0.0.1:8089"
```

## See Also

TODO 