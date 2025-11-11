import tls from "node:tls";
import { describe, it, mock, expect, afterEach } from "bun:test";
import { TakClient } from "../src/tak";
import type { Config } from "../src/config";
import CoT from "@tak-ps/node-cot";
import { EventEmitter } from "node:events";
import { sleep } from "bun";

const takConfig: Config = {
  dev: true,
  tak: {
    connection_id: "test",
    endpoint: "ssl://localhost:9123",
    key_file: "tak-admin-partner.key.pem",
    cert_file: "tak-admin-partner.cert.pem",
    callsign: "test",
    group: "test",
    role: "test",
    video: {},
    catalyst_lat: 0,
    catalyst_lon: 0,
  },
};
const takUrl = new URL(takConfig.tak.endpoint);
const TAK_HOSTNAME = takUrl.hostname;
const TAK_PORT = takUrl.port;

/**
 * function to generate test key and cert
 */
function generateTestKeyAndCert() {
  const key = `-----BEGIN RSA PRIVATE KEY-----
MIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCPNTXj7CmAdl3mGtKgh27NszFBT2UGoXqPs2vJ1gvL1Oio4MXtRvETrgDdh/UQWe/Tae5oBFLdvYJVT6TXElc8nuIPd3v20cf/dME3RkAzM3YqMiZJMn9BUOSjSUXwMG8PQCULOxnB/vROWCSAsX/Z+w8t1DiZ0J+DK8Tc4bQ6NZX6jVCV0y0EjbA+XTnOXIZtiT8SPLcQ+AikJiQWyYGgTcqX0XfSryEJFU+nwaBBYPffbgSaPzzXWvDo6+9Ac7NASBDKkZ67Woc0ujxuRQQS9oqkgrSeJmJwoAN/sonxsaphY0DngQt4qFWZ8+je3pbyl+iPeb9yqZdeXRvB9iVlAgMBAAECgf8+d0y1HqOmZVCQDnh8N+xyeAyuxZ2g8XmEiml59jkvBVp2+j9bleuSVKlhTZdCiqMR6iMT5s7pP2tFIHhxV+QK4phjfBBBQ+r5LZ8aJ9/ZIEQVeR/kzcy0W5S0+kEyLpjtuLfFLle4nH1JryjnpIUgOrgO8C3AP5VUohg864wHLLFP4Bxlx7bRsSSHtBvpAXOciFzmtU1rqkJrQh9xft5IXuhm4EqiXjtzcLsipGiqpp0YVU4aKF7nIeWE5PPXvpXs2D1/St4z99uj5ltQDpd1QdLxYCsOdv/xzi2QkQPguP1jTACHwli+du84saJCr4FcVpMimxU3A3WQp7Fv1/0CgYEAtbb/4CsvsQg0xt8Eeac30rMj/+T0YwBBNUdEZVcIOauHMpRFQ5lqECXOa/XShFHJhf3VbO3yeraHErfNf1+YbX4mTSgozfKb3RrEROz0OLUDeH3U8OT/8g2IlUCvS3WfjVETgWx4X15o0b74vs30gqOPuH81lwf0oBSaIqZpUVsCgYEAycBW+htp6i6dxnmuZt2E7GQUTXc+sP/6CvSH27UqyZxY4SHYj4TwjFXj5Kr3CB+ZGEppD2pInhKu4gwnSkWonmVxn7LDrgZBMwXiGu8sVURQaxn+g049/+DdEnXa8QxWbdA6OJ34JHQW/I0faZj4XxebDuIAaQTZoSNKZ7PrYD8CgYBxV7n2azmOJN42hXjXILQzGkYEIR1GeywxPUiuJUEeJ51msREa/yAm/k3pDSXIHvOiPhfXn/u1CxDpXfgx0MDU2vCtA7Wf8AnEOiPeEiarEE0f5OzjbRMwObzNy9ELMkzY6o9OFQhoBA1BdurUqMYwjjDhFYepsu6kwvT5U+8xLQKBgBHPCZ5wNww16zVu3kc0PJyFRQmFgiIrpk27QhbRyiIby/irfStGB9nLZx9zO/UanO/4+Ycj0Z8qdQd9HSbAOV8qAzqelAlTggPX/Bp2jEpGina5x66dhHmGxtzvTFFEzohI/iqrPxEwsiq+5kvy9dGnCsfoiTK7+93ueI3o4tkPAoGASFRHo0nmsEucA2pozG8FtmBNEDcRe87xAEXbzwBEEhrNMGGv+fAn56qKI3v2ue1id8cOVYPriWQ8j5tqH65qJChTwxFbKZRX0l+QgYz71f8MMepWIBl/WMNsH8ahHxYISxQcMQdHeIFsf4xlLntdxvqYZWOg1X2l4yip0Gp/UNI=
-----END RSA PRIVATE KEY-----`;
  const cert = `-----BEGIN CERTIFICATE-----
MIIC/DCCAeSgAwIBAgIGAZjEgON9MA0GCSqGSIb3DQEBCwUAMD8xETAPBgNVBAMMCHRlc3QuY29tMQswCQYDVQQGEwJVUzEdMBsGCSqGSIb3DQEJARYOdGVzdEBlbWFpbC5jb20wHhcNMjUwODE5MjI0MzU3WhcNMjYwODE5MjI0MzU3WjA/MREwDwYDVQQDDAh0ZXN0LmNvbTELMAkGA1UEBhMCVVMxHTAbBgkqhkiG9w0BCQEWDnRlc3RAZW1haWwuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjzU14+wpgHZd5hrSoIduzbMxQU9lBqF6j7NrydYLy9ToqODF7UbxE64A3Yf1EFnv02nuaARS3b2CVU+k1xJXPJ7iD3d79tHH/3TBN0ZAMzN2KjImSTJ/QVDko0lF8DBvD0AlCzsZwf70TlgkgLF/2fsPLdQ4mdCfgyvE3OG0OjWV+o1QldMtBI2wPl05zlyGbYk/Ejy3EPgIpCYkFsmBoE3Kl9F30q8hCRVPp8GgQWD3324Emj8811rw6OvvQHOzQEgQypGeu1qHNLo8bkUEEvaKpIK0niZicKADf7KJ8bGqYWNA54ELeKhVmfPo3t6W8pfoj3m/cqmXXl0bwfYlZQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBTOGoS7aZ55HqE2VSsnExqZWoXmkjMHgqbaZoRZvFMyTR+tuUKejZa36R9JcTw51yJ8cIU059tZnR6BDdKAOtQT1GYYut+69kK1drDlqpsRkYzWJF5ZqOFGz89lX6ha3YVGGtyCMit1VzXLNMV8mYoakT79w4aGxcMJDN5+s1jzT9LCzEqoMiV55pFKhfEjFoNJwM0Vx0Vo4vZKL+C0oMajvf5rdffXVC+135+ROE1cDAdrdUCvKVP0C9bMvdLEOlNQofjcQzxz5ZCBNB0DfbhGBbk9LG4f/VHIzoHtZPq305MLV9MCFMuEMwWLmmuPHTGGVYeHufBVyeH/ye6iN0u
-----END CERTIFICATE-----`;
  return { key, cert };
}

/**
 * Helper function to listen to an event once and return the content of the event
 *
 * @param emitter - The event emitter to listen to
 * @param event - The event to listen for
 * @param name - The name of the event
 * @param timeout - The timeout in milliseconds
 * @returns The content of the event
 */
export function once<T>(
  emitter: EventEmitter,
  event: string,
  name?: string,
  timeout = 4_500,
): Promise<{ content: T; duration_seconds: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const timer = setTimeout(() => {
      emitter.removeListener(event, handler); // cleanup listener
      reject(
        new Error(`AsyncOnce: event:"${event}" name:"${name ?? ""}" timeout`),
      );
    }, timeout);

    const handler = (content: T) => {
      clearTimeout(timer);
      resolve({
        content,
        duration_seconds: (Date.now() - start) / 1000,
      });
    };

    emitter.once(event, handler);
  });
}

type MockTakServerEvents = {
  cotData: [string];
  clientPing: [string];
  clientDisconnected: [];
};

class MockTakServer extends EventEmitter<MockTakServerEvents> {
  tlsServer: tls.Server | null = null;
  private packets: string[] = [];
  private cotInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  connections: tls.TLSSocket[] = [];

  async start() {
    this.tlsServer = tls.createServer({
      key: generateTestKeyAndCert().key,
      cert: generateTestKeyAndCert().cert,
    });
    this.tlsServer.on("error", (err) => {
      console.log("Mock TAK server error", err);
      this.close();
    });
    this.tlsServer.on("secureConnection", (socket) =>
      this.handleConnection(socket),
    );
    this.tlsServer.on("close", () => {
      console.log("Mock TAK server close");
      this.close();
    });
    await new Promise((resolve) =>
      this.tlsServer?.listen(parseInt(TAK_PORT), TAK_HOSTNAME, () => {
        console.log("Mock TAK server started");
        resolve(true);
      }),
    );
  }

  handleConnection(socket: tls.TLSSocket) {
    console.log("New connection to Mock TAK server");
    this.connections.push(socket);
    socket.on("data", (data) => {
      const cots: string[] = data.toString().split("\n");
      console.log("MockServer: data", cots);
      for (const cot of cots) {
        if (cot.includes("t-x-c-t")) {
          this.emit("clientPing", cot);
        } else {
          this.emit("cotData", cot);
        }
      }
    });
    socket.on("close", () => {
      console.log("MockServer: end");
      this.connections.splice(this.connections.indexOf(socket), 1);
      this.emit("clientDisconnected");
    });
    socket.on("error", (err) => {
      console.log("MockServer: error", err);
    });

    // every 100ms, send a packet
    const sendPackets = () => {
      if (this.packets.length > 0) {
        socket.write(this.packets.shift() || "\n");
      }
    };
    this.cotInterval = setInterval(sendPackets, 500);

    // send a ping every 500ms
    const cotPing = new CoT(`
      <event version="2.0" uid="takPing" type="t-x-c-t-r" how="m-g" time="2021-02-27T20:32:24.771Z" start="2021-02-27T20:32:24.771Z" stale="2021-02-27T20:38:39.771Z">
        <point lat="1.234567" lon="-3.141592" hae="-25.7" ce="9.9" le="9999999.0"/>
      </event>
  `);
    this.pingInterval = setInterval(() => {
      if (socket.readyState === "open") {
        socket.write(cotPing.to_xml() + "\n");
      }
    }, 500);
  }

  addPacket(packet: string) {
    this.packets.push(packet);
  }

  async close() {
    console.log("Closing mock TAK server");
    console.log("this.connections", this.connections.length);

    // clear the intervals
    if (this.cotInterval) {
      clearInterval(this.cotInterval);
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // remove all listeners
    this.tlsServer?.removeAllListeners();

    // close the connections
    for (const connection of this.connections) {
      await new Promise((resolve) => {
        connection.end(() => resolve(true));
      });
      connection.destroy();
    }
    // close the tls server
    await new Promise((resolve) => this.tlsServer?.close(() => resolve(true)));
    this.connections = [];
  }
}

// Mock the certificate reading function to return valid PEM format
mock.module("../src/tak/index.ts", () => ({
  readKeyAndCert: () => generateTestKeyAndCert(),
}));

describe("TAK Client", () => {
  let takClient: TakClient;
  let mockTakServer: MockTakServer;

  afterEach(async () => {
    await mockTakServer?.close();
    takClient.stop();
  });

  it("should reconnect to the TAK server", async () => {
    takClient = new TakClient(takConfig);
    mockTakServer = new MockTakServer();
    await mockTakServer.start();
    await takClient.init();

    // check if the client is connected
    expect(takClient.connected).toBe(true);
    await once(mockTakServer.tlsServer!, "secureConnection");
    expect(mockTakServer.connections.length).toBe(1);

    // wait for the client to close
    const endEvent = once(takClient.tak!, "end", "takClient Receives End");
    mockTakServer.close();
    await endEvent;
    expect(mockTakServer.connections.length).toBe(0);
    expect(takClient.reconnecting).toBe(true);

    // restart the mock tak server and veerify if new connection is established
    mockTakServer.start();
    await once(mockTakServer.tlsServer!, "secureConnection");
    expect(mockTakServer.connections.length).toBe(1);

    await once(takClient.tak!, "ping", "TakClient Received Successfull Ping");

    // send cot from TAK client and receive it on the mock tak server
    const cot = new CoT(`
      <event version="2.0" uid="ANDROID-deadbeef" type="a-f-G-U-C" how="m-g" time="2021-02-27T20:32:24.771Z" start="2021-02-27T20:32:24.771Z" stale="2021-02-27T20:38:39.771Z">
          <point type="b-f-t" lat="1.234567" lon="-3.141592" hae="-25.7" ce="9.9" le="9999999.0"/>
      </event>`);
    takClient.tak?.write([cot]);
    await once(mockTakServer!, "cotData", "Mock TAK Server Received CoT");

    await mockTakServer.close();
    takClient.stop();
  });

  it("should not attempt to reconnect if the TAK client is destroyed", async () => {
    mockTakServer = new MockTakServer();
    await mockTakServer.start();

    takClient = new TakClient(takConfig);
    await takClient.init();

    expect(takClient.connected).toBe(true);
    await once(mockTakServer.tlsServer!, "secureConnection");
    expect(mockTakServer.connections.length).toBe(1);

    const disconnectEvent = once(mockTakServer!, "clientDisconnected");
    takClient.stop();
    await disconnectEvent;

    expect(takClient.connected).toBe(false);
    expect(takClient.reconnecting).toBe(false);

    await sleep(3000);

    expect(takClient.backoff.getAttempts()).toBe(0);
    expect(mockTakServer.connections.length).toBe(0);

    await mockTakServer.close();
  });

  it("should attempt to reconnect if destroyed prior and reconnected", async () => {
    mockTakServer = new MockTakServer();
    await mockTakServer.start();

    takClient = new TakClient(takConfig);
    await takClient.init();

    // Verify initial connection
    await once(mockTakServer.tlsServer!, "secureConnection");
    expect(mockTakServer.connections.length).toBe(1);
    expect(takClient.connected).toBe(true);

    // Intentionally kill the takClient
    takClient.stop();

    expect(takClient.connected).toBe(false);
    expect(takClient.reconnecting).toBe(false);

    // Reconnect the takClient
    takClient = new TakClient(takConfig);
    await takClient.init();

    // Verify new connection
    await once(mockTakServer.tlsServer!, "secureConnection");
    expect(mockTakServer.connections.length).toBe(1);
    expect(takClient.connected).toBe(true);

    // wait for the client to close
    const endEvent = once(takClient.tak!, "end", "takClient Receives End");
    mockTakServer.close();
    await endEvent;
    expect(takClient.reconnecting).toBe(true);

    // restart the mock tak server and veerify if new connection is established
    mockTakServer.start();
    await once(mockTakServer.tlsServer!, "secureConnection");
    expect(mockTakServer.connections.length).toBe(1);
  });

  it(
    "should fail if more than maxReconnects attempts are made",
    async () => {
      // Unique connection id to avoid re-using old closed and stale connections
      takClient = new TakClient(takConfig);
      mockTakServer = new MockTakServer();
      await mockTakServer.start();
      await takClient.init();

      expect(takClient.connected).toBe(true);

      // send data to the mock tak server
      const cot = new CoT(`
      <event version="2.0" uid="ANDROID-deadbeef" type="a-f-G-U-C" how="m-g" time="2021-02-27T20:32:24.771Z" start="2021-02-27T20:32:24.771Z" stale="2021-02-27T20:38:39.771Z">
          <point type="b-f-t" lat="1.234567" lon="-3.141592" hae="-25.7" ce="9.9" le="9999999.0"/>
      </event>`);
      takClient.tak?.write([cot]);
      const cotData = await once(
        mockTakServer!,
        "cotData",
        "MockTAKServer Receives CoT",
      );
      // if passes the server is connected
      expect(cotData.content).toBe(cot.to_xml());

      // Register event listener
      const endEvent = once(takClient.tak!, "end", "takClient Receives End");

      // close the mock tak server
      mockTakServer.close();

      // wait for the client to detect the connection loss
      const eventResult = await endEvent;

      expect(eventResult.duration_seconds).toBeCloseTo(0, 0.2);
      const error1Event = await once(
        takClient.tak!,
        "error",
        "MockTAKServer Receives Error #1",
      );
      expect(error1Event.duration_seconds).toBeCloseTo(1, 0.2);
      const error2Event = await once(
        takClient.tak!,
        "error",
        "MockTAKServer Receives Error #2",
      );
      expect(error2Event.duration_seconds).toBeCloseTo(2, 0.2);
      const error3Event = await once(
        takClient.tak!,
        "error",
        "MockTAKServer Receives Error #3",
      );
      expect(error3Event.duration_seconds).toBeCloseTo(4, 0.2);

      // check if the client is reconnecting
      expect(takClient.backoff.getAttempts()).toBe(4);
      expect(takClient.connected).toBe(true);
      expect(takClient.reconnecting).toBe(true);

      takClient.stop();
      await mockTakServer.close();
    },
    {
      timeout: 10_000,
    },
  );

  it("should remove the cot and ping listeners when the client is stopped", async () => {
    // Unique connection id to avoid re-using old closed and stale connections
    takClient = new TakClient(takConfig);
    await takClient.init();

    await takClient.start({
      onCoT: async (cot) => {
        console.log("MockTAKServer Received CoT", cot.to_xml());
      },
      onPing: async () => {
        console.log("MockTAKServer Received Ping");
      },
    });

    expect(takClient.tak?.listeners("cot").length).toBe(1);
    expect(takClient.tak?.listeners("ping").length).toBe(1);

    takClient.stop();

    expect(takClient.tak?.listeners("cot").length).toBe(0);
    expect(takClient.tak?.listeners("ping").length).toBe(0);
  });
});
