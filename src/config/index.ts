import fs from "fs";
import toml from "smol-toml";
import { merge } from "lodash";
import z from "zod";
import { generateMock } from "@anatine/zod-mock";

// Config items we'd like to keep secret
export interface SecretConfig {
  dev: boolean;
  tak: {
    raw_key_and_cert: boolean;
    key_file?: string;
    cert_file?: string;
    endpoint?: string;
    connection_id?: string;
  };
  consumer: {
    catalyst_token?: string;
    catalyst_query?: string;
  };
  producer: {
    catalyst_app_id?: string;
  };
}

// Helper to get secrets from environment variables
function getSecrets(): SecretConfig {
  return {
    dev: process.env.NODE_ENV === "development",
    tak: {
      // use boolean to determine if the key and cert are raw strings
      raw_key_and_cert: process.env.RAW_KEY_AND_CERT === "true",
      // if raw_key_and_cert is true, use the key and cert from the environment
      // this is used for fly.io secrets
      key_file: process.env.FLY_SECRET_TAK_KEY_FILE ?? undefined,
      cert_file: process.env.FLY_SECRET_TAK_CERT_FILE ?? undefined,
      endpoint: process.env.FLY_SECRET_TAK_ENDPOINT ?? undefined,
      connection_id: process.env.FLY_SECRET_TAK_CONNECTION_ID ?? undefined,
    },
    consumer: {
      catalyst_token:
        process.env.FLY_SECRET_CONSUMER_CATALYST_TOKEN ?? undefined,
      catalyst_query:
        process.env.FLY_SECRET_CONSUMER_CATALYST_QUERY ?? undefined,
    },
    producer: {
      catalyst_app_id:
        process.env.FLY_SECRET_PRODUCER_CATALYST_APP_ID ?? undefined,
    },
  };
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
  dev: z.boolean().default(false),
  tak: z.object({
    raw_key_and_cert: z.boolean().default(false),
    connection_id: z.string(),
    endpoint: z.string(),
    key_file: z.string(),
    cert_file: z.string(),
    callsign: z.string(),
    catalyst_lat: z.number().optional(),
    catalyst_lon: z.number().optional(),
    group: z.string(),
    role: z.string(),
    rtsp_server: z.string(),
    rtsp_port: z.string(),
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
        .record(
          z.object({
            recipient: z.string(),
            message_id: z.string(),
            message_vars: z.record(z.string()),
            message_template: z.string(),
          }),
        )
        .nullable(),
    })
    .optional(),
  producer: z
    .object({
      enabled: z.boolean(),
      catalyst_jwks_url: z.string(),
      catalyst_app_id: z.string(),
      local_db_path: z.string().default("./db/producer"),
      local_download_path: z.string().default(".tak_downloads"),
      graphql_port: z.number(),
      graphql_host: z.string(),
    })
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
    validatedConfig.tak.raw_key_and_cert = true;
  }
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
