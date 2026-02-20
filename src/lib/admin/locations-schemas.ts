import { z } from "zod";

export const locationIdSchema = z.coerce
  .number()
  .int("Identifiant invalide")
  .positive("Identifiant invalide");

export const listLocationsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, "La recherche ne doit pas dépasser 120 caractères.")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(10),
});

const locationNameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères.")
  .max(120, "Le nom ne doit pas dépasser 120 caractères.");

export const createLocationInputSchema = z.object({
  name: locationNameSchema,
});

export const updateLocationInputSchema = z
  .object({
    name: locationNameSchema.optional(),
  })
  .refine((data) => data.name !== undefined, {
    message: "Au moins un champ doit être fourni pour la mise à jour.",
    path: ["name"],
  });

export type LocationIdInput = z.infer<typeof locationIdSchema>;
export type ListLocationsQueryInput = z.infer<typeof listLocationsQuerySchema>;
export type CreateLocationInput = z.infer<typeof createLocationInputSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationInputSchema>;
