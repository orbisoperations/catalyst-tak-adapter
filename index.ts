import TAK, { CoT } from "@tak-ps/node-tak";
import { TakClient } from "./src/tak";
import { getConfig, Config } from "./src/config";
import { Consumer } from "./src/adapters/consumer";
import { Producer } from "./src/adapters/producer";

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

let config: Config | undefined = undefined;
while (config === undefined) {
  try {
    config = getConfig();
  } catch (e) {
    console.error("Error reading config file", e);
    await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
  }
}

let consumer: Consumer | undefined = undefined;
let producer: Producer | undefined = undefined;
if (config.consumer?.catalyst_token) {
  try {
    consumer = new Consumer(config);
  } catch (e) {
    console.error("Error instantiating consumer", e);
  }
}

if (config.producer && config.producer.catalyst_app_id) {
  try {
    producer = new Producer(config);
  } catch (e) {
    console.error("Error instantiating producer", e);
  }
}

/*
 * TAK Client Config and Startup
 */

const takClient = new TakClient(config);
await takClient.init();

takClient.start({
  onCoT: async (cot: CoT) => {
    console.log("Received CoT: ", cot.to_xml());
    if (producer) await producer.putCoT(cot);
  },
  onPing: async () => {
    if (producer)
      console.error(
        "all messages: ",
        producer.getAllCoT()?.map((cot) => cot.event._attributes.uid),
      );
  },
});

function generateCallsignHeartbeatCoT({
  callsign = "CATALYST",
  type = "a-f-G-U-C-I",
  how = "m-g",
  lat = -64.0107,
  lon = -59.452,
  group = "Cyan",
  role = "Team Member",
}: {
  callsign?: string | number;
  type?: string;
  how?: string;
  lat?: number;
  lon?: number;
  group?: string;
  role?: string;
}): CoT {
  const now = new Date();
  const stale = new Date(now.getTime() + 5 * 60 * 1000);
  const RTSP_URL = "192.168.1.102:7428";
  const RTSP_PORT = "7428";
  const RTSP_STREAM_PATH = "/stream";
  return new CoT(
    `<event version="2.0" uid="${callsign}" type="${type}" how="${how}" time="${now.toISOString()}" start="${now.toISOString()}" stale="${stale.toISOString()}">
            <point lat="${lat}" lon="${lon}" hae="999999.0" ce="999999.0" le="999999.0"/>
            <detail>
                <__video uid="${callsign}" url="rtsp://${RTSP_URL}/stream" >
                    <ConnectionEntry networkTimeout="5000" uid="${callsign}" path="${RTSP_STREAM_PATH}"
                        protocol="rtsp" bufferTime="-1" address="${RTSP_URL}" port="${RTSP_PORT}"
                        roverPort="-1" rtspReliable="1" ignoreEmbbededKLV="false" alias="live/${callsign}" />
                </__video>
                <contact callsign="${callsign}" endpoint="*:-1:stcp"/>
                <__group name="${group}" role="${role}"/>
                <takv device="Tak Adapter" platform="Catalyst" os="linux" version="0.0.1"/>
                <link relation="p-p" type="a-f-G-U-C-I" uid="${callsign}"/>
                <_flow-tags_>
                    <NodeCoT-12.6.0>${now.toISOString()}</NodeCoT-12.6.0>
                </_flow-tags_>
            </detail>
        </event>`,
  );
}

takClient.setInterval(
  "callsign",
  (tak: TAK) => {
    return async () => {
      const cot = generateCallsignHeartbeatCoT({
        callsign: config?.tak.callsign ?? "CATALYST",
        type: "a-f-G-U-C-I",
        how: "m-g",
        lat: config?.tak.catalyst_lat ?? -64.0107,
        lon: config?.tak.catalyst_lon ?? -59.452,
        group: config?.tak.group ?? "Cyan",
        role: config?.tak.role ?? "Team Member",
      });
      console.log("SENDING LOCAL CALLSIGN", cot.to_xml());
      try {
        tak.write([cot]);
      } catch (e) {
        console.error("Error sending CoT", e);
      }
    };
  },
  10 * 1000,
);

if (consumer) {
  console.log(
    "setting interval for consumer",
    config.consumer?.catalyst_query_poll_interval_ms,
  );
  takClient.setInterval(
    "consumer",
    (tak: TAK) => {
      return async () => {
        console.log("LOG: Doing graphql query from consumer");
        try {
          const jsonResults = await consumer.doGraphqlQuery();
          console.log("jsonResults", jsonResults);
          const cots = consumer.jsonToCots(jsonResults);
          console.log("cots", cots[0], cots[0].to_xml(), cots[0].uid());
          const msgCots = await consumer.jsonToGeoChat(jsonResults);
          consumer.publishCot([...cots, ...msgCots], tak);
        } catch (e) {
          console.error("Error doing graphql query from consumer", e);
        }
      };
    },
    config.consumer?.catalyst_query_poll_interval_ms || 1000,
  );
}

if (producer) {
  producer.startGraphqlServer();
}
