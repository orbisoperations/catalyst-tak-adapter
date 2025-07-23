import fs from "node:fs";
import { Config } from "../config";
import TAK, { CoT } from "@tak-ps/node-tak";

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
  constructor(config: Config) {
    this.config = config;
    this.timers = new Map<string, Timer>();
  }

  async init() {
    this.tak = await TAK.connect(
      new URL(this.config.tak.endpoint),
      {
        ...readKeyAndCert(this.config),
        // rejectUnauthorized: true,
      },
      {
        id: this.config.tak.connection_id || "ConnectionID",
      },
    );
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
      .on("end", async () => {
        console.error(`Connection End`);
      })
      .on("timeout", async () => {
        console.error(`Connection Timeout`);
      })
      .on("ping", async () => {
        console.error(`TAK Server Ping`);
        if (hooks.onPing) {
          await hooks.onPing();
        }
      })
      .on("error", async (err: Error) => {
        console.error(`Connection Error`, err);
      });
  }

  setInterval(name: string, func: (tak: TAK) => Bun.TimerHandler, ms: number) {
    this.timers.set(name, setInterval(func(this.tak!), ms));
  }

  cancelInterval(name: string) {
    this.timers.get(name)?.unref();
  }
}
