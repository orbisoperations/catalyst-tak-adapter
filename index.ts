import TAK, {CoT}  from '@tak-ps/node-tak';
import {TakClient} from "./src/tak"
import {getConfig, Config} from "./src/config"
import {Consumer} from "./src/adapters/consumer"
import { Producer } from './src/adapters/producer';

/*
TODO:
[X] export configs as toml (not envs)
[] TAK as a data source
    [X] find local db store to use (and install it)
        [X] could be something like KV that uses UID as the key
        [] some sort of event loop to clear stale objects
    [X] capture and parse CoT for storage
    [X] create graphql schema for CoT
    [X] expose the endpoint to catalyst
    [X] key validation from catalyst (JWT)
    [X] return appropriate data for the query
[X] TAK as a consumer
    [X] we need a scheduling mechanism to send data to TAK
    [X] we need a graphlq to query against Catalyst
    [X] we need a way to convert catalyst data to CoT
    [X] we need to send the messages to the TAK server
 */

let config: Config | undefined = undefined
while (config === undefined) {
    try {
        config = getConfig();
    } catch (e) {
        console.error("Error reading config file", e)
        await new Promise(resolve => setTimeout(resolve, 10 * 1000))
    }
}



let consumer: Consumer | undefined = undefined
let producer: Producer | undefined = undefined
if (config.consumer) {
    consumer = new Consumer(config);
}

if (config.producer) {
    producer = new Producer(config);
}

/*
* TAK Client Config and Startup
 */

const takClient = new TakClient(config)
await takClient.init()

takClient.start({
    onCoT: async (cot: CoT) => {
        console.log("Received CoT: ", cot.to_xml())
        if (producer) await producer.putCoT(cot)
    },
    onPing: async () => {
        if (producer) console.error("all messages: ", producer.getAllCoT()?.map(cot => cot.event._attributes.uid))
    }
})

takClient.setInterval("callsign", (tak: TAK) => {
    return async () => {
        const cot = new CoT(`<event version="2.0" uid="${config?.tak.callsign?? "CATALYST"}" type="a-f-G-U-C-I" how="m-g" time="${new Date(Date.now()).toISOString()}" start="${new Date(Date.now()).toISOString()}" stale="${new Date(Date.now()+ (5 * 60 * 1000)).toISOString()}">
                        <point lat="${config?.tak.catalyst_lat ?? -64.0107}" lon="${config?.tak.catalyst_lon ?? -59.4520}" hae="999999.0" ce="999999.0" le="999999.0"/>
                        <detail>
                            <contact callsign="${config?.tak.callsign?? "CATALYST"}" endpoint="*:-1:stcp"/>
                            <__group name="${config?.tak.group ?? "Cyan"}" role="${config?.tak.role ?? "Team Member"}"/>
                            <takv device="Tak Adapter" platform="Catalyst" os="linux" version="0.0.1"/>
                            <link relation="p-p" type="a-f-G-U-C-I" uid="${config?.tak.callsign?? "CATALYST"}"/>
                            <_flow-tags_>
                                <NodeCoT-12.6.0>2024-10-24T16:57:55.264Z</NodeCoT-12.6.0>
                            </_flow-tags_>
                        </detail>
                    </event>`)
        console.log("SENDING CATALYST CALLSIGN", cot.to_xml())

        tak.write([cot])
    }
}, 10 * 1000)

if (consumer) {
    takClient.setInterval('consumer', (tak: TAK) => {
            return async () => {
                const jsonResults = await consumer.doGraphqlQuery()
                const cots = consumer.jsonToCots(jsonResults)
                const msgCots = await consumer.jsonToGeoChat(jsonResults)
                consumer.publishCot([...cots, ...msgCots], tak)
            }
        }
        , config.consumer?.catalyst_query_poll_interval_ms || 1000)
}

if (producer) {
    producer.startGraphqlServer()
}

// consumer?.publishCot([new CoT(`<event version="2.0" uid="GeoChat.ff1c0089-695c-a6c6-5a80-a56301a31688.8b52a385-bf8c-6fa1-4a84-da418a1e9009" type="b-t-f" how="h-g-i-g-o" time="2024-10-24T12:03:58Z" start="2024-10-24T12:03:58Z" stale="2025-02-17T05:50:38Z"><point lat="25.0353499" lon="121.5690985" hae="999999.0" ce="999999.0" le="999999.0"/><detail><__chat chatroom="All Chat Rooms" senderCallsign="GHOST WALKER199" parent="RootContactGroup" groupOwner="false" id="All Chat Rooms"><chatgrp id="All Chat Rooms" uid0="ff1c0089-695c-a6c6-5a80-a56301a31688" uid1="All Chat Rooms"/></__chat><remarks time="2024-10-24T12:03:58Z" source="ff1c0089-695c-a6c6-5a80-a56301a31688" to="All Chat Rooms">hi</remarks><link relation="p-p" type="a-f-G-U-C-I" uid="ff1c0089-695c-a6c6-5a80-a56301a31688"/><_flow-tags_ TAK-Server-3abc9530735f4a3093430a1334481205="2024-10-24T12:03:58Z"><NodeCoT-12.6.0>2024-10-24T12:03:59.015Z</NodeCoT-12.6.0></_flow-tags_></detail></event>`)], takClient.tak!)
