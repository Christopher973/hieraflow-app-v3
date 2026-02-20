import { z } from "zod";

export const departmentIdSchema = z.coerce
  .number()
  .int("Identifiant invalide")
  .positive("Identifiant invalide");

export const listDepartmentsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, "La recherche ne doit pas dépasser 120 caractères.")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(10),
});

const departmentNameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères.")
  .max(120, "Le nom ne doit pas dépasser 120 caractères.");

export const createDepartmentInputSchema = z.object({
  name: departmentNameSchema,
});

export const updateDepartmentInputSchema = z
  .object({
    name: departmentNameSchema.optional(),
  })
  .refine((data) => data.name !== undefined, {
    message: "Au moins un champ doit être fourni pour la mise à jour.",
    path: ["name"],
  });

export type DepartmentIdInput = z.infer<typeof departmentIdSchema>;
export type ListDepartmentsQueryInput = z.infer<
  typeof listDepartmentsQuerySchema
>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentInputSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentInputSchema>;
