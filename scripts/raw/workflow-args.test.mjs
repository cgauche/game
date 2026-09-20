// La PROJECTION du registre des livres vers les `args` d'un workflow d'extraction Atlas.
// Les sigles des fixtures sont INVENTÉS : un banc qui recopierait un sigle réel réintroduirait la
// table de livres qu'on vient de sortir du code (#1825). Le seul contact avec le registre RÉEL est
// une propriété de FORME, sans aucun nom de livre.
import test from 'node:test'
import assert from 'node:assert/strict'
import { REGISTRE_LIVRES } from './_lib.mjs'
import { coeursDuRegistre, perimetreDeCoeur } from './workflow-args.mjs'

const FIXTURE = [
  { id: 'base-alpha', abbr: 'BKA', dir: 'Source/Fixture - Base Alpha', language: 'Langue-A', coeur: 'alpha' },
  { id: 'base-beta', abbr: 'BKB', dir: 'Source/Fixture - Base Beta', language: 'Langue-B', coeur: 'beta' },
  { id: 'supplement-gamma', abbr: 'SPG', dir: 'Source/Fixture - Supplement Gamma', language: 'Langue-B' },
  { id: 'sans-extraction', abbr: 'SXX', language: 'Langue-A' },
]

test('coeursDuRegistre : les cœurs déclarés, dans l’ordre du fichier, sans doublon', () => {
  assert.deepEqual(coeursDuRegistre(FIXTURE), ['alpha', 'beta'])
})

test('perimetreDeCoeur : `supplements: true` ajoute les suppléments ; l’AUTRE cœur et les livres sans `dir` restent dehors', () => {
  assert.deepEqual(perimetreDeCoeur('alpha', { supplements: true, registre: FIXTURE }), {
    coeur: 'alpha',
    supplements: true,
    livres: [
      { ab: 'BKA', dir: 'Source/Fixture - Base Alpha', coeur: 'alpha', language: 'Langue-A' },
      { ab: 'SPG', dir: 'Source/Fixture - Supplement Gamma', coeur: null, language: 'Langue-B' },
    ],
  })
  assert.deepEqual(perimetreDeCoeur('beta', { supplements: true, registre: FIXTURE }).livres.map((l) => l.ab), ['BKB', 'SPG'])
})

test('perimetreDeCoeur : `supplements: false` ne garde que les livres de CE cœur, et le résultat PORTE le choix', () => {
  const p = perimetreDeCoeur('alpha', { supplements: false, registre: FIXTURE })
  assert.deepEqual(p.livres.map((l) => l.ab), ['BKA'])
  assert.equal(p.supplements, false)
})

test('perimetreDeCoeur : `supplements` NON DÉCLARÉ LÈVE — la compatibilité supplement/cœur n’est pas au registre', () => {
  assert.throws(() => perimetreDeCoeur('alpha', { registre: FIXTURE }), /`supplements` non déclaré.*supplements: true.*supplements: false/s)
  assert.throws(() => perimetreDeCoeur('alpha', { supplements: 'oui', registre: FIXTURE }), /`supplements` non déclaré/)
})

test('perimetreDeCoeur : un cœur absent ou non textuel LÈVE en nommant les cœurs du registre', () => {
  const avec = { supplements: true, registre: FIXTURE }
  assert.throws(() => perimetreDeCoeur('omega', avec), /aucun livre de cœur « omega ».*alpha, beta/s)
  assert.throws(() => perimetreDeCoeur('', avec), /absent ou non textuel.*alpha, beta/s)
  assert.throws(() => perimetreDeCoeur(undefined, avec), /absent ou non textuel/)
})

test('perimetreDeCoeur : un livre du périmètre sans `language` LÈVE — la langue des citations ne se devine pas', () => {
  const muet = FIXTURE.map((b) => (b.abbr === 'SPG' ? { ...b, language: undefined } : b))
  assert.throws(() => perimetreDeCoeur('alpha', { supplements: true, registre: muet }), /sans champ `language` \(SPG\)/)
})

test('registre RÉEL : chaque cœur déclaré projette, sous les DEUX choix, un périmètre non vide à langues complètes', () => {
  const coeurs = coeursDuRegistre(REGISTRE_LIVRES)
  assert.ok(coeurs.length >= 1, 'le registre ne déclare aucun cœur de règles')
  for (const coeur of coeurs) {
    for (const supplements of [true, false]) {
      const { livres } = perimetreDeCoeur(coeur, { supplements })
      assert.ok(livres.length > 0, `périmètre vide pour le cœur ${coeur} (supplements=${supplements})`)
      assert.ok(livres.some((l) => l.coeur === coeur), `aucun livre de cœur dans le périmètre ${coeur}`)
      assert.deepEqual(livres.filter((l) => !l.language), [], `livres sans langue au périmètre ${coeur}`)
      if (!supplements) assert.deepEqual(livres.filter((l) => l.coeur !== coeur), [], 'un supplement a fui dans `--coeur-seul`')
    }
  }
})
