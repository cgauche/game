// L'ASSEMBLEUR des fiches de l'Atlas, côté CŒUR (#1825 lot E2).
// Ce qu'il doit tenir : l'en-tête d'une fiche NOMME le cœur de règles REÇU (jamais une édition
// écrite en dur), le cœur ne se devine pas, et l'assembleur REFUSE d'écrire sur une fiche existante
// qui synthétise un AUTRE corps de règles — écraser perdrait l'autre, fusionner produirait la fiche
// à deux cœurs que `raw:reconcile` fait rougir. OÙ vit la fiche d'un second cœur n'est pas tranché
// ici : l'assembleur refuse, il ne route pas.
// Le sigle RÉEL vient du registre par `sigleDeCoeur` — aucun livre nommé dans ce banc.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BOOKS, coeurDe, coeursDe, livresDeCoeur, REGISTRE_LIVRES, sigleDeCoeur } from './_lib.mjs'
import { coeursCites, coeurDuRendu, refuserSiAutreCoeur } from './assemble-domain.mjs'

const COEURS = coeursDe(REGISTRE_LIVRES)
/** Deux livres de cœurs DIFFÉRENTS, pris au registre par leur RÉGIME — jamais par leur nom. */
const deuxCoeurs = () => {
  const vus = new Map()
  for (const [abbr] of livresDeCoeur(BOOKS, COEURS)) {
    const c = coeurDe(abbr, COEURS)
    if (!vus.has(c)) vus.set(c, abbr)
  }
  return [...vus] // [[coeur, abbr], …]
}

test('coeursCites : les cœurs qu’un texte de fiche cite, par ses mentions de chapitre', () => {
  const [[coeurA, abbrA]] = deuxCoeurs()
  assert.deepEqual(coeursCites(`voir \`${abbrA} 12 l.30\` pour la règle`), [coeurA])
  assert.deepEqual(coeursCites('aucune référence ici'), [])
})

test('coeurDuRendu : LÈVE en nommant la cause quand l’entrée ne porte pas son cœur', () => {
  assert.throws(() => coeurDuRendu({ domain: 'x' }, {}, 'sortie.json'), /sortie\.json ne porte pas son `coeur`/)
  assert.throws(() => coeurDuRendu({ domain: 'x', coeur: '' }, {}), /ne porte pas son `coeur`/)
})

test('coeurDuRendu : le cœur du domaine l’emporte, sinon celui de la racine du rendu', () => {
  assert.equal(coeurDuRendu({ coeur: 'du-domaine' }, { coeur: 'de-la-racine' }), 'du-domaine')
  assert.equal(coeurDuRendu({}, { coeur: 'de-la-racine' }), 'de-la-racine')
})

test('refuserSiAutreCoeur : REFUSE une fiche existante d’un AUTRE cœur, en nommant fiche et cœurs', () => {
  const paires = deuxCoeurs()
  if (paires.length < 2) return // registre à un seul cœur : rien à mesurer
  const [[coeurA, abbrA], [coeurB]] = paires
  const dir = mkdtempSync(join(tmpdir(), 'assemble-domain-'))
  try {
    const path = join(dir, 'fiche.md')
    writeFileSync(path, `# Fiche\n\nrègle — \`${abbrA} 12 l.30\`\n`, 'utf8')
    assert.throws(() => refuserSiAutreCoeur(path, coeurB), new RegExp(`cite déjà le\\(s\\) cœur\\(s\\) ${coeurA}.*porte le cœur ${coeurB}`, 's'))
    // Même cœur : aucun refus. Fiche absente : aucun refus (c'est une création).
    refuserSiAutreCoeur(path, coeurA)
    refuserSiAutreCoeur(join(dir, 'jamais-ecrite.md'), coeurB)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('refuserSiAutreCoeur : une fiche qui ne cite QUE des suppléments ne bloque aucun cœur', () => {
  const dir = mkdtempSync(join(tmpdir(), 'assemble-domain-'))
  try {
    const supplement = BOOKS.map(([a]) => a).find((a) => !coeurDe(a, COEURS))
    assert.ok(supplement, 'le registre ne porte aucun supplément extrait — le cas n’est pas mesuré')
    const path = join(dir, 'fiche.md')
    writeFileSync(path, `# Fiche\n\nrègle — \`${supplement} 3 l.10\`\n`, 'utf8')
    refuserSiAutreCoeur(path, coeurDe(sigleDeCoeur(), COEURS))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
