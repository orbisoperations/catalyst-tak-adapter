import {CoT}  from '@tak-ps/node-tak';
import { open, RootDatabase } from 'lmdb';
import { Config } from '../../config';
import type {Static} from "@sinclair/typebox";
import JSONCoT from "@tak-ps/node-cot/lib/types/types";
import { Hono } from 'hono'
import { createYoga, createSchema } from 'graphql-yoga';
import {createRemoteJWKSet, jwtVerify} from "jose"

type CoTMsg = Static<typeof JSONCoT>

export class Producer {
    config: Config;
    dbPath: string;
    db: RootDatabase<CoTMsg, string>;
    graphqlPort: number;
    graphqlHost: string;
    jwksEndpoint: string;
    appId: string;
    jwks
    mapSize: number;

    constructor(config: Config) {
        this.config = config;
        this.dbPath = config.producer?.local_db_path || "./db";
        this.mapSize = 2 * 1024 * 1024 * 1024; // 2GB
        this.db = this.initDB()
        this.graphqlHost = config.producer?.graphql_host || "0.0.0.0";
        this.graphqlPort = config.producer?.graphql_port || 8080;
        this.jwksEndpoint = config.producer?.catalyst_jwks_endpoint || "https://gateway.catalyst.devintelops.io/.well-known/jwks.json";
        if (!config.producer?.catalyst_app_id) {
            throw new Error("Catalyst App ID not found")
        }
        this.appId = config.producer?.catalyst_app_id;

        this.jwks = createRemoteJWKSet(new URL(this.jwksEndpoint))
    }

    /**
     * Initialize the database
     */
    initDB() {
        try {
            console.log("Opening database")
            return open<CoTMsg, string>({
                mapSize: this.mapSize,
                path: this.dbPath
            })
        } catch (error) {
            console.error("Error opening database", error)
            throw error
        }
    }

    /**
     * Close the database
     */
    async closeDB() {
        try {
            console.log("Closing database")
            await this.db!.close()
            console.log("Database closed")
        } catch (error) {
            console.error("Error closing database", error)
        }
    }

    /**
     * 
     * @param cot CoT object to store in the database
     */
    async putCoT(cot: CoT) {
        try {
            const uid = cot.uid();
            await this.db.put(uid, cot.raw)
            console.log(`CoT (${uid}) : stored`)   

        } catch (error) {
            console.error("Error storing CoT in local database", error)
        }
    }
    
    // Method to retrieve CoT from lmdb
    getCoT(uid: string): CoTMsg | undefined {
        try {
            const cot = this.db.get(uid)
            if (!cot) {
                console.error(`CoT (${uid}) : not found`)
                return undefined
            }
            console.log(`CoT (${uid}) : retrieved`)
            return cot as Static<typeof JSONCoT>;
        } catch (error) {
            console.error("Error retrieving CoT from local database", error)
        }
    }

    // Method to retrieve all CoT from lmdb
    getAllCoT(): CoTMsg[] | undefined  {
        try {
            const currentTime = new Date()
            const cots = this.db.getRange()
                .filter(({ key, value }) => {
                    return new Date(value.event._attributes.stale) >= currentTime;
                })
                .map(({ key, value }) => {
                    return value;
                })
            return Array.from(cots)
        } catch (error) {
            console.error("Error retrieving all CoT from local database", error)
        }
    }

    // Method to delete Cot from lmdb
    async deleteCoT(uid: string) {
        try {
            const cot = await this.db.remove(uid);
            if (!cot) {
                console.error(`CoT (${uid}) : not found`);
                return
            }
            console.log(`CoT (${uid}) : deleted`);
        } catch (error) {
            console.error("Error deleting CoT from local database", error);
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

        const schema = createSchema({
            typeDefs: `
        type CoTPoint {
            lat: Float!
            lon: Float!
            hae: Float!
        }
        
        type CoTDetail {
            callsign: String!
        }
        
        type CoT {
            version: String!
            uid: String!
            type: String!
            how: String!
            point: CoTPoint!
            detail: CoTDetail!
        }
        
        type Query {
            hello: String!
            cots: [CoT]!
            cotWitinRadius(lat: Float!, lon: Float!, radius: Float!): [CoT]!
        }
    `,
            resolvers: {
                Query: {
                    hello: () => 'Hello World!',
                    cots: () => {
                            return this.getAllCoT()?.map(cot => {
                                return {
                                    version: cot.event._attributes.version,
                                    uid: cot.event._attributes.uid,
                                    type: cot.event._attributes.type,
                                    how: cot.event._attributes.how,
                                    point: {
                                        lat: cot.event.point._attributes.lat,
                                        lon: cot.event.point._attributes.lon,
                                        hae: cot.event.point._attributes.hae
                                    },
                                    detail: {
                                        callsign: cot.event.detail?.contact?._attributes.callsign ?? ""
                                    }
                                }
                            })
                        return []
                    }
                }
            }
        })

        const yoga = createYoga({
            schema: schema,
            graphqlEndpoint: "/graphql",
        });

        const app = new Hono()

        app.use("/graphql", async (c) => {


            const token = c.req.header("Authorization") ? c.req.header("Authorization")!.split(" ")[1] : ""
            let valid = false
            try {
                const { payload, protectedHeader } = await jwtVerify(token, this.jwks)
                valid = payload.claims != undefined && (payload.claims as string[]).includes(this.appId)
                if (!valid) {
                    console.error("unable to validate jwt")
                }
            } catch (e) {
                console.error("error validating jwt: ", e)
                valid = false
            }
            if (!valid) {
                return c.text("Unauthorized", 401)
            }
            return yoga.handle(c.req.raw);
        })

        const server = Bun.serve({
            port: this.graphqlPort,
            hostname: this.graphqlHost,
            fetch: app.fetch
        })

        console.info(
            `Server is running on ${new URL(
                yoga.graphqlEndpoint,
                `http://${server.hostname}:${server.port}`
            )}`
        )
    }
}

