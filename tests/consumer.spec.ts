import { Consumer } from "../src/adapters/consumer";
import { Config, CoTTransform } from "../src/config";
// import TAK, { CoT } from '@tak-ps/node-tak';
// import * as ld from 'lodash';
import { expect, describe, beforeEach, it } from "bun:test";

describe("Consumer", () => {
  let consumer: Consumer;
  // missing tak and producer fields
  // @ts-expect-error: This is a mock config, missing fields are intentional
  const mockConfig: Config = {
    dev: true,
    consumer: {
      enabled: true,
      catalyst_query_variables: {},
      local_db_path: ".tak_downloads",
      chat: {},
      catalyst_endpoint: "https://gateway.catalyst.devintelops.io/graphql",
      catalyst_query: "{ query }",
      catalyst_token: "test-token",
      catalyst_query_poll_interval_ms: 10000,
      parser: {
        dataName: {
          transform: {
            uid: "uid",
            type: "type",
            lat: "point.lat",
            lon: "point.lon",
            hae: "point.hae",
            how: "how",
            callsign: "detail.callsign",
            remarks: "details.remarks.text",
          },
        },
      },
    },
  };

  beforeEach(() => {
    consumer = new Consumer(mockConfig);
  });

  it("extracts CoT values correctly", () => {
    const object = {
      uid: "test-callsign",
      version: "2.0",
      type: "a-f-F",
      how: "h-g-i-g-o",
      point: {
        lat: 0,
        lon: 119,
        hae: 0,
        ce: 0,
        le: 0,
      },
      detail: {
        callsign: "test-callsign",
        movementCount: 27,
        distanceToOrigin: 0.9121570088802997,
        remarks: {
          text: "test-remarks",
        },
      },
    };

    const transform: CoTTransform = {
      uid: "uid",
      type: "type",
      lat: "point.lat",
      lon: "point.lon",
      hae: "point.hae",
      how: "how",
      callsign: "detail.callsign",
      remarks: "detail.remarks.text",
    };
    const result = consumer.extractCoTValues("dataName", object, transform);
    expect(result).toEqual({
      uid: "test-callsign",
      lat: "0",
      lon: "119",
      hae: "0",
      how: "h-g-i-g-o",
      callsign: "test-callsign",
      remarks: "test-remarks",
      type: "a-f-F",
    });
  });

  it("returns undefined if lat value is missing", () => {
    const object = {
      uidPath: "123",
      typePath: "a",
      lonPath: "2.0",
      haePath: "3.0",
      callsignPath: "test-callsign",
      remarksPath: "test-remarks",
    };
    // Transform won't work on this because these fields don't match
    // @ts-expect-error: This is intentional, missing lat should return undefined
    const transform: CoTTransform = {
      uid: "uidPath",
      type: "typePath",
      lon: "lonPath",
      hae: "haePath",
      callsign: "callsignPath",
      remarks: "remarksPath",
    };
    const result = consumer.extractCoTValues("dataName", object, transform);
    expect(result).toBeUndefined();
  });

  it("returns undefined if lon value is missing", () => {
    // Transform won't work on this because these fields don't match
    const object = {
      uidPath: "123",
      typePath: "a",
      latPath: "1.0",
      haePath: "3.0",
      callsignPath: "test-callsign",
      remarksPath: "test-remarks",
    };
    const transform: CoTTransform =
      mockConfig.consumer!.parser!.dataName.transform;
    const result = consumer.extractCoTValues("dataName", object, transform);
    expect(result).toBeUndefined();
  });

  it("handles null remarks field gracefully", () => {
    // Transform won't work on this because these fields don't match
    const object = {
      uidPath: "123",
      typePath: "a",
      latPath: "1.0",
      lonPath: "2.0",
      haePath: "3.0",
      callsignPath: "test-callsign",
      remarksPath: null,
    };
    const transform: CoTTransform = {
      uid: "uidPath",
      type: "typePath",
      lat: "latPath",
      lon: "lonPath",
      hae: "haePath",
      how: "howPath",
      callsign: "callsignPath",
      remarks: "remarksPath",
    };
    const result = consumer.extractCoTValues("dataName", object, transform);
    expect(result).toEqual({
      uid: "123",
      type: "a",
      lat: "1.0",
      lon: "2.0",
      hae: "3.0",
      callsign: "test-callsign",
      remarks: undefined,
    });
  });

  it("handles missing remarks field gracefully", () => {
    // Transform won't work on this because these fields don't match
    const object = {
      uidPath: "123",
      typePath: "a",
      latPath: "1.0",
      lonPath: "2.0",
      haePath: "3.0",
      callsignPath: "test-callsign",
    };
    const transform: CoTTransform = {
      uid: "uidPath",
      type: "typePath",
      lat: "latPath",
      lon: "lonPath",
      hae: "haePath",
      callsign: "callsignPath",
    };
    const result = consumer.extractCoTValues("dataName", object, transform);
    expect(result).toEqual({
      uid: "123",
      type: "a",
      lat: "1.0",
      lon: "2.0",
      hae: "3.0",
      callsign: "test-callsign",
      remarks: undefined,
    });
  });

  it("handles json with missing data gracefully", () => {
    const json = { no: "data" };
    const result = consumer.jsonToCots(json);
    expect(result).toEqual([]);
  });
});
