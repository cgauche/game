// Banc des TITRES SOUDÉS (`lib/titres-soudes.mjs`, #1739) : P5 et titre à deux gras sur des lignes
// réelles du CRB, et, pour la forme P, la prose coupée et le recollement de deux morceaux.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estP5, estTitreADeuxGras, prosePrecedenteCoupee, recoller, sitesDeTitresSoudes } from './titres-soudes.mjs'

test('P5 : un gras de tête que suit un texte qui n’en est pas la prose ; étiquette, repère, minuscule et ponctuation exclus', () => {
  assert.equal(estP5('**Names** Add one Advance (+5) to any five of the following'), true)
  assert.equal(estP5('**Climb (S)** *basic* The ability to ascend'), true)
  assert.equal(estP5('**Combat Reflexes:** texte'), false)
  assert.equal(estP5('**40–42: Levy** An unexpected visit'), false)
  assert.equal(estP5('**A)** Choose one'), false)
  assert.equal(estP5('**Stunned** condition applies'), false)
  assert.equal(estP5('**Easy (+4 SL)**'), false)
  assert.equal(estP5('**Cost** — 5 XP'), false)
})

test('titre à deux groupes gras', () => {
  assert.equal(estTitreADeuxGras('#### **Bounce** **Cold-blooded**'), true)
  assert.equal(estTitreADeuxGras('#### **Bounce**'), false)
  assert.deepEqual(sitesDeTitresSoudes('x\n#### **A** **B**\n**Names** Add').map((s) => [s.ligne, s.classe]), [[2, 'deux-gras'], [3, 'p5']])
})

test('recoller : une espace ; le gras coupé par le saut redevient UN gras', () => {
  assert.equal(recoller('Your target must pass an **Average (+2 SL)** ', '**Cool** Test to break'), 'Your target must pass an **Average (+2 SL) Cool** Test to break')
  assert.equal(recoller('must take an', '**Easy (+4 SL)** x'), 'must take an **Easy (+4 SL)** x')
})

test('prose coupée (CRB 107 l.147-151) : la ligne de prose précédente, blanc sauté, si elle ne finit pas une phrase', () => {
  const lignes = ['see page 356', '', '**Infected:** Wounded opponents must take an', '', '**Easy (+4 SL)**', '', '**Endurance** Test to avoid a Festering Wound']
  assert.equal(prosePrecedenteCoupee(lignes, 4), 2)
  assert.equal(prosePrecedenteCoupee(lignes, 6), 4)
  assert.equal(prosePrecedenteCoupee(['must pass an **Average (+2 SL)** ', '**Cool** Test'], 1), 0)
})

test('prose coupée : une phrase FINIE, un titre, une table, une puce, une citation ou un blanc ne le sont pas', () => {
  for (const avant of ['Fin de phrase.', 'Fin **grasse.**', 'Label:', '### **Titre**', '| a | b |', '- puce', '> citation', '']) {
    assert.equal(prosePrecedenteCoupee([avant, '', '**Names** Add one'], 2), -1, avant)
  }
})
