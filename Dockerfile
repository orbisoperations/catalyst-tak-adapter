# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1-debian AS base
WORKDIR /usr/src/app
# copy production dependencies and source code into final image
FROM base AS release
ENV NODE_ENV=production
COPY index.ts .
COPY src/ src/
COPY package.json .
COPY tsconfig.json .
COPY bun.lockb .

RUN chown -R bun:bun /usr/src/app

USER bun
RUN ls -al src
RUN bun install --ignore-scripts

# run the app
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]