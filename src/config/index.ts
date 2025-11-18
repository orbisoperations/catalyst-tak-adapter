import fs from "fs";
import toml from "smol-toml";
import { merge } from "lodash";
import z from "zod";
import { generateMock } from "@anatine/zod-mock";

// Zod schema for SecretConfig validation
export const SecretConfigSchema = z
  .object({
    dev: z.boolean(),
    consumer: z
      .object({
        enabled: z.boolean().optional(),
        catalyst_token: z.string().optional(),
        catalyst_query: z.string().optional(),
        catalyst_query_poll_interval_ms: z.number().optional(),
      })
      .optional(),
    producer: z
      .object({
        enabled: z.boolean().optional(),
        catalyst_app_id: z.string().optional(),
        catalyst_jwt_issuer: z.string().optional(),
      })
      .optional(),
  })
  .optional();
export type SecretConfig = z.input<typeof SecretConfigSchema>;

// Helper to get secrets from environment variables
function getSecrets(): SecretConfig {
  const secrets: SecretConfig = {
    dev: process.env.NODE_ENV === "development",
    consumer: {
      enabled: process.env.FLY_SECRET_CONSUMER_ENABLED
        ? process.env.FLY_SECRET_CONSUMER_ENABLED === "true"
        : undefined,
      catalyst_token:
        process.env.FLY_SECRET_CONSUMER_CATALYST_TOKEN ?? undefined,
      catalyst_query:
        process.env.FLY_SECRET_CONSUMER_CATALYST_QUERY ?? undefined,
      catalyst_query_poll_interval_ms: process.env
        .FLY_SECRET_CONSUMER_CATALYST_QUERY_POLL_INTERVAL_MS
        ? Number(
            process.env.FLY_SECRET_CONSUMER_CATALYST_QUERY_POLL_INTERVAL_MS,
          )
        : undefined,
    },
    producer: {
      enabled: process.env.FLY_SECRET_PRODUCER_ENABLED
        ? process.env.FLY_SECRET_PRODUCER_ENABLED === "true"
        : undefined,
      catalyst_app_id:
        process.env.FLY_SECRET_PRODUCER_CATALYST_APP_ID ?? undefined,
      catalyst_jwt_issuer:
        process.env.FLY_SECRET_PRODUCER_CATALYST_JWT_ISSUER ?? undefined,
    },
  };

  const parsedSecrets = SecretConfigSchema.safeParse(secrets);
  return parsedSecrets?.data || { dev: process.env.NODE_ENV === "development" };
}

// Zod schemas for Config validation
const CoTTransformSchema = z.object({
  uid: z.string().optional().describe("The UID of the CoT event"),
  type: z.string(),
  lat: z.string(),
  lon: z.string(),
  hae: z.string().optional(),
  how: z.string().optional(),
  callsign: z.string().optional(),
  remarks: z.string().optional(),
});

const CoTOverwriteSchema = z.object({
  uid: z.string().optional(),
  type: z.string().optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
  hae: z.string().optional(),
  how: z.string().optional(),
  callsign: z.string().optional(),
  remarks: z.string().optional(),
});

const ConfigSchema = z.object({
  tak_server_ping_timeout_ms: z.number().default(120_000).optional(), // 2 minutes
  dev: z.boolean().default(false),
  tak: z.object({
    connection_id: z.string(),
    endpoint: z.string(),
    key_file: z.string(),
    cert_file: z.string(),
    callsign: z.string(),
    catalyst_lat: z.number().optional(),
    catalyst_lon: z.number().optional(),
    group: z.string(),
    role: z.string(),
    video: z
      .object({
        rtsp: z
          .object({
            enabled: z.boolean(),
            rtsp_server: z.string(),
            rtsp_port: z.string(),
            rtsp_path: z.string(),
          })
          .optional(),
      })
      .optional()
      .default({}),
  }),
  consumer: z
    .object({
      enabled: z.boolean(),
      catalyst_endpoint: z.string(),
      catalyst_token: z.string(),
      catalyst_query: z.string(),
      catalyst_query_variables: z.record(z.any()),
      catalyst_query_poll_interval_ms: z.number(),
      local_db_path: z.string().default("./db/consumer"),
      parser: z.record(
        z.object({
          transform: CoTTransformSchema,
          overwrite: CoTOverwriteSchema.optional(),
        }),
      ),
      chat: z
        .object({
          message_template: z.string(),
          message_vars: z.record(z.string()),
          cots: z.object({
            transform: z.object({
              recipient_uid: z.string(),
              sender_uid: z.string(),
              sender_callsign: z.string(),
              message_id: z.string(),
              chatroom: z.string(),
            }),
          }),
        })
        .optional()
        .nullable(),
    })
    .optional(),
  producer: z
    .discriminatedUnion("enabled", [
      z.object({
        enabled: z.literal(true),
        catalyst_jwks_url: z.string(),
        catalyst_jwt_issuer: z.string(),
        catalyst_app_id: z.string(),
        local_db_path: z.string().default("./db/producer"),
        local_download_path: z.string().default(".tak_downloads"),
        graphql_port: z.number(),
        graphql_host: z.string(),
      }),
      z.object({
        enabled: z.literal(false),
      }),
    ])
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type CoTTransform = z.infer<typeof CoTTransformSchema>;
export type CoTOverwrite = z.infer<typeof CoTOverwriteSchema>;

export function getConfig(): Config {
  const configPath = process.env.CONFIG_PATH || "config.toml";
  const tomlConfig = toml.parse(fs.readFileSync(configPath).toString());
  const secrets = getSecrets();

  // Merge secrets with TOML config, with secrets taking precedence
  const mergedConfig = merge({}, tomlConfig, secrets);

  const parsedConfig = ConfigSchema.safeParse(mergedConfig);
  if (!parsedConfig.success) {
    console.error("Invalid configuration:", parsedConfig.error);
    process.exit(1);
  }

  const validatedConfig: Config = parsedConfig.data;

  if (validatedConfig.consumer?.enabled) {
    if (!validatedConfig.consumer?.catalyst_query) {
      // if the query is empty, maybe because of the secrets.catalyst_query being set empty
      // so we need to set the query to the query in the toml config
      validatedConfig.consumer.catalyst_query =
        // @ts-expect-error-ignore: if the consumer is enabled, the catalyst_query is required
        tomlConfig.consumer.catalyst_query as string;
    }
  }

  if (process.env.NODE_ENV !== "development") {
    console.log("[CONFIG] NODE_ENV is not development, setting dev to false");
    validatedConfig.dev = false;
  }

  console.log("[CONFIG] validatedConfig", validatedConfig);

  return validatedConfig;
}

function initTemplateConfig() {
  // get mock config
  const mockConfig = generateMock(ConfigSchema, { seed: 1 });

  const stringifiedConfig = toml.stringify(mockConfig);
  const fileContents = `
# This is a template configuration file for the Catalyst TAK Adapter.
# It is used to configure the adapter to connect to the Catalyst platform and
# to the TAK server.
#
# The configuration is stored in a TOML file, which is a simple format that is
# easy to read and write.
#
# The configuration is split into sections, each section containing a set of
# key-value pairs.
${stringifiedConfig}`;

  // save config to file
  fs.writeFileSync("config.template.toml", fileContents);
}

initTemplateConfig();
