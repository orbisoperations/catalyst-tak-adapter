import CoT, { Types } from "@tak-ps/node-cot";
import { open, RootDatabase } from "lmdb";
import { Config } from "../../config";
import type { Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { createYoga, createSchema } from "graphql-yoga";
import { createRemoteJWKSet } from "jose";
import path from "node:path";
import fs from "fs";
import { readKeyAndCert } from "../../tak";
import https from "node:https";
import { verifyJwtWithRemoteJwks } from "../../auth/catalyst-jwt";

type CoTMsg = Static<typeof Types.default>;

/**
 * Get the file name with {uid}_{filename}
 * @param cot
 * @returns
 */
function getFileName(cot: CoT) {
  const fileshare = cot.detail().fileshare;
  if (!fileshare) {
    return;
  }
  const uid = cot.uid();
  const filename = fileshare._attributes.filename;
  if (filename) {
    return `${uid}_${filename}`;
  }
  return `${uid}_${fileshare._attributes.name}`;
}

export class Producer {
  config: Config;
  dbPath: string;
  downloadPath: string;
  db: RootDatabase<CoTMsg, string>;
  graphqlPort: number;
  graphqlHost: string;
  jwksEndpoint: string;
  appId: string;
  jwks;
  mapSize: number;
  catalyst_jwt_issuer: string;

  constructor(config: Config) {
    if (!config.producer || !config.producer.enabled) {
      throw new Error("Producer is not enabled");
    }

    this.config = config;
    this.catalyst_jwt_issuer = config.producer?.catalyst_jwt_issuer;
    this.dbPath = config.producer?.local_db_path || "./db/producer";
    this.downloadPath =
      config.producer?.local_download_path || ".tak_downloads";
    this.mapSize = 2 * 1024 * 1024 * 1024; // 2GB
    this.db = this.initDB();
    this.graphqlHost = config.producer?.graphql_host || "0.0.0.0";
    this.graphqlPort = config.producer?.graphql_port || 8080;
    this.jwksEndpoint =
      config.producer?.catalyst_jwks_url ||
      "https://gateway.catalyst.devintelops.io/.well-known/jwks.json";
    if (!config.producer?.catalyst_app_id) {
      throw new Error("Catalyst App ID not found");
    }
    this.appId = config.producer?.catalyst_app_id;

    this.jwks = createRemoteJWKSet(new URL(this.jwksEndpoint));
  }

  /**
   * Initialize the database
   */
  initDB() {
    try {
      console.log("Opening database");
      return open<CoTMsg, string>({
        mapSize: this.mapSize,
        path: this.dbPath,
      });
    } catch (error) {
      console.error("Error opening database", error);
      throw error;
    }
  }

  /**
   * Close the database
   */
  async closeDB() {
    try {
      console.log("Closing database");
      await this.db!.close();
      console.log("Database closed");
    } catch (error) {
      console.error("Error closing database", error);
    }
  }

  /**
   *
   * @param cot CoT object to store in the database
   */
  async putCoT(cot: CoT) {
    try {
      // handle fileshare
      const uid = cot.uid();
      console.log(`CoT received - UID: ${uid}, Type: ${cot.type()}`);
      if (cot.detail().fileshare) {
        console.log("🗂️  FileShare CoT detected!");
        console.log(
          "Full CoT:",
          JSON.stringify(cot.detail().fileshare, null, 2),
        );
        // save the file to the .tak_download path
        await this.getFileFromTak(cot);
      } else {
        console.log("📄 Regular CoT (not a fileshare)");
      }
      await this.db.put(uid, cot.raw);
      console.log(`CoT (${uid}) : stored`);
    } catch (error) {
      console.error("Error storing CoT in local database", error);
    }
  }

  async getFileFromTak(cot: CoT) {
    // validate if the cot contains valid fileshare information
    const fileshare = cot.detail().fileshare;
    if (!fileshare) {
      console.error("No fileshare found");
      return;
    }
    const senderUrl = fileshare._attributes.senderUrl;
    if (!senderUrl) {
      console.error("No senderUrl found");
      return;
    }
    const uniqueFileName = getFileName(cot);
    if (!uniqueFileName) {
      console.error("No unique file name found for cot: ", cot.uid());
      return;
    }
    const filePath = path.join(this.downloadPath, uniqueFileName);
    const { key, cert } = readKeyAndCert(this.config);
    const options: https.RequestOptions = {
      key: key,
      cert: cert,
      rejectUnauthorized: false,
    };
    console.log("Sending Request");
    https
      .get(senderUrl, options, (res) => {
        if (res.statusCode !== 200) {
          console.error(
            "Error downloading file: ",
            res.statusCode,
            res.statusMessage,
          );
          return;
        }

        if (!fs.existsSync(this.downloadPath)) {
          console.log("Creating download path.");
          fs.mkdirSync(this.downloadPath);
        }

        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          console.log("Download Completed.");
          fileStream.close();
        });

        fileStream.on("error", (error) => {
          fs.unlink(filePath, () => {});
          console.error("File stream issue: ", error);
        });

        return filePath;
      })
      .on("error", (error) => {
        console.error(error);
      });
  }

  // Method to retrieve CoT from LMDB
  getCoT(uid: string): CoT | undefined {
    try {
      const cot = this.db.get(uid);
      if (!cot) {
        console.error(`CoT (${uid}) : not found`);
        return undefined;
      }
      console.log(`CoT (${uid}) : retrieved`);
      return new CoT(cot);
    } catch (error) {
      console.error("Error retrieving CoT from local database", error);
    }
  }

  /**
   * Method to retrieve all CoT (Cursor on Target) messages from the local database.
   * Filters the messages to include only those where the stale time plus 60 seconds
   * is greater than or equal to the current time.
   *
   * @returns {CoTMsg[] | undefined} An array of CoT messages or undefined if an error occurs.
   */
  getAllCoT(): CoTMsg[] | undefined {
    try {
      const currentTime = new Date();
      const cots = this.db
        .getRange()
        .filter(({ value }) => {
          const staleTime = new Date(value.event._attributes.stale);
          const staleTimePlus60Secs = new Date(staleTime.getTime() + 60 * 1000);
          return staleTimePlus60Secs >= currentTime;
          // return new Date(value.event._attributes.stale) >= currentTime;
        })
        .map(({ value }) => {
          return value;
        });
      return Array.from(cots);
    } catch (error) {
      console.error("Error retrieving all CoT from local database", error);
    }
  }

  getFileShare(uid: string) {
    const cot = this.getCoT(uid);
    if (!cot) {
      console.error(`CoT (${uid}) : not found`);
      return;
    }
    // Get the fileshare object from the CoT
    try {
      const fileshare = cot.detail().fileshare;
      if (!fileshare) {
        console.error(`CoT (${uid}) : no fileshare found`);
        return;
      }
      const uniqueFileName = getFileName(cot);
      if (!uniqueFileName) {
        console.error(`CoT (${uid}) : no unique file name found`);
        return;
      }
      const filePath = path.join(this.downloadPath, uniqueFileName);
      const content = fs.readFileSync(filePath).toString("base64");
      return {
        uid,
        filename: uniqueFileName,
        content,
      };
    } catch (error) {
      console.error("Error getting fileshare from CoT", error);
    }
  }

  // Method to delete Cot from lmdb
  async deleteCoT(uid: string) {
    try {
      const cot = await this.db.remove(uid);
      if (!cot) {
        console.error(`CoT (${uid}) : not found`);
        return false;
      }
      console.log(`CoT (${uid}) : deleted`);
      return true;
    } catch (error) {
      console.error("Error deleting CoT from local database", error);
      return false;
    }
  }

  // Function to check for stale CoT and remove db entries
  /* handleStaleCoT() {
        console.log("Starting stale CoT check")
        // Check every 5 mins
        setInterval(async () => {
            let now = Date.now();
            // Get all CoT from db
            // CoT has a stale field so we can check that against current time
            // Check if stale
            // If stale, remove
            // If not, continue
            try {
                for await (const [key, value] of this.db.getRange()) {
                    const cot = JSON.parse(value);
                    console.log(cot._attributes.stale);
                    console.log(new Date(cot._attributes.stale).getTime());
                    if (now > new Date(cot._attributes.stale).getTime()) {
                        await this.db.remove(key);
                        console.log(`CoT (${key}) : stale and removed`);
                    }
                }
            } catch (error) {

            }
        }, 1 * 60 * 1000)
    }    */

  startGraphqlServer() {
    /*
     * Graphql Stuff
     */
    const typeDefs = `
        type CoTPoint {
            lat: Float!
            lon: Float!
            hae: Float!
        }

        type CoTRemarks {
            source: String
            to: String
            time: String
            text: String
        }

        type CoTGroupChat {
            uids: [String]!
            id: String!
        }

        type CoTChat {
            parent: String!
            groupOwner: String!
            messageId: String!
            chatRoom: String!
            id: String!
            senderCallsign: String!
            chatGroup: CoTGroupChat
        }

        type CoTDetail {
            callsign: String!
            chat: CoTChat
            remarks: CoTRemarks
            fileshare: CoTFileShare
        }

        type CoTFileShare {
            uid: String!
            filename: String!
            senderUid: String!
            senderCallsign: String!
            name: String!
        }

        type CoT {
            version: String!
            uid: String!
            type: String!
            how: String!
            point: CoTPoint!
            detail: CoTDetail!
        }

        type File {
            uid: String!
            filename: String!
            content: String!
        }

        type Query {
            hello: String!
            cots: [CoT]!
            cotWitinRadius(lat: Float!, lon: Float!, radius: Float!): [CoT]!
            downloadFile(uid: String!): File!
            _sdl: String!
        }

        type Mutation {
            deleteCoT(uid: String!): Boolean
        }
    `;
    const schema = createSchema({
      typeDefs: typeDefs,
      resolvers: {
        Query: {
          hello: () => "Hello World!",
          cots: () => {
            return this.getAllCoT()?.map((cot) => {
              return {
                version: cot.event._attributes.version,
                uid: cot.event._attributes.uid,
                type: cot.event._attributes.type,
                how: cot.event._attributes.how,
                point: {
                  lat: cot.event.point._attributes.lat,
                  lon: cot.event.point._attributes.lon,
                  hae: cot.event.point._attributes.hae,
                },
                detail: {
                  callsign:
                    cot.event.detail?.contact?._attributes.callsign ?? "",
                  chat: cot.event.detail?.__chat
                    ? {
                        parent: cot.event.detail?.__chat._attributes.parent,
                        groupOwner:
                          cot.event.detail?.__chat._attributes.groupOwner,
                        messageId:
                          cot.event.detail?.__chat._attributes.messageId ??
                          cot.event._attributes.uid,
                        chatRoom: cot.event.detail?.__chat._attributes.chatroom,
                        id: cot.event.detail?.__chat._attributes.id,
                        senderCallsign:
                          cot.event.detail?.__chat._attributes.senderCallsign,
                        chatGroup: {
                          uids:
                            Object.entries(
                              cot.event.detail?.__chat.chatgrp._attributes,
                            )
                              .filter(([key]) => key !== "id")
                              .map((a) => a[1]) || [],
                          id: cot.event.detail?.__chat.chatgrp.id ?? "",
                        },
                      }
                    : undefined,
                  fileshare: cot.event.detail?.fileshare
                    ? {
                        uid: cot.event._attributes.uid,
                        filename:
                          cot.event.detail?.fileshare?._attributes.filename,
                        senderUid:
                          cot.event.detail?.fileshare?._attributes.senderUid,
                        senderCallsign:
                          cot.event.detail?.fileshare?._attributes
                            .senderCallsign,
                        name: cot.event.detail?.fileshare?._attributes.name,
                      }
                    : undefined,
                  remarks: cot.event.detail?.remarks
                    ? {
                        source: cot.event.detail?.remarks._attributes?.source,
                        to: cot.event.detail?.remarks._attributes?.to,
                        time: cot.event.detail?.remarks._attributes?.time,
                        text: cot.event.detail?.remarks._text,
                      }
                    : undefined,
                },
              };
            });
          },
          downloadFile: (_, { uid }) => {
            return this.getFileShare(uid);
          },

          _sdl: () => typeDefs,
        },
        Mutation: {
          deleteCoT: async (_, { uid }) => {
            return await this.deleteCoT(uid);
          },
        },
      },
    });

    const yoga = createYoga({
      schema: schema,
      graphqlEndpoint: "/graphql",
    });

    const app = new Hono();

    // middleware to check if the request is a valid jwt
    app.use(async (c, next) => {
      if (this.config.dev) {
        // don't check for jwt in dev mode
        console.error("THIS SERVER IS RUNNING IN DEV MODE AND IS NOT SECURE");
        console.log("dev mode, skipping jwt check");
        return next();
      }

      const header = c.req.header("Authorization");
      const splitedValue = header?.split(" ");
      const token: string | undefined = splitedValue?.[1];

      if (!token) {
        console.error(
          "Unauthorized request: No token found in Authorization header",
        );
        return c.json(
          { message: "Catalyst token is required", code: 400 },
          400,
        );
      }

      const validationResult = await verifyJwtWithRemoteJwks(
        token,
        this.catalyst_jwt_issuer,
        this.appId,
        this.jwksEndpoint,
      );

      if (!validationResult.verified) {
        console.error(
          "error verifying jwt: ",
          JSON.stringify(validationResult),
        );

        if (
          validationResult.errorCode === "JWT_VALIDATION_FAILED" ||
          validationResult.errorCode === "UNEXPECTED_JWT_VALIDATION_ERROR"
        ) {
          console.error(
            "Internal JOSE Error validating jwt. Masking error to client.",
          );
          return c.json({ message: "Invalid JWT", code: 401 }, 401);
        }

        return c.json({ message: validationResult.message, code: 401 }, 401);
      }

      return next();
    });

    app.use("/graphql", async (c) => {
      return yoga.handle(c.req.raw);
    });

    const server = Bun.serve({
      port: this.graphqlPort,
      hostname: this.graphqlHost,
      fetch: app.fetch,
    });

    console.info(
      `Server is running on ${new URL(
        yoga.graphqlEndpoint,
        `http://${server.hostname}:${server.port}`,
      )}`,
    );
  }
}
