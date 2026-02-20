import { NextRequest } from "next/server";

import { requireAdmin } from "@/src/lib/auth-guards";
import {
  forbidden,
  invalidJson,
  ok,
  unauthorized,
  validationError,
} from "@/src/lib/api-response";
import {
  persistImportRequestSchema,
  type PersistImportRequestInput,
} from "@/src/lib/import/persist-schemas";
import {
  persistImportPayload,
  validateImportPayloadRefs,
} from "@/src/lib/import/persist-import";
import {
  completeImportJob,
  createImportJob,
  failImportJob,
  markImportJobRunning,
  updateImportJobProgress,
} from "@/src/lib/import/import-jobs-store";
import type { ImportStartPayload } from "@/src/types/import";

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return adminCheck.code === "UNAUTHORIZED"
      ? unauthorized(adminCheck.message)
      : forbidden(adminCheck.message);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const parse = persistImportRequestSchema.safeParse(payload);

  if (!parse.success) {
    return validationError(parse.error.issues);
  }

  const validatedPayload: PersistImportRequestInput = parse.data;
  const refIssues = validateImportPayloadRefs(validatedPayload.payload);

  if (refIssues.length > 0) {
    return validationError(refIssues);
  }

  const jobId = createImportJob();

  void (async () => {
    try {
      markImportJobRunning(jobId);

      const result = await persistImportPayload(validatedPayload.payload, {
        onProgress: (progress) => {
          updateImportJobProgress(jobId, progress);
        },
      });

      completeImportJob(jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("expired transaction")) {
        failImportJob(
          jobId,
          "Le traitement de l'import a dépassé le délai transactionnel. Veuillez réessayer.",
        );
        return;
      }

      failImportJob(jobId, "Impossible de persister l'import CSV.");
    }
  })();

  return ok<ImportStartPayload>({ jobId }, "Import CSV démarré.");
}
