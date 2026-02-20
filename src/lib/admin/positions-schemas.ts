import { z } from "zod";

/**
 * Types de poste disponibles dans la hiérarchie organisationnelle.
 */
export const positionTypeSchema = z.enum([
  "DIRECTEUR",
  "SOUS_DIRECTEUR",
  "CHEF_SERVICE",
  "RESPONSABLE",
  "COLLABORATEUR",
  "ASSISTANT",
]);

/**
 * Schéma de validation pour un ID de poste.
 */
export const positionIdSchema = z.coerce.number().int().positive();

/**
 * Schéma de validation pour un ID de secteur.
 */
export const sectorIdSchema = z.coerce.number().int().positive();

/**
 * Schéma de validation pour un ID de département.
 */
export const departmentIdSchema = z.coerce.number().int().positive();

/**
 * Schéma de validation pour les paramètres de requête de liste des postes.
 */
export const listPositionsQuerySchema = z.object({
  /** Recherche textuelle sur le nom du poste */
  q: z.string().trim().optional(),

  /** Filtrer par secteur */
  sectorId: sectorIdSchema.optional(),

  /** Filtrer par département (via secteur) */
  departmentId: departmentIdSchema.optional(),

  /** Filtrer par type de poste */
  type: positionTypeSchema.optional(),

  /** Filtrer uniquement les postes vacants (sans membre) */
  vacantOnly: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),

  /** Numéro de page (1-based) */
  page: z.coerce.number().int().positive().default(1),

  /** Nombre d'éléments par page */
  pageSize: z.coerce.number().int().positive().max(1000).default(10),
});

/**
 * Schéma de validation pour les détails du poste.
 * Format attendu: liste de libellés (ex: ["Niveau 6", "Département Business"]).
 */
const jobDetailsItemSchema = z
  .string()
  .trim()
  .min(1, "Chaque détail de poste doit contenir au moins 1 caractère.");

export const jobDetailsSchema = z.array(jobDetailsItemSchema).nullable();

/**
 * Schéma de validation pour la création d'un poste.
 */
export const createPositionInputSchema = z
  .object({
    /** Nom du poste (unique par secteur) */
    name: z.string().trim().min(1).max(100),

    /** Type de poste dans la hiérarchie */
    type: positionTypeSchema.default("COLLABORATEUR"),

    /** Indique si c'est un poste primaire/stratégique */
    isPrimary: z.boolean().default(false),

    /** Détails du poste au format JSON */
    jobDetails: jobDetailsSchema.optional().default(null),

    /** ID du secteur auquel appartient le poste (hors directeur) */
    sectorId: z.union([sectorIdSchema, z.null()]).optional(),

    /** ID du département auquel appartient le poste directeur */
    departmentId: departmentIdSchema.optional(),

    /** ID du poste parent dans la hiérarchie (optionnel) */
    parentPositionId: positionIdSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "DIRECTEUR") {
      if (!value.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["departmentId"],
          message: "Le département est obligatoire pour un directeur.",
        });
      }
      return;
    }

    if (!value.sectorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectorId"],
        message: "Le secteur est obligatoire pour ce type de poste.",
      });
    }
  });

/**
 * Schéma de validation pour la mise à jour d'un poste.
 * Tous les champs sont optionnels sauf l'ID qui vient des paramètres de route.
 */
export const updatePositionInputSchema = z.object({
  /** Nouveau nom du poste */
  name: z.string().trim().min(1).max(100).optional(),

  /** Nouveau type de poste */
  type: positionTypeSchema.optional(),

  /** Nouveau statut primaire */
  isPrimary: z.boolean().optional(),

  /** Nouveaux détails du poste */
  jobDetails: jobDetailsSchema.optional(),

  /** Nouveau secteur */
  sectorId: z.union([sectorIdSchema, z.null()]).optional(),

  /** Nouveau département (pour directeur) */
  departmentId: departmentIdSchema.optional(),

  /** Nouveau poste parent (null pour retirer le parent) */
  parentPositionId: positionIdSchema.nullable().optional(),
});
