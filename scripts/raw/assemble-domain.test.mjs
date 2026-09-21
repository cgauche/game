// L'ASSEMBLEUR des fiches de l'Atlas, côté CŒUR (#1825 lots E2, F0).
// Ce qu'il doit tenir : l'en-tête d'une fiche NOMME le cœur de règles REÇU (jamais une édition
// écrite en dur), le cœur ne se devine pas, et la fiche s'ÉCRIT SOUS son cœur — le CHEMIN déclare,
// si bien que deux cœurs portent le même domaine sans qu'aucun run n'écrase la fiche de l'autre.
// Les cœurs RÉELS viennent du registre par leur RÉGIME — aucun cœur nommé dans ce banc.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listerArbre } from '../guards/lib/lister.mjs'
import { coeursDuRegistre } from './_lib.mjs'
import { assemble, cheminDeFiche, coeurDuRendu, domainesSautes, dossierDuCoeur, RAWDIR, topicsInfideles } from './assemble-domain.mjs'

/** `assemble` ECRIT : tout ce qui le JOUE le pointe sur un Atlas JETABLE, jamais sur `docs/raw/`.
 *  Le refus de publier un topic infidèle est ce qu'on MESURE — il ne peut pas être aussi le filet
 *  qui empêche le banc de salir l'arbre. */
function avecAtlasJetable(cas) {
  const jetable = mkdtempSync(join(tmpdir(), 'atlas-assemble-'))
  try { return cas(jetable) } finally { rmSync(jetable, { recursive: true, force: true }) }
}

test('coeurDuRendu : LÈVE en nommant la cause quand l’entrée ne porte pas son cœur', () => {
  assert.throws(() => coeurDuRendu({ domain: 'x' }, {}, 'sortie.json'), /sortie\.json ne porte pas son `coeur`/)
  assert.throws(() => coeurDuRendu({ domain: 'x', coeur: '' }, {}), /ne porte pas son `coeur`/)
})

test('coeurDuRendu : le cœur du domaine l’emporte, sinon celui de la racine du rendu', () => {
  assert.equal(coeurDuRendu({ coeur: 'du-domaine' }, { coeur: 'de-la-racine' }), 'du-domaine')
  assert.equal(coeurDuRendu({}, { coeur: 'de-la-racine' }), 'de-la-racine')
})

test('cheminDeFiche : la fiche s’écrit SOUS son cœur — le chemin PORTE le cœur reçu', () => {
  for (const coeur of coeursDuRegistre()) {
    const chemin = cheminDeFiche(coeur, 'un-domaine').split('\\').join('/')
    assert.equal(chemin, `${RAWDIR}/${coeur}/un-domaine.md`)
    assert.equal(dossierDuCoeur(coeur).split('\\').join('/'), `${RAWDIR}/${coeur}`)
  }
})

// FIDÉLITÉ — le rendu du workflow porte, par topic, le verdict de sa passe de vérification
// (`faithful`) et ses `issues`. Trois valeurs, deux conclusions : seul `true` est une PREUVE.
// `false` = refus tenu jusqu'après la correction ; `null` = aucun verdict (l'agent de vérification
// n'a rien rendu). Publier l'un ou l'autre, c'est publier du texte que personne n'a confronté à la
// source — et la fiche ne dirait rien de ce silence.
const topic = (faithful, issues = []) => ({ topicId: 'un-topic', title: 'Un Topic', markdown: '## Un Topic\n\nUn corps.', refs: [], faithful, issues })

test('topicsInfideles : seul `faithful:true` est une preuve — `false` et `null` sont NOMMÉS', () => {
  assert.deepEqual(topicsInfideles([topic(true)]), [])
  assert.deepEqual(topicsInfideles([topic(false, ['une valeur fausse'])]), [
    { topicId: 'un-topic', verdict: 'fidelite REFUSEE', issues: ['une valeur fausse'] },
  ])
  assert.deepEqual(topicsInfideles([topic(null)]), [
    { topicId: 'un-topic', verdict: 'JAMAIS verifie', issues: [] },
  ])
})

// La clé `faithful` ABSENTE est le cas qu'un rendu tronqué produit (topic recopié à la main, rendu
// d'une version antérieure du workflow) : il ne dit RIEN de plus que `null`, et se refuse pareil.
// Sans ce banc, seul `!== true` le tenait — une comparaison qu'un `=== false` bien intentionné
// remplacerait sans rougir.
test('topicsInfideles : la clé `faithful` ABSENTE se juge comme `null` — aucun verdict, aucune preuve', () => {
  const sansCle = { topicId: 'un-topic', title: 'Un Topic', markdown: '## Un Topic\n\nUn corps.', refs: [] }
  assert.equal(Object.hasOwn(sansCle, 'faithful'), false)
  assert.deepEqual(topicsInfideles([sansCle]), [
    { topicId: 'un-topic', verdict: 'JAMAIS verifie', issues: [] },
  ])
  avecAtlasJetable((rawDir) => {
    const coeur = coeursDuRegistre()[0]
    assert.throws(
      () => assemble({ coeur, domain: 'un-domaine-jamais-declare', title: 'Un Domaine', topics: [sansCle] }, { rawDir }),
      /un-topic : JAMAIS verifie/,
    )
  })
})

test('assemble : un topic non prouvé fidèle REFUSE la publication, et n’écrit RIEN', () => {
  avecAtlasJetable((rawDir) => {
    const coeur = coeursDuRegistre()[0]
    const rendu = (faithful, issues) => ({ coeur, domain: 'un-domaine-jamais-declare', title: 'Un Domaine', topics: [topic(faithful, issues)] })
    assert.throws(
      () => assemble(rendu(false, ['une table reduite aux bornes']), { rawDir }),
      /un-domaine-jamais-declare.*1 topic\(s\).*un-topic : fidelite REFUSEE — une table reduite aux bornes/s,
    )
    assert.throws(() => assemble(rendu(null, []), { rawDir }), /un-topic : JAMAIS verifie/)
    // Le refus PRÉCÈDE l'écriture : aucune fiche ne reste sur le disque, ni dans l'Atlas jetable…
    assert.deepEqual(listerArbre(rawDir), [])
    // … ni dans l'Atlas RÉEL, que ce banc ne désigne jamais.
    assert.equal(existsSync(cheminDeFiche(coeur, 'un-domaine-jamais-declare')), false)
  })
})

// Le contrat POSITIF de la couture : un rendu PROUVÉ fidèle s'écrit — et il s'écrit DANS le `rawDir`
// reçu. Sans ce banc, pointer `rawDir` sur l'Atlas réel passerait inaperçu.
test('assemble : la fiche s’écrit dans le `rawDir` REÇU, sous le dossier de son cœur', () => {
  avecAtlasJetable((rawDir) => {
    const coeur = coeursDuRegistre()[0]
    const r = assemble({ coeur, domain: 'un-domaine-jamais-declare', title: 'Un Domaine', topics: [topic(true)] }, { rawDir })
    assert.equal(r.path, cheminDeFiche(coeur, 'un-domaine-jamais-declare', rawDir))
    assert.equal(existsSync(r.path), true)
    assert.equal(existsSync(cheminDeFiche(coeur, 'un-domaine-jamais-declare')), false)
  })
})

// DOMAINE SAUTÉ — le workflow le PORTE dans son rendu (`sautes`), et l'assemblage le REFUSE : une
// fiche manquante nomme alors la cause qui la tient, au lieu de se confondre avec une aire à extraire.
test('domainesSautes : la liste des sauts d’un rendu, entrées sans `domain` écartées', () => {
  assert.deepEqual(domainesSautes({}), [])
  assert.deepEqual(domainesSautes({ sautes: 'pas une liste' }), [])
  assert.deepEqual(
    domainesSautes({ sautes: [{ domain: 'un-domaine-saute', raison: 'cadrage VIDE' }, { raison: 'sans domaine' }, null] }),
    [{ domain: 'un-domaine-saute', raison: 'cadrage VIDE' }],
  )
})

test('assemble : un domaine que le rendu déclare SAUTÉ refuse la publication, et n’écrit RIEN', () => {
  avecAtlasJetable((rawDir) => {
    const coeur = coeursDuRegistre()[0]
    const racine = { coeur, domains: [], sautes: [{ domain: 'un-domaine-jamais-declare', raison: 'inventaire VIDE : la cartographie n a rien rapporte' }] }
    assert.throws(
      () => assemble({ domain: 'un-domaine-jamais-declare', title: 'Un Domaine', topics: [topic(true)] }, { racine, rawDir }),
      /« un-domaine-jamais-declare » SAUTÉ — inventaire VIDE/,
    )
    assert.deepEqual(listerArbre(rawDir), [])
    // Un domaine que `sautes` ne nomme PAS s'assemble normalement : le refus est ciblé.
    const r = assemble({ domain: 'un-autre-domaine', title: 'Un Autre', topics: [topic(true)] }, { racine, rawDir })
    assert.equal(existsSync(r.path), true)
  })
})

test('cheminDeFiche : DEUX cœurs portant le MÊME domaine rendent DEUX chemins — aucun run n’écrase l’autre', () => {
  const coeurs = coeursDuRegistre()
  if (coeurs.length < 2) return // registre à un seul cœur : rien à mesurer
  const chemins = coeurs.map((c) => cheminDeFiche(c, 'un-domaine'))
  assert.equal(new Set(chemins).size, coeurs.length)
})
