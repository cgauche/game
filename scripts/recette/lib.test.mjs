// Sonde de la LOGIQUE de survie au rechargement du pipeline de capture (#1196, promue en test
// committé sous #1211) : classification des erreurs CDP (`isNavigationError`) et politique de
// rejeu (`withReloadRetry`). Tests PURS — aucun Chrome, aucun serveur, aucun process : la session
// est un faux objet local. Lancé par `npm run test:recette`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DELAI_EVALUATE,
  checkServer,
  empreinteArbre,
  evaluate,
  expressionRestaurerStockage,
  instantanerStockage,
  isNavigationError,
  restaurerStockage,
  TARGET_NAVIGATED,
  verdictArbreGele,
  verdictArbreServi,
  withReloadRetry,
} from './lib.mjs'
import { ENTETE_RACINE } from '../port-dev.mjs'

/** Session factice : `evaluate` (via `rpc`) répond « app prête » immédiatement, aucun réseau. */
function fakeSession() {
  return {
    contextCleared: false,
    rpc: async () => ({ result: { value: true } }),
  }
}

const err = (message) => new Error(message)

// ---------------------------------------------------------------- classification

test('classification : le code TARGET_NAVIGATED marque l\'erreur rejouable', () => {
  const e = err('message quelconque sans motif reconnu')
  e.code = TARGET_NAVIGATED
  assert.equal(isNavigationError(e), true)
})

for (const message of [
  'Inspected target navigated or closed',
  'Execution context was destroyed.',
  'Cannot find context with specified id',
  'Target closed',
  'Session with given id not found',
  'No target with given id',
]) {
  test(`classification : « ${message} » est rejouable`, () => {
    assert.equal(isNavigationError(err(message)), true)
  })
}

test('classification : casse indifférente (les motifs CDP sont insensibles à la casse)', () => {
  assert.equal(isNavigationError(err('INSPECTED TARGET NAVIGATED OR CLOSED')), true)
})

test('classification : helper de DEV évaporé — lecture sur undefined/null', () => {
  assert.equal(isNavigationError(err("Cannot read properties of undefined (reading 'screen')")), true)
  assert.equal(isNavigationError(err("Cannot read properties of null (reading 'screen')")), true)
})

test('classification : helper de DEV évaporé — window.__wfrp is not a function / undefined', () => {
  assert.equal(isNavigationError(err('window.__wfrp is not a function')), true)
  assert.equal(isNavigationError(err('window.__wfrp is undefined')), true)
})

test('classification : une CHAÎNE nue est classée sur son texte', () => {
  assert.equal(isNavigationError('Execution context was destroyed'), true)
  assert.equal(isNavigationError('bouton introuvable'), false)
})

test('classification : une erreur quelconque n\'est PAS rejouable', () => {
  assert.equal(isNavigationError(err('Condition jamais vraie après 8000ms : document.querySelector(".btn")')), false)
})

test('classification : absence d\'erreur ou message vide — pas rejouable', () => {
  assert.equal(isNavigationError(null), false)
  assert.equal(isNavigationError(undefined), false)
  assert.equal(isNavigationError(err('')), false)
})

// ---------------------------------------------------------------- politique de rejeu

test('withReloadRetry : une erreur rejouable est rejouée `tries` fois puis abandonnée, l\'erreur d\'origine en cause', async () => {
  const session = fakeSession()
  let calls = 0
  const origine = err('Inspected target navigated or closed')
  const retries = []
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, {
      tries: 3, timeoutMs: 100, onRetry: (e, i, n) => { retries.push([i, n]) },
    }),
    (e) => {
      assert.match(e.message, /3 tentatives épuisées/)
      assert.equal(e.cause, origine)
      return true
    },
  )
  assert.equal(calls, 3)
  assert.deepEqual(retries, [[1, 3], [2, 3]])
})

test('withReloadRetry : une erreur NON rejouable remonte telle quelle, AUCUN rejeu', async () => {
  const session = fakeSession()
  let calls = 0
  const origine = err('bouton « Lancer » introuvable')
  let retried = false
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, {
      tries: 3, timeoutMs: 100, onRetry: () => { retried = true },
    }),
    (e) => e === origine,
  )
  assert.equal(calls, 1)
  assert.equal(retried, false)
})

test('withReloadRetry : le succès au 2e essai rend le résultat', async () => {
  const session = fakeSession()
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Execution context was destroyed')
    return 'capture ok'
  }, { tries: 3, timeoutMs: 100 })
  assert.equal(valeur, 'capture ok')
  assert.equal(calls, 2)
})

test('withReloadRetry : `resettle` remet l\'écran entre deux tentatives', async () => {
  const session = fakeSession()
  let calls = 0
  let resettles = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Target closed')
    return 42
  }, { tries: 3, timeoutMs: 100, resettle: () => { resettles++ } })
  assert.equal(valeur, 42)
  assert.equal(resettles, 1)
})

test('withReloadRetry : `contextCleared` déclenche le rejeu même sur une erreur non classée', async () => {
  const session = fakeSession()
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) { session.contextCleared = true; throw err('valeur inattendue : undefined') }
    return 'ok'
  }, { tries: 3, timeoutMs: 100 })
  assert.equal(valeur, 'ok')
  assert.equal(calls, 2)
})

test('withReloadRetry : le succès au 1er essai n\'appelle ni onRetry ni resettle', async () => {
  const session = fakeSession()
  let touched = 0
  const valeur = await withReloadRetry(session, async () => 'direct', {
    tries: 3, timeoutMs: 100, onRetry: () => { touched++ }, resettle: () => { touched++ },
  })
  assert.equal(valeur, 'direct')
  assert.equal(touched, 0)
})

// ------------------------------------------------- arbre servi / arbre gelé (#1679 L1c)

// Racines de sonde ASSEMBLÉES à l'exécution : ce fichier ne porte aucun chemin absolu littéral, il
// reste donc soumis à `src/portable-paths-guard.test.ts` comme le reste de `scripts/**`.
const RACINE_PARENTE = 'C' + ':/Users' + '/x/Foundry/Game'
const RACINE_SONDE = RACINE_PARENTE + '/.wt-1679'
const entete = (racine) => encodeURIComponent(racine.toLowerCase())
/** Motif d'un chemin cité par le refus : les `/` y sont échappés comme dans le message rendu. */
const motifChemin = (chemin) => chemin.toLowerCase().split('/').join('\\/')

test('arbre servi : en-tête ABSENT = refus (fail-closed, jamais un silence)', () => {
  const refus = verdictArbreServi(undefined, RACINE_SONDE)
  assert.match(refus, /ne publie pas l'en-tête/)
  assert.match(refus, /x-wfrp-racine/)
})

test('arbre servi : racine servie ≠ cwd = refus NOMMANT les deux arbres', () => {
  const refus = verdictArbreServi(entete(RACINE_PARENTE), RACINE_SONDE)
  assert.match(refus, /Arbre SERVI ≠ arbre courant/)
  assert.match(refus, new RegExp('sert « ' + motifChemin(RACINE_PARENTE) + ' »'))
  assert.match(refus, new RegExp('tourne dans\\s+« ' + motifChemin(RACINE_SONDE).replace('.wt', '\\.wt') + ' »'))
})

test('arbre servi : MÊME arbre écrit autrement (casse, backslash, slash final) = accepté', () => {
  const enWindows = ['C:', 'Users', 'x', 'Foundry', 'Game', '.wt-1679', ''].join(String.fromCharCode(92))
  assert.equal(verdictArbreServi(entete(RACINE_SONDE), enWindows), null)
  assert.equal(verdictArbreServi(encodeURIComponent(RACINE_SONDE.toUpperCase()), RACINE_SONDE), null)
})

test('checkServer : un serveur qui sert un AUTRE arbre est REFUSÉ (aucune session ouverte)', async () => {
  const recuperer = async () => ({
    ok: true,
    status: 200,
    headers: { get: (nom) => (nom === ENTETE_RACINE ? entete(RACINE_PARENTE) : null) },
  })
  await assert.rejects(
    () => checkServer('http://localhost:5173/', { recuperer, racineCourante: RACINE_SONDE }),
    (e) => /Arbre SERVI ≠ arbre courant/.test(e.message) && /URL interrogée/.test(e.message),
  )
})

test('checkServer : le serveur de CET arbre passe', async () => {
  const recuperer = async () => ({ ok: true, status: 200, headers: { get: () => entete(RACINE_SONDE) } })
  await checkServer('http://localhost:5210/', { recuperer, racineCourante: RACINE_SONDE })
})

test('empreinte : le fichier le plus RÉCENT et le cardinal sont relevés', () => {
  const fichiers = [
    { chemin: 'src/a.ts', mtimeMs: 10 },
    { chemin: 'src/b.ts', mtimeMs: 42 },
    { chemin: 'vite.config.ts', mtimeMs: 5 },
  ]
  assert.deepEqual(empreinteArbre('/peu importe', () => fichiers), {
    nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts',
  })
})

test('arbre gelé : mtime IDENTIQUE = aucun verdict', () => {
  const e = { nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' }
  assert.equal(verdictArbreGele(e, { ...e }), null)
})

test('arbre gelé : un mtime qui bouge NOMME le fichier', () => {
  const avant = { nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' }
  const apres = { nb: 3, mtimeMax: 99, plusRecent: 'src/ui/RollShell.tsx' }
  const verdict = verdictArbreGele(avant, apres)
  assert.match(verdict, /L'arbre a été modifié pendant la recette/)
  assert.match(verdict, /src\/ui\/RollShell\.tsx/)
})

test('arbre gelé : un fichier AJOUTÉ à mtime inchangé est vu aussi', () => {
  const verdict = verdictArbreGele(
    { nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' },
    { nb: 4, mtimeMax: 42, plusRecent: 'src/b.ts' },
  )
  assert.match(verdict, /1 fichier\(s\) ajouté\(s\)/)
})

test('withReloadRetry : arbre MODIFIÉ pendant la recette = échec nommé, AUCUN rejeu', async () => {
  const session = fakeSession()
  let calls = 0
  let mesures = 0
  const empreinte = () => ({ nb: 3, mtimeMax: mesures++ === 0 ? 42 : 99, plusRecent: 'src/ui/RollShell.tsx' })
  const origine = err('Execution context was destroyed')
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, { tries: 3, timeoutMs: 100, empreinte }),
    (e) => {
      assert.match(e.message, /L'arbre a été modifié pendant la recette/)
      assert.match(e.message, /src\/ui\/RollShell\.tsx/)
      assert.equal(e.cause, origine)
      return true
    },
  )
  assert.equal(calls, 1, 'le rejeu ne doit PAS avoir lieu sur un arbre qui a bougé')
})

test('withReloadRetry : arbre GELÉ — le rejeu garde son comportement', async () => {
  const session = fakeSession()
  const empreinte = () => ({ nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' })
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Target closed')
    return 'ok'
  }, { tries: 3, timeoutMs: 100, empreinte })
  assert.equal(valeur, 'ok')
  assert.equal(calls, 2)
})

// ------------------------------------------------- évaluation bornée (#1679 L1c)

test('evaluate : une expression qui ne rend jamais la main REJETTE au lieu de figer', async () => {
  const session = { rpc: () => new Promise(() => {}) } // jamais résolue : la page est bloquée
  const debut = Date.now()
  await assert.rejects(
    () => evaluate(session, 'while (true) {}', { timeoutMs: 30, margeMs: 30 }),
    (e) => {
      assert.match(e.message, /n'a pas rendu la main en 60ms/)
      assert.match(e.message, /while \(true\)/)
      return true
    },
  )
  assert.ok(Date.now() - debut < 2000, 'le rejet tombe au délai, pas au bout du gel historique')
})

test('evaluate : le plafond est PASSÉ à la page (paramètre timeout du CDP)', async () => {
  const vus = []
  const session = { rpc: async (methode, params) => { vus.push([methode, params]); return { result: { value: 7 } } } }
  assert.equal(await evaluate(session, '1 + 6', { timeoutMs: 1234 }), 7)
  assert.equal(vus[0][0], 'Runtime.evaluate')
  assert.equal(vus[0][1].timeout, 1234)
})

test('evaluate : sans plafond explicite, le défaut du kit est appliqué', async () => {
  const vus = []
  const session = { rpc: async (m, p) => { vus.push(p); return { result: { value: true } } } }
  await evaluate(session, 'true')
  assert.equal(vus[0].timeout, DELAI_EVALUATE)
})

// ------------------------------------------------- état persistant (#1679 L1c)

test('stockage : l\'instantané est relu depuis la page, les deux zones', async () => {
  const session = {
    rpc: async () => ({ result: { value: { local: { save1: '{"a":1}' }, session: { onglet: 'combat' } } } }),
  }
  assert.deepEqual(await instantanerStockage(session), {
    local: { save1: '{"a":1}' }, session: { onglet: 'combat' },
  })
})

test('stockage : l\'expression de restauration VIDE puis repose chaque clé des deux zones', () => {
  const expr = expressionRestaurerStockage({ local: { save1: 'x' }, session: { onglet: 'combat' } })
  assert.match(expr, /localStorage/)
  assert.match(expr, /sessionStorage/)
  assert.match(expr, /zone\.clear\(\)/)
  assert.match(expr, /zone\.setItem\(k, v\)/)
  assert.match(expr, /"save1":"x"/)
  assert.match(expr, /"onglet":"combat"/)
})

test('stockage : un instantané VIDE vide les deux zones (aucun résidu de recette)', () => {
  const expr = expressionRestaurerStockage({ local: {}, session: {} })
  assert.match(expr, /zone\.clear\(\)/)
  assert.match(expr, /"local":\{\}/)
})

test('stockage : restaurerStockage envoie CETTE expression à la page', async () => {
  const vus = []
  const session = { rpc: async (m, p) => { vus.push(p.expression); return { result: { value: true } } } }
  const instantane = { local: { save1: 'x' }, session: {} }
  await restaurerStockage(session, instantane)
  assert.equal(vus[0], expressionRestaurerStockage(instantane))
})

test('evaluate : un plafond ATTEINT côté navigateur est requalifié (le CDP rend « Internal error » nu)', async () => {
  const session = { rpc: () => new Promise((_, rejeter) => setTimeout(() => rejeter(err('Internal error')), 40)) }
  await assert.rejects(
    () => evaluate(session, 'while (true) {}', { timeoutMs: 30, margeMs: 5000 }),
    (e) => {
      assert.match(e.message, /n'a pas rendu la main en 30ms/)
      assert.match(e.message, /le navigateur a rendu : Internal error/)
      return true
    },
  )
})

test('evaluate : une erreur de scénario AVANT le plafond remonte telle quelle', async () => {
  const origine = err('ReferenceError: machin is not defined')
  const session = { rpc: async () => { throw origine } }
  await assert.rejects(() => evaluate(session, 'machin', { timeoutMs: 5000 }), (e) => e === origine)
})
