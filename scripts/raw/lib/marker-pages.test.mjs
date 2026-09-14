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
  restituerPages, verifierExtraction, commandeRestitution, deballerSup,
} from './marker-pages.mjs'

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

test('deballerSup (f) `<sup>0</sup>` et `<sup>~</sup>` NON TRANCHÉS : déballés par défaut', () => {
  assert.equal(deballerSup('Une phrase.<sup>0</sup> Une autre.'), 'Une phrase.0 Une autre.')
  assert.equal(deballerSup('un tarif<sup>~</sup>'), 'un tarif~')
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

test('commandeRestitution : page 1-based → `--page_range` 0-based et dossier `restitutions/<k>`', () => {
  assert.equal(commandeRestitution('Source/_marker/wfrp5.pdf', 'Source/_marker/full/wfrp5/slices', 17),
    'marker_single "Source/_marker/wfrp5.pdf" --output_format markdown --config_json scripts/raw/marker-paginate.json'
    + ' --disable_ocr --disable_image_extraction --force_layout_block Text --page_range 16 --output_dir "Source/_marker/full/wfrp5/slices/restitutions/16"')
})
