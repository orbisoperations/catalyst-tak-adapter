# catalyst-tak-adapter

The Catalyst Tak Adapter is a service design to bridge TAK environments to a rich data integration fabric.

# Table of Contents
- [Minimal Production Setup](#minimal-production-setup)
  - [Check out Repo and Run the Build Script](#check-out-repo-and-run-the-build-script)
  - [Minimal TOML Configuration File](#minimal-toml-configuration-file)
  - [TAK Key and Certs](#tak-key-and-certs)
  - [Adapter Storage](#adapter-storage)
  - [Deployments](#deployments)
    - [Running the Container](#running-the-container)
    - [Running in Fly.io](#running-in-flyio)
- [Development Steps](#development-steps)
    - [Check out Repo and Bootrstrap TAK Dev Server](#check-out-repo-and-bootrstrap-tak-dev-server)
    - [Setting Up Your Browser](#setting-up-your-browser)
    - [Check out this Repo](#check-out-this-repo)
        - [Copy over User Key/Cert](#copy-over-user-keycert)
        - [Decrypt the User Key](#decrypt-the-user-key)
        - [Run the Adapter](#run-the-adapter)
- [Adapter Runthrough](#adapter-runthrough)
    - [Consumer](#consumer)
    - [Producer](#producer)
    - [TOML Config](#toml-config)
        - [Example TOML](#example-toml)
        - [Default Config Values](#default-config-values)
        - [TOML Sections](#toml-sections)
            - [TAK section - \[tak\]](#tak-section---tak)
            - [Consumer section - \[consumer\]](#consumer-section---consumer)
                - [Consumer Parsers - \[consumer.parser.*.transform\|overwrite\]](#consumer-parsers---consumerparsertransformoverwrite)
            - [Producer section \[producer\]](#producer-section-producer)

## Minimal Production Setup

Docker is our recommended path for a production setup. The following steps will guide you through the process of setting up the adapter in a production environment.

### Check out Repo and Run the Build Script

Once this repo has been checked out, you can build this project in 2 ways.

`bun`: `bun run build`
`docker`: `docker build -t catalyst-tak-adapter .`

Either of these commands will build the project and result in a new container image.

### Minimal TOML  Configuration File

Minimal toml config:
```toml
[tak]
key_file="path to tak user key in PEM format"
cert_file="path to tak user cert in PEM format"
connection_id="a connection name for the TAK socket"
endpoint="TAK endpoint to connect to. Must be in the foramt ssl://server-hostname.com:8089"

[consumer]
catalyst_endpoint="https://gateway.catalyst.devintelops.io/graphql"
catalyst_token="insertcatalysttokenhere"
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

[consumer.parser.aircraftWithinDistance.transform]
uid = "hex"
lat = "lat"
lon = "lon"
hae = "alt_geom"

[consumer.parser.aircraftWithinDistance.overwrite]
type = "a-f-A"

[producer]
catalyst_app_id = "youridhere" # example app id
```

This configuration will need to be mounted into the container at `/usr/src/app/config.toml` to be used by the adapter.

### TAK Key and Certs

Both the key and the Cert need to be in PEM format. The key will need to be decrypted before use.

These keys will need to be mounted at:
* `key` - `/usr/src/app/key.pem`
* `cert` - `/usr/src/app/cert.pem`

### Adapter Storage

Although the adapter is designed to keep data ephemeral (staleness is set by the Catalyst polling rate) there is persistence if desired.

The directory `/usr/src/app/db` can be mounted to a volume to persist data between container restarts.

### Deployments 

#### Running the Container

The following command will run the container with the necessary mounts and environment variables.

```bash
docker run tak-adapter \
  -v /path/to/config.toml:/usr/src/app/config.toml \
  -v /path/to/key.pem:/usr/src/app/key.pem \
  -v /path/to/cert.pem:/usr/src/app/cert.pem \
  -v /path/to/db:/usr/src/app/db
```

#### Running in Fly.io


Generating time limited SSH keys:
```bash
[ -f ~/.ssh/flytmp ] && rm -f ~/.ssh/{flytmp,flytmp-cert.pub} & 
fly ssh issue personal ~/.ssh/flytmp --hours 1 -o $YOUR_ORG_HERE
```

Opening a tunnel to the fly.io instance:
```bash
fly proxy 10022:22 -a $YOUR_APP_NAME $APP_IP_ADDR 
```

Start SFTP session to move creds:
```bash
sftp -o "StrictHostKeyChecking=no" \
            -o "UserKnownHostsFile=/dev/null" \
            -P 10022 -i ~/.ssh/flytmp root@localhost
```



## Development Steps

### Check out Repo and Bootrstrap TAK Dev Server

Check out our fork of the [CLOUD-RF Tak-Server repo](https://github.com/orbisoperations/tak-server).

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

## TOML Config

The adapter(s) use a TOML config to define which types of data the adapter should pull/push to/from Catalyst and on which cadence.

An example toml:
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
catalyst_jwks_endpoint="http://localhost:8080/jwks"
catalyst_app_id = "thebestappid"
local_db_path="yourdb"
graphql_port = 8080
graphql_host = "0.0.0.0"
```
### Default Config Values
| Key                                          | Value                                                                  |
|----------------------------------------------|------------------------------------------------------------------------|
| producer.catalyst_jwks_endpoint              | defaults to `https://gateway.catalyst.devintelops.io/.well-known/jwks.json` |
| producer.graphql\_port                       | defaults to 8080                                                       |
| producer.graphql\_host                       | defaults to 0.0.0.0                                                    |
| producer.local\_db\_path                     | defaults to `./db`                                                |
| consumer.catalyst\_query\_poll\_interval\_ms | defaults to 10000 (10 seconds)                                         |
| consumer.catalyst\_endpoint                  | defaults to `https://gateway.catalyst.devintelops.io/graphql`            |


### Toml Sections



#### TAK section - [tak]

```toml
[tak]
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

#### Consumer section - [consumer]

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

* `catalyst_endpoint` - The endpoint to connect to Catalyst. This defaults to `https://gateway.catalyst.devintelops.io/graphql`.
* `catalyst_token` - The token to use when connecting to Catalyst. This must be retrieved through the UI. All tokens are scoped to specific data channels.
* `catalyst_query` - The query to use when pulling data from Catalyst. This must be a valid GraphQL query.
* `catalyst_query_poll_interval_ms` - The interval at which to poll Catalyst for data. This will also determine who quickly data becomes *stale* in TAK. This defaults to `10s`.
* `catalyst.parser.*.transform` - The mapping of data from the GraphQL query to supported CoT fields. This is required for all queries as it ensure the base CoT values are present for all data sent to TAK.
* `catalyst.parser.*.overwrite` - Overwrite allows values to be written to the provided value. The key/value pair are used to identify the CoT field (key) and assign a value (value). This is optional.

##### Consumer Parsers - [consumer.parser.*.transform|overwrite]

The custom parser fields help get data that may not already be structured as CoTs into a format that TAK can understand.

The transform section is required for all queries and supports the following fields:

| Field    | Example Mapping     | Status     |
|----------|---------------------|------------|
| uid      | "uid"               | *optional* |
| lat      | "point.lat"         | *required* |
| lon      | "point.lon"         | *required* |
| type     | "type"              | *optional* |
| how      | "how"               | *optional* |
| callsign | "detail.callsign"   | *optional* |

The overwrite section is optional and supports the following fields:

| Field     | Example Mapping     | Status     |
|-----------|---------------------|------------|
| uid       | "uid"               | *optional* |
| lat       | "point.lat"         | *optional* |
| lon       | "point.lon"         | *optional* |
| type      | "type"              | *optional* |
| how       | "how"               | *optional* |
| callsign  | "detail.callsign"   | *optional* |

In practice, although many of these fields are optional, it is recommended to include a transform or overwrite for all fields as this will help the data be most useful to TAK users.

Parsers are configured by the query name. In the example above, the query name is `aircraftWithinDistance` and that key is used to identify the correct parser set to use. If a parser is not defined the data will not be forwarded to TAK.


##### Producer section [producer]

[producer]
catalyst_jwks_endpoint="http://localhost:8080/jwks"
catalyst_app_id = "thebestappid"
local_db_path="yourdb"
graphql_port = 8080
graphql_host = "0.0.0.0"

The producer section governs how to connect to Catalyst in a way that Catalyst can read data.

* `catalyst_jwks_endpoint` - The URL to the JWKS endpoint for Catalyst. This is used to verify the JWT signature in side of your data channel. This defaults to `https://gateway.catalyst.devintelops.io/.well-known/jwks.json`.
* `catalyst_app_id` - The application ID to use when connecting to Catalyst. This must be retrieved through the UI. This ID can be used to validate the provided token has been scoped to include this data channel (app).
* `local_db_path` - The path to the local database. This defaults to `./db`.
* `graphql_port` - The port to run the GraphQL server on. This defaults to `8080`.
* `graphql_host` - The host to run the GraphQL server on. This defaults to 0.0.0.0`








