import { expect, test, describe, it} from "bun:test";
import {getConfig} from "../src/config";
import {Producer} from "../src/adapters/producer"
import {CoT} from "@tak-ps/node-tak";

describe("Producer", () => {
    describe("local storage", () => {
        const config = getConfig()
        console.log(config)

        const exampleCoT = new CoT(`
            <event version="2.0" uid="a4f460" type="a-f-G-U-C" how="h-g-i-g-o" time="2024-10-16T19:52:25.747Z" start="2024-10-16T19:52:25.747Z" stale="2024-10-16T19:57:25.747Z">
                <point lat="38.804169" lon="-76.136627" hae="1575" ce="999999.0" le="999999.0"/>
                <detail>
                    <_flow-tags_>
                     <NodeCoT-12.6.0>2024-10-16T19:52:25.747Z</NodeCoT-12.6.0>
                    </_flow-tags_>
                </detail>
            </event>`)


        it ("should initialize the database", () => {
            const producer = new Producer(config)
            expect(producer.db).toBeDefined()
        })

        it('should close the database', async () => {
            const producer = new Producer(config)
            await producer.closeDB()
            try {
                producer.db.get("doesntexist")
            } catch (e) {
                expect(e).toBeDefined()
            }
        })

        it('should put/get a CoT in the database', async () => {
            const producer = new Producer(config)
            await producer.putCoT(exampleCoT)
            const result = producer.getCoT("a4f460")
            Bun.deepEquals(result, exampleCoT.raw, true)
        })

        it("should delete a CoT from the database", async () => {
            const producer = new Producer(config)
            await producer.putCoT(exampleCoT)
            await producer.deleteCoT("a4f460")

            const shouldBeDeleted =    producer.db.get("a4f460")
            expect(shouldBeDeleted).toBeUndefined()
        })

        it("should get all CoTs from the database", async () => {
            const producer = new Producer(config)
            await producer.putCoT(exampleCoT)
            const allCots = producer.getAllCoT()
            Bun.deepEquals(allCots, [exampleCoT.raw], true)
        })
    })
})