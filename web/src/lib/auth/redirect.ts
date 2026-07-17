export function getSafeLoginRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
