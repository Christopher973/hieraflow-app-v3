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
 * - Un membre ne peut avoir qu'un seul poste principal (`postePrincipale=oui`).
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
  /** codeAssignation → référence du poste principal */
  const memberPrimaryPositions = new Map<string, string>();

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
    if (department) {
      if (row.secteur) {
        const sectorKey = `${department._tempId}|${row.secteur.toLowerCase()}`;
        if (!sectorMap.has(sectorKey)) {
          sectorMap.set(sectorKey, {
            _tempId: nextTempId(),
            name: row.secteur,
            departmentRef: department._tempId,
          });
        }
        sector = sectorMap.get(sectorKey)!;
      } else if (row.poste) {
        // Quand un poste est défini sans secteur (ex: Directeur, Assistant au
        // niveau du département), on crée un secteur racine implicite nommé
        // d'après le département. Cela permet à ces postes d'exister dans le
        // modèle de données sans être rattachés à un secteur métier spécifique.
        const rootSectorKey = `${department._tempId}|__root__`;
        if (!sectorMap.has(rootSectorKey)) {
          sectorMap.set(rootSectorKey, {
            _tempId: nextTempId(),
            name: department.name,
            departmentRef: department._tempId,
          });
        }
        sector = sectorMap.get(rootSectorKey)!;
      }
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
          type: row.typePoste,
          sectorRef: sector._tempId,
          parentPositionRef: null,
          jobDetails: row.detailsPoste.length > 0 ? row.detailsPoste : null,
        });
      } else {
        // Mise à jour avec les données de la dernière occurrence
        const existing = positionMap.get(positionKey)!;
        existing.isPrimary = row.postePrincipale;
        existing.type = row.typePoste;
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
    // La colonne "postePrincipale" (oui/non) détermine l'affectation principale
    // du membre. "typePoste" désigne maintenant le rôle hiérarchique du poste.

    if (position && row.postePrincipale) {
      const existingPrimary = memberPrimaryPositions.get(row.codeAssignation);
      if (existingPrimary && existingPrimary !== position._tempId) {
        errors.push({
          line: lineNumber,
          field: "postePrincipale",
          message: `Le membre "${row.codeAssignation}" a déjà un poste principal. Passez "postePrincipale" à "non" sur les autres lignes.`,
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

      if (position && row.postePrincipale) {
        existingMember.primaryPositionRef = position._tempId;
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
        primaryPositionRef:
          position && row.postePrincipale ? position._tempId : null,
      });
    }
  }

  // ── Résolution de la hiérarchie (2e passe) ─────────────────────────

  for (const { positionKey, parentName, sectorTempId } of hierarchyLinks) {
    const parentKey = `${sectorTempId}|${parentName.toLowerCase()}`;
    const position = positionMap.get(positionKey);

    if (!position) continue;

    // 1. Chercher le parent dans le même secteur (cas nominal)
    let parentPosition = positionMap.get(parentKey);

    if (!parentPosition) {
      // 2. Recherche globale par nom : le parent peut être dans un autre
      //    secteur (ex: un Directeur sans secteur attribué crée un secteur
      //    racine implicite différent du secteur de l'enfant).
      const parentNameLower = parentName.toLowerCase();
      for (const pos of positionMap.values()) {
        if (pos.name.toLowerCase() === parentNameLower) {
          parentPosition = pos;
          break;
        }
      }
    }

    if (!parentPosition) {
      // 3. Introuvable nulle part : créer un poste parent vacant dans le
      //    même secteur en dernier recours.
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
