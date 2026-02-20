import { z } from "zod";

const tempIdSchema = z.string().trim().min(1);

export const importLocationSchema = z.object({
  _tempId: tempIdSchema,
  name: z.string().trim().min(1).max(120),
});

export const importDepartmentSchema = z.object({
  _tempId: tempIdSchema,
  name: z.string().trim().min(1).max(120),
});

export const importSectorSchema = z.object({
  _tempId: tempIdSchema,
  name: z.string().trim().min(1).max(120),
  departmentRef: tempIdSchema,
});

export const importPositionSchema = z.object({
  _tempId: tempIdSchema,
  name: z.string().trim().min(1).max(100),
  isPrimary: z.boolean().default(false),
  type: z.enum(["COLLABORATEUR", "ASSISTANT"]),
  sectorRef: tempIdSchema,
  parentPositionRef: tempIdSchema.nullable(),
  jobDetails: z.array(z.string().trim().min(1)).nullable(),
});

const nullableDateSchema = z.coerce.date().nullable();

export const importMemberSchema = z.object({
  _tempId: tempIdSchema,
  serviceCode: z.string().trim().min(1).max(50),
  firstname: z.string().trim().min(1).max(100),
  lastname: z.string().trim().min(1).max(100),
  birthday: nullableDateSchema,
  gender: z.enum(["HOMME", "FEMME", "AUTRE"]),
  avatarUrl: z.string().trim().url().nullable(),
  professionalEmail: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).nullable(),
  startDate: z.coerce.date(),
  endDate: nullableDateSchema,
  isReferentRH: z.boolean().default(false),
  locationRef: tempIdSchema,
  positionRefs: z.array(tempIdSchema),
});

export const importPayloadSchema = z.object({
  locations: z.array(importLocationSchema),
  departments: z.array(importDepartmentSchema),
  sectors: z.array(importSectorSchema),
  positions: z.array(importPositionSchema),
  members: z.array(importMemberSchema),
});

export const persistImportRequestSchema = z.object({
  payload: importPayloadSchema,
});

export type PersistImportRequestInput = z.infer<
  typeof persistImportRequestSchema
>;
export type ImportPayloadInput = z.infer<typeof importPayloadSchema>;
