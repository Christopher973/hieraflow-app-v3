import "server-only";

import type {
  ImportJobDto,
  ImportPersistPhase,
  ImportPersistResult,
} from "@/src/types/import";

const IMPORT_JOB_TTL_MS = 30 * 60 * 1000;

type ImportJobInternal = {
  id: string;
  status: ImportJobDto["status"];
  progress: ImportJobDto["progress"];
  result: ImportPersistResult | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const globalForImportJobs = globalThis as typeof globalThis & {
  __importJobsStore?: Map<string, ImportJobInternal>;
};

const store =
  globalForImportJobs.__importJobsStore ?? new Map<string, ImportJobInternal>();
globalForImportJobs.__importJobsStore = store;

const now = () => new Date();

const sanitizeProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const pruneExpiredJobs = () => {
  const expirationDate = Date.now() - IMPORT_JOB_TTL_MS;

  for (const [jobId, job] of store.entries()) {
    if (job.updatedAt.getTime() < expirationDate) {
      store.delete(jobId);
    }
  }
};

const toJobDto = (job: ImportJobInternal): ImportJobDto => ({
  id: job.id,
  status: job.status,
  progress: job.progress,
  result: job.result,
  error: job.error,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

export const createImportJob = () => {
  pruneExpiredJobs();

  const id = crypto.randomUUID();
  const createdAt = now();

  const job: ImportJobInternal = {
    id,
    status: "queued",
    progress: {
      phase: "queued",
      progress: 0,
      message: "Import planifié.",
    },
    result: null,
    error: null,
    createdAt,
    updatedAt: createdAt,
  };

  store.set(id, job);
  return id;
};

export const getImportJob = (id: string): ImportJobDto | null => {
  pruneExpiredJobs();

  const job = store.get(id);
  if (!job) return null;
  return toJobDto(job);
};

export const markImportJobRunning = (id: string) => {
  const job = store.get(id);
  if (!job) return;

  job.status = "running";
  job.updatedAt = now();
};

export const updateImportJobProgress = (
  id: string,
  input: {
    phase: ImportPersistPhase;
    progress: number;
    message?: string | null;
  },
) => {
  const job = store.get(id);
  if (!job) return;

  job.status = "running";
  job.progress = {
    phase: input.phase,
    progress: sanitizeProgress(input.progress),
    message: input.message ?? null,
  };
  job.updatedAt = now();
};

export const completeImportJob = (id: string, result: ImportPersistResult) => {
  const job = store.get(id);
  if (!job) return;

  job.status = "completed";
  job.result = result;
  job.error = null;
  job.progress = {
    phase: "completed",
    progress: 100,
    message: "Import terminé.",
  };
  job.updatedAt = now();
};

export const failImportJob = (id: string, error: string) => {
  const job = store.get(id);
  if (!job) return;

  job.status = "failed";
  job.error = error;
  job.progress = {
    phase: "failed",
    progress: Math.max(job.progress.progress, 1),
    message: error,
  };
  job.updatedAt = now();
};
