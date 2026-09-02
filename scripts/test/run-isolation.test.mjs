// ISOLATION entre arbres et entre sessions (#1679 L1c), deux décisions prises avant tout
// lancement :
//   · refus d'un outillage NON LOCAL (`scripts/test/run.mjs`, `scripts/typecheck-fast.mjs`) — la
//     vérification juge le FICHIER que l'appelant va jouer, jamais une résolution de module (qui,
//     elle, remonte les arbres) ;
//   · verrou de SUITE à l'échelle de la machine (`scripts/test/run.mjs`) — une seule suite
//     complète à la fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { prendreVerrou, verrouRequis } from './verrou.mjs'

test('entrée absente de l’arbre : refus qui NOMME l’arbre, l’outil et la cause', () => {
  const refus = refusOutillageLocal('/arbres/.wt-42', 'vitest', '/arbres/.wt-42/node_modules/vitest/vitest.mjs', () => false)
  assert.ok(refus, 'une entrée absente doit être refusée')
  assert.match(refus, /vitest/)
  assert.match(refus, /\/arbres\/\.wt-42/)
  assert.match(refus, /AUTRE arbre/)
})

test('entrée présente : aucun refus, et la présence se juge sur CE fichier', () => {
  const entree = '/arbres/.wt-42/node_modules/typescript/bin/tsc'
  const vus = []
  const refus = refusOutillageLocal('/arbres/.wt-42', 'tsc', entree, (p) => {
    vus.push(p)
    return true
  })
  assert.equal(refus, null)
  assert.deepEqual(vus, [entree])
})

test('une entrée présente AILLEURS ne vaut pas présence dans l’arbre', () => {
  const entree = '/arbres/.wt-42/node_modules/vitest/vitest.mjs'
  const refus = refusOutillageLocal('/arbres/.wt-42', 'vitest', entree, (p) => p !== entree)
  assert.ok(refus, 'seul le fichier attendu compte')
})

// ── quels runs prennent le verrou ───────────────────────────────────────────────
const FICHIERS = new Set(['src/engine/x.test.ts', 'src/ui/y.test.tsx'])
const estFichier = (t) => FICHIERS.has(t)

test('run SANS filtre : verrou REQUIS', () => {
  assert.equal(verrouRequis([], estFichier), true)
})

test('filtre-DOSSIER : verrou REQUIS — `npm test src` énumère la suite entière', () => {
  assert.equal(verrouRequis(['src'], estFichier), true)
  assert.equal(verrouRequis(['.'], estFichier), true)
  assert.equal(verrouRequis(['src/engine'], estFichier), true)
})

test('filtres-FICHIERS : verrou LIBRE, même à plusieurs', () => {
  assert.equal(verrouRequis(['src/engine/x.test.ts'], estFichier), false)
  assert.equal(verrouRequis(['src/engine/x.test.ts', 'src/ui/y.test.tsx'], estFichier), false)
})

test('un seul filtre-DOSSIER parmi des fichiers suffit à exiger le verrou', () => {
  assert.equal(verrouRequis(['src/engine/x.test.ts', 'src'], estFichier), true)
})

// ── verrou de SUITE à l'échelle machine (#1679 L1c-M7) ────────────────────────────────────────
// `fs` factice : un seul fichier, `openSync('wx')` refusant une cible déjà présente — la propriété
// d'exclusion sur laquelle repose le verrou.
function fsFactice(present = null) {
  const boite = { contenu: present }
  return {
    boite,
    openSync(_chemin, mode) {
      if (mode === 'wx' && boite.contenu !== null) {
        const e = new Error('EEXIST')
        e.code = 'EEXIST'
        throw e
      }
      boite.contenu = ''
      return 7
    },
    writeSync(_fd, texte) {
      boite.contenu = texte
    },
    closeSync() {},
    readFileSync() {
      if (boite.contenu === null) throw new Error('ENOENT')
      return boite.contenu
    },
    rmSync() {
      boite.contenu = null
    },
  }
}

test('verrou libre : pris, le tenant s’inscrit, et `liberer` rend la place', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    env: {},
    fs,
    estVivant: () => true,
    maintenant: () => '2026-09-02T00:00:00.000Z',
  })
  assert.equal(pris.etat, 'pris')
  assert.deepEqual(JSON.parse(fs.boite.contenu), {
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    date: '2026-09-02T00:00:00.000Z',
  })
  pris.liberer()
  assert.equal(fs.boite.contenu, null)
})

test('verrou tenu par un PID VIVANT : refus qui NOMME le PID, la commande et l’arbre', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234, commande: 'node scripts/test/run.mjs', cwd: '/arbres/Game' }))
  const vus = []
  const refus = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 4242,
    env: {},
    fs,
    estVivant: (p) => {
      vus.push(p)
      return true
    },
  })
  assert.equal(refus.etat, 'refus')
  assert.deepEqual(vus, [1234])
  assert.match(refus.message, /1234/)
  assert.match(refus.message, /node scripts\/test\/run\.mjs/)
  assert.match(refus.message, /\/arbres\/Game/)
  assert.match(refus.message, /WFRP_SUITE_LOCK=0/)
  // Le verrou de l'autre suite reste INTACT : le refus ne vole la place de personne.
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234)
})

test('verrou laissé par un PID MORT : repris, sans refus', () => {
  const fs = fsFactice(JSON.stringify({ pid: 999, commande: 'node scripts/test/run.mjs' }))
  const pris = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 4242,
    env: {},
    fs,
    estVivant: () => false,
    maintenant: () => '2026-09-02T00:00:00.000Z',
  })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('verrou ILLISIBLE (écriture interrompue) : repris, aucun PID à interroger', () => {
  const fs = fsFactice('{pas du json')
  const pris = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 4242, env: {}, fs, estVivant: () => true })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('opt-out WFRP_SUITE_LOCK=0 : verrou IGNORÉ, mais l’avertissement le dit', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234 }))
  const hors = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    env: { WFRP_SUITE_LOCK: '0' },
    fs,
    estVivant: () => true,
  })
  assert.equal(hors.etat, 'ignore')
  assert.match(hors.avertissement, /WFRP_SUITE_LOCK=0/)
  assert.equal(hors.liberer, undefined)
  // Aucun fichier touché : l'opt-out ne dérange pas la suite qui tient le verrou.
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234)
})
