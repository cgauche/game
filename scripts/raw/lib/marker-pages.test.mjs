// Test du parseur de pages Marker et du déballage `<sup>` (#1739). Pages depuis DEUX tranches en
// fixtures inline (aucun fichier : `pagesDeMarker` prend son lecteur en paramètre), et un cas par
// classe de la CONSIGNE `<sup>` (a…f). Lancé par `npm run test:raw`.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import {
  mdsDeMarker, mdsDeRestitutions, pagesDeMarker, pagesManquantes, pagesVides, pagesPerdues,
  restituerPages, verifierExtraction, commandeRestitution, couperAuxTitres,
} from './marker-pages.mjs'
import { deballerSup, estLigneDeTitre, lecturesDeTitre, motsDe, ouvreSur } from './titres.mjs'

// Deux tranches contiguës, séparateurs à index ABSOLU 0-based (tranche 2 ouvre à {2}).
const TRANCHE_A = '{0}--------------------------------------------------\nPage un\n\n{1}----------\nPage deux\n'
const TRANCHE_B = '{2}----------\nPage trois\n'
const lire = (p) => (p === 'a.md' ? TRANCHE_A : TRANCHE_B)

test('pagesDeMarker : deux tranches → pages 1-based continues', () => {
  const pages = pagesDeMarker(['a.md', 'b.md'], lire)
  assert.deepEqual([...pages.keys()], [1, 2, 3])
  assert.equal(pages.get(1).trim(), 'Page un')
  assert.equal(pages.get(3).trim(), 'Page trois')
})

test('pagesDeMarker : texte non blanc avant le premier séparateur → lève en nommant le fichier', () => {
  assert.throws(() => pagesDeMarker(['x.md'], () => 'entete parasite\n{0}----------\nPage un\n'),
    /texte avant le premier séparateur de page \(x\.md\)/)
})

test('pagesDeMarker : page présente dans deux tranches → lève en nommant la page', () => {
  assert.throws(() => pagesDeMarker(['a.md', 'c.md'], (p) => (p === 'a.md' ? TRANCHE_A : '{1}----------\nPage deux bis\n')),
    /page 2 extraite deux fois \(c\.md\)/)
})

test('pagesManquantes : les pages 1..max absentes de la Map, vide sur une Map vide', () => {
  assert.deepEqual(pagesManquantes(pagesDeMarker(['b.md'], lire)), [1, 2])
  assert.deepEqual(pagesManquantes(pagesDeMarker(['a.md', 'b.md'], lire)), [])
  assert.deepEqual(pagesManquantes(new Map()), [])
})

test('deballerSup (a) lettrines et petites capitales : déballées', () => {
  assert.equal(deballerSup("<sup>s</sup>'ils"), "s'ils")
  assert.equal(deballerSup('# <sup>L</sup><sup>A</sup> <sup>T</sup>OU<sup>R</sup>'), '# LA TOUR')
})

test('deballerSup (b) `<sup>à</sup>` de titre : déballé', () => {
  assert.equal(deballerSup('## De Bögenhafen <sup>à</sup> Altdorf'), '## De Bögenhafen à Altdorf')
})

test('deballerSup (c) appels de note `*` / `**` : déballés', () => {
  assert.equal(deballerSup('Épée<sup>\\*</sup> et Hache<sup>\\*\\*</sup>'), 'Épée\\* et Hache\\*\\*')
})

test('deballerSup (d) numéro de rangée devant une Marque (VDM) : déballé', () => {
  assert.equal(deballerSup('<sup>1</sup> **Marque de la Bête**'), '1 **Marque de la Bête**')
  assert.equal(deballerSup('<sup>10</sup> **Marque du Chaos**'), '10 **Marque du Chaos**')
})

test('deballerSup (e) icône de rang `<sup>h</sup>` : SUPPRIMÉE avec l\'espace qui suit, à sa position seule', () => {
  assert.equal(deballerSup('#### <sup>h</sup> **Hanté – Bronze 1**'), '#### **Hanté – Bronze 1**')
  assert.equal(deballerSup('- <sup>h</sup> **Recruit Brass 5**'), '- **Recruit Brass 5**')
  assert.equal(deballerSup('<sup>h</sup> **Sans préfixe**'), '**Sans préfixe**')
})

test('deballerSup (e) `<sup>h</sup>` en MILIEU de phrase : pas une icône de rang → déballé en `h`', () => {
  assert.equal(deballerSup('la mesure <sup>h</sup> **de rang**'), 'la mesure h **de rang**')
  assert.equal(deballerSup('#### <sup>h</sup> Hanté sans gras'), '#### h Hanté sans gras')
})

test('deballerSup (f) puce `<sup>0</sup>` : SUPPRIMÉE avec l\'espace qui suit, en milieu de ligne', () => {
  assert.equal(deballerSup('…sans jamais attaquer. <sup>0</sup> Vous appartenez…'),
    '…sans jamais attaquer. Vous appartenez…')
})

test('deballerSup (f) puce `<sup>0</sup>` en TÊTE d\'item : `- <sup>0</sup> **X**` → `- **X**`', () => {
  assert.equal(deballerSup('- <sup>0</sup> **Grand secret :** vous êtes un pacifiste'),
    '- **Grand secret :** vous êtes un pacifiste')
})

test('deballerSup (g) `<sup>~</sup>` : CONTENU, déballé', () => {
  assert.equal(deballerSup('<sup>~</sup> UN RAPPORT ~ DU SCRIBE'), '~ UN RAPPORT ~ DU SCRIBE')
})

test('deballerSup : zéro `<sup>` résiduel sur un texte mêlant toutes les classes', () => {
  const mele = ['# <sup>L</sup>A <sup>T</sup>OUR', 'De Bögenhafen <sup>à</sup> Altdorf',
    'Épée<sup>\\*</sup>', '<sup>3</sup> **Marque du Ver**', '#### <sup>h</sup> **Hanté – Bronze 1**',
    'phrase.<sup>0</sup> suite', 'tarif<sup>~</sup>', 'milieu <sup>h</sup> de phrase'].join('\n')
  assert.equal(deballerSup(mele).match(/<\/?sup>/g), null)
})

// ---------- lecture de DISQUE : tranches, repli, restitutions (#1739) ----------
// Ces branches lisent le disque (`listerDossier`) : aucune injection ne les couvre. Arbre
// TEMPORAIRE sous `os.tmpdir()`, supprimé en `after`.
const RACINE = mkdtempSync(join(tmpdir(), 'marker-pages-test-'))
after(() => rmSync(RACINE, { recursive: true, force: true }))

/** Arbre `<RACINE>/<cas>/…` : un fichier paginé par chemin relatif, plus des dossiers VIDES. */
function arbre(cas, fichiers, dossiers = []) {
  const base = join(RACINE, cas)
  mkdirSync(base, { recursive: true })
  for (const d of dossiers) mkdirSync(join(base, d), { recursive: true })
  for (const f of fichiers) {
    const abs = join(base, f)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, '{0}-----\nPage\n')
  }
  return base
}

test('mdsDeMarker : chemin de fichier non-`.md` → lève', () => {
  const base = arbre('non-md', ['sortie.txt'])
  assert.throws(() => mdsDeMarker(join(base, 'sortie.txt')), /n'est pas un \.md/)
})

test('mdsDeMarker : tranche sans sous-dossier de PDF (run tué avant écriture) → sautée', () => {
  const base = arbre('tranche-vide', ['0-39/pdf/pdf.md', '40-79/marker.log'])
  assert.deepEqual(mdsDeMarker(base), [join(base, '0-39', 'pdf', 'pdf.md')])
})

test('mdsDeMarker : tranche à 2 `.md` → lève en NOMMANT la tranche', () => {
  const base = arbre('tranche-double', ['0-39/pdf/pdf.md', '0-39/autre/autre.md'])
  assert.throws(() => mdsDeMarker(base), /tranche 0-39 → 2 fichiers \.md \(attendu : 1\)/)
})

test('mdsDeMarker : tranches ordonnées par BORNE BASSE (pas par nom de dossier)', () => {
  const base = arbre('ordre', ['0-39/p/p.md', '120-159/p/p.md', '40-79/p/p.md'])
  const tranches = mdsDeMarker(base).map((p) => relative(base, p).split(/[\\/]/)[0])
  assert.deepEqual(tranches, ['0-39', '40-79', '120-159'])
})

test('mdsDeMarker : repli sans tranche → le `.md` UNIQUE ; deux `.md` → lève (jamais `md[0]` en silence)', () => {
  const base = arbre('repli', ['pdf/pdf.md'])
  assert.deepEqual(mdsDeMarker(base), [join(base, 'pdf', 'pdf.md')])
  assert.throws(() => mdsDeMarker(arbre('repli-double', ['a/a.md', 'b/b.md'])), /→ 2 fichiers \.md \(attendu : 1\)/)
})

test('restitutions/ : IGNORÉ par les tranches, rendu par `mdsDeRestitutions`', () => {
  const base = arbre('restit', ['0-39/p/p.md', 'restitutions/16/p/p.md'])
  assert.deepEqual(mdsDeMarker(base), [join(base, '0-39', 'p', 'p.md')])
  assert.deepEqual(mdsDeRestitutions(base), [join(base, 'restitutions', '16', 'p', 'p.md')])
})

test("mdsDeRestitutions : `[]` quand le dossier `restitutions/` n'existe pas", () => {
  assert.deepEqual(mdsDeRestitutions(arbre('sans-restit', ['0-39/p/p.md'])), [])
})

// ---------- pages VIDES / PERDUES / restituées ----------

test('pagesVides : page `\n` et page réduite à son ancre `<span id="page-3-0">` = VIDES ; page pleine non', () => {
  const pages = new Map([[1, 'Du texte\n'], [2, '\n'], [3, '<span id="page-3-0"></span>\n']])
  assert.deepEqual(pagesVides(pages), [2, 3])
  assert.deepEqual(pagesManquantes(pages), []) // la page vide est INVISIBLE pour `pagesManquantes`
})

test('restituerPages : remplace une page VIDE et une page ABSENTE, entrée NON mutée', () => {
  const base = new Map([[1, 'Du texte\n'], [2, '\n']])
  const fusion = restituerPages(base, new Map([[2, 'Planche restituée\n'], [3, 'Encadré restitué\n']]))
  assert.deepEqual([...fusion.keys()], [1, 2, 3])
  assert.equal(fusion.get(2), 'Planche restituée\n')
  assert.equal(base.get(2), '\n')
  assert.equal(base.size, 2)
})

test('restituerPages : page de base PLEINE → lève en nommant la page', () => {
  assert.throws(() => restituerPages(new Map([[1, 'Du texte\n']]), new Map([[1, 'OCR\n']])),
    /page 1 déjà pleine, restitution refusée/)
})

test('pagesPerdues : vide OU absente chez Marker et > seuil chez pypdf ; `extraire` INJECTÉ (zéro python)', () => {
  const pages = new Map([[1, 'Du texte\n'], [2, '\n'], [4, '\n']]) // 2 et 4 vides, 3 absente
  const extraire = (pdf, indices) => {
    assert.equal(pdf, 'x.pdf')
    assert.deepEqual(indices, [1, 2, 3]) // indices 0-based = page − 1
    return new Map([[1, 'a'.repeat(1806)], [2, 'b'.repeat(2070)], [3, 'c'.repeat(10)]])
  }
  assert.deepEqual(pagesPerdues(pages, 'x.pdf', { extraire }),
    [{ page: 2, pypdf: 1806 }, { page: 3, pypdf: 2070 }])
})

test('pagesPerdues : aucune page suspecte → pypdf JAMAIS appelé', () => {
  const extraire = () => { throw new Error('pypdf ne doit pas être appelé') }
  assert.deepEqual(pagesPerdues(new Map([[1, 'Du texte\n']]), 'x.pdf', { extraire }), [])
})

test("verifierExtraction : fusionne les restitutions AVANT de juger — une page restituée n'est plus perdue", () => {
  const pages = new Map([[1, 'Du texte\n'], [2, '\n']])
  const extraire = () => new Map([[1, 'a'.repeat(1461)]])
  assert.deepEqual(verifierExtraction(pages, { pdfPath: 'x.pdf', extraire }).perdues, [{ page: 2, pypdf: 1461 }])
  const v = verifierExtraction(pages, { pdfPath: 'x.pdf', extraire, restitutions: new Map([[2, 'Planche\n']]) })
  assert.deepEqual(v.perdues, [])
  assert.deepEqual(v.manquantes, [])
  assert.equal(v.pages.get(2), 'Planche\n')
})

// ---------- coupe à la ligne d'un titre d'ouverture (#1739) ----------
// Flux FORGÉ (aucun livre nommé) portant les cinq pièges mesurés au CRB 5e : un homonyme AVANT la
// section qu'il ouvre et un autre APRÈS, deux ouvertures sur une même page, un titre à MOBILIER de
// gouttière hors du gras, un titre SANS gras, et un fichier sans titre.
const FLUX = [
  'Bandeau',              // 0
  '',                     // 1
  '# **ALPHA**',          // 2   page 1
  'texte',                // 3
  '## **ARMOUR**',        // 4   homonyme (gabarit de profil), AVANT la section ARMOUR
  'texte',                // 5
  '# **BETA** V',         // 6   page 2 — mobilier de gouttière hors du gras
  'texte',                // 7
  '# GAMMA',              // 8   page 2 — deuxième ouverture de la page, SANS gras
  'texte',                // 9
  '# **ARMOUR**',         // 10  page 3 — la section ARMOUR
  'texte',                // 11
  '#### **ARMOUR**',      // 12  homonyme, APRÈS
  'texte',                // 13
]
const BORNES = { 1: [0, 6], 2: [6, 10], 3: [10, 14] }
const fenetre = (pg) => ({ depuis: BORNES[pg][0], avant: BORNES[pg][1] })

test('estLigneDeTitre : une ligne ATX, ancre de page comprise ; rien d’autre', () => {
  assert.equal(estLigneDeTitre('# **BETA** V'), true)
  assert.equal(estLigneDeTitre('# <span id="page-5-0"></span>• **INTRODUCTION** •'), true)
  assert.equal(estLigneDeTitre('## Titre fermé ##'), true)
  assert.equal(estLigneDeTitre('**ALPHA**'), false)
  assert.equal(estLigneDeTitre('texte'), false)
})

test('lecturesDeTitre : TROIS lectures d’une ligne — entière, gras joint, reste hors gras', () => {
  assert.deepEqual(lecturesDeTitre('# **BETA** V').map((l) => motsDe(l).join(' ')), ['beta v', 'beta', 'v'])
  assert.deepEqual(lecturesDeTitre('# GAMMA').map((l) => motsDe(l).join(' ')), ['gamma', '', 'gamma'])
  assert.deepEqual(lecturesDeTitre('texte'), [])
})

test('ouvreSur : casse, habillage et typographie absorbés — le mobilier de gouttière, jamais', () => {
  assert.equal(ouvreSur('# **UNGRAKK’S  BRAYHERD**', "UNGRAKK'S BRAYHERD"), true)
  assert.equal(ouvreSur('# **ÉTATS**', 'ETATS'), true)
  assert.equal(ouvreSur('## Titre fermé ##', 'TITRE FERME'), true)
  // MORSURE : une SUITE de mots, jamais un préfixe — le chiffre romain ne se rogne pas.
  assert.equal(ouvreSur('# **APPENDIX III** I', 'APPENDIX I'), false)
  assert.equal(ouvreSur('# **APPENDIX I**', 'APPENDIX I'), true)
  assert.equal(ouvreSur('# **SKILLS AND TALENTS**', 'SKILLS'), false)
  // Une ouverture VIDE n'ouvre rien : aucune coupe ne se devine.
  assert.equal(ouvreSur('# **BETA**', ''), false)
})

test('couperAuxTitres : l’homonyme d’APRÈS est ignoré — le premier rencontré ouvre la section', () => {
  const { coupes, introuvables } = couperAuxTitres(FLUX, [
    { cle: 'Alpha', ouverture: 'ALPHA', ...fenetre(1) },
    { cle: 'Armour', ouverture: 'ARMOUR', ...fenetre(3) },
  ])
  assert.deepEqual(introuvables, [])
  assert.deepEqual(coupes.map((c) => c.ligne), [2, 10])
})

// Le MÊME texte de titre ouvre DEUX fichiers (CRB 5e : `POISONS` p.183 et p.313) — c'est le CURSEUR
// séquentiel, et lui seul, qui donne à la seconde entrée la seconde occurrence.
test('couperAuxTitres : deux entrées de MÊME titre prennent deux occurrences successives', () => {
  const { coupes, introuvables } = couperAuxTitres(FLUX, [
    { cle: 'Armour', ouverture: 'ARMOUR' },
    { cle: 'Armour bis', ouverture: 'ARMOUR' },
  ])
  assert.deepEqual(introuvables, [])
  assert.deepEqual(coupes.map((c) => c.ligne), [4, 10])
})

// PORTÉE de la recherche séquentielle, mesurée ici : elle écarte l'homonyme d'APRÈS à elle seule ;
// celui d'AVANT ne tombe que par la fenêtre de PAGE. Un flux qui n'en porte pas (les `.md` en
// service, qui n'ont presque aucune ancre de page) doit donc se relire à la carte émise.
test('couperAuxTitres : sans fenêtre, un homonyme d’AVANT prend la coupe — la page seule l’écarte', () => {
  const nue = couperAuxTitres(FLUX, [{ cle: 'Alpha', ouverture: 'ALPHA' }, { cle: 'Armour', ouverture: 'ARMOUR' }])
  assert.deepEqual(nue.coupes.map((c) => c.ligne), [2, 4])
})

test('couperAuxTitres : deux ouvertures sur la MÊME page, dans leur fenêtre', () => {
  const { coupes } = couperAuxTitres(FLUX, [
    { cle: 'Beta', ouverture: 'BETA', ...fenetre(2) },
    { cle: 'Gamma', ouverture: 'GAMMA', ...fenetre(2) },
  ])
  assert.deepEqual(coupes.map((c) => c.ligne), [6, 8])
})

test('couperAuxTitres : un fichier SANS titre imprimé coupe à son `depuis`', () => {
  const { coupes } = couperAuxTitres(FLUX, [
    { cle: 'Couverture', ouverture: null, ...fenetre(1) },
    { cle: 'Alpha', ouverture: 'ALPHA', ...fenetre(1) },
  ])
  assert.deepEqual(coupes, [
    { cle: 'Couverture', ouverture: null, ligne: 0 },
    { cle: 'Alpha', ouverture: 'ALPHA', ligne: 2 },
  ])
})

test('couperAuxTitres : titre INTROUVABLE dans sa fenêtre → nommé, et aucune coupe devinée', () => {
  const { coupes, introuvables } = couperAuxTitres(FLUX, [
    { cle: 'Alpha', ouverture: 'ALPHA' },
    { cle: 'Delta', ouverture: 'DELTA' },
    { cle: 'Armour', ouverture: 'ARMOUR' },
  ])
  assert.deepEqual(introuvables.map((i) => i.cle), ['Delta'])
  assert.deepEqual(coupes.map((c) => c.cle), ['Alpha', 'Armour'])
})

test('couperAuxTitres : un titre présent HORS de sa fenêtre de page reste introuvable', () => {
  const { coupes, introuvables } = couperAuxTitres(FLUX, [
    { cle: 'Gamma', ouverture: 'GAMMA', ...fenetre(3) },
  ])
  assert.deepEqual(coupes, [])
  assert.deepEqual(introuvables.map((i) => [i.cle, i.depuis, i.avant]), [['Gamma', 10, 14]])
})

test('commandeRestitution : page 1-based → `--page_range` 0-based et dossier `restitutions/<k>`', () => {
  assert.equal(commandeRestitution('Source/_marker/core-rulebook-5e.pdf', 'Source/_marker/full/core-rulebook-5e/slices', 17),
    'marker_single "Source/_marker/core-rulebook-5e.pdf" --output_format markdown --config_json scripts/raw/marker-paginate.json'
    + ' --disable_ocr --disable_image_extraction --force_layout_block Text --page_range 16 --output_dir "Source/_marker/full/core-rulebook-5e/slices/restitutions/16"')
})
