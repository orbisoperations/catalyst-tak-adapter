# Fly.io Deployment

This guide covers deploying the Catalyst TAK Adapter to Fly.io.

## Overview

Fly.io is a cloud platform that allows you to deploy and scale your applications in a highly available and scalable manner.

## Prerequisites

- Fly.io account
- Fly CLI installed
- TAK User key and certificate (key.pem and cert.pem)
- Configuration file (config.toml) - see [example](../../config.example.toml)

## Essential Files

After running `fly launch`, you'll have two critical files:

### fly.toml

This is your main Fly.io configuration file. Unlike typical examples, we keep this in version control for CI/CD purposes:

### Dockerfile

Your Dockerfile should already be configured, but if you need to update it (e.g., for new dependencies), you can regenerate it:

```bash
fly launch --generate-only
```

## Deployment

### 1. Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login to Fly.io

```bash
fly auth login
```

### 3. Initialize your app

In the directory containing your Dockerfile (and source code), run:

```bash
fly launch
```

This command attempts to guess how to build your application.
If you already have a Dockerfile, Fly will detect it and generate a fly.toml configuration file.
You’ll be prompted for an app name, region, etc. If you already have an existing Fly app, you can skip fly launch and just ensure your corresponding fly.toml is in place.

### 4. Deploy Application

```bash
# Deploy your application
fly deploy
```

Fly will build your Docker image (using the Dockerfile).
Push the built image to Fly.io’s registry.
Start a VM in the chosen region(s) and run your container there.

### Moving Credentials

Generate time limited SSH keys:

```bash
[ -f ~/.ssh/flytmp ] && rm -f ~/.ssh/{flytmp,flytmp-cert.pub} &
fly ssh issue personal ~/.ssh/flytmp --hours 1 -o $YOUR_ORG_HERE
```

Open a tunnel to the fly.io instance:

```bash
fly proxy 10022:22 -a $YOUR_APP_NAME $APP_IP_ADDR
```

Start SFTP session to move creds:

```bash
sftp -o "StrictHostKeyChecking=no" \
            -o "UserKnownHostsFile=/dev/null" \
            -P 10022 -i ~/.ssh/flytmp root@localhost
```

## See Also

[Fly.io Documentation](https://fly.io/docs)
