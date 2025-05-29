import fs from "fs"
import toml from "toml"

export interface CoTTransform {
    uid?: string
    type: string
    lat: string
    lon: string
    hae?: string
    how?: string
    callsign?: string
    remarks?: string
}

export interface CoTOverwrite {
    uid?: string
    type?: string
    lat?: string
    lon?: string
    hae?: string
    how?: string
    callsign?: string
    remarks?: string
}

export interface Config{
    dev: boolean
    tak: {
        connection_id: string; // SECRET
        endpoint: string; // SECRET
        key_file: string; // SECRET
        cert_file: string; // SECRET
        callsign: number
        catalyst_lat: number
        catalyst_lon: number
        group: string
        role: string
    },
    consumer?: {
        catalyst_endpoint: string;
        catalyst_token: string; // SECRET
        catalyst_query: string; // SECRET
        catalyst_query_variables: Record<string, any>
        catalyst_query_poll_interval_ms: number
        local_db_path: string
        parser: {
            [key: string]: {
                transform: CoTTransform
                overwrite?: CoTOverwrite
            }
        }
        chat: {
            [key: string]: {
                recipient: string
                message_id: string
                message_vars: {
                    [key: string]: string
                }
                message_template: string
            }
        }
    },
    producer?: {
        catalyst_jwks_endpoint: string;
        catalyst_app_id: string; // SECRET
        local_db_path: string
        local_download_path: string
        graphql_port: number
        graphql_host: string
    }
}

// Config items we'd like to keep secret
export interface SecretConfig {
    tak?: {
        key_file?: string;
        cert_file?: string;
        endpoint?: string;
        connection_id?: string;
    };
    consumer?: {
        catalyst_token?: string;
        catalyst_query?: string
    };
    producer?: {
        catalyst_app_id?: string;
    };
}

// Helper to get secrets from environment variables
function getSecrets(): SecretConfig {
    return {
        tak: {
            key_file: process.env.FLY_SECRET_TAK_KEY_FILE ?? undefined,
            cert_file: process.env.FLY_SECRET_TAK_CERT_FILE ?? undefined,
            endpoint: process.env.FLY_SECRET_TAK_ENDPOINT ?? undefined,
            connection_id: process.env.FLY_SECRET_TAK_CONNECTION_ID ?? undefined
        },
        consumer: {
            catalyst_token: process.env.FLY_SECRET_CONSUMER_CATALYST_TOKEN ?? undefined,
            catalyst_query: process.env.FLY_SECRET_CONSUMER_CATALYST_QUERY ?? undefined
        },
        producer: {
            catalyst_app_id: process.env.FLY_SECRET_PRODUCER_CATALYST_APP_ID ?? undefined
        }
    };
}

// Deep merge helper
function deepMerge(target: any, source: any) {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

export function getConfig() {
    const configPath = process.env.CONFIG_PATH || "config.toml"
    const tomlConfig = toml.parse(fs.readFileSync(configPath).toString())
    const secrets = getSecrets()
    
    // Merge secrets with TOML config, with secrets taking precedence
    const config = deepMerge(tomlConfig, secrets)

    console.log("Loaded configuration (secrets redacted)")
    return config as Config
}

