import type { ApiError, ApiResponse } from "@/src/types/api";

type QueryValue = string | number | boolean | undefined | null;

type QueryParams = Record<string, QueryValue>;

type ApiClientError = {
  message: string;
  errors: ApiError[];
  status: number;
};

type ApiClientResult<T> = {
  response: ApiResponse<T>;
  error: ApiClientError | null;
  status: number;
};

const EMPTY_RESPONSE: ApiResponse<null> = {
  data: null,
  errors: null,
  message: null,
  meta: null,
};

const buildQueryString = (params?: QueryParams) => {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const normalizeErrors = (
  errors: ApiError[] | null,
  status: number,
  fallbackMessage?: string | null,
): ApiClientError | null => {
  if (!errors || errors.length === 0) {
    if (status >= 400) {
      return {
        message: fallbackMessage || "La requête a échoué.",
        errors: [
          {
            code: "INTERNAL_ERROR",
            detail: fallbackMessage || "Réponse API invalide.",
          },
        ],
        status,
      };
    }

    return null;
  }

  const message =
    errors
      .map((error) => error.detail || error.code)
      .filter(Boolean)
      .join("\n") ||
    fallbackMessage ||
    "La requête a échoué.";

  return { message, errors, status };
};

const parseApiResponse = async <T>(
  response: Response,
): Promise<ApiClientResult<T>> => {
  const status = response.status;

  let payload: ApiResponse<T> = EMPTY_RESPONSE as ApiResponse<T>;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    const fallbackMessage =
      status >= 500 ? "Erreur serveur inattendue." : "Réponse API non lisible.";

    return {
      response: EMPTY_RESPONSE as ApiResponse<T>,
      error: normalizeErrors(null, status, fallbackMessage),
      status,
    };
  }

  const fallbackMessage = payload.message;

  const error =
    !response.ok || payload.errors
      ? normalizeErrors(payload.errors, status, fallbackMessage)
      : null;

  return {
    response: payload,
    error,
    status,
  };
};

export const apiGet = async <T>(
  path: string,
  params?: QueryParams,
): Promise<ApiClientResult<T>> => {
  const query = buildQueryString(params);
  const response = await fetch(`/api${path}${query}`, {
    method: "GET",
    credentials: "include",
  });

  return parseApiResponse<T>(response);
};

export const apiRequest = async <T>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<ApiClientResult<T>> => {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return parseApiResponse<T>(response);
};
