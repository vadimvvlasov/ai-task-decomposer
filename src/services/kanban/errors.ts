export type ApiErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CROSS_BOARD_MOVE"
  | "LLM_NOT_CONFIGURED"
  | "LLM_UNAVAILABLE"
  | "LLM_UPSTREAM_ERROR"
  | "LLM_INVALID_OUTPUT";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode | string;

  constructor(status: number, code: ApiErrorCode | string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const notFound = (what: string) =>
  new ApiError(404, "NOT_FOUND", `${what} was not found.`);

export const invalid = (message: string) =>
  new ApiError(422, "VALIDATION_ERROR", message);

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
