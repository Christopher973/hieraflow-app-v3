import { z } from "zod";
import type { CsvValidatedRow, ImportError } from "./types";

// ─── Headers CSV attendus ──────────────────────────────────────────────────────

export const CSV_EXPECTED_HEADERS = [
  "codeAssignation",
  "nom",
  "prenom",
  "dateNaissance",
  "genre",
  "urlImage",
  "emailProfessionnelle",
  "telephone",
  "dateDebut",
  "dateFin",
  "referentRH",
  "localisation",
  "departement",
  "secteur",
  "poste",
  "postePrincipale",
  "detailsPoste",
  "posteResponsable",
  "typePoste",
] as const;

// ─── Helpers de validation ─────────────────────────────────────────────────────

/**
 * Vérifie qu'une chaîne est une date française valide (JJ/MM/AAAA).
 * Retourne true si la date est valide ou si la chaîne est vide.
 */
function isValidFrenchDate(val: string): boolean {
  if (val === "") return true;
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return (
    !isNaN(date.getTime()) && date.getDate() === d && date.getMonth() === m - 1
  );
}

/**
 * Parse une date française "JJ/MM/AAAA" en objet Date.
 * Retourne null si la chaîne est vide.
 */
function parseFrenchDate(val: string): Date | null {
  const trimmed = val.trim();
  if (trimmed === "") return null;
  const [d, m, y] = trimmed.split("/").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Parse le genre : "homme" → "HOMME", "femme" → "FEMME", autre → "AUTRE".
 */
function parseGender(val: string): "HOMME" | "FEMME" | "AUTRE" {
  const lower = val.trim().toLowerCase();
  if (lower === "homme") return "HOMME";
  if (lower === "femme") return "FEMME";
  return "AUTRE";
}

/**
 * "oui" (insensible à la casse) → true, tout le reste → false.
 */
function parseOuiNon(val: string): boolean {
  return val.trim().toLowerCase() === "oui";
}

/**
 * Retourne null si vide, la chaîne trimmée sinon.
 */
function emptyToNull(val: string): string | null {
  const trimmed = val.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse une liste séparée par "|" en tableau de strings.
 */
function parseDetailsList(val: string): string[] {
  const trimmed = val.trim();
  if (trimmed === "") return [];
  return trimmed
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Schéma Zod : validation de la forme d'une ligne CSV ──────────────────────

/**
 * Valide la structure d'une ligne CSV brute.
 * Tous les champs sont des chaînes ; les champs obligatoires doivent être
 * non-vides. Les formats complexes (dates, email) sont vérifiés dans
 * `validateAndTransformRow`.
 */
export const csvRowSchema = z.object({
  codeAssignation: z.string(),
  nom: z.string(),
  prenom: z.string(),
  dateNaissance: z.string(),
  genre: z.string(),
  urlImage: z.string(),
  emailProfessionnelle: z.string(),
  telephone: z.string(),
  dateDebut: z.string(),
  dateFin: z.string(),
  referentRH: z.string(),
  localisation: z.string(),
  departement: z.string(),
  secteur: z.string(),
  poste: z.string(),
  postePrincipale: z.string(),
  detailsPoste: z.string(),
  posteResponsable: z.string(),
  typePoste: z.string(),
});

export type CsvRawRow = z.infer<typeof csvRowSchema>;

// ─── Pré-traitement : normalise les valeurs Papaparse en strings ───────────────

/**
 * Garantit que chaque clé attendue existe et est une string.
 * Protège contre les valeurs `undefined` / `null` / `number` de Papaparse.
 */
export function normalizeRawRow(
  raw: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of CSV_EXPECTED_HEADERS) {
    const value = raw[key];
    result[key] = typeof value === "string" ? value : "";
  }
  return result;
}

// ─── Validation détaillée + Transformation ─────────────────────────────────────

/**
 * Valide les formats et règles métier d'une ligne CSV, puis la transforme
 * en `CsvValidatedRow`. Retourne soit la ligne transformée, soit un tableau
 * d'erreurs détaillées.
 */
export function validateAndTransformRow(
  raw: CsvRawRow,
  lineNumber: number,
):
  | { success: true; data: CsvValidatedRow }
  | { success: false; errors: ImportError[] } {
  const errors: ImportError[] = [];

  // ── Champs obligatoires ────────────────────────────────────────────

  const codeAssignation = raw.codeAssignation.trim();
  if (!codeAssignation) {
    errors.push({
      line: lineNumber,
      field: "codeAssignation",
      message: "Code d'assignation est obligatoire",
    });
  }

  const nom = raw.nom.trim();
  if (!nom) {
    errors.push({
      line: lineNumber,
      field: "nom",
      message: "Nom est obligatoire",
    });
  }

  const prenom = raw["prenom"].trim();
  if (!prenom) {
    errors.push({
      line: lineNumber,
      field: "prenom",
      message: "Prénom est obligatoire",
    });
  }

  const localisation = raw.localisation.trim();
  if (!localisation) {
    errors.push({
      line: lineNumber,
      field: "localisation",
      message: "Localisation est obligatoire",
    });
  }

  // ── Email (obligatoire + format) ───────────────────────────────────

  const emailProfessionnelle = raw.emailProfessionnelle.trim();
  if (!emailProfessionnelle) {
    errors.push({
      line: lineNumber,
      field: "emailProfessionnelle",
      message: "Email professionnel est obligatoire",
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailProfessionnelle)) {
    errors.push({
      line: lineNumber,
      field: "emailProfessionnelle",
      message: `Email professionnel invalide : "${emailProfessionnelle}"`,
    });
  }

  // ── Dates ──────────────────────────────────────────────────────────

  const dateDebutRaw = raw.dateDebut.trim();
  if (!dateDebutRaw) {
    errors.push({
      line: lineNumber,
      field: "dateDebut",
      message: "Date de début est obligatoire",
    });
  } else if (!isValidFrenchDate(dateDebutRaw)) {
    errors.push({
      line: lineNumber,
      field: "dateDebut",
      message: `Date de début invalide : "${dateDebutRaw}", format attendu : JJ/MM/AAAA`,
    });
  }

  const dateNaissanceRaw = raw.dateNaissance.trim();
  if (dateNaissanceRaw && !isValidFrenchDate(dateNaissanceRaw)) {
    errors.push({
      line: lineNumber,
      field: "dateNaissance",
      message: `Date de naissance invalide : "${dateNaissanceRaw}", format attendu : JJ/MM/AAAA`,
    });
  }

  const dateFinRaw = raw.dateFin.trim();
  if (dateFinRaw && !isValidFrenchDate(dateFinRaw)) {
    errors.push({
      line: lineNumber,
      field: "dateFin",
      message: `Date de fin invalide : "${dateFinRaw}", format attendu : JJ/MM/AAAA`,
    });
  }

  // ── Type de poste (directeur | assistant | collaborateur, défaut: collaborateur) ─
  // Remplace l'ancien usage "principal"/"secondaire" qui était une erreur de
  // conception : ce champ désigne le rôle hiérarchique du poste, pas le
  // caractère principal/secondaire de l'affectation (géré par "postePrincipale").

  const typePosteRaw = raw.typePoste.trim();
  const typePosteLower = typePosteRaw.toLowerCase();
  let typePoste: "DIRECTEUR" | "ASSISTANT" | "COLLABORATEUR" = "COLLABORATEUR";

  if (typePosteLower === "directeur") {
    typePoste = "DIRECTEUR";
  } else if (typePosteLower === "assistant") {
    typePoste = "ASSISTANT";
  } else if (typePosteLower === "collaborateur" || typePosteLower === "") {
    typePoste = "COLLABORATEUR";
  } else {
    // Rétrocompatibilité : les anciennes valeurs "principal"/"secondaire"
    // étaient erronées dans ce champ. On les ignore et on applique le défaut.
    if (typePosteLower === "principal" || typePosteLower === "secondaire") {
      console.warn(
        `[Import] Ligne ${lineNumber} : valeur obsolète "${typePosteRaw}" dans "typePoste". ` +
        `Ce champ doit désormais contenir "directeur", "assistant" ou "collaborateur". ` +
        `Valeur par défaut appliquée : "collaborateur".`,
      );
    } else {
      console.warn(
        `[Import] Ligne ${lineNumber} : valeur inconnue "${typePosteRaw}" dans "typePoste". ` +
        `Valeur par défaut appliquée : "collaborateur".`,
      );
    }
    typePoste = "COLLABORATEUR";
  }

  // ── Arrêt si erreurs ───────────────────────────────────────────────

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // ── Transformation ─────────────────────────────────────────────────

  return {
    success: true,
    data: {
      codeAssignation,
      nom,
      prenom,
      dateNaissance: parseFrenchDate(dateNaissanceRaw),
      genre: parseGender(raw.genre),
      urlImage: emptyToNull(raw.urlImage),
      emailProfessionnelle,
      telephone: emptyToNull(raw.telephone),
      dateDebut: parseFrenchDate(dateDebutRaw)!,
      dateFin: parseFrenchDate(dateFinRaw),
      referentRH: parseOuiNon(raw.referentRH),
      localisation,
      departement: emptyToNull(raw.departement),
      secteur: emptyToNull(raw.secteur),
      poste: emptyToNull(raw.poste),
      postePrincipale: parseOuiNon(raw.postePrincipale),
      typePoste,
      detailsPoste: parseDetailsList(raw.detailsPoste),
      posteResponsable: emptyToNull(raw.posteResponsable),
    },
  };
}
