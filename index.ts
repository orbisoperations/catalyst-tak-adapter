import TAK, {CoT}  from '@tak-ps/node-tak';
import {TakClient} from "./src/tak"
import {getConfig} from "./src/config"
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
    [] create graphql schema for CoT
    [] expose the endpoint to catalyst
    [] key validation from catalyst (JWT)
    [] return appropriate data for the query
[X] TAK as a consumer
    [X] we need a scheduling mechanism to send data to TAK
    [X] we need a graphlq to query against Catalyst
    [X] we need a way to convert catalyst data to CoT
    [X] we need to send the messages to the TAK server
 */

const config = getConfig();

let consumer: Consumer | undefined = undefined
let producer: Producer | undefined = undefined
if (config.consumer) {
    consumer = new Consumer(config);
}

if (config.producer) {
    producer = new Producer(config);
}

const takClient = new TakClient(config)
await takClient.init()

takClient.start({
    onCoT: async (cot: CoT) => {
        console.log(cot.to_xml())
        if (producer) await producer.putCoT(cot)
    },
    onPing: async () => {
        if (producer) console.error("all messages: ", producer.getAllCoT()?.map(cot => cot.event._attributes.uid))
    }
})

if (consumer) {
    takClient.setInterval('consumer', (tak: TAK) => {
            return async () => {
                const jsonResults = await consumer.doGraphqlQuery()
                const cots = consumer.jsonToCots(jsonResults)
                consumer.publishCot(cots, tak)
            }
        }
        , config.consumer?.catalyst_query_poll_interval_ms || 1000)
}
