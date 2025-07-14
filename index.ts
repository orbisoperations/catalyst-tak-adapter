import TAK, { CoT } from "@tak-ps/node-tak";
import { CoTParser } from "@tak-ps/node-cot";
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

if (!config.producer?.enabled && !config.consumer?.enabled) {
  console.error("at least one of producer or consumer must be enabled");
  process.exit(1);
}

let consumer: Consumer | undefined = undefined;
let producer: Producer | undefined = undefined;
if (config.consumer?.enabled) {
  try {
    consumer = new Consumer(config);
  } catch (e) {
    console.error("Error instantiating consumer", e);
  }
}

if (config.producer?.enabled) {
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
    console.log("Received CoT: ", CoTParser.to_xml(cot));
    if (producer) await producer.putCoT(cot);
  },
  onPing: async () => {
    if (producer)
      console.error(
        "all messages: ",
        producer
          .getAllCoT()
          ?.map((cot) => cot.event._attributes.uid + " " + JSON.stringify(cot)),
      );
  },
});

function generateCallsignHeartbeatCoT({
  callsign = "CATALYST-TAK-ADAPTER",
  type = "a-f-G-U-C-I",
  how = "m-g",
  lat,
  lon,
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
}): CoT | null {
  if (!lat || !lon) {
    console.error(
      "generateCallsignHeartbeatCoT: local heartbeat lat and lon are required. could not send Heartbeat",
    );
    return null;
  }
  const now = new Date();
  const stale = new Date(now.getTime() + 5 * 60 * 1000);
  let videoDetailItem: string | null = null;
  if (config?.tak.video?.rtsp?.enabled) {
    const RTSP_URL = config?.tak.video?.rtsp?.rtsp_server ?? "192.168.1.101";
    const RTSP_PORT = config?.tak.video?.rtsp?.rtsp_port ?? "7428";
    const RTSP_STREAM_PATH = config?.tak.video?.rtsp?.rtsp_path ?? "/stream";
    videoDetailItem = `
     <__video uid="${callsign}" url="rtsp://${RTSP_URL}:${RTSP_PORT}${RTSP_STREAM_PATH}" >
        <ConnectionEntry networkTimeout="5000" uid="${callsign}" path="${RTSP_STREAM_PATH}"
            protocol="rtsp" bufferTime="-1" address="${RTSP_URL}" port="${RTSP_PORT}"
            roverPort="-1" rtspReliable="1" ignoreEmbbededKLV="false" alias="live/${callsign}" />
    </__video>`;
  }
  return CoTParser.from_xml(
    `<event version="2.0" uid="${callsign}" type="${type}" how="${how}" time="${now.toISOString()}" start="${now.toISOString()}" stale="${stale.toISOString()}">
            <point lat="${lat}" lon="${lon}" hae="999999.0" ce="999999.0" le="999999.0"/>
            <detail>
                ${videoDetailItem ?? ""}
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
        callsign: "CATALYST-TAK-ADAPTER",
        type: "a-f-G-U-C-I",
        how: "m-g",
        lat: config?.tak.catalyst_lat,
        lon: config?.tak.catalyst_lon,
        group: config?.tak.group,
        role: config?.tak.role,
      });
      if (!cot) {
        console.error("takClient.setInterval: No CoT to send");
        return;
      }
      console.log(
        "takClient.setInterval: SENDING LOCAL CALLSIGN",
        CoTParser.to_xml(cot),
      );
      try {
        tak.write([cot]);
      } catch (e) {
        console.error("takClient.setInterval: Error sending CoT", e);
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
          if (!jsonResults?.data) {
            console.log("No data returned from graphql query");
            return;
          }
          const cots = consumer.jsonToCots(jsonResults);
          if (cots.length === 0) {
            console.log("No cots found by consumer");
            return;
          }
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
