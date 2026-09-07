import { describe, expect, it } from 'vitest'
import { base64Decode, base64DecodeOrRaw, base64Encode, formBody, pythonJson } from '../src/encoding.js'

describe('pythonJson', () => {
  it('sépare comme Python, avec les espaces', () => {
    expect(pythonJson({ a: 1, b: 2 })).toBe('{"a": 1, "b": 2}')
    expect(pythonJson([1, 2])).toBe('[1, 2]')
  })

  it('échappe tout ce qui sort de l\'ASCII', () => {
    // `JSON.stringify` rendrait « é » tel quel : la chaîne envoyée serait différente.
    expect(pythonJson({ nom: 'Gaëlle' })).toBe('{"nom": "Ga\\u00eblle"}')
    expect(pythonJson('—')).toBe('"\\u2014"')
  })

  it('échappe une paire de substitution en deux séquences', () => {
    expect(pythonJson('\u{1F600}')).toBe('"\\ud83d\\ude00"')
  })

  it("respecte l'ordre d'insertion des clés", () => {
    const body = { identifiant: 'x', motdepasse: 'y', isReLogin: false, uuid: '', fa: [] }
    expect(pythonJson(body)).toBe('{"identifiant": "x", "motdepasse": "y", "isReLogin": false, "uuid": "", "fa": []}')
  })

  it('rend les conteneurs vides comme Python', () => {
    expect(pythonJson({})).toBe('{}')
    expect(pythonJson([])).toBe('[]')
  })

  it('échappe les commandes et les guillemets', () => {
    expect(pythonJson('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"')
  })
})

describe('formBody', () => {
  it('préfixe et encode', () => {
    expect(formBody({ a: 'b c' })).toBe('data=%7B%22a%22%3A%20%22b%20c%22%7D')
  })
})

describe('base64', () => {
  it('fait l\'aller-retour sur de l\'UTF-8', () => {
    expect(base64Decode(base64Encode('Quelle est ta date de naissance ?'))).toBe('Quelle est ta date de naissance ?')
  })

  it('tolère les retours à la ligne et le remplissage absent', () => {
    const encoded = base64Encode('12 mars 2009')
    const maltraité = encoded.replace(/=+$/, '').replace(/(.{4})/g, '$1\n')
    expect(base64Decode(maltraité)).toBe('12 mars 2009')
  })

  it('rend la chaîne brute plutôt que de lever', () => {
    expect(base64DecodeOrRaw('!!! pas du base64 !!!')).toBe('!!! pas du base64 !!!')
  })
})
