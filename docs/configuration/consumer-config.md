# Consumer Configuration

This section describes how to configure the Consumer component, which pulls data from Catalyst and forwards it to TAK.

## Configuration Section

The Consumer configuration is defined in the `[consumer]` section of your TOML configuration file:

```toml
[consumer]
catalyst_endpoint="https://gateway.catalyst.devintelops.io/graphql"
catalyst_token="yourtokenhere"
catalyst_query_poll_interval_ms = 10000

catalyst_query= """
query {
  aircraftWithinDistance(lat: 38.937620, lon: -77.180400, dist: 50) {
    hex
    flight
    lat
    lon
    alt_geom
  }
}
"""
```

## Configuration Options

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `catalyst_endpoint` | No | Catalyst GraphQL API endpoint | https://gateway.catalyst.devintelops.io/graphql |
| `catalyst_token` | Yes | Authentication token for Catalyst API | None |
| `catalyst_query` | Yes | GraphQL query for data retrieval | None |
| `catalyst_query_poll_interval_ms` | No | Polling interval in milliseconds | 10000 |

## Parser Configuration

The parser configuration is defined in two optional sections:

### Transform Configuration

The transform configuration is used to map Catalyst data fields to TAK CoT fields and is defined in the `[consumer.parser.queryName.transform]` section.
```toml
[consumer.parser.aircraftWithinDistance.transform]
uid = "hex"
lat = "lat"
lon = "lon"
hae = "alt_geom"
```


### Overwrite Configuration

The overwrite configuration is used to apply static overrides to the TAK CoT fields and is defined in the `[consumer.parser.queryName.overwrite]` section.
```toml
[consumer.parser.aircraftWithinDistance.overwrite]
type = "a-f-A"
```

## Example Configurations

### Basic Aircraft Tracking
```toml
[consumer]
catalyst_endpoint="https://gateway.catalyst.devintelops.io/graphql"
catalyst_token="your-token-here"
catalyst_query="""
query {
  aircraftWithinDistance(lat: 38.937620, lon: -77.180400, dist: 50) {
    hex
    flight
    lat
    lon
    alt_geom
  }
}
"""

[consumer.parser.aircraftWithinDistance.transform]
uid = "hex"
lat = "lat"
lon = "lon"
hae = "alt_geom"

[consumer.parser.aircraftWithinDistance.overwrite]
type = "a-f-A"
```

## See Also
- [Parser Configuration](./parser-config.md)
- [Producer Configuration](./producer-config.md)