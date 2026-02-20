import { NextRequest } from "next/server";

import { requireAdmin } from "@/src/lib/auth-guards";
import { forbidden, notFound, ok, unauthorized } from "@/src/lib/api-response";
import { getImportJob } from "@/src/lib/import/import-jobs-store";
import type { ImportJobPayload } from "@/src/types/import";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: NextRequest, context: RouteParams) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return adminCheck.code === "UNAUTHORIZED"
      ? unauthorized(adminCheck.message)
      : forbidden(adminCheck.message);
  }

  const { jobId } = await context.params;
  const job = getImportJob(jobId);

  if (!job) {
    return notFound("Job d'import introuvable ou expiré.");
  }

  return ok<ImportJobPayload>({ job }, "Progression import récupérée.");
}
