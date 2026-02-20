import type { ZodIssue } from "zod";

import type {
  ApiError,
  ApiErrorCode,
  ApiMeta,
  ApiResponse,
} from "@/src/types/api";

export type ResponseBuilderArgs<T> = {
  data?: T | null;
  errors?: ApiError[] | null;
  message?: string | null;
  meta?: ApiMeta | null;
  status?: number;
  headers?: HeadersInit;
};

const createError = (
  code: ApiErrorCode | (string & {}),
  detail?: string,
  source?: string,
): ApiError => ({
  code,
  detail,
  source,
});

export const formatZodIssues = (
  issues: ReadonlyArray<Pick<ZodIssue, "path" | "message">>,
) =>
  issues
    .map((issue) => {
      const path =
        issue.path.map((item) => String(item)).join(".") || "corps de requête";
      return `${path} : ${issue.message}`;
    })
    .join("\n");

export const toValidationErrors = (
  issues: ReadonlyArray<Pick<ZodIssue, "path" | "message">>,
): ApiError[] =>
  issues.map((issue) => ({
    code: "VALIDATION_ERROR",
    source:
      issue.path.map((item) => String(item)).join(".") || "corps de requête",
    detail: issue.message,
  }));

export function buildResponse<T>({
  data = null,
  errors = null,
  message = null,
  meta = null,
  status = 200,
  headers,
}: ResponseBuilderArgs<T>) {
  const body: ApiResponse<T> = {
    data,
    errors,
    message,
    meta,
  };

  return Response.json(body, { status, headers });
}

export function buildApiPayload<T>({
  data = null,
  errors = null,
  message = null,
  meta = null,
}: Omit<ResponseBuilderArgs<T>, "status" | "headers"> = {}) {
  const body: ApiResponse<T> = {
    data,
    errors,
    message,
    meta,
  };

  return body;
}

export function ok<T>(data: T, message?: string, meta?: ApiMeta | null) {
  return buildResponse<T>({
    data,
    message: message ?? null,
    meta: meta ?? null,
    status: 200,
  });
}

export function created<T>(data: T, message?: string, meta?: ApiMeta | null) {
  return buildResponse<T>({
    data,
    message: message ?? "Ressource créée",
    meta: meta ?? null,
    status: 201,
  });
}

export function noContent(message?: string) {
  return buildResponse<null>({
    data: null,
    errors: null,
    message: message ?? null,
    meta: null,
    status: 200,
  });
}

export function badRequest(detail: string, source?: string) {
  return buildResponse({
    errors: [createError("BAD_REQUEST", detail, source)],
    message: "Requête invalide",
    status: 400,
  });
}

export function invalidJson() {
  return buildResponse({
    errors: [
      {
        ...createError(
          "INVALID_JSON",
          "Le corps de la requête n'est pas un JSON valide.",
        ),
        example: {
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            name: "Nom de la ressource",
          },
          hint: "Envoyez un JSON brut valide (pas du form-data, ni du texte brut).",
        },
      },
    ],
    message: "Requête invalide",
    status: 400,
  });
}

export function unauthorized(detail = "Authentification requise.") {
  return buildResponse({
    errors: [createError("UNAUTHORIZED", detail)],
    message: "Accès non autorisé",
    status: 401,
  });
}

export function forbidden(detail = "Droits insuffisants.") {
  return buildResponse({
    errors: [createError("FORBIDDEN", detail)],
    message: "Accès interdit",
    status: 403,
  });
}

export function notFound(detail = "Ressource introuvable.") {
  return buildResponse({
    errors: [createError("NOT_FOUND", detail)],
    message: "Ressource introuvable",
    status: 404,
  });
}

export function conflict(detail = "Conflit de données.", source?: string) {
  return buildResponse({
    errors: [createError("CONFLICT", detail, source)],
    message: "Conflit",
    status: 409,
  });
}

export function validationError(
  issues: ReadonlyArray<Pick<ZodIssue, "path" | "message">>,
  message = "Erreur de validation",
) {
  return buildResponse({
    errors: toValidationErrors(issues),
    message,
    status: 422,
  });
}

export function internalError(detail = "Une erreur interne est survenue.") {
  return buildResponse({
    errors: [createError("INTERNAL_ERROR", detail)],
    message: "Erreur interne",
    status: 500,
  });
}
