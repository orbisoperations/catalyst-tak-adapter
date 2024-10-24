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
}

export interface CoTOverwrite {
    uid?: string
    type?: string
    lat?: string
    lon?: string
    hae?: string
    callsign?: string
}

export interface Config{
    dev: boolean
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
        catalyst_query_poll_interval_ms: number
        local_storage_dir: string
        parser: {
            [key: string]: {
                transform: CoTTransform
                overwrite?: CoTOverwrite
            }
        }
    },
    producer?: {
        catalyst_jwks_endpoint: string;
        catalyst_app_id: string
        local_db_path: string
        graphql_port: number
        graphql_host: string
    }
}

export function getConfig() {
    const configPath = process.env.CONFIG_PATH || "config.toml"
    const config = toml.parse(fs.readFileSync(configPath).toString())

    console.log(config)

    return config as Config
}

