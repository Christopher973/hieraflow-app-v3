/**
 * Type de poste dans la hiérarchie organisationnelle.
 */
export type PositionType =
  | "DIRECTEUR"
  | "SOUS_DIRECTEUR"
  | "CHEF_SERVICE"
  | "RESPONSABLE"
  | "COLLABORATEUR"
  | "ASSISTANT";

/**
 * DTO représentant un poste avec ses relations.
 * Inclut les informations du secteur (+ département parent),
 * du poste parent hiérarchique, et du membre occupant si présent.
 */
export interface PositionDto {
  id: number;
  name: string;
  type: PositionType;
  isPrimary: boolean;
  jobDetails: string[] | null;

  /** ID du secteur auquel appartient le poste */
  sectorId: number | null;
  /** ID du département auquel appartient le poste */
  departmentId: number;
  /** Nom du secteur */
  sectorName: string;
  /** Nom du département parent du secteur */
  departmentName: string;

  /** ID du poste parent dans la hiérarchie (null si poste racine) */
  parentPositionId: number | null;
  /** Nom du poste parent (null si pas de parent) */
  parentPositionName: string | null;

  /** Nom complet du membre occupant (null si poste vacant) */
  memberName: string | null;
  /** Avatar du membre occupant (null si poste vacant) */
  memberAvatar: string | null;

  /** Nombre de postes enfants directs */
  childrenCount: number;

  lastMobility: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Paramètres de requête pour lister les postes.
 */
export interface PositionListQuery {
  /** Recherche textuelle (nom de poste) */
  q?: string;
  /** Filtrer par secteur */
  sectorId?: number;
  /** Filtrer par département (indirect via secteur) */
  departmentId?: number;
  /** Filtrer par type de poste */
  type?: PositionType;
  /** Afficher uniquement les postes vacants */
  vacantOnly?: boolean;
  /** Page actuelle */
  page?: number;
  /** Taille de page */
  pageSize?: number;
}

/**
 * Payload retourné par l'API lors de la liste des postes.
 * Utilise le même pattern que les autres entités (`items` + pagination dans `meta`).
 */
export interface PositionListPayload {
  items: PositionDto[];
}

/**
 * Input pour créer ou mettre à jour un poste (mutations).
 */
export interface PositionMutationInput {
  name: string;
  type: PositionType;
  isPrimary?: boolean;
  jobDetails?: string[] | null;
  sectorId?: number | null;
  departmentId?: number;
  parentPositionId?: number | null;
}

/**
 * Payload retourné par l'API lors d'une mutation (create/update).
 */
export interface PositionMutationPayload {
  position: PositionDto;
}
