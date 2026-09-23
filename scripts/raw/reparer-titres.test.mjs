// Banc de la RÉPARATION des titres (`reparer-titres.mjs`, #1739) : chaque forme de la sonde appliquée à
// un livre forgé de deux fichiers, les blancs du bloc posé, le refus d'un site périmé, la fidélité
// au multi-ensemble des mots du LIVRE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { infidelite, reparerLivre } from './reparer-titres.mjs'

const A = [
  'Intro.', '',
  '**Gamma** Gamma body.', '',
  '### **Beta**', '',
  '**Alpha** Beta body.', '',
  'Alpha body.', '',
  '**Iota**', '',
  'Iota body.', '',
  '**6. X** Delta body.', '',
  '### **Theta**', '',
  'Kappa body.', '',
  '### **Omega**', '',
  'Omega body.', '',
  '### **Zeta**', '',
  'Zeta body.',
].join('\n')
const B = ['*Pages*', '', '**Surprised** Foreign body.', ''].join('\n')
const TEXTES = new Map([['001', A], ['002', B]])
const SITES = [
  { forme: 'S', site: '001:3', titreMd: '**Gamma**', ligneTitre: '### **Gamma**', titre: 'Gamma' },
  { forme: 'F', site: '001:7', titreMd: '**Alpha**', cible: '001:9', ligneTitre: '### **Alpha**', titre: 'Alpha' },
  { forme: 'B', site: '001:11', titreMd: '**Iota**', ligneTitre: '### **Iota**', titre: 'Iota' },
  { forme: 'doublon', site: '001:15', texteMd: '**6. X**', titre: 'Delta' },
  { forme: 'M', site: '001:17', titreMd: '### **Theta**', cible: '001:19', ligneTitre: '### **Theta**', titre: 'Theta' },
  { forme: "S'", site: null, cible: '001:13', ligneTitre: '### **Restored**', titre: 'Restored' },
  { forme: 'O', site: '001:25', titreMd: '### **Zeta**', devant: '001:21', titre: 'Zeta' },
  { forme: 'F', site: '002:3', titreMd: '**Surprised**', cible: '001:23', ligneTitre: '### **Surprised**', titre: 'Surprised' },
  { forme: 'N', site: '001:5', titre: 'Beta' },
]

test('chaque forme appliquée : S détaché, F/M retiré et posé devant son corps (même entre fichiers), B promu, S′ inséré, O déplacé, débris retiré', () => {
  const { textes, refus, appliques } = reparerLivre(TEXTES, SITES)
  assert.deepEqual(refus, [])
  assert.equal(appliques.length, 8)
  assert.equal(textes.get('001'), [
    'Intro.', '',
    '### **Gamma**', '', 'Gamma body.', '',
    '### **Beta**', '', 'Beta body.', '',
    '### **Alpha**', '', 'Alpha body.', '',
    '### **Iota**', '',
    '### **Restored**', '', 'Iota body.', '',
    'Delta body.', '',
    '### **Theta**', '', 'Kappa body.', '',
    '### **Zeta**', '', 'Zeta body.', '',
    '### **Omega**', '',
    '### **Surprised**', '', 'Omega body.',
  ].join('\n'))
  assert.equal(textes.get('002'), ['*Pages*', '', 'Foreign body.', ''].join('\n'))
})

test('fidélité au LIVRE : ajoutés = les mots des S′, retirés = ceux des débris ; un déplacement entre fichiers se compense', () => {
  const { textes } = reparerLivre(TEXTES, SITES)
  assert.equal(infidelite(TEXTES, textes, SITES), null)
  const trafique = new Map(textes).set('002', `${textes.get('002')}mot\n`)
  assert.match(infidelite(TEXTES, trafique, SITES), /mots ajoutés .*mot×1/)
})

test('un site PÉRIMÉ (ligne qui ne porte plus ce que la sonde a vu) est REFUSÉ, nommé — rejeu d’un JSON sur un livre réparé', () => {
  const { textes } = reparerLivre(TEXTES, SITES)
  const { refus } = reparerLivre(textes, SITES)
  assert.ok(refus.some((r) => /^001:3 S « Gamma » : la ligne ne s'ouvre plus sur « \*\*Gamma\*\* »/.test(r)), refus.join('\n'))
  assert.ok(refus.some((r) => /S′ « Restored » : « ### \*\*Restored\*\* » déjà dans le fichier/.test(r)))
})

test('sans site, rien ne bouge : le texte réparé est rendu tel quel', () => {
  const { textes } = reparerLivre(TEXTES, SITES)
  const r = reparerLivre(textes, [])
  assert.deepEqual([...r.textes], [...textes])
  assert.deepEqual([r.refus, r.appliques, r.recolles], [[], [], []])
})

const P_TEXTE = new Map([['107', ['see page 356', '', '**Infected:** Wounded opponents must take an', '', '**Easy (+4 SL)**', '', '**Endurance** Test to avoid a Festering Wound', '', '**Night Vision:** See clearly', ''].join('\n')]])
const P_SITES = [
  { forme: 'P', site: '107:5', avec: '107:3', ligneMd: '**Easy (+4 SL)**', titre: 'Easy (+4 SL)' },
  { forme: 'P', site: '107:7', avec: '107:5', ligneMd: '**Endurance** Test to avoid a Festering Wound', titre: 'Endurance Test to avoid a Festering Wound' },
]

test('P (CRB 107 l.147-151) : les sites de la sonde recollés de la plus basse à la plus haute — trois morceaux, un paragraphe', () => {
  const { textes, refus, recolles } = reparerLivre(P_TEXTE, P_SITES)
  assert.deepEqual(refus, [])
  assert.deepEqual(recolles, [{ nnn: '107', ligne: 7, avec: 5 }, { nnn: '107', ligne: 5, avec: 3 }])
  assert.equal(textes.get('107'), ['see page 356', '', '**Infected:** Wounded opponents must take an **Easy (+4 SL) Endurance** Test to avoid a Festering Wound', '', '**Night Vision:** See clearly', ''].join('\n'))
  assert.equal(infidelite(P_TEXTE, textes, P_SITES), null)
})

test('P PÉRIMÉ : rejoué sur le livre recollé, chaque site est REFUSÉ, nommé, rien ne bouge', () => {
  const { textes } = reparerLivre(P_TEXTE, P_SITES)
  const r = reparerLivre(textes, P_SITES)
  assert.deepEqual(r.refus, ['107:7 P : la ligne n\'est plus « **Endurance** Test to avoid a Festering Wound »', '107:5 P : la ligne n\'est plus « **Easy (+4 SL)** »'])
  assert.deepEqual(r.textes, textes)
})

test('S soudé DANS le gras de l’étiquette, blanc de tête (CRB 018 l.108) : le titre détaché, le gras refermé des deux côtés', () => {
  const avant = new Map([['018', ['Read/Write **Trappings:** Writing Kit', '', ' **Adviser — Silver 3 Skills:** Consume Alcohol, Cool', ''].join('\n')]])
  const sites = [{ forme: 'S', site: '018:3', titreMd: '**Adviser — Silver 3', ligneTitre: '#### **Adviser — Silver 3**', titre: 'Adviser — Silver 3' }]
  const { textes, refus } = reparerLivre(avant, sites)
  assert.deepEqual(refus, [])
  assert.equal(textes.get('018'), ['Read/Write **Trappings:** Writing Kit', '', '#### **Adviser — Silver 3**', '', '**Skills:** Consume Alcohol, Cool', ''].join('\n'))
  assert.equal(infidelite(avant, textes, sites), null)
})
