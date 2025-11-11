import fs from "node:fs";
import type { Config } from "../config";
import TAK, { CoT } from "@tak-ps/node-tak";
import { ExponentialBackoff } from "../utils";

export function readKeyAndCert(config: Config) {
  // Read key and cert from file system
  return {
    key: fs.readFileSync(config.tak.key_file).toString(),
    cert: fs.readFileSync(config.tak.cert_file).toString(),
  };
}

export class TakClient {
  tak?: TAK;
  config: Config;
  timers: Map<string, Timer>;
  connected: boolean = false;
  reconnecting: boolean = false;
  private readonly _backoff: ExponentialBackoff = new ExponentialBackoff();
  private connectionIdOverride?: string;

  constructor(config: Config, opts?: { connectionId?: string }) {
    this.config = config;
    this.timers = new Map<string, Timer>();
    this.connectionIdOverride = opts?.connectionId;
  }

  async init() {
    const takUrl = new URL(this.config.tak.endpoint);
    console.log(
      "Connecting to TAK Server ",
      this.config.tak.endpoint,
      " with protocol ",
      takUrl.protocol,
      " and connection id ",
      this.connectionIdOverride ||
        this.config.tak.connection_id ||
        "ConnectionID",
    );

    this.tak = await TAK.connect(
      takUrl,
      {
        ...readKeyAndCert(this.config),
        // rejectUnauthorized: true,
      },
      {
        id:
          this.connectionIdOverride ||
          this.config.tak.connection_id ||
          "ConnectionID",
      },
    );

    this.tak
      .on("end", async () => {
        console.log(`TAKClient: Connection End`);
        await this.reconnect();
      })
      .on("timeout", async () => {
        console.error(`TAKClient: Connection Timeout`);
        await this.reconnect();
      })
      .on("error", async (err: Error) => {
        console.error(`TAKClient: Connection Error`, err);
        await this.reconnect();
      });

    this.connected = true;
  }

  async start(hooks: {
    onCoT?: (cot: CoT) => Promise<void>;
    onPing?: () => Promise<void>;
  }) {
    if (!this.tak) {
      throw new Error(
        "TAK not initialized or connection - please see logs above",
      );
    }
    this.tak
      .on("cot", async (cot: CoT) => {
        if (hooks.onCoT) {
          const pos = cot.position();
          cot.position([pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0]);
          await hooks.onCoT(cot);
        }
      })
      .on("ping", async () => {
        console.log(`TAK Server Ping`);
        if (hooks.onPing) {
          await hooks.onPing();
        }
      });
  }

  setInterval(name: string, func: (tak: TAK) => Bun.TimerHandler, ms: number) {
    this.timers.set(name, setInterval(func(this.tak!), ms));
  }

  cancelInterval(name: string) {
    clearInterval(this.timers.get(name)!);
    this.timers.get(name)?.unref();
    this.timers.delete(name);
  }

  /**
   * Reconnect to the TAK server
   * If the connection is already disconnected, do nothing
   * If the connection flag is set, reconnect.
   */
  async reconnect() {
    if (!this.connected) {
      console.log("TAK client was stopped, not reconnecting...");
      this.reconnecting = false;
      return;
    }

    this.reconnecting = true;
    const delay = this.backoff.nextDelay();
    await new Promise((r) => setTimeout(r, delay));

    /* We might have been stopped while sleeping */
    if (!this.connected) {
      this.reconnecting = false;
      return;
    }

    console.log(
      `Reconnecting to TAK server, attempt ${this.backoff.getAttempts()}`,
    );

    // let tak handle the reconnect internally
    // if not we would have to keep track of all the handlers and reinitialize them
    // NOTE: this reconnect does not throw an error if it fails
    //        what it does is that the tak client will emit an error event
    //        and we will handle it in the error handler and keep retrying
    //        be careful to not cause loops inside of this function
    await this.tak?.reconnect();
  }

  get backoff() {
    return this._backoff;
  }

  /**
   * Stop the TAK server
   * Set the disconnected flag to true
   * Cleanup the timers and the connection
   */
  stop() {
    this.connected = false;
    this.reconnecting = false;
    this.backoff.reset();
    console.log(`TAKClient: Cleaning up TAK connection`);
    this.timers.forEach((timer) => {
      try {
        clearInterval(timer);
        timer.unref();
      } catch (err) {
        console.error(`Error unrefing timer`, err);
      }
    });
    this.timers.clear();
    try {
      // Remove listeners after close to ensure call during cleanup      // Remove listeners after close to ensure call during cleanup
      this.tak?.removeAllListeners("cot");
      this.tak?.removeAllListeners("ping");

      this.tak?.destroy?.();
    } catch {
      console.error("TAKClient: end or close failed");
    }

    console.log(
      `TAK client ${this.connectionIdOverride || this.config.tak.connection_id || "ConnectionID"} stopped.`,
    );
  }
}
