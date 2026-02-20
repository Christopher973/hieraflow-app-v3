export type SectorDto = {
  id: number;
  name: string;
  departmentId: number;
  departmentName: string;
  positionsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SectorListPayload = {
  items: SectorDto[];
};

export type SectorMutationPayload = {
  sector: SectorDto;
};

export type SectorListQuery = {
  q?: string;
  departmentId?: number;
  page: number;
  pageSize: number;
};
