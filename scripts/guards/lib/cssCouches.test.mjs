// Le PARSEUR des trois couches CSS (#1800, `node --test` — joué par `npm run test:hooks`) : ce qu'il
// rend, et ce qu'il refuse d'abriter ; puis la PARTITION stock / exempté et la VENTILATION d'une
// décrue (#1806). Aucun disque : chaque cas est une fixture de texte. La MESURE sur le corpus réel se
// prouve ailleurs (`src/ui/ui-ratchets.test.ts`, cliquets (xxi)/(xxii)).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CHEMIN_COUCHES, declarations, decoupeSelecteurs, estPlacement, FEUILLE_LAYOUT, FEUILLES_PARTAGEES,
  feuillesPartageesDe, ligneDeVentilation, manifesteDe, moduleHorsCouche, partitionCss, reglesCss,
  prixDuReclassement, revendicationsArmees, valeurHorsEchelle, ventilerDecrue,
} from './cssCouches.mjs'

test('reglesCss : règle de premier niveau — sélecteurs séparés, corps rendu, media nul', () => {
  assert.deepEqual(reglesCss('.a, .b > .c { color: red; gap: 4px }'), [
    { selecteurs: ['.a', '.b > .c'], corps: ' color: red; gap: 4px ', media: null },
  ])
})

test('reglesCss : blocs IMBRIQUÉS — le contexte at-rule est empilé, rendu, et n’abrite rien', () => {
  const regles = reglesCss('@media (a) { @supports (b) { .x { color: red } } } @keyframes k { from { color: red } }')
  assert.equal(regles.length, 1)
  assert.deepEqual(regles[0].selecteurs, ['.x'])
  assert.equal(regles[0].media, '@media (a) && @supports (b)')
})

test('reglesCss : @keyframes / @font-face sautés en BLOC (leur corps n’est pas fait de sélecteurs)', () => {
  assert.deepEqual(
    reglesCss('@keyframes p { 0%, 100% { opacity: 0.5 } 50% { opacity: 1 } } .z { color: red }'),
    [{ selecteurs: ['.z'], corps: ' color: red ', media: null }],
  )
  assert.deepEqual(reglesCss('@font-face { font-family: X; src: url(a.woff) }'), [])
})

test('reglesCss : un commentaire ne déclare rien, un prélude at-rule n’est jamais un sélecteur', () => {
  assert.deepEqual(reglesCss('/* .faux { color: red } */ .vrai { gap: 0 }').map((r) => r.selecteurs), [['.vrai']])
  assert.deepEqual(reglesCss('@media (max-width: 700px) { .x { gap: 0 } }')[0].selecteurs, ['.x'])
})

test('reglesCss : une at-rule DÉCLARATION se clôt sur son `;` et ne colle pas à la règle suivante', () => {
  const apresImport = reglesCss('@import "a.css"; .x { color: red }')
  assert.deepEqual(apresImport, [{ selecteurs: ['.x'], corps: ' color: red ', media: null }])
  const apresCharset = reglesCss('@charset "u"; @media (max-width:700px) { .x { color: red } }')
  assert.equal(apresCharset.length, 1)
  assert.equal(apresCharset[0].media, '@media (max-width:700px)')
})

test('reglesCss : une accolade CITÉE dans une valeur ne ferme pas le bloc', () => {
  assert.deepEqual(reglesCss(".a::after { content: '}' } .b { color: red }").map((r) => r.selecteurs), [['.a::after'], ['.b']])
})

test('declarations : sépare sur les `;` de premier niveau seulement', () => {
  assert.deepEqual(declarations('padding: 0 max(12px, env(safe-area-inset-left)); color: red;'), [
    { prop: 'padding', valeur: '0 max(12px, env(safe-area-inset-left))' },
    { prop: 'color', valeur: 'red' },
  ])
  assert.deepEqual(declarations('  ;  '), [])
})

test('estPlacement : la liste FERMÉE place, tout le reste PEINT', () => {
  for (const p of ['display', 'flex', 'flex-direction', 'grid-template-columns', 'gap', 'padding-left',
    'margin-inline-start', 'min-width', 'max-height', 'overflow-y', 'position', 'z-index', 'text-align',
    'white-space', 'list-style', 'touch-action', 'user-select', 'transform', '--ma-var',
    'contain', 'container', 'container-type', 'container-name']) {
    assert.equal(estPlacement(p), true, `${p} PLACE`)
  }
  for (const p of ['color', 'background', 'border', 'border-color', 'border-radius', 'box-shadow',
    'font-size', 'font-weight', 'opacity', 'cursor', 'transition', 'filter', 'line-height']) {
    assert.equal(estPlacement(p), false, `${p} PEINT`)
  }
})

test('valeurHorsEchelle : un littéral de longueur NON NUL, et rien d’autre', () => {
  for (const v of ['10px', '0 10px', '1.5rem', '0 max(12px, env(safe-area-inset-left))', '8px 10px']) {
    assert.equal(valeurHorsEchelle(v), true, v)
  }
  for (const v of ['0', 'auto', '0 auto', 'var(--sp-md)', 'calc(3 * var(--sp-md))', '50%', '2vw', '0px']) {
    assert.equal(valeurHorsEchelle(v), false, v)
  }
})

test('reglesCss : une virgule DANS `:has()`/`:is()` ne coupe pas la liste (#1806)', () => {
  const regles = reglesCss('label:has(> a, > .btn) { color: red }')
  assert.deepEqual(regles[0].selecteurs, ['label:has(> a, > .btn)'])
  // Les virgules de NIVEAU 0 séparent toujours, y compris autour d'un sélecteur à parenthèses.
  assert.deepEqual(reglesCss('.a:is(.x, .y), .b[data-k="1,2"] { color: red }')[0].selecteurs, [
    '.a:is(.x, .y)',
    '.b[data-k="1,2"]',
  ])
})

test('decoupeSelecteurs : niveau 0 seulement, espaces réduits, vides écartés', () => {
  assert.deepEqual(decoupeSelecteurs('  .a ,  .b:not(.c, .d) , '), ['.a', '.b:not(.c, .d)'])
})

test('moduleHorsCouche : `src/ui/styles/`, ou la zone du `fichier` hors de `src/ui` (#1806 A3)', () => {
  assert.equal(moduleHorsCouche('src/ui/RollShell.tsx', 'src/ui/styles/roll-shell.css'), false)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/anim.css'), false)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/ui/styles/hud.css'), false)
  // Une primitive de `src/ui` ne colocalise pas sa feuille ; une autre ne sort pas de SA zone.
  assert.equal(moduleHorsCouche('src/ui/RollShell.tsx', 'src/ui/RollShell.css'), true)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/state/anim.css'), true)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/anim.ts'), true)
})

// ── Partition et ventilation (#1806) ─────────────────────────────────────────────────────────────

const ECRAN = 'src/ui/styles/ecran.css'
const PRIMITIVE = 'src/ui/styles/prim.css'
/** Image fixture : `feuilles` = `{ chemin: texte }`, `revendiques` = les chemins que le manifeste revendique. */
const image = (feuilles, revendiques = [], partagees = FEUILLES_PARTAGEES) => ({
  fichiers: Object.entries(feuilles).map(([rel, text]) => ({ rel, text })),
  manifeste: [{ id: 'sans-css' }, ...revendiques.map((css, i) => ({ id: `p${i}`, css }))],
  partagees,
})
/** Les nombres d'un volet, sans ses bornes. */
const nombres = ({ deltaStock, deltaExempte, entre, disparu, reclasse, primitivise }) =>
  ({ deltaStock, deltaExempte, entre, disparu, reclasse, primitivise })

test('partition : écran et layout au stock (identité ET espacement), primitive et partagée exemptées', () => {
  const p = partitionCss(image({
    [ECRAN]: '.e { color: red; gap: 3px }',
    [PRIMITIVE]: '.p { color: red; gap: 3px }',
    'src/ui/styles/base.css': '.b { color: red }',
    [FEUILLE_LAYOUT]: '.l { color: red; gap: 3px }',
  }, [PRIMITIVE]))
  assert.deepEqual(p.stock.identite.map((s) => s.file), [ECRAN, FEUILLE_LAYOUT])
  assert.deepEqual(p.stock.espacement.map((s) => s.file), [ECRAN, FEUILLE_LAYOUT])
  assert.deepEqual(p.exempte.identite.map((s) => s.file), [PRIMITIVE, 'src/ui/styles/base.css'])
  assert.deepEqual(p.exempte.espacement.map((s) => s.file), [PRIMITIVE])
})

test('ventilation : RECLASSEMENT pur — Δstock −k, Δexempté +k → entré k, disparu 0, revendication nommée au prix k', () => {
  const css = '.e { color: red; border: 0; gap: 3px }'
  const v = ventilerDecrue(image({ [ECRAN]: css }), image({ [ECRAN]: css }, [ECRAN]))
  assert.deepEqual(nombres(v.identite), { deltaStock: -2, deltaExempte: 2, entre: 2, disparu: 0, reclasse: 2, primitivise: 0 })
  assert.deepEqual(nombres(v.espacement), { deltaStock: -1, deltaExempte: 1, entre: 1, disparu: 0, reclasse: 1, primitivise: 0 })
  assert.deepEqual(v.revendications, [{ module: ECRAN, identite: 2, espacement: 1, n: 3 }])
})

test('ventilation : SOLDE pur — la matière disparaît, rien n’entre en zone exempte', () => {
  const v = ventilerDecrue(image({ [ECRAN]: '.e { color: red; border: 0; gap: 3px }' }), image({ [ECRAN]: '.e { gap: var(--sp-md) }' }))
  assert.deepEqual(nombres(v.identite), { deltaStock: -2, deltaExempte: 0, entre: 0, disparu: 2, reclasse: 0, primitivise: 0 })
  assert.deepEqual(nombres(v.espacement), { deltaStock: -1, deltaExempte: 0, entre: 0, disparu: 1, reclasse: 0, primitivise: 0 })
  assert.deepEqual(v.revendications, [])
})

test('ventilation : PRIMITIVISATION — la déclaration passe au module déjà revendiqué et déjà peint, entrée sans reclassement', () => {
  const v = ventilerDecrue(
    image({ [ECRAN]: '.e { color: red }', [PRIMITIVE]: '.p { border: 0 }' }, [PRIMITIVE]),
    image({ [ECRAN]: '.e { display: flex }', [PRIMITIVE]: '.p { border: 0; color: red }' }, [PRIMITIVE]),
  )
  assert.deepEqual(nombres(v.identite), { deltaStock: -1, deltaExempte: 1, entre: 1, disparu: 0, reclasse: 0, primitivise: 1 })
  assert.deepEqual(v.revendications, [])
})

test('ventilation : RENOMMAGE de sélecteur et RÉÉCRITURE de valeur sont neutres', () => {
  const avant = image({ [ECRAN]: '.x { color: red; gap: 3px }' })
  for (const apres of ['.y { color: red; gap: 3px }', '.x { color: blue; gap: 5px }']) {
    const v = ventilerDecrue(avant, image({ [ECRAN]: apres }))
    assert.deepEqual(nombres(v.identite), { deltaStock: 0, deltaExempte: 0, entre: 0, disparu: 0, reclasse: 0, primitivise: 0 }, apres)
    assert.deepEqual(nombres(v.espacement), { deltaStock: 0, deltaExempte: 0, entre: 0, disparu: 0, reclasse: 0, primitivise: 0 }, apres)
  }
})

// ── Revendications ARMÉES, lecteurs d'image, trois nombres (#1806, juge de diff du 2026-09-23) ─────

const STUB = 'src/ui/styles/stub.css'
const PEINT = '.e { color: red; border: 0; font-size: 3px; gap: 3px }'
/** Côté d'une image pour `revendicationsArmees` : manifeste, feuilles partagées, lecteur de texte. */
const cote = (feuilles, revendiques = [], partagees = FEUILLES_PARTAGEES) => {
  const img = image(feuilles, revendiques, partagees)
  const textes = new Map(img.fichiers.map((f) => [f.rel, f.text]))
  return { manifeste: img.manifeste, partagees, lire: (f) => textes.get(f) ?? null }
}

test('armée : revendication NEUVE qui retire des sites — N par volet, mesuré à la tête', () => {
  assert.deepEqual(revendicationsArmees(cote({ [ECRAN]: PEINT }), cote({ [ECRAN]: PEINT }, [ECRAN]), []),
    [{ module: ECRAN, identite: 3, espacement: 1, n: 4 }])
})

test('armée : revendication VIDE posée d’abord, module versé ensuite — le second geste arme (T1)', () => {
  const t0 = cote({ [ECRAN]: PEINT })
  const t1 = cote({ [ECRAN]: PEINT }, [STUB])
  const t2 = cote({ [STUB]: PEINT }, [STUB])
  assert.deepEqual(revendicationsArmees(t0, t1, []), [], 'commit 1 : N = 0, rien ne sort')
  assert.deepEqual(revendicationsArmees(t1, t2, [ECRAN, STUB]), [{ module: STUB, identite: 3, espacement: 1, n: 4 }], 'commit 2 : 0 site à la base → armée')
  assert.deepEqual(revendicationsArmees(t0, t2, [ECRAN, STUB]), [{ module: STUB, identite: 3, espacement: 1, n: 4 }], 'cumul : même fonction, même N')
})

test('armée : un module DÉJÀ revendiqué et déjà peint à la base ne s’arme pas — la matière qui y entre est PRIMITIVISÉE', () => {
  assert.deepEqual(revendicationsArmees(cote({ [PRIMITIVE]: '.p { color: red }' }, [PRIMITIVE]), cote({ [PRIMITIVE]: PEINT }, [PRIMITIVE]), [PRIMITIVE]), [])
})

test('armée : une feuille ENTRÉE en FEUILLES_PARTAGEES est une revendication comme une autre (T2) ; layout n’en est pas une', () => {
  const avant = cote({ [ECRAN]: PEINT })
  assert.deepEqual(revendicationsArmees(avant, cote({ [ECRAN]: PEINT }, [], [...FEUILLES_PARTAGEES, ECRAN]), [CHEMIN_COUCHES]),
    [{ module: ECRAN, identite: 3, espacement: 1, n: 4 }])
  const sansLayout = FEUILLES_PARTAGEES.filter((f) => f !== FEUILLE_LAYOUT)
  assert.deepEqual(revendicationsArmees(cote({ [FEUILLE_LAYOUT]: PEINT }, [], sansLayout), cote({ [FEUILLE_LAYOUT]: PEINT }), [CHEMIN_COUCHES]), [])
})

test('armée : `touches` restreint la lecture sans changer le verdict — un module intouché et déjà revendiqué ne s’arme jamais', () => {
  const lus = []
  const base = cote({ [PRIMITIVE]: '' }, [PRIMITIVE])
  const tete = cote({ [PRIMITIVE]: '', [STUB]: PEINT }, [PRIMITIVE, STUB])
  const espion = { ...tete, lire: (f) => { lus.push(f); return tete.lire(f) } }
  assert.deepEqual(revendicationsArmees(base, espion, [STUB]), revendicationsArmees(base, tete, [PRIMITIVE, STUB]))
  assert.deepEqual(lus, [STUB], 'la revendication neuve est lue, le module intouché ne l’est pas')
})

test('feuillesPartageesDe : lit la liste dans le TEXTE de cssCouches.mjs ; absent → [] ; illisible → refus nommé', () => {
  const texte = readFileSync(new URL('./cssCouches.mjs', import.meta.url), 'utf8')
  assert.equal(CHEMIN_COUCHES, 'scripts/guards/lib/cssCouches.mjs')
  assert.deepEqual(feuillesPartageesDe(texte), [...FEUILLES_PARTAGEES])
  assert.deepEqual(feuillesPartageesDe(null), [])
  assert.throws(() => feuillesPartageesDe('export const AUTRE = []'), /FEUILLES_PARTAGEES/)
})

test('manifesteDe : UN lecteur — absent → [], JSON invalide ou non-tableau → refus nommé, jamais [] silencieux', () => {
  assert.deepEqual(manifesteDe(null), [])
  assert.deepEqual(manifesteDe('[{"id":"a"}]'), [{ id: 'a' }])
  assert.throws(() => manifesteDe('[{"id":'), /primitives\.manifest\.json/)
  assert.throws(() => manifesteDe('{"id":"a"}'), /primitives\.manifest\.json/)
})

test('ventilation : matière NEUVE en zone exempte → APPARU, jamais « DISPARU -2 » ; écran → layout reste au stock', () => {
  const neuf = ventilerDecrue(image({ [PRIMITIVE]: '.p { border: 0 }' }, [PRIMITIVE]), image({ [PRIMITIVE]: '.p { border: 0; color: red; outline: 0 }' }, [PRIMITIVE]))
  assert.equal(neuf.identite.disparu, -2)
  assert.match(ligneDeVentilation('identité', neuf.identite), /APPARU 2/)
  assert.doesNotMatch(ligneDeVentilation('identité', neuf.identite), /DISPARU/)
  const versLayout = ventilerDecrue(image({ [ECRAN]: '.e { color: red; border: 0 }', [FEUILLE_LAYOUT]: '' }), image({ [ECRAN]: '', [FEUILLE_LAYOUT]: '.e { color: red; border: 0 }' }))
  assert.deepEqual(nombres(versLayout.identite), { deltaStock: 0, deltaExempte: 0, entre: 0, disparu: 0, reclasse: 0, primitivise: 0 })
})

test('ventilation : TROIS nombres — RECLASSÉ = min(prix du volet, ENTRÉ), PRIMITIVISÉ = ENTRÉ − RECLASSÉ', () => {
  const v = ventilerDecrue(
    image({ [ECRAN]: PEINT, [PRIMITIVE]: '.p { border: 0 }', 'src/ui/styles/autre.css': '.a { color: red }' }, [PRIMITIVE]),
    image({ [ECRAN]: PEINT, [PRIMITIVE]: '.p { border: 0; color: red }', 'src/ui/styles/autre.css': '' }, [PRIMITIVE, ECRAN]),
  )
  assert.deepEqual(nombres(v.identite), { deltaStock: -4, deltaExempte: 4, entre: 4, disparu: 0, reclasse: 3, primitivise: 1 })
  const ligne = ligneDeVentilation('identité', v.identite)
  assert.match(ligne, /DISPARU 0 · RECLASSÉ 3 · PRIMITIVISÉ 1/)
})

test('prix : min(Σ N des armés, baisse du stock) par volet — N ne se paie que s’il a quitté le stock (juge 2026-09-23)', () => {
  const avant = cote({ [ECRAN]: '.e { color: red }' })
  const tete = cote({ [ECRAN]: PEINT }, [ECRAN])
  const prix = prixDuReclassement(avant, tete, [ECRAN])
  assert.deepEqual({ identite: prix.identite, espacement: prix.espacement, n: prix.n }, { identite: 1, espacement: 0, n: 1 })
  assert.deepEqual(prix.deltaStock, { identite: -1, espacement: 0 })
  assert.equal(prixDuReclassement(cote({}), cote({ [ECRAN]: PEINT }, [ECRAN]), [ECRAN]).n, 0, 'module neuf avec son CSS neuf : le stock ne baisse pas')
})

test('ventilation : primitive NEUVE avec son CSS neuf → APPARU, RECLASSÉ 0, PRIMITIVISÉ 0 — aucun nombre négatif (juge 2026-09-23, écart 1)', () => {
  const v = ventilerDecrue(image({}), image({ [PRIMITIVE]: '.p { color: red; border: 0 }' }, [PRIMITIVE]))
  assert.deepEqual(nombres(v.identite), { deltaStock: 0, deltaExempte: 2, entre: 0, disparu: -2, reclasse: 0, primitivise: 0 })
  assert.deepEqual(v.revendications, [{ module: PRIMITIVE, identite: 2, espacement: 0, n: 2 }])
})
