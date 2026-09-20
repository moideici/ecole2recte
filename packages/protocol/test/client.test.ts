import { describe, expect, it } from 'vitest'
import { EcoleDirecteClient } from '../src/client.js'
import { base64Encode } from '../src/encoding.js'
import { FakeEngine, GTK_EXCHANGE, STUDENT_PAYLOAD, loginResponse } from './fake.js'

type Options = Omit<ConstructorParameters<typeof EcoleDirecteClient>[0], 'engine'>

function client(engine: FakeEngine, options: Options = {}) {
  return new EcoleDirecteClient({ engine, ...options })
}

describe('connexion', () => {
  it('va chercher le GTK avant de tenter le login', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    const outcome = await client(engine).login('camille', 'motdepasse')

    expect(engine.requests).toHaveLength(2)
    expect(engine.requests[0]?.method).toBe('GET')
    expect(engine.requests[0]?.url).toContain('gtk=1')
    // Sans cet en-tête, le service répond « identifiant ou mot de passe incorrect ».
    expect(engine.requests[1]?.headers['X-GTK']).toBe('GTK-DE-TEST')
    expect(outcome.ok && outcome.accounts[0]?.firstName).toBe('Camille')
  })

  it('redemande un GTK neuf à chaque login, même quand la session en garde un', async () => {
    // Le jeton est à usage unique : le rejouer fait échouer le login qui suit la question.
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    const subject = client(engine)
    subject.session.gtk = 'GTK-USE'
    subject.session.cookies['GTK'] = 'GTK-USE'
    await subject.login('camille', 'x')

    expect(engine.requests[0]?.url).toContain('gtk=1')
    expect(engine.requests[1]?.headers['X-GTK']).toBe('GTK-DE-TEST')
    expect(engine.requests[1]?.headers['Cookie']).toContain('GTK=GTK-DE-TEST')
    expect(engine.requests[1]?.headers['Cookie']).not.toContain('GTK-USE')
  })

  it('prend le GTK dans le corps quand ni en-tête ni cookie ne le portent', async () => {
    const engine = new FakeEngine([
      { match: 'gtk=1', body: { code: 200, token: 'GTK-DU-CORPS', data: null } },
      loginResponse(200, STUDENT_PAYLOAD),
    ])
    await client(engine).login('camille', 'x')
    expect(engine.requests[1]?.headers['X-GTK']).toBe('GTK-DU-CORPS')
  })

  it('envoie le corps de login au caractère près', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    await client(engine).login('camille', 'sécret"1')

    expect(engine.sentRaw(1)).toBe(
      'data=' +
        encodeURIComponent(
          '{"identifiant": "camille", "motdepasse": "s\\u00e9cret\\"1", "isReLogin": false, "uuid": "", "fa": []}',
        ),
    )
  })

  it('rejoue un couple de confiance mémorisé dans le seul champ fa', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    await client(engine).login('camille', 'x', { cn: 'CN1', cv: 'CV1' })

    const body = engine.sentBody(1) as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['identifiant', 'motdepasse', 'isReLogin', 'uuid', 'fa'])
    expect(body['fa']).toEqual([{ cn: 'CN1', cv: 'CV1', uniq: false }])
  })

  it('après la question, envoie cn et cv à la racine et dans fa, dans l’ordre du site', async () => {
    // Avec `fa` seul, le service annonce un mot de passe invalide à une réponse juste.
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    await client(engine).login('camille', 'x', { cn: 'CN1', cv: 'CV1' }, { fresh: true })

    const body = engine.sentBody(1) as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['identifiant', 'motdepasse', 'isReLogin', 'cn', 'cv', 'uuid', 'fa'])
    expect(body).toMatchObject({ cn: 'CN1', cv: 'CV1', fa: [{ cn: 'CN1', cv: 'CV1', uniq: false }] })
  })

  it('emporte les jetons de la question de sécurité dans le login qui la conclut', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    const subject = client(engine)
    subject.session.token = 'JETON-QUESTION'
    subject.session.twoFactorToken = 'JETON-2FA-QUESTION'
    await subject.login('camille', 'x', { cn: 'CN1', cv: 'CV1' }, { fresh: true })

    expect(engine.requests[1]?.headers['X-Token']).toBe('JETON-QUESTION')
    expect(engine.requests[1]?.headers['2FA-Token']).toBe('JETON-2FA-QUESTION')
  })

  it('n’envoie aucun jeton sur une première connexion', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    await client(engine).login('camille', 'x')
    expect(engine.requests[1]?.headers['X-Token']).toBeUndefined()
    expect(engine.requests[1]?.headers['2FA-Token']).toBeUndefined()
  })

  it('retient les jetons et les cookies rapportés par la réponse', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    const subject = client(engine)
    await subject.login('camille', 'x')

    expect(subject.session.token).toBe('JETON-DE-TEST')
    expect(subject.session.twoFactorToken).toBe('JETON-2FA')
    // Les attributs de cookie ne sont pas des cookies.
    expect(subject.session.cookies).toEqual({ GTK: 'GTK-DE-TEST' })
  })
})

describe('codes métier', () => {
  const cases: Array<[number, string]> = [
    [250, 'two-factor'],
    [403, 'access-denied'],
    [505, 'invalid-credentials'],
    [516, 'account-blocked'],
    [517, 'stale-version'],
    [520, 'session-expired'],
    [525, 'session-expired'],
    [526, 'session-expired'],
    [535, 'account-blocked'],
    [999, 'protocol'],
  ]

  for (const [code, kind] of cases) {
    it(`traduit ${code} en ${kind}`, async () => {
      const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(code)])
      const outcome = await client(engine).login('camille', 'x')
      expect(outcome.ok).toBe(false)
      expect(!outcome.ok && outcome.kind).toBe(kind)
    })
  }

  it('croit le corps plutôt que le statut HTTP', async () => {
    // Le piège fondateur : le service refuse en répondant 200.
    const engine = new FakeEngine([GTK_EXCHANGE, { ...loginResponse(520), status: 200 }])
    const outcome = await client(engine).login('camille', 'x')
    expect(!outcome.ok && outcome.kind).toBe('session-expired')
  })

  it('signale une réponse qui n\'est pas du JSON sans lever', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, { match: 'login.awp', body: '<html>maintenance</html>' }])
    const outcome = await client(engine).login('camille', 'x')
    expect(!outcome.ok && outcome.kind).toBe('protocol')
  })
})

describe('question de sécurité', () => {
  it('décode la question et ses propositions', async () => {
    const engine = new FakeEngine([
      {
        match: 'doubleauth.awp',
        body: {
          code: 200,
          data: {
            question: base64Encode('Quelle est ta date de naissance ?'),
            propositions: [base64Encode('12 mars 2009'), base64Encode('3 juin 2010')],
          },
        },
      },
    ])
    const result = await client(engine).securityQuestion()

    expect(result.ok && result.value.question).toBe('Quelle est ta date de naissance ?')
    expect(result.ok && result.value.choices).toEqual(['12 mars 2009', '3 juin 2010'])
    expect(engine.requests[0]?.url).toContain('verbe=get')
  })

  it('renvoie le choix encodé et rapporte le couple de confiance', async () => {
    const engine = new FakeEngine([{ match: 'doubleauth.awp', body: { code: 200, data: { cn: 'CN', cv: 'CV' } } }])
    const result = await client(engine).answerSecurityQuestion('12 mars 2009')

    expect(engine.requests[0]?.url).toContain('verbe=post')
    expect(engine.sentBody(0)).toEqual({ choix: base64Encode('12 mars 2009') })
    expect(result.ok && result.value).toEqual({ cn: 'CN', cv: 'CV' })
  })
})

describe("police d'écriture", () => {
  const exchange = { match: 'cahierdetexte.awp', body: { code: 200, data: null } }

  it('refuse par défaut : rien ne part', async () => {
    const engine = new FakeEngine([exchange])
    const result = await client(engine).call('/Eleves/1/cahierdetexte.awp', {
      verb: 'put',
      write: true,
      body: { idDevoirsEffectues: [7] },
    })

    expect(!result.ok && result.kind).toBe('write-disabled')
    expect(engine.requests).toHaveLength(0)
  })

  it('en répétition, construit la requête sans l\'envoyer', async () => {
    const engine = new FakeEngine([exchange])
    const traces: unknown[] = []
    const subject = client(engine, { writePolicy: 'dry-run', onRequest: (record) => traces.push(record) })
    const result = await subject.call('/Eleves/1/cahierdetexte.awp', {
      verb: 'put',
      write: true,
      body: { idDevoirsEffectues: [7] },
    })

    expect(!result.ok && result.kind).toBe('dry-run')
    expect(engine.requests).toHaveLength(0)
    // La trace existe : c'est elle qu'on relit avant d'autoriser le premier envoi réel.
    expect(traces).toHaveLength(1)
  })

  it('envoie quand elle est autorisée, avec le verbe et la version', async () => {
    const engine = new FakeEngine([exchange])
    const subject = client(engine, { writePolicy: 'allow' })
    subject.session.token = 'JETON'
    const result = await subject.call('/Eleves/1/cahierdetexte.awp', {
      verb: 'put',
      write: true,
      body: { idDevoirsEffectues: [7], idDevoirsNonEffectues: [] },
    })

    expect(result.ok).toBe(true)
    const request = engine.requests[0]
    expect(request?.url).toBe('https://api.ecoledirecte.com/v3/Eleves/1/cahierdetexte.awp?verbe=put&v=4.101.4')
    expect(request?.headers['X-Token']).toBe('JETON')
    expect(request?.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(engine.sentBody(0)).toEqual({ idDevoirsEffectues: [7], idDevoirsNonEffectues: [] })
  })

  it('laisse passer la lecture quelle que soit la police', async () => {
    const engine = new FakeEngine([{ match: 'notes.awp', body: { code: 200, data: { x: 1 } } }])
    const result = await client(engine).call('/eleves/1/notes.awp', { verb: 'get' })
    expect(result.ok).toBe(true)
  })
})

describe('traces', () => {
  it("n'écrit jamais le mot de passe dans une trace", async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    const traces: string[] = []
    await client(engine, { onRequest: (record) => traces.push(JSON.stringify(record)) }).login('camille', 'Tr0ub4dour')

    // La clé reste lisible — c'est la valeur qui ne doit jamais apparaître.
    expect(traces.join('\n')).not.toContain('Tr0ub4dour')
    expect(traces.join('\n')).toContain('expurgé')
  })

  it('n’écrit jamais le couple de confiance dans une trace', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    const traces: string[] = []
    await client(engine, { onRequest: (record) => traces.push(JSON.stringify(record)) }).login(
      'camille',
      'x',
      { cn: 'CN-SECRET', cv: 'CV-SECRET' },
      { fresh: true },
    )
    expect(traces.join('\n')).not.toContain('CN-SECRET')
    expect(traces.join('\n')).not.toContain('CV-SECRET')
  })
})

describe('hôte enseignant', () => {
  it('vise apip pour un appel professeur', async () => {
    const engine = new FakeEngine([{ match: 'apip.ecoledirecte.com', body: { code: 200, data: null } }])
    await client(engine).call('/P/9/emploidutemps.awp', { verb: 'get', host: 'teacher' })
    expect(engine.requests[0]?.url).toContain('https://apip.ecoledirecte.com/v3/P/9/emploidutemps.awp')
  })
})
