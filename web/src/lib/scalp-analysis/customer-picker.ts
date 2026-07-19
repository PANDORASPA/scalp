type CustomerPickerRecord = {
  id: string
  name: string
  phone: string | null
}

export function filterScalpAnalysisCustomers<T extends CustomerPickerRecord>(
  customers: T[],
  query: string,
  selectedCustomerId: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return customers

  const matches = customers.filter((customer) =>
    `${customer.name} ${customer.phone ?? ''}`.toLocaleLowerCase().includes(normalizedQuery),
  )
  const selected = customers.find((customer) => customer.id === selectedCustomerId)
  if (!selected || matches.some((customer) => customer.id === selected.id)) return matches
  return [selected, ...matches]
}
