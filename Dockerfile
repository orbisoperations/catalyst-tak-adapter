# Pull down image from Orbis GHCR and do a fly local only deploy
ARG BASE_VERSION="0.1.1"
FROM ghcr.io/orbisoperations/catalyst-adapter-base:${BASE_VERSION} AS base

LABEL fly_launch_runtime="Bun"

WORKDIR /app

ENV NODE_ENV=production

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

# TS dependencies
COPY package.json .
COPY tsconfig.json .
COPY bun.lockb .
RUN bun install --ignore-scripts

# copy source code
COPY index.ts .
COPY src/ src/

# copy config file
COPY config.toml .

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

ARG TAK_CERT_FILE=tak-admin.cert.pem
ARG TAK_KEY_FILE=tak-admin.key.pem

COPY ${TAK_CERT_FILE} ./${TAK_CERT_FILE}
COPY ${TAK_KEY_FILE} ./${TAK_KEY_FILE}

EXPOSE 8080/tcp
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["curl", "-f", "http://localhost:8080/health", "||", "exit", "1"]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000/tcp

# Simple entrypoint that starts Agent + your app
CMD ["bun", "run", "index.ts"]