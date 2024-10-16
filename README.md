# catalyst-tak-adapter


## Development Steps

### Check out Repo and Bootrstrap TAK Dev Server

Check out our fork of the CLOUD-RF Tak-Server repo.

*You will need to also follow the step to download the right tak server docker image from tak.gov and place it in the root of the directory.*

Since most of our team runs on MAC/OSX, you will need your IP address:

```bash
ipconfig getifaddr en0
```

Run `scipts/setup.sh` to configure and start the tak server. Take care to enter the IP address you found above.
*WebTAK will not work if you use localhost or 127.0.0.1 for no reason we can discern.*

### Setting Up Your Browser
Use Firefox!

Import cert/key (as a .p12) into 'Your Certificates' (Setting > Privacy & Security) and ensure you trust the CA.
Go the the Authorities tab and enable website trust for TAK.

*TODO* include images plz.

### Check out this Repo
Hopefully you already have, but if not, check out this repo.

#### Copy over User Key/Cert

Copy a pair of key/certs created by the tak server configuration for use by the adapter.

By default, there are admin, user1, and user2 creds. Either of the users will work in this case.

#### Decrypt the User Key

```bash
openssl rsa -in key.pem -out key.pem
```
*Note: The password is `atakatak`*

#### Run the Adapter

```bash
bun run index.ts
```

# Adapter Runthrough

## Consumer

The consumer takes data from Catalyst and supplies it to the TAK Server.

## Producer

The producer takes data from the TAK Server and supplies it to Catalyst.

### Local Storage

## TOML Config

The adapter(s) use a TOML config to define which types of data the adapter should pull/push to/from Catalyst and on which cadence.

```toml
[tak]
key_file="key.pem"
cert_file="cert.pem"
connection_id="TestConnection"
endpoint="ssl://127.0.0.1:8089"

[consumer]
catalyst_endpoint="https://gateway.catalyst.devintelops.io/graphql"
catalyst_token="yourtokenhere"
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

catalyst_query_poll_interval_ms = 10000

[consumer.parser.aircraftWithinDistance.transform]
uid = "hex"
lat = "lat"
lon = "lon"
hae = "alt_geom"

[consumer.parser.aircraftWithinDistance.overwrite]
type = "a-f-A"

[producer]
catalyst_jwks_url="http://localhost:8080/jwks"
catalyst_app_id = "thebestappid"
```

### TAK section [tak]

```toml
key_file="key.pem"
cert_file="cert.pem"
connection_id="TestConnection"
endpoint="ssl://127.0.0.1:8089"
```

This section governs how to connect to the TAK server.

* `key_file` - The path to the user key file.
* `cert_file` - The path to the user cert file.
* `connection_id` - The connection ID to use when connecting to the TAK server.
* `endpoint` - The endpoint to connect to the TAK server. This __must be formatted__ as *sssl://<ip>:<port>*.

### Consumer section [consumer]

```toml
[consumer]
catalyst_endpoint="https://gateway.catalyst.devintelops.io/graphql"
catalyst_token="yourtokenhere"
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

catalyst_query_poll_interval_ms = 10000

[consumer.parser.aircraftWithinDistance.transform]
uid = "hex"
lat = "lat"
lon = "lon"
hae = "alt_geom"

[consumer.parser.aircraftWithinDistance.overwrite]
type = "a-f-A"
```

The base consumer section governs how to connect to Catalyst.

* `catalyst_endpoint` - The endpoint to connect to Catalyst. This must be the HTTPS Graphql endpoint.
* `catalyst_token` - The token to use when connecting to Catalyst. This must be retrieved through the UI. All tokens are scoped to specific data channels.
* `catalyst_query` - The query to use when pulling data from Catalyst. This must be a valid GraphQL query.
* `catalyst_query_poll_interval_ms` - The interval at which to poll Catalyst for data. This will also determine who quickly data becomes *stale* in TAK.

#### Consumer Parser Section [consumer.parser]

There are two sub-sections under the consumer section: `transform` and `overwrite`.

Although both of these edit the resulting CoT data, transform maps data from the GraphQL query to supported CoT fields, while overwrite sets the CoT field with the provided data.

Transformers are required on all queries, while overwrites are optional.

Parsers are configured by the query name. In the example above, the query name is `aircraftWithinDistance`.

### Producer section [producer]

```toml
[producer]
catalyst_jwks_url="http://localhost:8080/jwks"
catalyst_app_id = "thebestappid"
```

The producer section governs how to connect to Catalyst in a way that Catalyst can read data.

* `catalyst_jwks_url` - The URL to the JWKS endpoint for Catalyst. This is used to verify the JWT signature in side of your data channel.
* `catalyst_app_id` - The application ID to use when connecting to Catalyst. This must be retrieved through the UI. This ID can be used to validate the provided token has been scoped to include this data channel (app).





