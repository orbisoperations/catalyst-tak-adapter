# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1-debian AS base

WORKDIR /app

ENV NODE_ENV=production

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

ARG TAK_CERT_FILE=tak-admin.cert.pem
ARG TAK_KEY_FILE=tak-admin.key.pem

COPY ${TAK_CERT_FILE} ./${TAK_CERT_FILE}
COPY ${TAK_KEY_FILE} ./${TAK_KEY_FILE}

RUN chown -R bun:bun /app
USER bun

# run the app
EXPOSE 8080/tcp
EXPOSE 3000/tcp

ENTRYPOINT [ "bun", "run", "index.ts" ]