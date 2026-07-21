import { z } from "zod";
import { ApiError } from "../errors.js";

/**
 * Parses an untrusted input against a contract schema, or throws the 03 §4
 * VALIDATION_FAILED envelope. The handlers accept `unknown` and validate here
 * rather than trusting Nest's body binding, because the contract's Zod schema —
 * shared with the client and the OpenAPI doc — is the single definition of what
 * a valid request looks like.
 */
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError("VALIDATION_FAILED", "Request is invalid", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  // `result.data` is the schema's output type; the generic erases it to `any`
  // inside this function, but every call site recovers the precise type from S.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return result.data;
}
