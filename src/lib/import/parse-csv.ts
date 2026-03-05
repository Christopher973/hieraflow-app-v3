import Papa from "papaparse";
import {
  CSV_EXPECTED_HEADERS,
  csvRowSchema,
  normalizeRawRow,
  validateAndTransformRow,
} from "./csv-row.schema";
import { normalizeImportData } from "./normalize";
import type { CsvValidatedRow, ImportError, ImportResult } from "./types";

// ─── Formatage des erreurs Zod ───────────────────────────────────────────────

function formatZodErrors(
  zodError: { issues: { path: PropertyKey[]; message: string }[] },
  lineNumber: number,
): ImportError[] {
  return zodError.issues.map((issue) => ({
    line: lineNumber,
    field: issue.path.map(String).join(".") || undefined,
    message: issue.message,
  }));
}

// ─── Orchestrateur principal ─────────────────────────────────────────────────

/**
 * Parse un fichier CSV, valide chaque ligne avec Zod, transforme les données,
 * normalise les entités (dédoublonnage), résout la hiérarchie, et retourne
 * un `ImportResult` contenant le payload prêt pour Prisma, les erreurs,
 * et un résumé.
 *
 * Flux :
 * 1. Papaparse → lignes brutes (Record<string, unknown>[])
 * 2. normalizeRawRow → toutes les valeurs sont des strings
 * 3. csvRowSchema.safeParse → validation de la structure Zod
 * 4. validateAndTransformRow → validation métier + transformation des types
 * 5. normalizeImportData → dédoublonnage + hiérarchie
 * 6. Construction du résumé
 */
export function parseAndValidateCsv(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete(results) {
        try {
          const allErrors: ImportError[] = [];
          const validatedRows: { row: CsvValidatedRow; lineNumber: number }[] =
            [];

          const headers = (results.meta.fields ?? []).map((field) =>
            (field ?? "").trim(),
          );
          const missingHeaders = CSV_EXPECTED_HEADERS.filter(
            (expected) => !headers.includes(expected),
          );

          if (missingHeaders.length > 0) {
            allErrors.push({
              line: 1,
              field: "header",
              message: `Colonnes manquantes: ${missingHeaders.join(", ")}`,
            });
          }

          // ── Étape 1-4 : Validation ligne par ligne ─────────────────

          for (let i = 0; i < results.data.length; i++) {
            const lineNumber = i + 2; // +2 car ligne 1 = header, index 0 = ligne 2
            const rawRow = results.data[i];

            // Normalisation des valeurs brutes
            const normalized = normalizeRawRow(rawRow);

            // Validation de la structure (Zod)
            const schemaResult = csvRowSchema.safeParse(normalized);
            if (!schemaResult.success) {
              allErrors.push(
                ...formatZodErrors(schemaResult.error, lineNumber),
              );
              continue;
            }

            // Validation métier + transformation
            const transformResult = validateAndTransformRow(
              schemaResult.data,
              lineNumber,
            );
            if (!transformResult.success) {
              allErrors.push(...transformResult.errors);
              continue;
            }

            validatedRows.push({ row: transformResult.data, lineNumber });
          }

          // ── Étape 5 : Normalisation + dédoublonnage ────────────────

          const {
            payload,
            errors: normalizeErrors,
            duplicatesOverwritten,
          } = normalizeImportData(validatedRows);

          allErrors.push(...normalizeErrors);

          // ── Étape 6 : Construction du résumé ───────────────────────

          const summary = {
            totalRows: results.data.length,
            validRows: payload.members.length,
            errorCount: allErrors.length,
            duplicatesOverwritten,
            entities: {
              locations: payload.locations.length,
              departments: payload.departments.length,
              sectors: payload.sectors.length,
              positions: payload.positions.length,
              members: payload.members.length,
            },
          };

          resolve({ payload, errors: allErrors, summary });
        } catch (error) {
          reject(error);
        }
      },
      error(error) {
        reject(new Error(`Erreur de parsing CSV : ${error.message}`));
      },
    });
  });
}
