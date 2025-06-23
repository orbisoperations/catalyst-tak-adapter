import { parse } from "smol-toml";
import { readFileSync } from "fs";
import { join } from "path";
import z from "zod";
import { execSync } from "child_process";

const FlySecretsSchema = z.object({
  consumer: z.object({
    enabled: z.boolean().default(true),
    catalyst_token: z.string(),
    catalyst_query: z.string().optional(),
    catalyst_query_poll_interval_ms: z.number().min(1000),
  }),
  producer: z.object({
    enabled: z.boolean().default(true),
    catalyst_app_id: z.string(),
    catalyst_jwt_issuer: z.string(),
  }),
});

type FlySecrets = z.infer<typeof FlySecretsSchema>;

export function loadFlySecrets(): FlySecrets {
  try {
    // Read the TOML file
    const configPath = join(process.cwd(), "config.toml");
    const configFile = readFileSync(configPath, "utf-8");
    const tomlConfig = parse(configFile);

    const parsed = FlySecretsSchema.safeParse(tomlConfig);
    if (!parsed.success) {
      throw new Error("Invalid config.toml file: " + parsed.error.message);
    }

    const config = parsed.data;

    // Format the secrets for fly.io
    const flySecrets = {
      // producer
      FLY_SECRET_PRODUCER_ENABLED: config.producer.enabled,
      FLY_SECRET_PRODUCER_CATALYST_APP_ID:
        config.producer.catalyst_app_id ?? undefined,
      FLY_SECRET_PRODUCER_CATALYST_JWT_ISSUER:
        config.producer.catalyst_jwt_issuer ?? undefined,
      // consumer
      FLY_SECRET_CONSUMER_ENABLED: config.consumer.enabled,
      FLY_SECRET_CONSUMER_CATALYST_QUERY_POLL_INTERVAL_MS:
        config.consumer.catalyst_query_poll_interval_ms,
      FLY_SECRET_CONSUMER_CATALYST_TOKEN: config.consumer.catalyst_token,
      FLY_SECRET_CONSUMER_CATALYST_QUERY: config.consumer.catalyst_query,
    };

    // Set the secrets using fly.io CLI
    const secretsCommand = Object.entries(flySecrets)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        // Escape quotes and remove newlines for the query
        const formattedValue =
          key === "CONSUMER_CATALYST_QUERY"
            ? (value as string)?.replace(/"/g, '\\"').replace(/\n/g, "")
            : value;
        return `${key}="${formattedValue}"`;
      })
      .join(" \\\n");

    console.log(`fly secrets set ${secretsCommand}`);
    // execute the command
    execSync(`fly secrets set ${secretsCommand}`, { stdio: "inherit" });

    return config;
  } catch (error) {
    console.error("Error loading fly secrets:", error);
    throw error;
  }
}

loadFlySecrets();
