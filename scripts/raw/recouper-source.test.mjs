// Banc du RE-COUPEUR de `Source/` (`scripts/raw/recouper-source.mjs`, #1739), sur un livre FORGÉ —
// aucun livre du dépôt n'est lu ici : le geste est PUR (`recouper`), sa coquille d'entrée/sortie
// n'ajoute que le disque. Le livre forgé porte les pièges mesurés sur un vrai livre : deux sections
// sur une MÊME page, un titre à MOBILIER de gouttière hors du gras, un titre SANS gras, un homonyme
// du gabarit de profil APRÈS sa section, et un fichier SANS titre imprimé.
// Ce que le banc EXIGE : la coupe, l'en-tête de pages partagées, l'identité À L'OCTET du flux, le
// REFUS quand elle est rompue, l'IDEMPOTENCE, et le recalage d'une entrée de stock AVEC sa `preuve`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contenuDe, fluxDe, indexDe, planDe, recalerStock, recouper } from './recouper-source.mjs'

const CH1 = [
  '*Pages PDF 1-2*',
  '',
  '# **ALPHA**',
  'la prose d’alpha',
  '',
  '# **BETA** V',
  'la prose de beta',
  '',
  '# GAMMA',
  '| clé | valeur |',
  '| --- | --- |',
  '| a | 1 |',
  '',
].join('\n')
const CH2 = [
  '*Pages PDF 3-4*',
  '',
  '# **DELTA**',
  'la prose de delta',
  '',
  '### **ALPHA**',
  'étiquette du gabarit de profil, homonyme d’ALPHA',
  '',
].join('\n')
// Aucun titre imprimé : la planche de fin. Sa coupe vient de l'ancre de page de son chapitre.
const CH3 = ['*Pages PDF 5*', '', 'une planche muette', ''].join('\n')

const ANCIENS = [{ nom: '1 - Alpha.md', texte: CH1 }, { nom: '2 - Delta.md', texte: CH2 }, { nom: '3 - Planche.md', texte: CH3 }]
// La PLAGE est de la DONNÉE, lue au livre : `page` ET `pageFin` à chaque entrée, les voisins
// PARTAGEANT au plus une page. Les deux outils la COPIENT — aucun ne la calcule.
const LISTE = [
  { titre: 'Alpha', ouverture: 'ALPHA', page: 1, pageFin: 2 },
  { titre: 'Beta', ouverture: 'BETA', page: 2, pageFin: 2 },
  { titre: 'Gamma', ouverture: 'GAMMA', page: 2, pageFin: 3 },
  { titre: 'Delta', ouverture: 'DELTA', page: 3, pageFin: 4 },
  { titre: 'Planche', page: 5, pageFin: 5 },
]

test('#1739 : le flux est le corps des chapitres en service, en-têtes retirés, joints par une ligne vide', () => {
  const { flux, debuts } = fluxDe(ANCIENS)
  assert.equal(flux.split('\n')[0], '# **ALPHA**')
  assert.deepEqual(debuts, [0, 11, 17])
})

test('#1739 : un fichier par entrée, la page PARTAGÉE réclamée par les deux voisins', () => {
  const { plan, introuvables, ecart } = recouper(ANCIENS, LISTE)
  assert.deepEqual(introuvables, [])
  assert.equal(ecart, null)
  assert.deepEqual(plan.map((e) => `${e.nom} ${e.span}`), [
    '01 - Alpha.md 1-2', '02 - Beta.md 2', '03 - Gamma.md 2-3', '04 - Delta.md 3-4', '05 - Planche.md 5',
  ])
})

test('#1739 : l’homonyme du gabarit de profil n’ouvre aucun fichier — la coupe reste séquentielle', () => {
  const { contenus } = recouper(ANCIENS, LISTE)
  assert.ok(contenus.get('04 - Delta.md').includes('### **ALPHA**'), 'l’homonyme reste dans la section qui le porte')
  assert.equal(contenus.get('01 - Alpha.md'), '*Pages PDF 1-2*\n\n# **ALPHA**\nla prose d’alpha\n')
})

test('#1739 : un fichier SANS titre imprimé coupe à l’ancre de page de son chapitre', () => {
  const { contenus } = recouper(ANCIENS, LISTE)
  assert.equal(contenus.get('05 - Planche.md'), '*Pages PDF 5*\n\nune planche muette\n')
})

test('#1739 : sans ancre pour sa page, un fichier sans titre est NOMMÉ introuvable — aucune devinette', () => {
  const liste = LISTE.map((e) => (e.titre === 'Planche' ? { ...e, page: 9 } : e))
  const { plan, introuvables } = recouper(ANCIENS, liste)
  assert.deepEqual(plan, [])
  assert.deepEqual(introuvables.map((i) => i.cle), ['Planche'])
})

test('#1739 : un titre d’ouverture absent du flux est NOMMÉ, et rien n’est produit', () => {
  const { plan, introuvables } = recouper(ANCIENS, [...LISTE, { titre: 'Omega', ouverture: 'OMEGA', page: 5, pageFin: 5 }])
  assert.deepEqual(plan, [])
  assert.deepEqual(introuvables.map((i) => i.cle), ['Omega'])
})

test('#1739 : le flux reconstruit est identique À L’OCTET au flux lu', () => {
  const r = recouper(ANCIENS, LISTE)
  const refait = fluxDe(r.plan.map((e) => ({ nom: e.nom, texte: r.contenus.get(e.nom) })))
  assert.equal(refait.flux, r.flux)
  assert.equal(Buffer.byteLength(refait.flux), Buffer.byteLength(r.flux))
})

// MORSURE du contrôle à l'octet : un corps auquel il manque son saut de ligne final en reçoit un,
// et le flux reconstruit porte alors un octet de plus — `ecart` le dit, et `main` refuse d'écrire.
test('#1739 : un octet ajouté au corps rompt le contrôle — `ecart` le nomme', () => {
  const tronque = ANCIENS.map((f, i) => (i === 2 ? { ...f, texte: f.texte.replace(/\n$/, '') } : f))
  const { ecart } = recouper(tronque, LISTE)
  assert.ok(ecart, 'le contrôle à l’octet doit voir l’octet ajouté')
  assert.equal(ecart.apres.length, ecart.avant.length + 1)
})

test('#1739 : IDEMPOTENT — rejoué sur sa propre sortie, il rend les mêmes fichiers', () => {
  const un = recouper(ANCIENS, LISTE)
  const deux = recouper(un.plan.map((e) => ({ nom: e.nom, texte: un.contenus.get(e.nom) })), LISTE)
  assert.deepEqual(deux.introuvables, [])
  assert.equal(deux.ecart, null)
  assert.deepEqual([...deux.contenus], [...un.contenus])
  assert.equal(indexDe('Livre forgé', deux.plan), indexDe('Livre forgé', un.plan))
})

test('#1739 : une entrée de stock keyée par chemin et par section SUIT, sa `preuve` avec elle', () => {
  const { carte } = recouper(ANCIENS, LISTE)
  const racine = 'Source/Livre forge'
  const entrees = [
    { famille: 'br-litteral', fichier: `${racine}/1 - Alpha.md`, ref: 'gamma#1 :: cle|valeur', occurrence: 1, lot: '#X', date: '2026-01-01', preuve: 'PDF p.2 : …' },
    { famille: 'br-litteral', fichier: 'Source/Autre livre/01 - X.md', ref: 'y#1 :: a', occurrence: 1, lot: '#X', date: '2026-01-01' },
  ]
  const { entrees: apres, recalees, orphelines } = recalerStock(entrees, racine, carte)
  assert.deepEqual(orphelines, [])
  assert.equal(recalees.length, 1)
  assert.equal(apres[0].fichier, `${racine}/03 - Gamma.md`)
  assert.equal(apres[0].ref, 'gamma#1 :: cle|valeur')
  assert.equal(apres[0].preuve, 'PDF p.2 : …')
  assert.equal(apres[0].date, '2026-01-01')
  assert.deepEqual(apres[1], entrees[1], 'une entrée d’un autre livre ne bouge pas')
})

test('#1739 : une entrée de stock qu’aucune section ne porte est NOMMÉE, jamais devinée', () => {
  const { carte } = recouper(ANCIENS, LISTE)
  const racine = 'Source/Livre forge'
  const entrees = [{ famille: 'sans-folio', fichier: `${racine}/1 - Alpha.md`, ref: '3 chapitre(s)', occurrence: 1 }]
  const { entrees: apres, recalees, orphelines } = recalerStock(entrees, racine, carte)
  assert.deepEqual(recalees, [])
  assert.deepEqual(orphelines, [`${racine}/1 - Alpha.md :: 3 chapitre(s)`])
  assert.deepEqual(apres, entrees)
})

test('#1739 : `planDe` et `contenuDe` sont PURS — mêmes entrées, mêmes sorties', () => {
  const lignes = fluxDe(ANCIENS).flux.split('\n')
  const a = planDe(lignes, LISTE, new Map([[1, 0], [3, 11], [5, 17]]))
  const b = planDe(lignes, LISTE, new Map([[1, 0], [3, 11], [5, 17]]))
  assert.deepEqual(a, b)
  assert.equal(contenuDe(lignes, a.plan[0]), contenuDe(lignes, b.plan[0]))
})
