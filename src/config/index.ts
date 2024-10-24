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
}

export interface Config{
    dev: boolean
    tak: {
        connection_id: string;
        endpoint: string
        key_file: string;
        cert_file: string;
        callsign: number
        catalyst_lat: number
        catalyst_lon: number
        group: string
        role: string
    },
    consumer?: {
        catalyst_endpoint: string;
        catalyst_token: string
        catalyst_query: string
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

