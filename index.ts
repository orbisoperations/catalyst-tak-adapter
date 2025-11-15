import TAK, { CoT } from "@tak-ps/node-tak";
import { TakClient } from "./src/tak";
import { getConfig, Config } from "./src/config";
import { Consumer } from "./src/adapters/consumer";
import { Producer } from "./src/adapters/producer";
import ContactBook from "./src/modules/contact-book";

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
// Track the last time we logged a ping so we only print once every 10 minutes
let lastPingLogged = 0;
await takClient.init();

const contactBook = new ContactBook(config, producer);

takClient.start({
  onCoT: async (cot: CoT) => {
    if (producer) {
      try {
        await producer.putCoT(cot);
      } catch (e) {
        console.error("Error saving CoT", e);
      }
    }
  },
  onPing: async () => {
    const now = Date.now();
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    if (now - lastPingLogged >= TEN_MINUTES_MS) {
      console.log("Ping received via TAK client");
      lastPingLogged = now;
    }
  },
});

takClient.setInterval(
  "callsign",
  (tak: TAK) => {
    return async () => {
      const now = new Date();

      const cot = ContactBook.generateCallsignHeartbeatCoT({
        callsign: "CATALYST-TAK-ADAPTER",
        type: "a-f-G-U-C-I",
        how: "m-g",
        lat: config?.tak.catalyst_lat ?? 0.0,
        lon: config?.tak.catalyst_lon ?? 0.0,
        group: config?.tak.group,
        role: config?.tak.role,
        stale: new Date(now.getTime() + 5 * 60 * 1000),
      });

      if (!cot) {
        console.error("takClient.setInterval: No CoT to send");
        return;
      }
      console.log(
        "takClient.setInterval: SENDING LOCAL CALLSIGN",
        cot.to_xml(),
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

          // Separate contact CoTs (type a-f-G-U-*)
          const contactCots: CoT[] = [];
          const otherCots: CoT[] = [];

          // Sort cots for individual type-based processing
          for (const cot of cots) {
            const type = cot.type()?.toLowerCase();

            if (type && type === "a-f-g-u") {
              contactCots.push(cot);
            } else {
              otherCots.push(cot);
            }
          }

          // Process each contact CoT
          for (const cot of contactCots) {
            try {
              const now = new Date();
              const [lat, lon] = cot.position();
              /* eslint-disable  @typescript-eslint/no-explicit-any */
              const detail: any = cot.detail();

              await contactBook.addOrRefreshContact({
                callsign: detail?.contact?._attributes?.callsign ?? cot.uid(),
                type: cot.type() ?? "a-f-G-U-C-I",
                /* eslint-disable  @typescript-eslint/no-explicit-any */
                how: (cot as any).how?.() ?? "m-g", // fallback if method absent
                lat: Number(lat ?? 0),
                lon: Number(lon ?? 0),
                group: detail?.__group?._attributes?.name ?? "Unknown",
                role: detail?.__group?._attributes?.role ?? "Member",
                stale: new Date(now.getTime() + 5 * 60 * 1000),
              });
            } catch (e) {
              console.error("Error processing contact CoT", e);
            }
          }

          if (otherCots.length === 0) {
            console.log("No non-contact cots found by consumer");
            return;
          }

          const msgCots = await consumer.jsonToGeoChat(jsonResults);

          for (const cot of msgCots) {
            console.log(cot.detail()?.__chat?._attributes?.senderCallsign);

            await contactBook.publishCoTAsContact(
              cot.detail()?.__chat?._attributes?.senderCallsign ?? cot.uid(),
              cot,
            );
          }

          consumer.publishCot([...otherCots, ...msgCots], tak);
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
