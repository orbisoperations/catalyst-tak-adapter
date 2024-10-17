/*
[X] TAK as a consumer
    [X] we need a scheduling mechanism to send data to TAK
    [X] we need a graphlq to query against Catalyst
    [X] we need a way to convert catalyst data to CoT
    [X] we need to send the messages to the TAK server
 */

import {Config, CoTOverwrite, CoTTransform} from "../../config";
import TAK, {CoT} from "@tak-ps/node-tak";
import * as ld from "lodash";

interface CoTValues {
    uid?: string
    type?: string
    lat?: string
    lon?: string
    hae?: string
    how?: string
    callsign?: string
}



export class Consumer {
    config: Config
    poll_interval_ms: number
    catalyst_endpoint: string
    constructor(config: Config) {
     
        this.config = config;

        if (!this.config.consumer) {
            throw new Error("Consumer config not found")
        }

        if (!this.config.consumer.catalyst_endpoint || !this.config.consumer.catalyst_query || !this.config.consumer.catalyst_token) {
            throw new Error("Catalyst endpoint, query, or token not found")
        }

        this.catalyst_endpoint = this.config.consumer.catalyst_endpoint ?? "https://gateway.catalyst.devintelops.io/graphql"

        this.poll_interval_ms = this.config.consumer.catalyst_query_poll_interval_ms ?? 10 * 1000

    }

    async doGraphqlQuery() {

        const result = await fetch(this.catalyst_endpoint, {
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
        const parsers = this.config.consumer?.parser
        if (parsers === undefined) {
            console.warn("no transforms have been found and unable to convert data to CoT")
            return []
        }

        let cots: CoT[] = []
        for (const [dataName, parser] of Object.entries(parsers)) {
            if (data[dataName] === undefined) {
                console.warn("key not found in data", dataName)
            } else {
                const dataToTransform = data[dataName] as any[]
                for (const dataElement of dataToTransform) {
                    let extractedVals = this.extractCoTValues(dataName, dataElement, parser.transform)
                    if (extractedVals === undefined) {
                        console.error("error extracting values for", dataName)
                        continue
                    }
                    if (parser.overwrite) extractedVals = this.overWriteCoTValues(extractedVals, parser.overwrite!)
                    const cotValues = this.fillDefaultCoTValues(extractedVals)
                    cots.push(new CoT({
                        event: {
                            _attributes: {
                                version: "2.0",
                                uid: cotValues.uid,
                                type: cotValues.type,
                                how: "h-g-i-g-o",
                                // how: cotValues.how,
                                time: new Date().toISOString(),
                                start: new Date().toISOString(),
                                stale: new Date(Date.now() + this.poll_interval_ms).toISOString()
                            },
                            detail: {
                                contact: {
                                    _attributes: {
                                        callsign: cotValues.callsign,
                                    }
                                }
                            },
                            point: {
                                _attributes: {
                                    lat: cotValues.lat,
                                    lon: cotValues.lon,
                                    hae: cotValues.hae,
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

    extractCoTValues(key: string, object: any, transform: CoTTransform): CoTValues | undefined {
        let uid, type, lat, lon, hae, how, callsign: string | undefined
        if (transform.uid && ld.get(object, transform.uid)) uid = ld.get(object, transform.uid)
        if (transform.type && ld.get(object, transform.type)) type = ld.get(object, transform.type)
        if (transform.how && ld.get(object, transform.how)) how = ld.get(object, transform.how)

        if (transform.lat && ld.get(object, transform.lat)) lat = ld.get(object, transform.lat)
        else {
            console.error(`lat value not found for ${key}:${uid}`);
            return undefined
        }
        if (transform.lon && ld.get(object, transform.lon)) lon = ld.get(object, transform.lon)
        else {
            console.error(`lon value not found for ${key}:${uid}`);
            return undefined
        }
        if (transform.hae && ld.get(object, transform.hae)) hae = ld.get(object, transform.hae)
        // if (transform.callsign && object["detail"][transform.callsign]) callsign = object["detail"][transform.callsign]
        if (transform.callsign && ld.get(object, transform.callsign)) callsign = ld.get(object, transform.callsign)

        return {
            uid: uid,
            type: type,
            lat: lat,
            lon: lon,
            hae: hae,
            callsign: callsign,
            how: how,
        }
    }

    overWriteCoTValues(CoTVals: CoTValues, transform: CoTOverwrite) {
        if (transform.uid) CoTVals.uid = transform.uid
        if (transform.type) CoTVals.type = transform.type
        if (transform.lat) CoTVals.lat = transform.lat
        if (transform.lon) CoTVals.lon = transform.lon
        if (transform.hae) CoTVals.hae = transform.hae
        if (transform.callsign) CoTVals.callsign = transform.callsign
        if (transform.type) CoTVals.type = transform.type

        return CoTVals
    }

    fillDefaultCoTValues(cotValues: CoTValues): CoTValues {
        if (!cotValues.uid) cotValues.uid = crypto.randomUUID()
        if (!cotValues.type) cotValues.type = "a-f-G"
        if (!cotValues.hae) cotValues.hae = "999999.0"
        if (!cotValues.callsign) cotValues.callsign = ""

        return cotValues
    }

    publishCot(cots: CoT[], tak: TAK) {
        tak.write(cots)
    }
}