export function lireEtat(brut: string | null): Record<string, boolean> {
  try {
    const valeur: unknown = JSON.parse(brut ?? '{}')
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return {}
    return Object.fromEntries(Object.entries(valeur).filter(([, lu]) => typeof lu === 'boolean'))
  } catch {
    return {}
  }
}

export function basculer(etat: Record<string, boolean>, id: string, luActuel: boolean): Record<string, boolean> {
  return { ...etat, [id]: !luActuel }
}

export function estNouveau(dateMessage: string, aujourdhui: string): boolean {
  const jours = (Date.parse(aujourdhui) - Date.parse(dateMessage)) / 86_400_000
  return Number.isInteger(jours) && jours >= 0 && jours < 3
}
