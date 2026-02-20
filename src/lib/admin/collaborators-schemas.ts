import { z } from "zod";

// ─── Identifiants ───────────────────────────────────────────────────────────────

export const collaboratorIdSchema = z.coerce
  .number()
  .int("Identifiant invalide")
  .positive("Identifiant invalide");

// ─── Enums ──────────────────────────────────────────────────────────────────────

export const genderSchema = z.enum(["HOMME", "FEMME", "AUTRE"]);

export const memberStatusSchema = z.enum(["ACTIF", "INACTIF", "SUSPENDU"]);

// ─── Requête de liste ───────────────────────────────────────────────────────────

export const listCollaboratorsQuerySchema = z.object({
  /** Recherche textuelle (nom, prénom, email, matricule) */
  q: z
    .string()
    .trim()
    .max(120, "La recherche ne doit pas dépasser 120 caractères.")
    .optional(),

  /** Filtrer par statut */
  status: memberStatusSchema.optional(),

  /** Filtrer par genre */
  gender: genderSchema.optional(),

  /** Filtrer par localisation */
  locationId: z.coerce.number().int().positive().optional(),

  /** Filtrer par département */
  departmentId: z.coerce.number().int().positive().optional(),

  /** Filtrer par secteur */
  sectorId: z.coerce.number().int().positive().optional(),

  /** Filtrer par poste */
  positionId: z.coerce.number().int().positive().optional(),

  /** Filtrer les référents RH uniquement */
  isReferentRH: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),

  /** Numéro de page (1-based) */
  page: z.coerce.number().int().min(1).default(1),

  /** Nombre d'éléments par page */
  pageSize: z.coerce.number().int().min(1).max(1000).default(10),
});

// ─── Schémas de champs réutilisables ────────────────────────────────────────────

const serviceCodeSchema = z
  .string()
  .trim()
  .min(1, "Le matricule est obligatoire.")
  .max(50, "Le matricule ne doit pas dépasser 50 caractères.");

const firstnameSchema = z
  .string()
  .trim()
  .min(1, "Le prénom est obligatoire.")
  .max(100, "Le prénom ne doit pas dépasser 100 caractères.");

const lastnameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire.")
  .max(100, "Le nom ne doit pas dépasser 100 caractères.");

const professionalEmailSchema = z
  .string()
  .trim()
  .email("L'adresse email n'est pas valide.")
  .max(255, "L'email ne doit pas dépasser 255 caractères.");

const phoneSchema = z
  .string()
  .trim()
  .max(30, "Le téléphone ne doit pas dépasser 30 caractères.")
  .nullable()
  .optional();

const avatarUrlSchema = z
  .string()
  .trim()
  .url("L'URL de l'avatar n'est pas valide.")
  .nullable()
  .optional();

const avatarKeySchema = z
  .string()
  .trim()
  .min(1, "La clé avatar est invalide.")
  .max(512, "La clé avatar ne doit pas dépasser 512 caractères.")
  .nullable()
  .optional();

const parseDateInput = (value: unknown) => {
  if (value === null || value === undefined || value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return value;
  }

  const frenchDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (frenchDateMatch) {
    const [, dayValue, monthValue, yearValue] = frenchDateMatch;
    const day = Number(dayValue);
    const month = Number(monthValue);
    const year = Number(yearValue);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day
    ) {
      return parsedDate;
    }

    return value;
  }

  const isoDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoDateMatch) {
    const [, yearValue, monthValue, dayValue] = isoDateMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day
    ) {
      return parsedDate;
    }

    return value;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate;
};

const dateSchema = z.preprocess(
  parseDateInput,
  z.date().refine((date) => !Number.isNaN(date.getTime()), {
    message: "Date invalide.",
  }),
);

// ─── Création ───────────────────────────────────────────────────────────────────

export const createCollaboratorInputSchema = z.object({
  serviceCode: serviceCodeSchema,
  firstname: firstnameSchema,
  lastname: lastnameSchema,
  birthday: dateSchema.nullable().optional().default(null),
  gender: genderSchema.default("AUTRE"),
  avatarUrl: avatarUrlSchema.default(null),
  avatarKey: avatarKeySchema.default(null),
  professionalEmail: professionalEmailSchema,
  phone: phoneSchema.default(null),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional().default(null),
  status: memberStatusSchema.default("ACTIF"),
  isReferentRH: z.boolean().default(false),
  locationId: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
  positionId: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
  positionIds: z
    .array(z.coerce.number().int().positive())
    .optional()
    .default([]),
  primaryPositionId: z.coerce.number().int().positive().nullable().optional(),
});

// ─── Mise à jour ────────────────────────────────────────────────────────────────

export const updateCollaboratorInputSchema = z.object({
  serviceCode: serviceCodeSchema.optional(),
  firstname: firstnameSchema.optional(),
  lastname: lastnameSchema.optional(),
  birthday: dateSchema.nullable().optional(),
  gender: genderSchema.optional(),
  avatarUrl: avatarUrlSchema.optional(),
  avatarKey: avatarKeySchema.optional(),
  professionalEmail: professionalEmailSchema.optional(),
  phone: phoneSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.nullable().optional(),
  status: memberStatusSchema.optional(),
  isReferentRH: z.boolean().optional(),
  locationId: z.coerce.number().int().positive().nullable().optional(),
  positionId: z.coerce.number().int().positive().nullable().optional(),
  positionIds: z.array(z.coerce.number().int().positive()).optional(),
  primaryPositionId: z.coerce.number().int().positive().nullable().optional(),
});

// ─── Types inférés ──────────────────────────────────────────────────────────────

export type CollaboratorIdInput = z.infer<typeof collaboratorIdSchema>;
export type ListCollaboratorsQueryInput = z.infer<
  typeof listCollaboratorsQuerySchema
>;
export type CreateCollaboratorInput = z.infer<
  typeof createCollaboratorInputSchema
>;
export type UpdateCollaboratorInput = z.infer<
  typeof updateCollaboratorInputSchema
>;
