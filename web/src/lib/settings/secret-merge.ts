export function keepExistingSecretUnlessReplacement(input: string | undefined, current: string | undefined) {
  return input?.trim() ? input : current
}
