import * as realFs from "node:fs";
import { expect, describe, it, afterEach, mock, afterAll } from "bun:test";

// Mock fs module
mock.module("node:fs", () => {
  const mockWriteStream = {
    on: mock((event, callback) => {
      // Simulate successful events
      if (event === "finish") {
        setTimeout(callback, 10);
      }
      return mockWriteStream;
    }),
    close: mock(() => {}),
    emit: mock(() => {}),
  };

  return {
    default: {
      readFileSync: () => "Hello world. Mocked file content.",
      createWriteStream: mock(() => mockWriteStream),
      existsSync: mock(() => true),
      mkdirSync: mock(() => {}),
      unlink: mock((path, callback) => {
        // Simulate successful unlink
        if (callback) callback();
      }),
    },
  };
});

mock.module("node:https", () => {
  const mockResponse = {
    statusCode: 200,
    statusMessage: "OK",
    pipe: mock((stream) => {
      // Simulate successful pipe operation
      setTimeout(() => {
        stream.emit("finish");
      }, 10);
      return stream;
    }),
  };

  const mockRequest = {
    on: mock(() => {
      // Don't emit error by default for successful case
      return mockRequest;
    }),
  };

  return {
    default: {
      get: mock((url, options, callback) => {
        // Call the callback with the mock response
        if (typeof options === "function") {
          // If options is actually the callback
          options(mockResponse);
        } else if (typeof callback === "function") {
          callback(mockResponse);
        }
        return mockRequest;
      }),
    },
  };
});

import { Config } from "../src/config";
import { Producer } from "../src/adapters/producer";
import { CoT } from "@tak-ps/node-tak";

describe("Producer", () => {
  afterAll(() => {
    mock.restore();
  });

  describe("local storage", () => {
    // missing tak and consumer fields
    const mockConfig: Config = {
      dev: true,
      producer: {
        enabled: true,
        catalyst_jwks_url:
          "https://catalyst.devintelops.io/.well-known/jwks.json",
        catalyst_jwt_issuer: "issuer",
        catalyst_app_id: "test-app-id",
        local_db_path: ".tak_downloads",
        local_download_path: ".tak_downloads",
        graphql_port: 4000,
        graphql_host: "localhost",
      },
      tak: {
        connection_id: "test-connection-id",
        endpoint: "https://test.endpoint",
        key_file: "test-key-file",
        cert_file: "test-cert-file",
        callsign: "test-callsign",
        video: {},
        group: "test-group",
        role: "test-role",
        catalyst_lat: 0,
        catalyst_lon: 0,
      },
    };
    const exampleCoT = new CoT(`
            <event version="2.0" uid="a4f460" type="a-f-G-U-C" how="h-g-i-g-o" time="2024-10-16T19:52:25.747Z" start="2024-10-16T19:52:25.747Z" stale="2024-10-16T19:57:25.747Z">
                <point lat="38.804169" lon="-76.136627" hae="1575" ce="999999.0" le="999999.0"/>
                <detail>
                    <_flow-tags_>
                     <NodeCoT-12.6.0>2024-10-16T19:52:25.747Z</NodeCoT-12.6.0>
                    </_flow-tags_>
                </detail>
            </event>`);

    it("should initialize the database", () => {
      const producer = new Producer(mockConfig);
      expect(producer.db).toBeDefined();
    });

    it("should close the database", async () => {
      const producer = new Producer(mockConfig);
      await producer.closeDB();
      try {
        producer.db.get("doesntexist");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should put/get a CoT in the database", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(exampleCoT);
      const result = producer.getCoT("a4f460");
      Bun.deepEquals(result, exampleCoT.raw, true);
    });

    it("should delete a CoT from the database", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(exampleCoT);
      await producer.deleteCoT("a4f460");

      const shouldBeDeleted = producer.db.get("a4f460");
      expect(shouldBeDeleted).toBeUndefined();
    });

    it("should get all CoTs from the database", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(exampleCoT);
      const allCots = producer.getAllCoT();
      Bun.deepEquals(allCots, [exampleCoT.raw], true);
    });
  });

  describe("GraphQL resolver validation", () => {
    afterEach(() => {
      realFs.rmSync("tests/.tak_test_db", { recursive: true, force: true });
    });

    const mockConfig: Config = {
      dev: true,
      producer: {
        enabled: true,
        catalyst_jwks_url:
          "https://catalyst.devintelops.io/.well-known/jwks.json",
        catalyst_jwt_issuer: "issuer",
        catalyst_app_id: "test-app-id",
        local_db_path: "tests/.tak_test_db",
        local_download_path: "tests/.tak_test_downloads",
        graphql_port: 4000,
        graphql_host: "localhost",
      },
      tak: {
        connection_id: "test-connection-id",
        endpoint: "https://test.endpoint",
        key_file: "test-key-file",
        cert_file: "test-cert-file",
        callsign: "test-callsign",
        video: {},
        group: "test-group",
        role: "test-role",
        catalyst_lat: 0,
        catalyst_lon: 0,
      },
    };

    // Helper function to generate current timestamps
    const getCurrentTimestamps = () => {
      const now = new Date();
      const start = now.toISOString();
      const stale = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
      return { start, stale };
    };

    // Basic CoT without chat, fileshare, or remarks
    const basicCoT = (() => {
      const { start, stale } = getCurrentTimestamps();
      return new CoT(`
        <event version="2.0" uid="basic-test" type="a-f-G-U-C" how="h-g-i-g-o" time="${start}" start="${start}" stale="${stale}">
          <point lat="38.804169" lon="-76.136627" hae="1575" ce="999999.0" le="999999.0"/>
          <detail>
            <contact callsign="TEST-CALLSIGN"/>
            <_flow-tags_>
              <NodeCoT-12.6.0>${start}</NodeCoT-12.6.0>
            </_flow-tags_>
          </detail>
        </event>
      `);
    })();

    // Chat CoT
    const chatCoT = (() => {
      const { start, stale } = getCurrentTimestamps();
      return new CoT(`
        <event version="2.0" uid="chat-test" type="b-t-f" how="h-g-i-g-o" time="${start}" start="${start}" stale="${stale}">
          <point lat="38.491979" lon="-121.526124" hae="-40.895" ce="4.5" le="9999999.0"/>
          <detail>
            <contact callsign="CHAT-CALLSIGN"/>
            <__chat parent="RootContactGroup" groupOwner="false" messageId="test-message-id" chatroom="All Chat Rooms" id="All Chat Rooms" senderCallsign="TURBO">
              <chatgrp uid0="ANDROID-test" uid1="All Chat Rooms" id="All Chat Rooms"/>
            </__chat>
            <remarks source="TEST.SOURCE" to="All Chat Rooms" time="${start}">Test message</remarks>
          </detail>
        </event>
      `);
    })();

    // Fileshare CoT
    const fileshareCoT = (() => {
      const { start, stale } = getCurrentTimestamps();
      return new CoT(`
        <event version="2.0" uid="fileshare-test" type="b-f-t-r" how="h-e" time="${start}" start="${start}" stale="${stale}">
          <point lat="-58.90375561" lon="-123.15202048" hae="999999.0" ce="999999.0" le="999999.0"/>
          <detail>
            <contact callsign="FILE-CALLSIGN"/>
            <fileshare filename="test.jpg.zip" senderUrl="https://example.com/file" sizeInBytes="1024" sha256="testhash" senderUid="TEST-SENDER-UID" senderCallsign="TEST-SENDER" name="test.jpg"/>
          </detail>
        </event>
      `);
    })();

    // Remarks CoT
    const remarksCoT = (() => {
      const { start, stale } = getCurrentTimestamps();
      return new CoT(`
        <event version="2.0" uid="remarks-test" type="b-m-p-s-m" how="h-g-i-g-o" time="${start}" start="${start}" stale="${stale}">
          <point lat="-1.9419843375972548" lon="-72.24609375" hae="999999.0" ce="999999.0" le="999999.0"/>
          <detail>
            <contact callsign="REMARKS-CALLSIGN"/>
            <remarks source="TEST.SOURCE" to="TEST.TARGET" time="${start}">Test remarks content</remarks>
          </detail>
        </event>
      `);
    })();

    it("should return valid CoT structure for basic CoT", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(basicCoT);

      const result = producer.getAllCoT();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result!.length).toBe(1);

      // Test resolver transformation
      const resolverResult = producer.getAllCoT()?.map((cot) => {
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
            callsign: cot.event.detail?.contact?._attributes.callsign ?? "",
            chat: cot.event.detail?.__chat ? {} : undefined,
            fileshare: cot.event.detail?.fileshare ? {} : undefined,
            remarks: cot.event.detail?.remarks ? {} : undefined,
          },
        };
      });

      expect(resolverResult).toBeDefined();
      expect(resolverResult!.length).toBe(1);

      const cot = resolverResult![0];

      // Validate required fields match TypeDef
      expect(typeof cot?.version).toBe("string");
      expect(typeof cot?.uid).toBe("string");
      expect(typeof cot?.type).toBe("string");
      expect(typeof cot?.how).toBe("string");

      // Validate point structure
      expect(typeof cot?.point?.lat).toBe("string");
      expect(typeof cot?.point?.lon).toBe("string");
      expect(typeof cot?.point?.hae).toBe("string");

      // Validate detail structure
      expect(typeof cot?.detail?.callsign).toBe("string");
      expect(cot?.detail?.chat).toBeUndefined();
      expect(cot?.detail?.fileshare).toBeUndefined();
      expect(cot?.detail?.remarks).toBeUndefined();

      await producer.closeDB();
    });

    it("should return valid CoT structure with chat data", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(chatCoT);

      const resolverResult = producer.getAllCoT()?.map((cot) => {
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
            callsign: cot.event.detail?.contact?._attributes.callsign ?? "",
            chat: cot.event.detail?.__chat
              ? {
                  parent: cot.event.detail?.__chat._attributes.parent,
                  groupOwner: cot.event.detail?.__chat._attributes.groupOwner,
                  messageId: cot.event.detail?.__chat._attributes.messageId,
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
            fileshare: undefined,
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

      expect(resolverResult).toBeDefined();
      expect(resolverResult!.length).toBe(1);

      const cot = resolverResult![0];

      // Validate chat structure matches TypeDef
      expect(cot?.detail?.chat).toBeDefined();
      expect(typeof cot?.detail?.chat?.parent).toBe("string");
      expect(typeof cot?.detail?.chat?.groupOwner).toBe("string");
      expect(typeof cot?.detail?.chat?.messageId).toBe("string");
      expect(typeof cot?.detail?.chat?.chatRoom).toBe("string");
      expect(typeof cot?.detail?.chat?.id).toBe("string");
      expect(typeof cot?.detail?.chat?.senderCallsign).toBe("string");

      // Validate chatGroup structure
      expect(cot?.detail?.chat?.chatGroup).toBeDefined();
      expect(Array.isArray(cot?.detail?.chat?.chatGroup?.uids)).toBe(true);
      expect(typeof cot?.detail?.chat?.chatGroup?.id).toBe("string");

      // Validate remarks structure
      expect(cot?.detail?.remarks).toBeDefined();
      expect(typeof cot?.detail?.remarks?.source).toBe("string");
      expect(typeof cot?.detail?.remarks?.to).toBe("string");
      expect(typeof cot?.detail?.remarks?.time).toBe("string");
      expect(typeof cot?.detail?.remarks?.text).toBe("string");

      await producer.closeDB();
    });

    it("should return valid CoT structure with fileshare data", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(fileshareCoT);

      const resolverResult = producer.getAllCoT()?.map((cot) => {
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
            callsign: cot.event.detail?.contact?._attributes.callsign ?? "",
            chat: undefined,
            fileshare: cot.event.detail?.fileshare
              ? {
                  uid: cot.event._attributes.uid,
                  filename: cot.event.detail?.fileshare?._attributes.filename,
                  senderUid: cot.event.detail?.fileshare?._attributes.senderUid,
                  senderCallsign:
                    cot.event.detail?.fileshare?._attributes.senderCallsign,
                  name: cot.event.detail?.fileshare?._attributes.name,
                }
              : undefined,
            remarks: undefined,
          },
        };
      });

      expect(resolverResult).toBeDefined();
      expect(resolverResult!.length).toBe(1);

      const cot = resolverResult![0];

      // Validate fileshare structure matches TypeDef
      expect(cot?.detail?.fileshare).toBeDefined();
      expect(typeof cot?.detail?.fileshare?.uid).toBe("string");
      expect(typeof cot?.detail?.fileshare?.filename).toBe("string");
      expect(typeof cot?.detail?.fileshare?.senderUid).toBe("string");
      expect(typeof cot?.detail?.fileshare?.senderCallsign).toBe("string");
      expect(typeof cot?.detail?.fileshare?.name).toBe("string");

      // get the file
      const file = producer.getFileShare(cot?.detail?.fileshare?.uid ?? "");
      expect(file).toBeDefined();
      expect(file?.uid).toBe(cot?.uid ?? "");
      expect(file!.filename).toBe(
        cot?.uid + "_" + cot?.detail?.fileshare?.filename,
      );
      expect(file!.content).toBe("Hello world. Mocked file content.");

      await producer.closeDB();
    });

    it("should return valid CoT structure with remarks data", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(remarksCoT);

      const resolverResult = producer.getAllCoT()?.map((cot) => {
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
            callsign: cot.event.detail?.contact?._attributes.callsign ?? "",
            chat: undefined,
            fileshare: undefined,
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

      expect(resolverResult).toBeDefined();
      expect(resolverResult!.length).toBe(1);

      const cot = resolverResult![0];

      // Validate remarks structure matches TypeDef
      expect(cot?.detail?.remarks).toBeDefined();
      expect(typeof cot?.detail?.remarks?.source).toBe("string");
      expect(typeof cot?.detail?.remarks?.to).toBe("string");
      expect(typeof cot?.detail?.remarks?.time).toBe("string");
      expect(typeof cot?.detail?.remarks?.text).toBe("string");

      await producer.closeDB();
    });

    it("should handle empty database gracefully", () => {
      const producer = new Producer(mockConfig);

      const resolverResult = producer.getAllCoT()?.map((cot) => {
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
            callsign: cot.event.detail?.contact?._attributes.callsign ?? "",
            chat: undefined,
            fileshare: undefined,
            remarks: undefined,
          },
        };
      });

      expect(resolverResult).toEqual([]);
    });

    it("should handle multiple CoTs with different structures", async () => {
      const producer = new Producer(mockConfig);
      await producer.putCoT(basicCoT);
      await producer.putCoT(chatCoT);
      await producer.putCoT(fileshareCoT);

      const resolverResult = producer.getAllCoT()?.map((cot) => {
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
            callsign: cot.event.detail?.contact?._attributes.callsign ?? "",
            chat: cot.event.detail?.__chat
              ? {
                  parent: cot.event.detail?.__chat._attributes.parent,
                  groupOwner: cot.event.detail?.__chat._attributes.groupOwner,
                  messageId: cot.event.detail?.__chat._attributes.messageId,
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
                  filename: cot.event.detail?.fileshare?._attributes.filename,
                  senderUid: cot.event.detail?.fileshare?._attributes.senderUid,
                  senderCallsign:
                    cot.event.detail?.fileshare?._attributes.senderCallsign,
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

      expect(resolverResult).toBeDefined();
      expect(resolverResult!.length).toBe(3);

      // Validate each CoT has proper structure
      resolverResult!.forEach((cot) => {
        expect(typeof cot.version).toBe("string");
        expect(typeof cot.uid).toBe("string");
        expect(typeof cot.type).toBe("string");
        expect(typeof cot.how).toBe("string");
        expect(typeof cot.point.lat).toBe("string");
        expect(typeof cot.point.lon).toBe("string");
        expect(typeof cot.point.hae).toBe("string");
        expect(typeof cot.detail.callsign).toBe("string");
      });

      await producer.closeDB();
    });
  });
});
