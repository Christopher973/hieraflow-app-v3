export type ImportPersistStats = {
  created: number;
  updated: number;
};

export type ImportPersistResult = {
  locations: ImportPersistStats;
  departments: ImportPersistStats;
  sectors: ImportPersistStats;
  positions: ImportPersistStats;
  members: ImportPersistStats;
};

export type ImportPersistPayload = {
  result: ImportPersistResult;
};

export type ImportJobStatus = "queued" | "running" | "completed" | "failed";

export type ImportPersistPhase =
  | "queued"
  | "locations"
  | "departments"
  | "sectors"
  | "positions"
  | "positions_hierarchy"
  | "members"
  | "assignments"
  | "finalizing"
  | "completed"
  | "failed";

export type ImportJobProgress = {
  phase: ImportPersistPhase;
  progress: number;
  message: string | null;
};

export type ImportJobDto = {
  id: string;
  status: ImportJobStatus;
  progress: ImportJobProgress;
  result: ImportPersistResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportStartPayload = {
  jobId: string;
};

export type ImportJobPayload = {
  job: ImportJobDto;
};
