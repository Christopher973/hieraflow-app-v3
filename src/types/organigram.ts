export type OrganigramDepartmentDto = {
  id: number;
  name: string;
};

export type OrganigramSectorDto = {
  id: number;
  name: string;
  departmentId: number;
};

export type OrganigramNodeDto = {
  id: number;
  pid?: number;
  name: string;
  positionType:
    | "DIRECTEUR"
    | "SOUS_DIRECTEUR"
    | "CHEF_SERVICE"
    | "RESPONSABLE"
    | "COLLABORATEUR"
    | "ASSISTANT";
  department: string;
  sector: string;
  departmentId: number;
  sectorId: number | null;
  tags?: string[];
  title?: string;
  img?: string;
  isVacant: boolean;
  memberId?: number;
  serviceCode?: string;
  firstname?: string;
  lastname?: string;
  gender?: "HOMME" | "FEMME" | "AUTRE";
  birthday?: string;
  isReferentRH?: boolean;
  professionalEmail?: string;
  phone?: string;
  locationName?: string;
  startDate?: string;
  endDate?: string;
  avatarUrl?: string;
  detailsUrl?: string;
};

export type OrganigramPayload = {
  departments: OrganigramDepartmentDto[];
  sectors: OrganigramSectorDto[];
  nodes: OrganigramNodeDto[];
};
