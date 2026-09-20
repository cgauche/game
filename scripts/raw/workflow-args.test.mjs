// La PROJECTION des registres (livres, DOMAINES) vers les `args` d'un workflow d'extraction Atlas.
// Les sigles et les clés de domaine des fixtures sont INVENTÉS : un banc qui en recopierait un réel
// réintroduirait la table qu'on vient de sortir du code (#1825). Le seul contact avec les registres
// RÉELS est une propriété de FORME, sans aucun nom de livre ni de domaine.
import test from 'node:test'
import assert from 'node:assert/strict'
import { REGISTRE_LIVRES } from './_lib.mjs'
import { perimetreDeCoeur } from './workflow-args.mjs'
import { coeursDeDomaines, coeursDuRegistre, domainesDe } from './_lib.mjs'

/** Domaines de fixture : deux cœurs, clés et titres inventés. */
const DOMAINES = {
  alpha: [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-deux', titre: 'Second Domaine de Fixture' },
  ],
  beta: [{ cle: 'domaine-trois', titre: 'Troisieme Domaine de Fixture' }],
}
const LOT = ['domaine-un']
/** Les options communes : registres de fixture, choix déclarés. */
const opts = (extra) => ({ supplements: true, lot: LOT, registre: FIXTURE, registreDomaines: DOMAINES, ...extra })

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
  assert.deepEqual(perimetreDeCoeur('alpha', opts()), {
    coeur: 'alpha',
    supplements: true,
    domaines: DOMAINES.alpha,
    lot: LOT,
    livres: [
      { ab: 'BKA', dir: 'Source/Fixture - Base Alpha', coeur: 'alpha', language: 'Langue-A' },
      { ab: 'SPG', dir: 'Source/Fixture - Supplement Gamma', coeur: null, language: 'Langue-B' },
    ],
  })
  assert.deepEqual(perimetreDeCoeur('beta', opts({ lot: ['domaine-trois'] })).livres.map((l) => l.ab), ['BKB', 'SPG'])
})

test('perimetreDeCoeur : la CARTE des domaines est celle du cœur demandé — jamais celle d’un autre', () => {
  assert.deepEqual(perimetreDeCoeur('beta', opts({ lot: ['domaine-trois'] })).domaines, DOMAINES.beta)
})

test('perimetreDeCoeur : un `lot` NON DÉCLARÉ ou une clé INCONNUE LÈVE en nommant les domaines du cœur', () => {
  const sansLot = { ...opts() }
  delete sansLot.lot
  assert.throws(() => perimetreDeCoeur('alpha', sansLot), /`lot` de domaines non déclaré.*domaine-un, domaine-deux/s)
  assert.throws(() => perimetreDeCoeur('alpha', opts({ lot: [] })), /`lot` de domaines non déclaré/)
  assert.throws(
    () => perimetreDeCoeur('alpha', opts({ lot: ['domaine-un', 'domaine-jamais-declare'] })),
    /« domaine-jamais-declare » inconnu\(s\) du cœur « alpha ».*domaine-un, domaine-deux/s,
  )
  // La clé d'un AUTRE cœur n'est pas une clé de celui-ci : deux cœurs ne se joignent pas par `cle`.
  assert.throws(() => perimetreDeCoeur('alpha', opts({ lot: ['domaine-trois'] })), /« domaine-trois » inconnu\(s\)/)
})

test('perimetreDeCoeur : un cœur SANS domaine déclaré LÈVE — il ne rend pas un lot vide en silence', () => {
  assert.throws(
    () => perimetreDeCoeur('alpha', opts({ registreDomaines: { beta: DOMAINES.beta } })),
    /aucun domaine déclaré pour le cœur « alpha ».*domaines\.json.*beta/s,
  )
})

test('perimetreDeCoeur : `supplements: false` ne garde que les livres de CE cœur, et le résultat PORTE le choix', () => {
  const p = perimetreDeCoeur('alpha', opts({ supplements: false }))
  assert.deepEqual(p.livres.map((l) => l.ab), ['BKA'])
  assert.equal(p.supplements, false)
})

test('perimetreDeCoeur : `supplements` NON DÉCLARÉ LÈVE — la compatibilité supplement/cœur n’est pas au registre', () => {
  const sans = { ...opts() }
  delete sans.supplements
  assert.throws(() => perimetreDeCoeur('alpha', sans), /`supplements` non déclaré.*supplements: true.*supplements: false/s)
  assert.throws(() => perimetreDeCoeur('alpha', opts({ supplements: 'oui' })), /`supplements` non déclaré/)
})

test('perimetreDeCoeur : un cœur absent ou non textuel LÈVE en nommant les cœurs du registre', () => {
  assert.throws(() => perimetreDeCoeur('omega', opts()), /aucun livre de cœur « omega ».*alpha, beta/s)
  assert.throws(() => perimetreDeCoeur('', opts()), /absent ou non textuel.*alpha, beta/s)
  assert.throws(() => perimetreDeCoeur(undefined, opts()), /absent ou non textuel/)
})

test('perimetreDeCoeur : un livre du périmètre sans `language` LÈVE — la langue des citations ne se devine pas', () => {
  const muet = FIXTURE.map((b) => (b.abbr === 'SPG' ? { ...b, language: undefined } : b))
  assert.throws(() => perimetreDeCoeur('alpha', opts({ registre: muet })), /sans champ `language` \(SPG\)/)
})

test('registre RÉEL : chaque cœur déclaré projette, sous les DEUX choix, un périmètre non vide à langues complètes', () => {
  const coeurs = coeursDuRegistre(REGISTRE_LIVRES)
  assert.ok(coeurs.length >= 1, 'le registre ne déclare aucun cœur de règles')
  const cadres = coeursDeDomaines()
  for (const coeur of coeurs) {
    // Un cœur du registre SANS domaine au registre des domaines ne s'extrait pas : le dire ICI
    // au lieu de le sauter garde la boucle TOTALE sur les cœurs du registre.
    if (!cadres.includes(coeur)) {
      assert.throws(() => perimetreDeCoeur(coeur, { supplements: true, lot: ['peu-importe'] }), /aucun domaine déclaré/)
      continue
    }
    const lot = [domainesDe(coeur)[0].cle]
    for (const supplements of [true, false]) {
      const { livres, domaines } = perimetreDeCoeur(coeur, { supplements, lot })
      assert.deepEqual(domaines, domainesDe(coeur), `carte des domaines infidèle au cœur ${coeur}`)
      assert.ok(livres.length > 0, `périmètre vide pour le cœur ${coeur} (supplements=${supplements})`)
      assert.ok(livres.some((l) => l.coeur === coeur), `aucun livre de cœur dans le périmètre ${coeur}`)
      assert.deepEqual(livres.filter((l) => !l.language), [], `livres sans langue au périmètre ${coeur}`)
      if (!supplements) assert.deepEqual(livres.filter((l) => l.coeur !== coeur), [], 'un supplement a fui dans `--coeur-seul`')
    }
  }
})
