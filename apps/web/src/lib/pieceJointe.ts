const EXTENSIONS_REFUSEES = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|js|mjs|jar|sh|html|htm|svg|hta|lnk)$/i
export const LIMITE_PIECE_JOINTE = 25 * 1024 * 1024

export function verifierPieceJointe(nom: string, octets: number): { ok: true } | { ok: false; raison: string } {
  if (EXTENSIONS_REFUSEES.test(nom.trim())) return { ok: false, raison: 'Ce type de pièce jointe est refusé.' }
  if (octets > LIMITE_PIECE_JOINTE) return { ok: false, raison: 'La pièce jointe dépasse la limite de 25 Mo.' }
  return { ok: true }
}
