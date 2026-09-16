// Shared shape for every paginated list endpoint (projects, members, audit logs).
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
