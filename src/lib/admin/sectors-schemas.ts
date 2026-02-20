import { z } from "zod";

export const sectorIdSchema = z.coerce
  .number()
  .int("Identifiant invalide")
  .positive("Identifiant invalide");

export const departmentIdSchema = z.coerce
  .number()
  .int("Département invalide")
  .positive("Département invalide");

export const listSectorsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, "La recherche ne doit pas dépasser 120 caractères.")
    .optional(),
  departmentId: departmentIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(10),
});

const sectorNameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères.")
  .max(120, "Le nom ne doit pas dépasser 120 caractères.");

export const createSectorInputSchema = z.object({
  name: sectorNameSchema,
  departmentId: departmentIdSchema,
});

export const updateSectorInputSchema = z
  .object({
    name: sectorNameSchema.optional(),
    departmentId: departmentIdSchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.departmentId !== undefined,
    {
      message: "Au moins un champ doit être fourni pour la mise à jour.",
      path: ["name"],
    },
  );

export type SectorIdInput = z.infer<typeof sectorIdSchema>;
export type DepartmentIdInput = z.infer<typeof departmentIdSchema>;
export type ListSectorsQueryInput = z.infer<typeof listSectorsQuerySchema>;
export type CreateSectorInput = z.infer<typeof createSectorInputSchema>;
export type UpdateSectorInput = z.infer<typeof updateSectorInputSchema>;
