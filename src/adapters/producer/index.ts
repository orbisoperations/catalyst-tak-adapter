import {CoT}  from '@tak-ps/node-tak';
import { open, RootDatabase } from 'lmdb';
import { Config } from '../../config';
import type {Static} from "@sinclair/typebox";
import JSONCoT from "@tak-ps/node-cot/lib/types/types";

type CoTMsg = Static<typeof JSONCoT>

export class Producer {
    config: Config;
    dbPath: string;
    db: RootDatabase<CoTMsg, string>;

    mapSize: number;
    //static initDB: RootDatabase;

    constructor(config: Config) {
        this.config = config;
        this.dbPath = config.producer?.local_db_path || "./db";
        this.mapSize = 2 * 1024 * 1024 * 1024; // 2GB
        this.db = this.initDB()
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
            // What's going on here this should be a method, maybe not setting up type correctly?
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
}

