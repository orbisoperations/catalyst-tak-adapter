import CoT from "@tak-ps/node-cot";
import { TakClient } from "../tak";
import { Config } from "../config";
import { Producer } from "../adapters/producer";

interface Contact {
  callsign: string | number;
  type: string;
  how: string;
  lat: number;
  lon: number;
  group: string;
  role: string;
  stale: Date;
}

export default class ContactBook {
  private contacts: Map<
    string | number,
    { contact: Contact; takClient: TakClient }
  > = new Map<string, { contact: Contact; takClient: TakClient }>();

  private inFlightClients: Map<string | number, Promise<TakClient>> = new Map();
  private cleanupTimer?: Timer;

  private config: Config;
  private producer?: Producer;

  constructor(config: Config, producer?: Producer) {
    this.contacts = new Map<
      string,
      { contact: Contact; takClient: TakClient }
    >();

    this.config = config;
    this.producer = producer;

    // Cleanup contacts every 30 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 30 * 1000);
    try {
      // prevent timer from keeping the process alive
      this.cleanupTimer.unref();
    } catch {
      /* noop – not available in some runtimes */
      console.error("ContactBook: cleanupTimer unref failed");
    }
  }

  async addOrRefreshContact(contact: Contact) {
    console.log("ContactBook: addOrRefreshContact", contact);

    if (!contact.callsign) {
      console.error(
        "ContactBook: addOrRefreshContact: callsign is required. could not add or refresh contact",
      );
      return;
    }

    // Create or get the tak client for the contact with de-duped concurrent creation
    let takClient = this.contacts.get(contact.callsign)?.takClient;
    if (!takClient) {
      let inFlight = this.inFlightClients.get(contact.callsign);
      if (!inFlight) {
        inFlight = this.createContactTakClient(String(contact.callsign));
        this.inFlightClients.set(contact.callsign, inFlight);
      }
      takClient = await inFlight.finally(() => {
        this.inFlightClients.delete(contact.callsign);
      });
    }

    this.contacts.set(contact.callsign, {
      contact,
      takClient: takClient,
    });

    const contactCot = ContactBook.generateCallsignHeartbeatCoT({
      callsign: contact.callsign,
      type: contact.type,
      how: contact.how,
      lat: contact.lat,
      lon: contact.lon,
      group: contact.group,
      role: contact.role,
      stale: contact.stale,
    });

    if (contactCot) {
      takClient.tak?.write([contactCot]);
    } else {
      console.error("ContactTakClient: No CoT to send for contact", contact);
    }
  }

  async publishCoTAsContact(contactCallsign: string, cot: CoT) {
    console.log("ContactBook: publishCoTAsContact", contactCallsign, cot);

    const takClient = this.contacts.get(contactCallsign)?.takClient;
    if (takClient) {
      takClient.tak?.write([cot]);
    } else {
      console.error(
        "ContactBook: No contact found for callsign",
        contactCallsign,
      );
    }
  }

  async createContactTakClient(connectionKey?: string) {
    // use a unique connection id per contact to avoid server-side clashes
    const uniqueId = connectionKey
      ? `${this.config.tak.connection_id || "ConnectionID"}-${connectionKey}`
      : undefined;
    const takClient = new TakClient(this.config, { connectionId: uniqueId });

    await takClient.init();

    takClient.start({
      onCoT: async (cot: CoT) => {
        if (cot.is_chat() && this.producer) {
          await this.producer.putCoT(cot);
        }
      },
    });
    return takClient;
  }

  // A method that will cleanup contacts that are stale
  async cleanup() {
    const now = new Date();
    const staleContacts = Array.from(this.contacts.values()).filter(
      (contact) => {
        return new Date(contact.contact.stale) < now;
      },
    );

    staleContacts.map((contact) => {
      contact.takClient.stop();
      this.contacts.delete(contact.contact.callsign);
    });
  }

  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      try {
        this.cleanupTimer.unref();
      } catch {
        /* noop – not available in some runtimes */
        console.error("ContactBook: cleanupTimer unref failed");
      }
      this.cleanupTimer = undefined;
    }

    for (const { takClient } of this.contacts.values()) {
      takClient.stop();
    }
    this.contacts.clear();
    this.inFlightClients.clear();
  }

  static generateCallsignHeartbeatCoT({
    callsign = "CATALYST-TAK-ADAPTER",
    type = "a-f-G-U-C-I",
    how = "m-g",
    lat,
    lon,
    group = "Cyan",
    role = "Team Member",
    stale,
    video,
  }: {
    callsign?: string | number;
    type?: string;
    how?: string;
    lat: number;
    lon: number;
    group?: string;
    role?: string;
    stale: Date;
    video?: {
      rtsp_server: string;
      rtsp_port: string;
      rtsp_path: string;
    };
  }): CoT | null {
    if (lat === undefined || lon === undefined) {
      console.error(
        "generateCallsignHeartbeatCoT: local heartbeat lat and lon are required. could not send Heartbeat",
      );
      return null;
    }

    if (!callsign) {
      console.error(
        "generateCallsignHeartbeatCoT: callsign is required. could not send Heartbeat",
      );
      return null;
    }

    const now = new Date();

    // Encode video into the CoT
    let videoDetailItem: string | null = null;
    if (video !== undefined) {
      const RTSP_URL = video.rtsp_server ?? "192.168.1.101";
      const RTSP_PORT = video.rtsp_port ?? "7428";
      const RTSP_STREAM_PATH = video.rtsp_path ?? "/stream";
      videoDetailItem = `
       <__video uid="${callsign}" url="rtsp://${RTSP_URL}:${RTSP_PORT}${RTSP_STREAM_PATH}" >
          <ConnectionEntry networkTimeout="5000" uid="${callsign}" path="${RTSP_STREAM_PATH}"
              protocol="rtsp" bufferTime="-1" address="${RTSP_URL}" port="${RTSP_PORT}"
              roverPort="-1" rtspReliable="1" ignoreEmbbededKLV="false" alias="live/${callsign}" />
      </__video>`;
    }
    return new CoT(
      `<event version="2.0" uid="${callsign}" type="${type}" how="${how}" time="${now.toISOString()}" start="${now.toISOString()}" stale="${stale.toISOString()}" access="Undefined">
              <point lat="${lat}" lon="${lon}" hae="999999.0" ce="999999.0" le="999999.0"/>
              <detail>
                  ${videoDetailItem ?? ""}
                  <contact callsign="${callsign}" endpoint="*:-1:stcp"/>
                  <__group name="${group}" role="${role}"/>
                  <takv device="Tak Adapter" platform="Catalyst" os="linux" version="0.0.1"/>
                  <link relation="p-p" type="${type}" uid="${callsign}"/>
                  <_flow-tags_>
                      <NodeCoT-12.6.0>${now.toISOString()}</NodeCoT-12.6.0>
                  </_flow-tags_>
              </detail>
          </event>`,
    );
  }
}
