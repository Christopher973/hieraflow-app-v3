export type CollaboratorDto = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  birthday: string | null;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: string;
  endDate: string | null;
  status: "ACTIF" | "INACTIF" | "SUSPENDU";
  isReferentRH: boolean;
  locationId: number | null;
  locationName: string | null;
  positionId: number | null;
  positionName: string | null;
  sectorId: number | null;
  sectorName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CollaboratorListPayload = {
  items: CollaboratorDto[];
};

export type CollaboratorMutationPayload = {
  collaborator: CollaboratorDto;
};

export type CollaboratorAvatarPayload = {
  collaboratorId: number;
  avatarKey: string | null;
  avatarUrl: string | null;
};

export type CollaboratorLightMemberDto = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: string;
  endDate: string | null;
  locationId: number | null;
  locationName: string | null;
};

export type CollaboratorRelatedPositionDto = {
  id: number;
  name: string;
  type:
    | "DIRECTEUR"
    | "SOUS_DIRECTEUR"
    | "CHEF_SERVICE"
    | "RESPONSABLE"
    | "COLLABORATEUR"
    | "ASSISTANT";
  sectorId: number;
  sectorName: string;
  departmentId: number;
  departmentName: string;
  member: CollaboratorLightMemberDto | null;
  jobDetails?: string[] | null;
};

export type CollaboratorPositionDetailDto = {
  id: number;
  name: string;
  type:
    | "DIRECTEUR"
    | "SOUS_DIRECTEUR"
    | "CHEF_SERVICE"
    | "RESPONSABLE"
    | "COLLABORATEUR"
    | "ASSISTANT";
  sectorId: number;
  sectorName: string;
  departmentId: number;
  departmentName: string;
  parentPosition: CollaboratorRelatedPositionDto | null;
  childPositions: CollaboratorRelatedPositionDto[];
  jobDetails?: string[] | null;
};

export type CollaboratorDetailDto = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  birthday: string | null;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: string;
  endDate: string | null;
  status: "ACTIF" | "INACTIF" | "SUSPENDU";
  isReferentRH: boolean;
  locationId: number | null;
  locationName: string | null;
  positionId: number | null;
  primaryPositionId: number | null;
  position: CollaboratorPositionDetailDto | null;
  positions: Array<{
    id: number;
    name: string;
    type:
      | "DIRECTEUR"
      | "SOUS_DIRECTEUR"
      | "CHEF_SERVICE"
      | "RESPONSABLE"
      | "COLLABORATEUR"
      | "ASSISTANT";
    sectorId: number;
    sectorName: string;
    departmentId: number;
    departmentName: string;
    isPrimary: boolean;
    jobDetails?: string[] | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type CollaboratorPositionsMutationInput = {
  positionIds?: number[];
  primaryPositionId?: number | null;
};

export type CollaboratorDetailPayload = {
  collaborator: CollaboratorDetailDto;
};
