// SONDE des TITRES (#1739) : `classer` sur une page forgée et un `.md` forgé qui portent chaque forme.
// Le corps est l'ancre : chaque titre se juge par la ligne qui précède la 1re ligne de SON corps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classer, grasDeTete, plusLongueCroissante, sousLaRacine } from './sonde-titres.mjs'
import { gabaritTitreDe } from './_lib.mjs'

const GABARIT = {
  titre: { police: 'ACaslonPro-Bold', taille: 12 },
  accompagnement: [{ police: 'ACaslonPro-Italic', taille: 12 }],
  encadre: { police: 'CaslonAntique-Bold', taille: 15 },
  capitales: { police: 'CaslonAntique-Bold-SC700' },
  exclusions: [{ police: 'CaslonAntique-Bold', taille: 12 }],
}
const L = (colonne, y0, texte, police = 'ACaslonPro-Regular', taille = 9) => ({ colonne, x0: 58 + 244 * colonne, y0, texte, spans: [{ texte, police, taille }] })
const T = (colonne, y0, texte) => L(colonne, y0, texte, 'ACaslonPro-Bold', 12)

const PAGES = [
  {
    page: 10,
    lignes: [
      L(0, 750, 'Coda words appear once here'),
      T(0, 700, 'Alpha'),
      L(0, 690, 'Alpha body text one two three'),
      T(0, 600, 'Gamma'),
      L(0, 590, 'Gamma body words appear here'),
      T(0, 500, 'Delta'),
      L(0, 490, 'Delta corps texte vient ici'),
      T(0, 400, 'Theta'),
      L(0, 390, 'Theta body is here now'),
      T(0, 300, 'Iota'),
      L(0, 290, 'Iota corps en gras seul'),
      L(0, 200, 'BOX TITLE', 'CaslonAntique-Bold', 15),
      L(0, 190, 'cell a cell b'),
      L(0, 150, 'STATBLOC', 'CaslonAntique-Bold', 12),
      L(0, 100, 'SIDEBAR', 'CaslonAntique-Bold', 15),
      L(0, 90, 'Sidebar prose runs along here'),
      T(1, 700, 'Beta'),
      L(1, 690, 'Beta body words here now'),
      T(1, 600, 'Eps'),
      L(1, 590, 'Eps corps ligne encore la'),
      T(1, 500, 'Zeta'),
      L(1, 490, 'Zeta words for zeta entry'),
      T(1, 400, 'Kappa'),
      T(1, 350, 'Lambda'),
      L(1, 340, 'Lambda corps words go here'),
      T(1, 300, 'Mu'),
      L(1, 290, 'Mu corps words also here'),
      L(1, 200, 'Troll', 'CaslonAntique-Bold-SC700', 18),
      L(1, 190, 'Trolls are big and hungry'),
      L(1, 150, 'Wolf', 'CaslonAntique-Bold-SC700', 18),
      L(1, 140, 'Wolves hunt in packs here'),
    ],
  },
]
const MD = [
  '*Pages PDF 10-10*',
  'Alpha body text one two three',
  '### **Beta**',
  '**Alpha** Beta body words here now',
  '**Gamma** Gamma body words appear here',
  'Delta corps texte vient ici',
  '**Delta:** une étiquette, une mention',
  '### **Theta**',
  'Un paragraphe étranger.',
  'Theta body is here now',
  '**Iota**',
  'Iota corps en gras seul',
  '#### BOX TITLE',
  '| cell a | cell b |',
  '### **Zeta**',
  'Zeta words for zeta entry',
  '### **Eps**',
  'Eps corps ligne encore la',
  'Coda words appear once here',
  '### **Lambda**',
  'Coda words appear once here Lambda corps words go here',
  '### **Mu**',
  '10 11 Mu corps words also here',
  '#### SIDEBAR',
  'Autre paragraphe.',
  'Sidebar prose runs along here',
  '**Troll** Trolls are big and hungry',
  '## Wolf',
  'Wolves hunt in packs here',
]
const FICHIERS = [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: MD.flatMap((l, i) => (i ? ['', l] : [l])) }]

const { sites, titres } = classer(PAGES, FICHIERS, GABARIT)
const titre = (t) => titres.find((x) => x.texte === t)
const site = (f, t) => sites.find((s) => s.forme === f && s.titre === t)

test('#1739 : titre à sa place, familles entrée et tableau, exclusion typographique', () => {
  assert.equal(titre('Beta').forme, 'ok')
  assert.deepEqual([titre('BOX TITLE').famille, titre('BOX TITLE').forme], ['tableau', 'ok'])
  assert.equal(titre('STATBLOC'), undefined)
})

test('#1739 : famille « capitales » — le nom de créature SC700 est un titre : S soudé à son corps, ou à sa place', () => {
  assert.deepEqual([site('S', 'Troll')?.famille, site('S', 'Troll')?.site], ['capitales', '001:53'])
  assert.deepEqual([titre('Wolf')?.famille, titre('Wolf')?.forme], ['capitales', 'ok'])
})

test('#1739 : S soudé à son corps ; F soudé au corps de son jumeau, cible devant son propre corps', () => {
  assert.equal(site('S', 'Gamma').site, '001:9')
  assert.deepEqual([site('F', 'Alpha').site, site('F', 'Alpha').cible], ['001:7', '001:3'])
})

test('#1739 : S′ — une étiquette `**X:**` est une MENTION, pas un fragment ; le verbatim est le texte imprimé', () => {
  const s = site("S'", 'Delta')
  assert.equal(s.verbatim, 'Delta')
  assert.equal(s.cible, '001:11')
  assert.ok(s.mentions.includes('001:13'))
})

test('#1739 : M ligne de titre isolée ailleurs ; B gras seul ; corps-introuvable nommé', () => {
  assert.deepEqual([site('M', 'Theta').site, site('M', 'Theta').cible], ['001:15', '001:19'])
  assert.equal(site('B', 'Iota').site, '001:21')
  assert.equal(site('corps-introuvable', 'Kappa').cause, 'sans-ligne')
})

test('#1739 : O — l’entrée hors de l’ordre du PDF se pose DEVANT le titre qui la suit au PDF', () => {
  const o = site('O', 'Eps')
  assert.deepEqual([o.site, o.corps, o.devant, o.titreSuivant], ['001:33', '001:35', '001:29', 'Zeta'])
})

test('#1739 : encadré — seuls S et F se rendent : un titre isolé ailleurs n’est pas un M', () => {
  assert.equal(titre('SIDEBAR').famille, 'encadre')
  assert.equal(sites.some((s) => s.titre === 'SIDEBAR'), false)
})

test('#1739 : débris devant un corps à sa place — doublon d’un texte imprimé une fois, numéros de page', () => {
  const d = site('doublon', 'Lambda')
  assert.deepEqual([d?.site, d?.auMd, d?.auPdf.length], ['001:41', ['001:37', '001:41'], 1])
  assert.deepEqual([site('numero-de-page', 'Mu')?.site, site('numero-de-page', 'Mu')?.texte], ['001:45', '10 11'])
  assert.equal(titre('Lambda').forme, 'ok')
})

test('#1739 : grasDeTete distingue l’étiquette ; plusLongueCroissante garde l’ordre majoritaire', () => {
  assert.equal(grasDeTete('**Combat Reflexes:** texte').etiquette, true)
  assert.equal(grasDeTete('**Surprised** Multiple').etiquette, false)
  assert.deepEqual([...plusLongueCroissante([1, 2, 9, 3, 4])].sort(), [0, 1, 3, 4])
})

test('#1739 : `--json` refuse un chemin sous la racine du dépôt', () => {
  assert.equal(sousLaRacine('C:/repo/x/sites.json', 'C:/repo'), true)
  assert.equal(sousLaRacine('C:/tmp/sites.json', 'C:/repo'), false)
  assert.equal(sousLaRacine('C:/repo-voisin/sites.json', 'C:/repo'), false)
})

test('#1739 : toute cible est le DÉBUT d’un bloc — une ligne de données de tableau sort en cible-invalide (CRB p.145, p.339)', () => {
  const { pages, fichiers } = JSON.parse(readFileSync(new URL('./lib/fixtures/cibles-crb.json', import.meta.url), 'utf8'))
  const reels = classer(pages, fichiers, gabaritTitreDe('core-rulebook-5e')).sites
  const bu = reels.find((x) => x.titre === 'STINKING DRUNK')
  assert.deepEqual([bu.forme, bu.formeVisee, bu.champ], ['cible-invalide', 'F', 'cible'])
  assert.match(bu.ligneCible, /^\| 1–2 +\| 'Marienburger's Courage!'/)
  const sq = reels.find((x) => x.titre === 'skeleTon')
  assert.equal(sq.forme, 'F')
  const [f, l] = sq.cible.split(':').map(Number)
  const lignes = fichiers.find((x) => x.nom.startsWith(String(f).padStart(3, '0'))).lignes
  assert.match(lignes[l - 1], /^Skeletons are the fleshless bones/)
  assert.equal(lignes[l - 2], '')
})
