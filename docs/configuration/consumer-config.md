# Consumer Configuration

This document explains how to configure _consumer_ instances. A **consumer** polls the Catalyst GraphQL API at a configurable cadence, converts the returned data into TAK Cursor-on-Target (CoT) messages, and publishes those messages onto the adapter’s shared TAK connection.

---

## `[[consumers]]` section (array-of-tables)

A configuration can contain **one _or many_ consumer blocks**. Each block follows the TOML _array-of-tables_ syntax (`[[consumers]]`).

```toml
[[consumers]]
# — Core —
enabled   = true                    # Mandatory – set false to disable without deleting the block
name      = "aircraft-feed"          # Mandatory – unique identifier used in logs & timer labels

# Catalyst connection
catalyst_endpoint  = "https://gateway.catalyst.devintelops.io/graphql"
catalyst_token     = "$CATALYST_API_TOKEN"

# GraphQL query
catalyst_query = """
query Aircraft($lat: Float!, $lon: Float!, $dist: Float!) {
  aircraftWithinDistance(lat: $lat, lon: $lon, dist: $dist) {
    hex flight lat lon alt_geom
  }
}
"""
# Optional – variables object injected into the query
catalyst_query_variables = { lat = 38.93, lon = -77.18, dist = 50 }

# Polling cadence (default: 1000 ms)
catalyst_query_poll_interval_ms = 10_000

# Local LMDB path (default: "./db/consumer/<name>")
local_db_path = "./db/consumer/aircraft-feed"

# ---------------------
# Per-feed parsing rules
# ---------------------
[consumers.parser.aircraftWithinDistance.transform]
uid       = "hex"
type      = "\"a-f-A\""      # literal string – escapes needed inside TOML
lat       = "lat"
lon       = "lon"
hae       = "alt_geom"
how       = "\"h-g-i-g-o\""
remarks   = "flight"

[consumers.parser.aircraftWithinDistance.overwrite]
# Optional static overrides
# type = "a-f-A"
```

### Chat feed (optional)

If a consumer must convert Catalyst chat messages into GeoChat CoTs, add a nested `[consumers.chat]` section:

```toml
[consumers.chat]
message_template = "[{sender_callsign}] {text}"

# Where to pull variables from the Catalyst JSON for the text template
message_vars = { sender_callsign = "from", text = "body" }

# How to build the CoT headers
[consumers.chat.cots.transform]
recipient_uid   = "recipient.uid"
sender_uid      = "fromUid"
sender_callsign = "from"
message_id      = "id"
chatroom        = "room"
```

---

## Field reference

| Field                             | Type             | Required | Description                                                        | Default                |
| --------------------------------- | ---------------- | -------- | ------------------------------------------------------------------ | ---------------------- |
| `enabled`                         | bool             | yes      | Toggle this consumer on/off                                        | –                      |
| `name`                            | string           | yes      | Unique identifier for logging & DB path                            | –                      |
| `catalyst_endpoint`               | string           | yes      | Catalyst GraphQL endpoint                                          | –                      |
| `catalyst_token`                  | string           | yes      | Bearer token for Catalyst                                          | –                      |
| `catalyst_query`                  | multiline string | yes      | GraphQL query text                                                 | –                      |
| `catalyst_query_variables`        | table            | no       | Variables object passed with the query                             | `{}`                   |
| `catalyst_query_poll_interval_ms` | int              | no       | Polling interval (ms)                                              | `1000`                 |
| `local_db_path`                   | string           | no       | Path to LMDB used for de-duplication                               | `./db/consumer/<name>` |
| `[consumers.parser.*]`            | table(s)         | yes      | Map of _resultKey → transform / overwrite_ rules for non-chat CoTs | –                      |
| `[consumers.chat]`                | table            | no       | Enables GeoChat processing                                         | –                      |

---

## Multi-consumer example

```toml
# Aircraft feed polling every 10 s
[[consumers]]
name      = "aircraft-feed"
enabled   = true
catalyst_endpoint  = "https://gateway.catalyst.devintelops.io/graphql"
catalyst_token     = "$CATALYST_TOKEN_AIR"
catalyst_query     = """ <query omitted> """
catalyst_query_variables = { lat = 38.93, lon = -77.18, dist = 50 }
catalyst_query_poll_interval_ms = 10_000

[consumers.parser.aircraftWithinDistance.transform]
uid = "hex" ; lat = "lat" ; lon = "lon" ; hae = "alt_geom"

# Chat feed polling every 2 s
[[consumers]]
name      = "chat-feed"
enabled   = true
catalyst_endpoint  = "https://gateway.catalyst.devintelops.io/graphql"
catalyst_token     = "$CATALYST_TOKEN_CHAT"
catalyst_query     = """ <chat query> """
catalyst_query_poll_interval_ms = 2000

[consumers.chat]
message_template = "[{sender_callsign}] {text}"
message_vars     = { sender_callsign = "from", text = "body" }

[consumers.chat.cots.transform]
recipient_uid   = "recipient.uid"
sender_uid      = "fromUid"
sender_callsign = "from"
message_id      = "id"
chatroom        = "room"
```

---

## See Also

- [Parser Configuration](./parser-config.md)
- [Producer Configuration](./producer-config.md)
