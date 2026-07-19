export function mergeCustomerSearchResults<T extends { id: string; updated_at: string }>(results: T[][]) {
  const byId = new Map<string, T>()
  for (const rows of results) {
    for (const row of rows) {
      const current = byId.get(row.id)
      if (!current || row.updated_at.localeCompare(current.updated_at) > 0) {
        byId.set(row.id, row)
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}
