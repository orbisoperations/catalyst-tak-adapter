

import {CoT}  from '@tak-ps/node-tak';
import { open, RootDatabase } from 'lmdb';
import { Config } from '../../config';


export class Producer {
    config: Config;
    dbPath: string;
    db: any;

    mapSize: number;
    static initDB: RootDatabase;

    constructor(config: Config) {
        this.config = config;
        this.dbPath = config.producer?.local_db_path || "./db";
        this.mapSize = 2 * 1024 * 1024 * 1024; // 2GB
        this.initDB()
    }

    /**
     * Initialize the database
     */
    async initDB() {
        try {
            console.log("Opening database")
            this.db = open({
                mapSize: this.mapSize,
                path: this.dbPath
            })
            console.log("Database opened")
        } catch (error) {
            console.error("Error opening database", error)
        
        }
    }

    /**
     * Close the database
     */
    closeDB() {

        try {
            console.log("Closing database")
            this.db.close()
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
            await this.db.put(uid, JSON.stringify(cot.raw.event))
            console.log(`CoT (${uid}) : stored`)   

        } catch (error) {
            console.error("Error storing CoT in local database", error)
        }
    }
    
    // Method to retrieve CoT from lmdb
    async getCoT(uid: string) {
        try {
            const cot = await this.db.get(uid)
            if (!cot) {
                console.error(`CoT (${uid}) : not found`)
                return
            }
            console.log(`CoT (${uid}) : retrieved`)
            return JSON.parse(cot);
        } catch (error) {
            console.error("Error retrieving CoT from local database", error)
        }
    }

    // Method to retrieve all CoT from lmdb
    async getAllCoT() {
        try {
            const cots = []
            // What's going on here this should be a method, maybe not setting up type correctly?
            for (const [key, value] of this.db.getRange()) {
                console.log("--------------")
                console.log(value)
                cots.push(JSON.parse(value))
            }
            console.log("All CoT retrieved")
            console.log(cots);
            return cots
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
    handleStaleCoT() {
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
    }    
}

