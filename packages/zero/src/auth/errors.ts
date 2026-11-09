import { ApplicationError } from "@rocicorp/zero";

/**
 * Codes for errors that mutators send to the client. The web app can show a
 * translated message for each code later (decision record 0007).
 */
export type MutationErrorCode = "not_found" | "forbidden" | "invalid" | "internal";

export type MutationErrorDetails = { readonly code: MutationErrorCode };

/** An error that is safe to show to the user. Zero sends it as an `app` error. */
export function mutationError(code: MutationErrorCode, message: string) {
  return new ApplicationError<MutationErrorDetails>(message, { details: { code } });
}

/**
 * Turns anything a mutator throws into an error that is safe to send to the
 * client. A database error from Drizzle includes the SQL and its parameters
 * (decision record 0004), so only errors made by `mutationError` and argument
 * validation errors keep their message.
 */
export function toSafeMutationError(error: unknown): ApplicationError<MutationErrorDetails> {
  if (isMutationError(error)) {
    return error;
  }
  // Zero throws this when a mutator's Zod schema rejects the arguments. Its
  // message lists only the schema's issue messages, so it is safe to show.
  if (error instanceof Error && error.name === "InputValidationError") {
    return mutationError("invalid", error.message);
  }
  return mutationError("internal", "The change could not be saved. Try again later.");
}

function isMutationError(error: unknown): error is ApplicationError<MutationErrorDetails> {
  if (!(error instanceof ApplicationError)) {
    return false;
  }
  const details: unknown = error.details;
  return typeof details === "object" && details !== null && "code" in details;
}
