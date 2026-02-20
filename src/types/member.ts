export type MemberCardType = "newMembers" | "jobMobility" | "trombinoscope";

export type Member = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  gender: string;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string;
  startDate: string;
  endDate: string | null;
  locationName?: string | null;
  status: string;
  isReferentRH: boolean;
  positionId: number;
};

export type Position = {
  id: number;
  name: string;
  type: string;
  sectorId: number;
  parentPositionId: number | null;
  lastMobility?: string | null;
};

export type Sector = {
  id: number;
  name: string;
  departmentId: number;
};

export type Department = {
  id: number;
  name: string;
};

export type ResolvedMember = {
  member: Member;
  position: Position;
  sector: Sector;
  department: Department;
};
