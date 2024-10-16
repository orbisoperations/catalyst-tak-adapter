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
    }

    async doGraphqlQuery() {
        if (!this.config.consumer) {
            throw new Error("Consumer config not found")
        }

        if (!this.config.consumer.catalyst_endpoint || !this.config.consumer.catalyst_query || !this.config.consumer.catalyst_token) {
            throw new Error("Catalyst endpoint, query, or token not found")
        }

        const result = await fetch(this.config.consumer?.catalyst_endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: "Bearer " + this.config.consumer.catalyst_token,
            },
            body: JSON.stringify({
                query: this.config.consumer.catalyst_query,
                variables: new Object(this.config.consumer.catalyst_query_variables)
            }),
        })

        return  await result.json()
    }

    jsonToCots(json: any) {
        const data = json.data
        console.log(data)
        // specific airplane
        const airplanes = data["aircraftWithinDistance"] as any[]
        console.log("airplanes", airplanes)
        let cots: CoT[] = []
        for (const airplane of airplanes) {
            console.log("airplane: ", airplane)
            cots.push(new CoT({
                event: {
                    _attributes: {
                        version: "2.0",
                        uid: airplane.hex,
                        type: "a-f-A",
                        how: "h-g-i-g-o",
                        time: new Date().toISOString(),
                        start: new Date().toISOString(),
                        stale: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                    },

                    point: {
                        _attributes: {
                            lat: airplane.lat,
                            lon: airplane.lon,
                            hae: airplane.alt_geom,
                            ce: "999999.0",
                            le: "999999.0"
                        }
                    },
                }
            }))
        }
        return cots
    }

    publishCot(cots: CoT[], tak: TAK) {
        tak.write(cots)
    }
}