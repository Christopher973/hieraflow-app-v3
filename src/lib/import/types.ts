// ─── Types spécifiques à l'import CSV ────────────────────────────────────────

/**
 * Ligne CSV validée et transformée.
 */
export interface CsvValidatedRow {
  codeAssignation: string;
  nom: string;
  prenom: string;
  dateNaissance: Date | null;
  genre: "HOMME" | "FEMME" | "AUTRE";
  urlImage: string | null;
  emailProfessionnelle: string;
  telephone: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  referentRH: boolean;
  localisation: string;
  departement: string | null;
  secteur: string | null;
  poste: string | null;
  postePrincipale: boolean;
  // Type hiérarchique du poste : directeur, assistant ou collaborateur (défaut).
  typePoste: "DIRECTEUR" | "ASSISTANT" | "COLLABORATEUR";
  detailsPoste: string[];
  posteResponsable: string | null;
}

// ─── Entités normalisées (prêtes pour Prisma) ────────────────────────────────

export interface ImportLocation {
  _tempId: string;
  name: string;
}

export interface ImportDepartment {
  _tempId: string;
  name: string;
}

export interface ImportSector {
  _tempId: string;
  name: string;
  departmentRef: string;
}

export interface ImportPosition {
  _tempId: string;
  name: string;
  isPrimary: boolean;
  type: "DIRECTEUR" | "COLLABORATEUR" | "ASSISTANT";
  sectorRef: string;
  parentPositionRef: string | null;
  jobDetails: string[] | null;
}

export interface ImportMember {
  _tempId: string;
  serviceCode: string;
  firstname: string;
  lastname: string;
  birthday: Date | null;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: Date;
  endDate: Date | null;
  isReferentRH: boolean;
  locationRef: string;
  positionRefs: string[];
  primaryPositionRef: string | null;
}

// ─── Payload, erreurs, résumé ────────────────────────────────────────────────

export interface ImportPayload {
  locations: ImportLocation[];
  departments: ImportDepartment[];
  sectors: ImportSector[];
  positions: ImportPosition[];
  members: ImportMember[];
}

export interface ImportError {
  line: number;
  field?: string;
  message: string;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  errorCount: number;
  duplicatesOverwritten: number;
  entities: {
    locations: number;
    departments: number;
    sectors: number;
    positions: number;
    members: number;
  };
}

export interface ImportResult {
  payload: ImportPayload;
  errors: ImportError[];
  summary: ImportSummary;
}
