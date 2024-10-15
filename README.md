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

The producter takes data from the TAK Server and supplies it to Catalyst.

