import fs from "fs";
import {Config} from "../config";
import TAK, {CoT} from "@tak-ps/node-tak";

export function readKeyAndCert(config: Config) {
    // Read key and cert from file system
    return {
        key: fs.readFileSync(config.tak.key_file).toString(),
        cert: fs.readFileSync(config.tak.cert_file).toString()
    };
}

export async function startTakClient(config: Config, handlers: {
    onCot?: (tak: TAK, cot: CoT) => Promise<void>,
    onEnd?: (tak: TAK) => Promise<void>,
    onTimeout?: (tak: TAK) => Promise<void>,
    onPing?: (tak: TAK) => Promise<void>,
    onError?: (tak: TAK, err: Error) => Promise<void>
}) {
    const tak = await TAK.connect('ConnectionID', new URL(config.tak.endpoint), readKeyAndCert(config));
    tak.on('cot', async (cot: CoT) => {
        console.error('COT', cot); // See node-cot library
        if (handlers.onCot) await handlers.onCot(tak, cot);
    }).on('end', async () => {
        console.error(`Connection End`);
        if (handlers.onEnd) await handlers.onEnd(tak);
    }).on('timeout', async () => {
        console.error(`Connection Timeout`);
        if (handlers.onTimeout) await handlers.onTimeout(tak);
    }).on('ping', async () => {
        console.error(`TAK Server Ping`);
        if (handlers.onPing) await handlers.onPing(tak)
    }).on('error', async (err) => {
        console.error(`Connection Error`);
        if (handlers.onError) await handlers.onError(tak, err);
    });
}

