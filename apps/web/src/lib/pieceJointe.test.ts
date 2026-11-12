import { describe, expect, it } from 'vitest'
import { verifierPieceJointe, LIMITE_PIECE_JOINTE } from './pieceJointe.js'

describe('vérification des pièces jointes', () => {
  it.each(['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'ps1', 'vbs', 'js', 'mjs', 'jar', 'sh', 'html', 'htm', 'svg', 'hta', 'lnk'])('refuse .%s, y compris en majuscules et après une double extension', (extension) => {
    expect(verifierPieceJointe(`facture.pdf.${extension.toUpperCase()}`, 1).ok).toBe(false)
  })
  it.each(['document', 'document.pdf', 'document.docx', 'image.png'])('accepte %s à la limite exacte', (nom) => {
    expect(verifierPieceJointe(nom, LIMITE_PIECE_JOINTE)).toEqual({ ok: true })
  })
  it('refuse un octet de trop', () => {
    expect(verifierPieceJointe('document.pdf', LIMITE_PIECE_JOINTE + 1)).toEqual({ ok: false, raison: 'La pièce jointe dépasse la limite de 25 Mo.' })
  })
})
