import { z } from "zod";
import { JWTPayload, jwtVerify } from "jose";
import { createRemoteJWKSet } from "jose";
import { errors as joseErrors } from "jose";

export type JWTValidationErrorType =
  | "JWKS_PROVIDER_URL_REQUIRED"
  | "CATALYST_TOKEN_REQUIRED"
  | "JWT_VALIDATION_FAILED"
  | "JWKS_ERROR_FETCHING"
  | "JWT_ISSUER_INVALID"
  | "JWT_CLAIMS_MISSING"
  | "JWT_CLAIMS_DO_NOT_ALIGN"
  | "UNEXPECTED_JWT_VALIDATION_ERROR";

export const JWTValidationErrorTypeEnum: z.ZodType<JWTValidationErrorType> =
  z.enum([
    "JWKS_PROVIDER_URL_REQUIRED",
    "CATALYST_TOKEN_REQUIRED",
    "JWT_VALIDATION_FAILED",
    "JWKS_ERROR_FETCHING",
    "JWT_ISSUER_INVALID",
    "JWT_CLAIMS_MISSING",
    "JWT_CLAIMS_DO_NOT_ALIGN",
    "UNEXPECTED_JWT_VALIDATION_ERROR",
  ]);

export const JWTValidationError = z.object({
  verified: z.literal(false),
  errorCode: JWTValidationErrorTypeEnum,
  message: z.string(),
  jwtError: z
    .object({
      code: z.string(),
      name: z.string(),
      message: z.string(),
    })
    .optional(),
});

export const JWTValidationSuccess = z.object({
  verified: z.literal(true),
  payload: z.custom<JWTPayload>(),
});

export const JWTValidationResultScheme = z.discriminatedUnion("verified", [
  JWTValidationSuccess,
  JWTValidationError,
]);
export type JWTValidationResult = z.infer<typeof JWTValidationResultScheme>;

/**
 * Verifies a JWT token with a JWKS provider
 *
 * Considerations:
 * - Requires a valid JWKS provider URL to fetch the public keys
 * - Token must have the correct issuer claim that matches the expected issuer
 * - Token must contain the specified dataChannelId in its claims
 * - JWKS fetching errors are handled and reported in the return object
 * - Returns detailed error information to help diagnose validation failures
 *
 * @param jwtToken - The JWT token to verify
 * @param issuer - The issuer of the JWT token
 * @param dataChannelId - The data channel ID to verify
 * @param jwksProviderUrl - The URL of the JWKS provider
 * @returns { error: JWTValidationError | null; verified: boolean; payload: JWTPayload | null }
 */
export async function verifyJwtWithRemoteJwks(
  jwtToken: string,
  issuer: string,
  dataChannelId: string,
  jwksProviderUrl: string,
): Promise<JWTValidationResult> {
  if (!jwksProviderUrl) {
    return {
      errorCode: "JWKS_PROVIDER_URL_REQUIRED",
      message: "JWKS Provider URL is required",
      verified: false,
    };
  }

  if (!jwtToken) {
    return {
      errorCode: "CATALYST_TOKEN_REQUIRED",
      message: "Token is required",
      verified: false,
    };
  }

  let jwtUrl: URL;
  try {
    jwtUrl = new URL(jwksProviderUrl);
  } catch (e: Error | unknown) {
    console.error(
      "error parsing jwks provider url:",
      e instanceof Error ? e.message : "unknown error",
    );
    return {
      verified: false,
      errorCode: "JWKS_ERROR_FETCHING",
      message: "JWKS Provider URL is invalid",
    };
  }

  const JWKS = createRemoteJWKSet(jwtUrl);

  if (!JWKS) {
    return {
      errorCode: "JWKS_ERROR_FETCHING",
      message: "Error fetching JWKS",
      verified: false,
    };
  }

  let payload: JWTPayload | null = null;
  try {
    const verificationResult = await jwtVerify(jwtToken, JWKS);
    payload = verificationResult.payload;
  } catch (e) {
    if (e instanceof joseErrors.JOSEError) {
      console.error("error verifying token with JWKS", e);
      return {
        errorCode: "JWT_VALIDATION_FAILED",
        message: e.message,
        jwtError: {
          code: e.code,
          name: e.name,
          message: e.message,
        },
        verified: false,
      };
    } else {
      return {
        errorCode: "UNEXPECTED_JWT_VALIDATION_ERROR",
        message: `Unexpected Error Verifying JWT: ${e}`,
        verified: false,
      };
    }
  }

  /// check that the issuer is good
  if (payload.iss !== issuer) {
    console.log("jwt issuer is not expected");
    return {
      errorCode: "JWT_ISSUER_INVALID",
      message: "JWT Issuer Invalid",
      verified: false,
    };
  }
  // check that claims exist, non-exists is falsey, empty array can be true
  if (!payload.claims) {
    console.log("jwt claims non-existent");
    return {
      errorCode: "JWT_CLAIMS_MISSING",
      message: "JWT Data Channel Claims Missing",
      verified: false,
    };
  }

  // check that our claims are in the claims
  const dataChannelClaims: string[] = payload.claims as string[];
  if (!dataChannelClaims.includes(dataChannelId)) {
    return {
      errorCode: "JWT_CLAIMS_DO_NOT_ALIGN",
      message: `JWT Data Channel Claims Does not contain current ChannelId`,
      verified: false,
    };
  }

  return {
    verified: true,
    payload,
  };
}
