# Parser Configuration

This section describes how to configure the data parsers that transform between Catalyst and TAK Cursor on Target (CoT) fields.

## Overview

The parser system is responsible for:
- Mapping Catalyst data fields to TAK CoT fields
- Transforming data types and formats
- Applying static overrides
- Validating required fields

## Parser Types

### Transform Parser
Maps dynamic values from Catalyst to TAK fields:

```toml
[consumer.parser.queryName.transform]
uid = "source_field"
lat = "location.lat"
lon = "location.lon"
hae = "altitude"
type = "entity_type"
how = "method"
callsign = "name"
```

### Overwrite Parser
Applies static values to TAK fields:

```toml
[consumer.parser.queryName.overwrite]
type = "a-f-A"
how = "m-g"
```

## Field Reference

### Required Fields
| Field | Description | Format | Example |
|-------|-------------|--------|---------|
| `lat` | Latitude coordinate | Decimal degrees | 38.889484 |
| `lon` | Longitude coordinate | Decimal degrees | -77.035278 |

### Optional Fields
| Field | Description | Format | Example |
|-------|-------------|--------|---------|
| `uid` | Unique identifier | String | "AIRCRAFT123" |
| `type` | Entity type | CoT type string | "a-f-A" |
| `how` | Data source method | CoT how string | "m-g" |
| `callsign` | Entity callsign | String | "N12345" |
| `hae` | Height above ellipsoid | Meters | 1000 |

## Entity Type Example Configuration

### Aircraft
```toml
[consumer.parser.aircraft.overwrite]
type = "a-f-A"     # Aircraft friend
how = "m-g"        # GPS measured
```

     

## Advanced Configuration

### Nested Field Mapping
```toml
[consumer.parser.data.transform]
lat = "position.coordinates.lat"
lon = "position.coordinates.lon"
callsign = "details.identification.name"
```

### Multiple Entity Types
```toml
# Aircraft configuration
[consumer.parser.aircraft.transform]
uid = "hex"
lat = "lat"
lon = "lon"
hae = "alt_geom"

[consumer.parser.aircraft.overwrite]
type = "a-f-A"

# Vessel configuration
[consumer.parser.vessels.transform]
uid = "mmsi"
lat = "position.lat"
lon = "position.lon"

[consumer.parser.vessels.overwrite]
type = "a-f-S"
```

## Best Practices

1. Always include required fields (`lat`, `lon`)
2. Use meaningful unique identifiers
3. Set appropriate entity types
4. Document field mappings
5. Validate data formats

## See Also

- [Consumer Configuration](./consumer-config.md)
- [Producer Configuration](./producer-config.md)
  