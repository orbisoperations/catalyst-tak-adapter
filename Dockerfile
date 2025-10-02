# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.2.22

FROM gcr.io/datadoghq/agent:7 AS datadogagent

# Adjust BUN_VERSION as desired
FROM oven/bun:${BUN_VERSION}-slim AS base

LABEL fly_launch_runtime="Bun"

WORKDIR /app

ENV NODE_ENV=production

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3 ca-certificates

# TS dependencies
COPY package.json .
COPY tsconfig.json .
COPY bun.lockb .
RUN bun install --ignore-scripts

# copy source code
COPY index.ts .
COPY src/ src/
COPY entrypoint.sh .

# copy config file
COPY config.toml .

# Final stage for app image
FROM base

# CA certs fix for TLS (prevents x509 unknown authority)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy Datadog Agent into this image and the /etc config skeleton
COPY --from=datadogagent /opt/datadog-agent /opt/datadog-agent
COPY --from=datadogagent /etc/datadog-agent /etc/datadog-agent

# Copy Datadog config files
COPY datadog/system-probe.yaml /etc/datadog-agent/system-probe.yaml
COPY datadog/datadog.yaml /etc/datadog-agent/datadog.yaml
COPY datadog/security-agent.yaml /etc/datadog-agent/security-agent.yaml

# Copy built application
COPY --from=build /app /app
COPY --from=build /app/entrypoint.sh /entrypoint.sh

ARG TAK_CERT_FILE=tak-admin.cert.pem
ARG TAK_KEY_FILE=tak-admin.key.pem

COPY ${TAK_CERT_FILE} ./${TAK_CERT_FILE}
COPY ${TAK_KEY_FILE} ./${TAK_KEY_FILE}

RUN chmod +x /entrypoint.sh

EXPOSE 8080/tcp
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["curl", "-f", "http://localhost:8080/health", "||", "exit", "1"]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000/tcp

# Simple entrypoint that starts Agent + your app
ENTRYPOINT ["/entrypoint.sh"]