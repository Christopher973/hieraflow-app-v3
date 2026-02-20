import type {
  CsvValidatedRow,
  ImportDepartment,
  ImportError,
  ImportLocation,
  ImportMember,
  ImportPayload,
  ImportPosition,
  ImportSector,
} from "./types";

// ─── Compteur d'identifiants temporaires ─────────────────────────────────────

let tempIdCounter = 0;
function nextTempId(): string {
  return `temp_${++tempIdCounter}`;
}

// ─── Interface de sortie ─────────────────────────────────────────────────────

interface NormalizeResult {
  payload: ImportPayload;
  errors: ImportError[];
  duplicatesOverwritten: number;
}

// ─── Normalisation principale ────────────────────────────────────────────────

/**
 * Normalise les lignes CSV validées en entités dédoublonnées (Location,
 * Department, Sector, Position, Member), résout la hiérarchie
 * `posteResponsable`, et gère les contraintes d'unicité.
 *
 * Règles :
 * - Location : unique par nom (insensible à la casse).
 * - Department : unique par nom (insensible à la casse).
 * - Sector : unique par nom AU SEIN d'un département.
 * - Position : unique par nom AU SEIN d'un secteur.
 * - Member : unique par codeAssignation. Si doublon, la dernière occurrence
 *   écrase la précédente (données membre), et les positions s'accumulent.
 * - Email : unique entre membres différents.
 * - Un membre ne peut avoir qu'un seul poste principal.
 */
export function normalizeImportData(
  validatedRows: { row: CsvValidatedRow; lineNumber: number }[],
): NormalizeResult {
  // Reset du compteur à chaque import
  tempIdCounter = 0;

  const errors: ImportError[] = [];
  let duplicatesOverwritten = 0;

  // ── Maps de dédoublonnage ──────────────────────────────────────────

  const locationMap = new Map<string, ImportLocation>();
  const departmentMap = new Map<string, ImportDepartment>();
  const sectorMap = new Map<string, ImportSector>();
  const positionMap = new Map<string, ImportPosition>();

  // ── Suivi des membres ──────────────────────────────────────────────

  const memberMap = new Map<string, ImportMember>();
  /** email → codeAssignation du propriétaire */
  const emailOwnerMap = new Map<string, string>();
  /** codeAssignation → Set<positionName en lowercase dans le même secteur> pour détecter les postes principaux multiples */
  const memberPrimaryPositions = new Map<string, string | null>();

  // ── Suivi de la hiérarchie (pour résolution en 2e passe) ───────────

  interface HierarchyLink {
    positionKey: string;
    parentName: string;
    sectorTempId: string;
  }
  const hierarchyLinks: HierarchyLink[] = [];

  // ── Traitement de chaque ligne ─────────────────────────────────────

  for (const { row, lineNumber } of validatedRows) {
    // ── Unicité email entre membres différents ───────────────────────

    const emailLower = row.emailProfessionnelle.toLowerCase();
    const existingEmailOwner = emailOwnerMap.get(emailLower);
    if (existingEmailOwner && existingEmailOwner !== row.codeAssignation) {
      errors.push({
        line: lineNumber,
        field: "emailProfessionnelle",
        message: `Email "${row.emailProfessionnelle}" déjà utilisé par le membre "${existingEmailOwner}"`,
      });
      continue;
    }
    emailOwnerMap.set(emailLower, row.codeAssignation);

    // ── Location ─────────────────────────────────────────────────────

    const locationKey = row.localisation.toLowerCase();
    if (!locationMap.has(locationKey)) {
      locationMap.set(locationKey, {
        _tempId: nextTempId(),
        name: row.localisation,
      });
    }
    const location = locationMap.get(locationKey)!;

    // ── Department (optionnel) ───────────────────────────────────────

    let department: ImportDepartment | null = null;
    if (row.departement) {
      const deptKey = row.departement.toLowerCase();
      if (!departmentMap.has(deptKey)) {
        departmentMap.set(deptKey, {
          _tempId: nextTempId(),
          name: row.departement,
        });
      }
      department = departmentMap.get(deptKey)!;
    }

    // ── Sector (optionnel, nécessite un département) ─────────────────

    let sector: ImportSector | null = null;
    if (row.secteur && department) {
      const sectorKey = `${department._tempId}|${row.secteur.toLowerCase()}`;
      if (!sectorMap.has(sectorKey)) {
        sectorMap.set(sectorKey, {
          _tempId: nextTempId(),
          name: row.secteur,
          departmentRef: department._tempId,
        });
      }
      sector = sectorMap.get(sectorKey)!;
    }

    // ── Position (optionnelle, nécessite un secteur) ─────────────────

    let position: ImportPosition | null = null;
    if (row.poste && sector) {
      const positionKey = `${sector._tempId}|${row.poste.toLowerCase()}`;
      if (!positionMap.has(positionKey)) {
        positionMap.set(positionKey, {
          _tempId: nextTempId(),
          name: row.poste,
          isPrimary: row.postePrincipale,
          type: row.assistant ? "ASSISTANT" : "COLLABORATEUR",
          sectorRef: sector._tempId,
          parentPositionRef: null,
          jobDetails: row.detailsPoste.length > 0 ? row.detailsPoste : null,
        });
      } else {
        // Mise à jour avec les données de la dernière occurrence
        const existing = positionMap.get(positionKey)!;
        existing.isPrimary = row.postePrincipale;
        existing.type = row.assistant ? "ASSISTANT" : "COLLABORATEUR";
        if (row.detailsPoste.length > 0) {
          existing.jobDetails = row.detailsPoste;
        }
      }
      position = positionMap.get(positionKey)!;

      // ── Enregistrement du lien hiérarchique ──────────────────────

      if (row.posteResponsable) {
        hierarchyLinks.push({
          positionKey,
          parentName: row.posteResponsable,
          sectorTempId: sector._tempId,
        });
      }
    }

    // ── Validation : un seul poste principal par membre ──────────────

    if (position && row.postePrincipale) {
      const existingPrimary = memberPrimaryPositions.get(row.codeAssignation);
      if (existingPrimary && existingPrimary !== position._tempId) {
        errors.push({
          line: lineNumber,
          field: "postePrincipale",
          message: `Le membre "${row.codeAssignation}" a déjà un poste principal`,
        });
        continue;
      }
      memberPrimaryPositions.set(row.codeAssignation, position._tempId);
    }

    // ── Member ───────────────────────────────────────────────────────

    const existingMember = memberMap.get(row.codeAssignation);
    if (existingMember) {
      duplicatesOverwritten++;

      // Dernière occurrence écrase les données personnelles
      existingMember.firstname = row.prenom;
      existingMember.lastname = row.nom;
      existingMember.birthday = row.dateNaissance;
      existingMember.gender = row.genre;
      existingMember.avatarUrl = row.urlImage;
      existingMember.professionalEmail = row.emailProfessionnelle;
      existingMember.phone = row.telephone;
      existingMember.startDate = row.dateDebut;
      existingMember.endDate = row.dateFin;
      existingMember.isReferentRH = row.referentRH;
      existingMember.locationRef = location._tempId;

      // Ajouter la position si elle n'est pas déjà assignée
      if (position && !existingMember.positionRefs.includes(position._tempId)) {
        existingMember.positionRefs.push(position._tempId);
      }
    } else {
      memberMap.set(row.codeAssignation, {
        _tempId: nextTempId(),
        serviceCode: row.codeAssignation,
        firstname: row.prenom,
        lastname: row.nom,
        birthday: row.dateNaissance,
        gender: row.genre,
        avatarUrl: row.urlImage,
        professionalEmail: row.emailProfessionnelle,
        phone: row.telephone,
        startDate: row.dateDebut,
        endDate: row.dateFin,
        isReferentRH: row.referentRH,
        locationRef: location._tempId,
        positionRefs: position ? [position._tempId] : [],
      });
    }
  }

  // ── Résolution de la hiérarchie (2e passe) ─────────────────────────

  for (const { positionKey, parentName, sectorTempId } of hierarchyLinks) {
    const parentKey = `${sectorTempId}|${parentName.toLowerCase()}`;
    const position = positionMap.get(positionKey);

    if (!position) continue;

    let parentPosition = positionMap.get(parentKey);

    if (!parentPosition) {
      // Créer un poste parent vacant s'il n'existe pas encore
      parentPosition = {
        _tempId: nextTempId(),
        name: parentName,
        isPrimary: false,
        type: "COLLABORATEUR",
        sectorRef: sectorTempId,
        parentPositionRef: null,
        jobDetails: null,
      };
      positionMap.set(parentKey, parentPosition);
    }

    position.parentPositionRef = parentPosition._tempId;
  }

  // ── Construction du payload ────────────────────────────────────────

  return {
    payload: {
      locations: Array.from(locationMap.values()),
      departments: Array.from(departmentMap.values()),
      sectors: Array.from(sectorMap.values()),
      positions: Array.from(positionMap.values()),
      members: Array.from(memberMap.values()),
    },
    errors,
    duplicatesOverwritten,
  };
}
