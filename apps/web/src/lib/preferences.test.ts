import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { PALETTES, TAILLES } from './preferences.js'

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8')
const palettes = readFileSync(new URL('../palettes.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8')
const blocs = (source: string) => [...source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
const jetons = (source: string): Record<string, string> => Object.fromEntries(
  [...source.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
)

// La conversion sRGB évite de confondre luminosité perçue et moyenne des composantes.
function luminance(hex: string): number {
  const rgb = hex.slice(1).match(/../g)!.map((v) => {
    const c = parseInt(v, 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
}
function contraste(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const paires = [
  ...['fond', 'surface', 'surface-2', 'surface-3'].flatMap((fond) =>
    ['encre', 'encre-douce', 'lien', 'accent-fort'].map((texte) => [texte, fond])),
  ['accent-encre', 'accent'], ['accent-encre', 'accent-fort'], ['accent-fort', 'accent-doux'],
  ['bandeau-encre', 'bandeau'], ['bandeau-encre-douce', 'bandeau'],
  ['rail-encre', 'rail'], ['rail-encre-douce', 'rail'],
  ...['succes', 'alerte', 'erreur'].map((statut) => [statut, `${statut}-doux`]),
]

describe('Palettes : texte normal WCAG AA', () => {
  for (const [palette] of PALETTES) for (const sombre of [false, true]) {
    it(`${palette} ${sombre ? 'sombre' : 'clair'}`, () => {
      const valeurs: Record<string, string> = {}
      Object.assign(valeurs, jetons(blocs(palettes).find((b) => b[1]!.trim() === ':root')![2]!))
      Object.assign(valeurs, jetons(blocs(palettes).find((b) => b[1]!.includes(`data-palette=${palette}`))?.[2] ?? ''))
      for (const [, selecteur, corps] of blocs(css)) {
        const s = selecteur!.trim()
        if (s === ':root' || (sombre && s === ":root[data-theme='sombre']")) Object.assign(valeurs, jetons(corps!))
      }
      const lire = (nom: string): string => {
        const valeur = valeurs[nom]!
        const reference = /^var\(--([\w-]+)\)$/.exec(valeur)
        return reference ? lire(reference[1]!) : valeur
      }
      for (const [texte, fond] of paires) {
        expect(contraste(lire(texte!), lire(fond!)), `${texte}/${fond}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

it('applique chaque préférence avant affichage, sans accepter les valeurs inconnues', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!
  for (const [palette] of PALETTES) for (const [taille] of TAILLES) {
    const attributs: Record<string, string> = {}
    const stockage: Record<string, string> = { 'e2r-theme': 'sombre', 'e2r-palette': palette, 'e2r-taille': taille }
    runInNewContext(script, {
      localStorage: { getItem: (cle: string) => stockage[cle] },
      document: { documentElement: { setAttribute: (cle: string, valeur: string) => { attributs[cle] = valeur } } },
    })
    expect(attributs).toEqual({ 'data-theme': 'sombre', 'data-palette': palette, 'data-taille': taille })
  }
  for (const getItem of [() => 'inconnu', () => { throw new Error('Stockage refusé') }]) {
    const attributs: Record<string, string> = {}
    const setAttribute = (cle: string, valeur: string) => { attributs[cle] = valeur }
    expect(() => runInNewContext(script, { localStorage: { getItem }, document: { documentElement: { setAttribute } } })).not.toThrow()
    expect(attributs).toEqual({})
  }
})
