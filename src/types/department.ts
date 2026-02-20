export type DepartmentDto = {
  id: number;
  name: string;
  sectorsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentListPayload = {
  items: DepartmentDto[];
};

export type DepartmentMutationPayload = {
  department: DepartmentDto;
};

export type DepartmentListQuery = {
  q?: string;
  page: number;
  pageSize: number;
};
