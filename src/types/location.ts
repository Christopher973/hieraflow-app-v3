export type LocationDto = {
  id: number;
  name: string;
  membersCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LocationListPayload = {
  items: LocationDto[];
};

export type LocationMutationPayload = {
  location: LocationDto;
};

export type LocationListQuery = {
  q?: string;
  page: number;
  pageSize: number;
};
