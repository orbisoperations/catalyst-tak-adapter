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

if (producer) {
    producer.startGraphqlServer()
}

