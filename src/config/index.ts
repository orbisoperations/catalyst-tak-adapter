import fs from "fs"
import toml from "toml"
export interface Config{
    tak: {
        connection_id: string;
        endpoint: string
        key_file: string;
        cert_file: string;
    },
    consumer?: {
        catalyst_endpoint: string;
        catalyst_token: string
        catalyst_query: string
        catalyst_query_variables: Record<string, any>
        local_storage_dir: string
    },
    producer?: {
        catalyst_jwks_endpoint: string;
        catalyst_app_id: string
        local_storage_dir: string
    }
}

export function getConfig() {
    const configPath = process.env.CONFIG_PATH || "config.toml"
    const config = toml.parse(fs.readFileSync(configPath).toString())

    console.log(config)

    return config as Config
}

