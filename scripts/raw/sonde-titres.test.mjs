// SONDE des TITRES (#1739) : `classer` sur une page forgée et un `.md` forgé qui portent chaque forme.
// Le corps est l'ancre : chaque titre se juge par la ligne qui précède la 1re ligne de SON corps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { classer, grasDeTete, plusLongueCroissante } from './sonde-titres.mjs'
import { gabaritTitreDe } from './_lib.mjs'

const GABARIT = {
  titre: { police: 'ACaslonPro-Bold', taille: 12 },
  accompagnement: [{ police: 'ACaslonPro-Italic', taille: 12 }],
  encadre: { police: 'CaslonAntique-Bold', taille: 15 },
  capitales: { police: 'CaslonAntique-Bold-SC700' },
  intertitre: { police: 'ACaslonPro-Bold', taille: 10 },
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
      L(1, 120, 'Ogre', 'CaslonAntique-Bold-SC700', 18),
      L(1, 110, 'Ogres are huge brutes here'),
      L(1, 100, 'OGRE', 'CaslonAntique-Bold', 12),
      L(1, 80, 'Career Path', 'CaslonAntique-Bold-SC700', 18),
      L(1, 70, 'Career path body words go'),
      T(1, 50, 'Rho'),
      L(1, 40, 'Rho corps words sit here'),
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
  'Ogres are huge brutes here',
  '#### **OGRE**',
  'Career path body words go',
  '# <span id="page-10-0"></span>**Rho**',
  'Rho corps words sit here',
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

test('#1739 : S′ de capitales par COMPTAGE — imprimé plus de fois que le `.md` ne le porte, restauré dans la forme de ses frères', () => {
  const s = site("S'", 'Ogre')
  assert.deepEqual([s?.famille, s?.cible, s?.ligneTitre, s?.frere, s?.comptage], ['capitales', '001:59', '## Ogre', '001:55 « Wolf »', { auPdf: 2, auMd: 1 }])
  assert.equal(titre('Career Path').forme, "S'")
  assert.equal(sites.some((x) => x.titre === 'Career Path'), false)
})

test('#1739 : une ancre `<span id="page-…">` devant un titre ne le cache pas', () => {
  assert.equal(titre('Rho').forme, 'ok')
})

test('#1739 : S soudé à son corps ; F soudé au corps de son jumeau, cible devant son propre corps', () => {
  assert.equal(site('S', 'Gamma').site, '001:9')
  assert.deepEqual([site('F', 'Alpha').site, site('F', 'Alpha').cible], ['001:7', '001:3'])
})

test('#1739 : `titreMd` — le texte EXACT du titre dans le `.md`, que la réparation déplace', () => {
  assert.deepEqual(
    [site('S', 'Gamma'), site('F', 'Alpha'), site('M', 'Theta'), site('B', 'Iota'), site('O', 'Eps'), site('S', 'Troll')].map((x) => x.titreMd),
    ['**Gamma**', '**Alpha**', '### **Theta**', '**Iota**', '### **Eps**', '**Troll**'],
  )
})

test('#1739 : S′ — une étiquette `**X:**` est une MENTION, pas un fragment ; la ligne restaurée porte le texte imprimé', () => {
  const s = site("S'", 'Delta')
  assert.equal(s.ligneTitre, '### **Delta**')
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

test('#1739 : débris devant un corps à sa place — doublon d’un texte imprimé une fois ; des nombres ne sont pas un débris de titre (mobilier)', () => {
  const d = site('doublon', 'Lambda')
  assert.deepEqual([d?.site, d?.auMd, d?.auPdf.length], ['001:41', ['001:37', '001:41'], 1])
  assert.equal(titre('Lambda').forme, 'ok')
  assert.equal(titre('Mu').forme, 'ok')
  assert.equal(sites.some((x) => x.titre === 'Mu'), false)
})

test('#1739 : grasDeTete distingue l’étiquette ; plusLongueCroissante garde l’ordre majoritaire', () => {
  assert.equal(grasDeTete('**Combat Reflexes:** texte').etiquette, true)
  assert.equal(grasDeTete('**Surprised** Multiple').etiquette, false)
  assert.deepEqual([...plusLongueCroissante([1, 2, 9, 3, 4])].sort(), [0, 1, 3, 4])
})

test('#1739 : `--json` sous la racine du dépôt est REFUSÉ avant toute lecture du PDF (exit 2, rien d’écrit)', () => {
  const sortie = fileURLToPath(new URL('./sites-refuses.json', import.meta.url))
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./sonde-titres.mjs', import.meta.url)), 'core-rulebook-5e', '--json', sortie], { encoding: 'utf8' })
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /sous le dépôt/)
  assert.equal(existsSync(sortie), false)
})

test('#1739 : toute cible est le DÉBUT d’un bloc — une ligne de tableau se remonte à l’EN-TÊTE de son bloc (CRB p.145, p.339)', () => {
  const { pages, fichiers } = JSON.parse(readFileSync(new URL('./lib/fixtures/cibles-crb.json', import.meta.url), 'utf8'))
  const reels = classer(pages, fichiers, gabaritTitreDe('core-rulebook-5e')).sites
  const bu = reels.find((x) => x.titre === 'STINKING DRUNK')
  assert.deepEqual([bu.forme, bu.titreMd], ['F', '**STINKING DRUNK**'])
  const [, lb] = bu.cible.split(':').map(Number)
  const l028 = fichiers.find((x) => x.nom.startsWith('028')).lignes
  assert.match(l028[lb - 1], /^\| 1d10 +\| Outcome/)
  assert.equal(l028[lb - 2], '')
  const sq = reels.find((x) => x.titre === 'skeleTon')
  assert.equal(sq.forme, 'F')
  const [f, l] = sq.cible.split(':').map(Number)
  const lignes = fichiers.find((x) => x.nom.startsWith(String(f).padStart(3, '0'))).lignes
  assert.match(lignes[l - 1], /^Skeletons are the fleshless bones/)
  assert.equal(lignes[l - 2], '')
})

test('#1739 : une cible au milieu d’un paragraphe sort en cible-invalide, avec sa forme visée', () => {
  const pages = [{ page: 10, lignes: [T(0, 700, 'Omega'), L(0, 690, 'Omega corps words go here')] }]
  const lignes = ['Intro line here', 'Omega corps words go here', '', '**Omega** Autre corps étranger ici']
  const [s] = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT).sites
  assert.deepEqual([s.forme, s.formeVisee, s.champ, s.cible, s.ligneCible], ['cible-invalide', 'F', 'cible', '001:2', 'Omega corps words go here'])
})

test('#1739 : la ligne de titre POSÉE — niveau et gras du frère typographique précédent (le suivant pour le premier), texte du `.md`', () => {
  assert.deepEqual([site('S', 'Gamma').ligneTitre, site('S', 'Gamma').frere], ['### **Gamma**', '001:5 « Beta »'])
  assert.deepEqual([site('M', 'Theta').ligneTitre, site('B', 'Iota').ligneTitre], ['### **Theta**', '### **Iota**'])
  assert.deepEqual([site('S', 'Troll').ligneTitre, site('S', 'Troll').frere], ['## **Troll**', '001:55 « Wolf »'])
})

test('#1739 : une ligne imprimée en deux boîtes (même y) est UNE ligne de corps, ses morceaux de gauche à droite', () => {
  const morceau = (x0, texte) => ({ colonne: 0, x0, y0: 490, texte, spans: [{ texte, police: 'ACaslonPro-Regular', taille: 9 }] })
  const pages = [{ page: 10, lignes: [T(0, 500, 'Nostrum'), morceau(120, 'Range: Touch'), morceau(58, 'CN: 0')] }]
  const lignes = ['#### **Nostrum**', '', '**CN:** 0 **Range:** Touch']
  const { titres: ts } = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT)
  assert.deepEqual([ts[0].forme, ts[0].cles], ['ok', ['cn: 0 range:']])
})

test('#1739 : le frère qui donne le niveau est dans le MÊME fichier — le premier titre d’un fichier prend le suivant, jamais le dernier du fichier précédent', () => {
  const pages = [
    { page: 10, lignes: [T(0, 700, 'Aa'), L(0, 690, 'Aa corps words go here')] },
    { page: 11, lignes: [T(0, 700, 'Bb'), L(0, 690, 'Bb corps words go here'), T(0, 600, 'Cc'), L(0, 590, 'Cc corps words go here')] },
  ]
  const fichiers = [
    { nom: '001 - Un.md', page: 10, pageFin: 10, lignes: ['## **Aa**', '', 'Aa corps words go here'] },
    { nom: '002 - Deux.md', page: 11, pageFin: 11, lignes: ['**Bb** Bb corps words go here', '', '#### **Cc**', '', 'Cc corps words go here'] },
  ]
  const s = classer(pages, fichiers, GABARIT).sites.find((x) => x.titre === 'Bb')
  assert.deepEqual([s?.forme, s?.ligneTitre, s?.frere], ['S', '#### **Bb**', '002:3 « Cc »'])
})

test('#1739 : un titre imprimé sur DEUX lignes (même gabarit, même colonne, interligne serré) est UN titre (CRB p.170)', () => {
  const E = (y0, texte) => L(0, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(229, 'THE HEAL SKILL AND'), E(215, 'BLEEDING CONDITIONS'), L(0, 200, 'Heal skill prose words here')] }]
  const lignes = ['#### THE HEAL SKILL AND BLEEDING CONDITIONS', '', 'Heal skill prose words here']
  const r = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT)
  assert.deepEqual(r.titres.map((t) => [t.texte, t.forme]), [['THE HEAL SKILL AND BLEEDING CONDITIONS', 'ok']])
  assert.deepEqual(r.sites, [])
})

test('#1739 : P — paragraphe scindé, PROUVÉ au PDF par un gras CONTINU d’une ligne à l’autre (CRB p.338) ; un repère de liste ou un libellé ne l’est pas (CRB p.36)', () => {
  const G = (colonne, y0, ...morceaux) => ({ colonne, x0: 58, y0, texte: morceaux.map(([t]) => t).join(' '), spans: morceaux.map(([texte, gras]) => ({ texte, police: gras ? 'ACaslonPro-Bold' : 'ACaslonPro-Regular', taille: 9 })) })
  const pages = [{
    page: 10,
    lignes: [
      G(0, 384, ['see page 356']),
      G(0, 371, ['Infected:', true], ['Wounded opponents must take an']),
      G(0, 358, ['Easy (+4 SL)', true]),
      G(0, 345, ['Endurance', true], ['Test to avoid a Festering Wound']),
      G(1, 580, ['A)', true], ['Choose a Class and Career available']),
      G(1, 567, ['or']),
      G(1, 554, ['B)', true], ['Roll on your Species table']),
      G(1, 400, ['Skills: Charm, Gossip', true]),
      G(1, 387, ['Talents:', true], ['Craftsman, Strong Back']),
    ],
  }]
  const lignes = [
    'see page 356', '', '**Infected:** Wounded opponents must take an', '', '**Easy (+4 SL)**', '', '**Endurance** Test to avoid a Festering Wound', '',
    '**A)** Choose a Class and Career available *or*', '', '**B)** Roll on your Species table', '',
    '**Skills: Charm, Gossip**', '', '**Talents:** Craftsman, Strong Back',
  ]
  const p = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT).sites.filter((s) => s.forme === 'P')
  assert.deepEqual(p.map((s) => [s.site, s.avec, s.preuve]), [['001:5', '001:3', 'p.10 col.0 y371→358'], ['001:7', '001:5', 'p.10 col.0 y358→345']])
})

test('#1739 : famille « intertitre » (CRB p.46, p.92, p.171, p.193) — F soudé au corps de son jumeau, S soudé DANS le gras de l’étiquette, B à blanc de tête, titre sur deux lignes ; niveau du frère intertitre', () => {
  const I = (colonne, y0, texte) => L(colonne, y0, texte, 'ACaslonPro-Bold', 10)
  const pages = [{
    page: 10,
    lignes: [
      I(0, 700, '36–39: Cures'), L(0, 690, 'Cures body words go here'),
      I(0, 600, '40–42: Levy'), L(0, 590, 'Levy body words sit here'),
      I(0, 300, 'Inflicting Critical Wounds'), I(0, 287, 'on an Opponent with 0 Wounds'), L(0, 277, 'Damage words reduce here now'),
      I(1, 600, '69–73: Tax Collector'), L(1, 590, 'Tax body words are here'),
      I(1, 500, 'Adviser — Silver 3'), L(1, 490, 'Skills: Consume Alcohol, Cool'),
      I(1, 400, 'Explorer — Silver 5'), L(1, 390, 'Explorer body words go here'),
    ],
  }]
  const md = [
    '#### **36–39: Cures**', 'Cures body words go here', 'Levy body words sit here',
    '#### **Inflicting Critical Wounds on an Opponent with 0 Wounds**', 'Damage words reduce here now',
    '#### **69–73: Tax Collector**', '**40–42: Levy** Tax body words are here',
    ' **Adviser — Silver 3 Skills:** Consume Alcohol, Cool', ' **Explorer — Silver 5**', 'Explorer body words go here',
  ]
  const r = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: md.flatMap((l, i) => (i ? ['', l] : [l])) }], GABARIT)
  const de = (f, t) => r.sites.find((s) => s.forme === f && s.titre === t)
  assert.deepEqual([de('F', '40–42: Levy')?.famille, de('F', '40–42: Levy')?.site, de('F', '40–42: Levy')?.cible, de('F', '40–42: Levy')?.ligneTitre], ['intertitre', '001:13', '001:5', '#### **40–42: Levy**'])
  assert.deepEqual([de('S', 'Adviser — Silver 3')?.site, de('S', 'Adviser — Silver 3')?.titreMd, de('S', 'Adviser — Silver 3')?.ligneTitre], ['001:15', '**Adviser — Silver 3', '#### **Adviser — Silver 3**'])
  assert.deepEqual([de('B', 'Explorer — Silver 5')?.site, de('B', 'Explorer — Silver 5')?.ligneTitre], ['001:17', '#### **Explorer — Silver 5**'])
  assert.equal(r.titres.find((t) => t.texte === 'Inflicting Critical Wounds on an Opponent with 0 Wounds')?.forme, 'ok')
  assert.deepEqual(r.sites.map((s) => s.forme).sort(), ['B', 'F', 'S'])
})
