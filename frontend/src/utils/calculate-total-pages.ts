export function calculateTotalPages(total: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  const lastPageSize = total % pageSize || pageSize;
  return { totalPages, lastPageSize };
}
