/*
[] TAK as a consumer
    [] we need a scheduling mechanism to send data to TAK
    [X] we need a graphlq to query against Catalyst
    [] we need a way to convert catalyst data to CoT
    [] we need to send the messages to the TAK server
 */

import {Config} from "../../config";
import TAK, {CoT} from "@tak-ps/node-tak";

export class Consumer {
    config: Config
    constructor(config: Config) {
        const storagePath = config.consumer?.local_storage_dir ?
            config.consumer?.local_storage_dir.endsWith("/") ? config.consumer?.local_storage_dir : config.consumer?.local_storage_dir + "/"
            : "./"
        this.config = config;

        if (!this.config.consumer) {
            throw new Error("Consumer config not found")
        }

        if (!this.config.consumer.catalyst_endpoint || !this.config.consumer.catalyst_query || !this.config.consumer.catalyst_token) {
            throw new Error("Catalyst endpoint, query, or token not found")
        }

        if (!this.config.consumer.catalyst_query_poll_interval_ms) {
            console.warn("Poll interval not found, defaulting to 1 minute")
            this.config.consumer.catalyst_query_poll_interval_ms = 1 * 60 * 1000
        }


    }

    async doGraphqlQuery() {

        const result = await fetch(this.config.consumer!.catalyst_endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: "Bearer " + this.config.consumer!.catalyst_token,
            },
            body: JSON.stringify({
                query: this.config.consumer!.catalyst_query,
                variables: new Object(this.config.consumer!.catalyst_query_variables)
            }),
        })

        return  await result.json()
    }

    jsonToCots(json: any) {
        const data = json.data
        // specific airplane
        const transforms = this.config.consumer?.transforms
        if (transforms === undefined) {
            console.warn("no transforms have been found and unable to convert data to CoT")
            return []
        }

        let cots: CoT[] = []
        for (const [key, transform] of Object.entries(transforms)) {
            if (data[key] === undefined) {
                console.warn("key not found in data", key)
            } else {
                const dataToTransform = data[key] as any[]
                for (const dateElement of dataToTransform) {
                    console.error(dateElement)
                    let uid, type, lat, lon, hae, callsign
                    if (transform.uid && dateElement[transform.uid]) uid = dateElement[transform.uid]
                    else uid = crypto.randomUUID()
                    if (transform.type && dateElement[transform.type]) type = dateElement[transform.type]
                    else type = "a-f-G"
                    if (transform.lat && dateElement[transform.lat]) lat = dateElement[transform.lat]
                    else {
                        console.error(`lat value not found for ${key}:${uid}`);
                        continue
                    }
                    if (transform.lon && dateElement[transform.lon]) lon = dateElement[transform.lon]
                    else {
                        console.error(`lon value not found for ${key}:${uid}`);
                        continue
                    }
                    if (transform.hae && dateElement[transform.hae]) hae = dateElement[transform.hae]
                    else hae = "999999.0"
                    if (transform.callsign && dateElement[transform.callsign]) callsign = dateElement[transform.callsign]
                    else  callsign = ""

                    console.log(`uid: ${uid}, type: ${type}, lat: ${lat}, lon: ${lon}, hae: ${hae}, callsign: ${callsign}`)
                    throw new Error("not implemented")
                    cots.push(new CoT({
                        event: {
                            _attributes: {
                                version: "2.0",
                                uid: uid,
                                type: type,
                                how: "h-g-i-g-o",
                                time: new Date().toISOString(),
                                start: new Date().toISOString(),
                                stale: new Date(Date.now() + this.config.consumer!.catalyst_query_poll_interval_ms).toISOString()
                            },
                            detail: {},
                            point: {
                                _attributes: {
                                    lat: lat,
                                    lon: lon,
                                    hae: hae,
                                    ce: "999999.0",
                                    le: "999999.0"
                                }
                            },
                        }
                    }))
                }
            }
        }

        return cots
    }

    publishCot(cots: CoT[], tak: TAK) {
        tak.write(cots)
    }
}