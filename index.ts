import TAK, {CoT}  from '@tak-ps/node-tak';
import fs from "fs"

import {startTakClient} from "./src/tak"
import {getConfig} from "./src/config"

/*
TODO:
[X] export configs as toml (not envs)
[] TAK as a data source
    [] find local db store to use (and install it)
    [] capture and parse CoT for storage
    [] create graphql schema for CoT
    [] expose the endpoint to catalyst
    [] key validation from catalyst (JWT)
    [] return appropriate data for the query
[] TAK as a consumer
    [] we need a scheduling mechanism to send data to TAK
    [] we need a graphlq to query against Catalyst
    [] we need a way to convert catalyst data to CoT
    [] we need to send the messages to the TAK server




 */

const extracot = [new CoT(`
    <event version="2.0" uid="06ffdc74-fa10-6e37-6280-057491ac7e49" type="a-f-G" how="h-g-i-g-o" time="${new Date().toISOString()}" start="${new Date().toISOString()}" stale="${new Date(Date.now() + 5 * 60 * 1000).toISOString()}">
        <point lat="40.58094380762393" lon="-121.65387331154284" hae="999999.0" ce="999999.0" le="999999.0"/>
        <detail>
            <contact callsign="F.16.144558"/>
            <takv device="Firefox - 131" platform="WebTAK" os="Macintosh - 10.15" version="4.10.2"/>
            <archive/>
            <usericon iconsetpath="COT_MAPPING_2525B/"/>
            <link relation="p-p" type="a-f-G-U-C-I" uid="abad185b-c95d-13de-ee68-b51a7ef10d82"/>
            
        </detail>
    </event>
`),
    new CoT(`
    <event version="2.0" uid="06ffdc74-fa10-6e37-6280-057491ac7e40" type="a-f-G" how="h-g-i-g-o" time="${new Date().toISOString()}" start="${new Date().toISOString()}" stale="${new Date(Date.now() + 5 * 60 * 1000).toISOString()}">
        <point lat="40.78094380762393" lon="-121.85387331154284" hae="999999.0" ce="999999.0" le="999999.0"/>
        <detail>
            <contact callsign="F.16.144558"/>
            <takv device="Firefox - 131" platform="WebTAK" os="Macintosh - 10.15" version="4.10.2"/>
            <archive/>
            <usericon iconsetpath="COT_MAPPING_2525B/"/>
            <link relation="p-p" type="a-f-G-U-C-I" uid="abad185b-c95d-13de-ee68-b51a7ef10d83"/>
            
        </detail>
    </event>
`)];

const config = getConfig();
await startTakClient(config, {
    onCot: async (tak: TAK, cot: CoT) => {
        console.log('Received CoT', cot);
    },
    onEnd: async (tak: TAK) => {
        console.log(`Connection End`);
    },
    onTimeout: async (tak: TAK) => {
        console.log(`Connection Timeout`);
    },
    onPing: async (tak: TAK) => {
        console.log(`TAK Server Ping`);
        tak.write(extracot);
    },
    onError: async (tak: TAK, err: Error) => {
        console.log(`Connection Error`, err);
    }
})