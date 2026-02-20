export type ApiErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST";

export type ApiError = {
  code: ApiErrorCode | (string & {});
  detail?: string;
  source?: string;
  example?: unknown;
};

export type ApiMeta = Record<string, unknown>;

export type ApiResponse<T> = {
  data: T | null;
  errors: ApiError[] | null;
  message: string | null;
  meta: ApiMeta | null;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
