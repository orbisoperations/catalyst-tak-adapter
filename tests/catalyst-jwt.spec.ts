import { describe, it, expect, mock } from "bun:test";

import { verifyJwtWithRemoteJwks } from "../src/auth/catalyst-jwt";
import { JWTPayload } from "jose";

describe("verifyJwtWithRemoteJwks", () => {
  it("returns error if any missing parameters in verifyJwtWithRemoteJwks", async () => {
    const result1 = await verifyJwtWithRemoteJwks(
      "token",
      "issuer",
      "channel",
      "",
    );
    expect(result1.verified).toBe(false);
    if (!result1.verified) {
      expect(result1.errorCode).toBe("JWKS_PROVIDER_URL_REQUIRED");
    }
    const result2 = await verifyJwtWithRemoteJwks(
      "",
      "issuer",
      "channel",
      "https://jwks.example.com",
    );
    expect(result2.verified).toBe(false);
    if (!result2.verified) {
      expect(result2.errorCode).toBe("CATALYST_TOKEN_REQUIRED");
    }
    const result3 = await verifyJwtWithRemoteJwks(
      "token",
      "issuer",
      "channel",
      "not-a-url",
    );
    expect(result3.verified).toBe(false);
    if (!result3.verified) {
      expect(result3.errorCode).toBe("JWKS_ERROR_FETCHING");
    }
  });

  it("returns error if issuer is invalid", async () => {
    // Mock the JWKS and jwtVerify to return a payload with wrong issuer
    const mockPayload: JWTPayload = {
      iss: "wrong-issuer",
      claims: ["channel"],
    };
    // bun:test mock
    mock.module("jose", () => ({
      jwtVerify: async () => ({ payload: mockPayload }),
    }));
    const result = await verifyJwtWithRemoteJwks(
      "token",
      "issuer",
      "channel",
      "https://jwks.example.com",
    );
    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.errorCode).toBe("JWT_ISSUER_INVALID");
    }
  });

  it("returns error if claims are missing", async () => {
    const mockPayload: JWTPayload = { iss: "issuer" };
    // bun:test mock
    mock.module("jose", () => ({
      jwtVerify: async () => ({ payload: mockPayload }),
    }));
    const result = await verifyJwtWithRemoteJwks(
      "token",
      "issuer",
      "channel",
      "https://jwks.example.com",
    );
    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.errorCode).toBe("JWT_CLAIMS_MISSING");
    }
  });

  it("returns error if claims do not align", async () => {
    const mockPayload: JWTPayload = {
      iss: "issuer",
      claims: ["other-channel"],
    };
    // bun:test mock
    mock.module("jose", () => ({
      jwtVerify: async () => ({ payload: mockPayload }),
    }));
    const result = await verifyJwtWithRemoteJwks(
      "token",
      "issuer",
      "channel",
      "https://jwks.example.com",
    );
    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.errorCode).toBe("JWT_CLAIMS_DO_NOT_ALIGN");
    }
  });

  it("returns success if all checks pass", async () => {
    const mockPayload: JWTPayload = { iss: "issuer", claims: ["channel"] };
    // bun:test mock
    mock.module("jose", () => ({
      jwtVerify: async () => ({ payload: mockPayload }),
    }));
    const result = await verifyJwtWithRemoteJwks(
      "token",
      "issuer",
      "channel",
      "https://jwks.example.com",
    );
    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.payload).toEqual(mockPayload);
    }
  });
});
