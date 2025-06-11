# Configuration Guide

This guide covers all configuration options for the Catalyst TAK Adapter.

## Configuration Files

You must provide a valid configuration file to start the adapter.

The adapter will check if the environment variable `CONFIG_PATH` is set. If it is, it will use that path as the configuration file. If it is not, it will look for `config.toml` in the root of the project.

An example configuration file is provided in the root of the project: `config.example.toml`

## Configuration Sections

- [TAK Configuration](./tak-config.md)
- [Producer Configuration](./producer-config.md)

## Default Values

**Note:**
Default values only apply when a config file exists

| Key                                      | Default Value                                                 |
| ---------------------------------------- | ------------------------------------------------------------- |
| producer.catalyst_jwks_endpoint          | https://gateway.catalyst.devintelops.io/.well-known/jwks.json |
| producer.graphql_port                    | 8080                                                          |
| producer.graphql_host                    | 0.0.0.0                                                       |
| producer.local_db_path                   | ./db/producer                                                 |
| consumer.catalyst_query_poll_interval_ms | 10000                                                         |
| consumer.catalyst_endpoint               | https://gateway.catalyst.devintelops.io/graphql               |

## Environment Variables

- `CONFIG_PATH` - Override the path to the configuration file

## File Paths and Mounting

When running in Docker, the following paths are used:

- Configuration: `/usr/src/app/config.toml`
- Key: `/usr/src/app/key.pem`
- Certificate: `/usr/src/app/cert.pem`
- Database: `/usr/src/app/db`

## See Also

#### TODO

- [TAK Configuration](./tak-config.md)
- [Producer Configuration](./producer-config.md)
- [Consumer Configuration](./consumer-config.md)
- [Parser Configuration](./parser-config.md)
- This See Also section for links to other sections
