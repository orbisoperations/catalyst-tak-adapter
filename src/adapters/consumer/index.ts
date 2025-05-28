/*
[X] TAK as a consumer
    [X] we need a scheduling mechanism to send data to TAK
    [X] we need a graphlq to query against Catalyst
    [X] we need a way to convert catalyst data to CoT
    [X] we need to send the messages to the TAK server
 */

import { Config, CoTOverwrite, CoTTransform } from "../../config";
import TAK, { CoT } from "@tak-ps/node-tak";
import * as ld from "lodash";
import { open, RootDatabase } from "lmdb";

interface CoTValues {
  uid?: string;
  type?: string;
  lat?: string;
  lon?: string;
  hae?: string;
  how?: string;
  callsign?: string;
  remarks?: string;
}

export class Consumer {
  config: Config;
  poll_interval_ms: number;
  catalyst_endpoint: string;
  dbPath: string;
  db: RootDatabase<string, string>;

  constructor(config: Config) {
    this.config = config;
    this.dbPath = config.consumer?.local_db_path || "./db/consumer";
    if (!this.config.consumer) {
      throw new Error("Consumer config not found");
    }

    if (
      !this.config.consumer.catalyst_endpoint ||
      !this.config.consumer.catalyst_query ||
      !this.config.consumer.catalyst_token
    ) {
      throw new Error("Catalyst endpoint, query, or token not found");
    }

    this.catalyst_endpoint =
      this.config.consumer.catalyst_endpoint ??
      "https://gateway.catalyst.devintelops.io/graphql";

    this.poll_interval_ms =
      this.config.consumer.catalyst_query_poll_interval_ms ?? 10 * 1000;

    this.db = this.initDB();
  }

  initDB() {
    try {
      console.log("Opening database");
      return open<string, string>({
        mapSize: 2 * 1024 * 1024 * 1024, // 2GB
        path: this.dbPath,
      });
    } catch (error) {
      console.error("Error opening database", error);
      throw error;
    }
  }

  async doGraphqlQuery() {
    const result = await fetch(this.catalyst_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + this.config.consumer!.catalyst_token,
      },
      body: JSON.stringify({
        query: this.config.consumer!.catalyst_query,
        variables: new Object(this.config.consumer!.catalyst_query_variables),
      }),
    });
    try {
      return await result.json();
    } catch (error) {
      console.error("Error parsing response", error);
      console.error("query", this.config.consumer!.catalyst_query);
      console.error(
        "variables",
        this.config.consumer!.catalyst_query_variables
      );
      console.error("response", result);
      return { data: {} };
    }
  }

  async jsonToGeoChat(json: any): Promise<CoT[]> {
    if (!json || !json.data) {
      console.warn("Invalid JSON: ", json);
      return [];
    }

    const data = json.data;
    const senderUID = this.config?.tak.callsign ?? "CATALYST";
    const chatParsers = this.config.consumer?.chat;
    if (chatParsers === undefined) {
      console.warn(
        "no chat transforms have been found and unable to convert data to CoT"
      );
      return [];
    }
    console.log("chat parsers", chatParsers);
    let cots: CoT[] = [];
    for (const [dataName, chatParser] of Object.entries(chatParsers)) {
      if (data[dataName] === undefined) {
        console.error("key not found to generate chats in data", dataName);
      } else {
        const dataToTransform = data[dataName] as any[];
        console.log("dataToTransform", dataToTransform);
        for (const dataElement of dataToTransform) {
          if (!chatParser.message_id) {
            console.error("message_id not found and cannot send for", dataName);
            continue;
          }
          const messageId = ld.get(
            dataElement,
            chatParser.message_id,
            undefined
          );

          // build map of message variables
          let msgVars: [string, string][] = [];
          for (const [key, value] of Object.entries(chatParser.message_vars)) {
            ld.get(dataElement, value)
              ? msgVars.push([key, ld.get(dataElement, value)])
              : console.error("value not found for", key);
          }
          // build message
          let message = chatParser.message_template;
          for (const [key, value] of msgVars) {
            message = message.replace(`{${key}}`, value);
          }

          if (messageId === undefined) {
            console.error("message_id not found for", dataName);
            continue;
          }

          if (this.db.get(messageId) && this.db.get(messageId) === message) {
            console.log("message already sent and has not changed", messageId);
            continue;
          } else {
            await this.db.put(messageId, message);
          }

          const recipient = chatParser.recipient ?? "All Chat Rooms";
          // build CoT

          const cot = new CoT({
            event: {
              _attributes: {
                version: "2.0",
                uid: `GeoChat.${senderUID}.${recipient}.${messageId}`,
                type: "b-t-f",
                how: "h-g-i-g-o",
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toISOString(),
                access: "Undefined",
              },
              point: {
                _attributes: {
                  lat: this.config.tak.catalyst_lat ?? -64.0107,
                  lon: this.config.tak.catalyst_lon ?? -59.452,
                  hae: "999999.0",
                  ce: "999999.0",
                  le: "999999.0",
                },
              },
              detail: {
                __chat: {
                  _attributes: {
                    senderCallsign: senderUID,
                    chatroom: recipient,
                    id: recipient,
                    messageId: messageId,
                    parent: "RootContactGroup",
                    groupOwner: "false",
                  },
                  chatgrp: {
                    _attributes: {
                      id: recipient,
                      uid0: senderUID,
                      uid1: recipient,
                    },
                  },
                },
                remarks: {
                  _attributes: {
                    time: new Date().toISOString(),
                    source: senderUID,
                    to: recipient,
                  },
                  _text: message,
                },
                link: {
                  _attributes: {
                    relation: "p-p",
                    type: "a-f-G-U-C-I",
                    uid: senderUID,
                  },
                },
              },
            },
          });
          console.log("cot", cot.to_xml());
          cots.push(cot);
        }
      }
    }
    return cots;
  }

  jsonToCots(json: any) {
    if (!json || !json.data) {
      console.error("Invalid JSON: ", json);
      return [];
    }

    const data = json.data;

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      console.error("Expected 'data' to be a non-null object, got:", data);
      return [];
    }

    const parsers = this.config.consumer?.parser;

    if (parsers === undefined) {
      console.warn(
        "no transforms have been found and unable to convert data to CoT"
      );
      return [];
    }

    let cots: CoT[] = [];
    for (const [dataName, parser] of Object.entries(parsers)) {
      if (!(dataName in data)) {
        console.warn(
          `Key '${dataName}' not found in data. Available keys: ${Object.keys(
            data
          )}`
        );
        continue;
      }

      if (data[dataName] === undefined) {
        console.warn(`Key '${dataName}' exists but has undefined value`);
        continue;
      }

      const dataToTransform = data[dataName] as any[];
      for (const dataElement of dataToTransform) {
        let extractedVals = this.extractCoTValues(
          dataName,
          dataElement,
          parser.transform
        );
        if (extractedVals === undefined) {
          console.error("error extracting values for", dataName);
          continue;
        }

        if (parser.overwrite)
          extractedVals = this.overWriteCoTValues(
            extractedVals,
            parser.overwrite!
          );
        const cotValues = this.fillDefaultCoTValues(extractedVals);
        const formedCot = new CoT({
          event: {
            _attributes: {
              version: "2.0",
              uid: cotValues.uid,
              type: cotValues.type,
              how: cotValues.how,
              time: new Date().toISOString(),
              start: new Date().toISOString(),
              stale: new Date(Date.now() + this.poll_interval_ms).toISOString(),
            },
            detail: {
              contact: {
                _attributes: {
                  callsign: cotValues.callsign,
                },
              },
              remarks: {
                _text: cotValues.remarks,
              },
            },
            point: {
              _attributes: {
                lat: cotValues.lat,
                lon: cotValues.lon,
                hae: cotValues.hae,
                ce: "999999.0",
                le: "999999.0",
              },
            },
          },
        });
        cots.push(formedCot);
      }
    }

    return cots;
  }

  // Parse CoT Chat Event

  extractCoTValues(
    key: string,
    object: any,
    transform: CoTTransform
  ): CoTValues | undefined {
    // let uid, type, lat, lon, hae, how, callsign, remarks: string | undefined
    let uid, type, lat, lon, hae, how, callsign, remarks: string | undefined;
    if (transform.uid && ld.get(object, transform.uid))
      uid = ld.get(object, transform.uid);
    if (transform.type && ld.get(object, transform.type))
      type = ld.get(object, transform.type);
    if (transform.how && ld.get(object, transform.how))
      how = ld.get(object, transform.how);

    if (transform.lat && ld.get(object, transform.lat))
      lat = ld.get(object, transform.lat);
    else {
      console.error(`lat value not found for ${key}:${uid}`);
      return undefined;
    }
    if (transform.lon && ld.get(object, transform.lon))
      lon = ld.get(object, transform.lon);
    else {
      console.error(`lon value not found for ${key}:${uid}`);
      return undefined;
    }
    if (transform.hae && ld.get(object, transform.hae))
      hae = ld.get(object, transform.hae);

    if (transform.callsign && ld.get(object, transform.callsign))
      callsign = ld.get(object, transform.callsign);

    if (transform.remarks && ld.get(object, transform.remarks))
      remarks = ld.get(object, transform.remarks);
    return {
      uid: uid,
      type: type,
      lat: lat,
      lon: lon,
      hae: hae,
      callsign: callsign,
      how: how,
      remarks: remarks,
    };
  }

  overWriteCoTValues(CoTVals: CoTValues, transform: CoTOverwrite) {
    if (transform.uid) CoTVals.uid = transform.uid;
    if (transform.type) CoTVals.type = transform.type;
    if (transform.lat) CoTVals.lat = transform.lat;
    if (transform.lon) CoTVals.lon = transform.lon;
    if (transform.hae) CoTVals.hae = transform.hae;
    if (transform.callsign) CoTVals.callsign = transform.callsign;
    if (transform.type) CoTVals.type = transform.type;
    if (transform.how) CoTVals.how = transform.how;
    if (transform.remarks) CoTVals.remarks = transform.remarks;

    return CoTVals;
  }

  fillDefaultCoTValues(cotValues: CoTValues): CoTValues {
    if (!cotValues.uid) cotValues.uid = crypto.randomUUID();
    if (!cotValues.type) cotValues.type = "a-f-G";
    if (!cotValues.hae) cotValues.hae = "999999.0";
    if (!cotValues.callsign) cotValues.callsign = "";
    if (!cotValues.how) cotValues.how = "h-g-i-g-o";
    if (!cotValues.remarks) cotValues.remarks = "";

    return cotValues;
  }

  publishCot(cots: CoT[], tak: TAK) {
    tak.write(cots);
  }
}
