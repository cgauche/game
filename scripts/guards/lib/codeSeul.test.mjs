// PORTE DE RÔLE de la vue CODE SEUL (#1788) — le contrat porte sur la MÉCANIQUE de blanchiment,
// prouvée sur des formes NUES : prendre un fichier du dépôt pour fixture mesurerait l'arbre du jour,
// pas la primitive. Le motif témoin est l'identifiant `CIBLE`, qui n'existe nulle part ailleurs — un
// motif de garde réelle ferait de ce test le doublon de cette garde.
// Trois propriétés : (a) ce qui est PROSE ou DONNÉE ne porte plus rien, ce qui est CODE porte encore ;
// (b) les LIGNES sont préservées — un numéro rapporté sur la vue désigne la même ligne à la source ;
// (c) les DÉLIMITEURS de chaîne restent : la FORME d'un appel survit, sa donnée non.
// Patron des voisins de `scripts/guards/lib/` : `node:test` + `node:assert/strict`, exécutable par
// `node --test` nu.
import test from 'node:test'
import assert from 'node:assert/strict'
import { codeSeul } from './codeSeul.mjs'

test('codeSeul : prose et données blanchies, code intact', () => {
  const cas = [
    ['// CIBLE en commentaire de ligne', false, 'commentaire de ligne'],
    ['/* CIBLE en commentaire de bloc */', false, 'commentaire de bloc'],
    [`const s = 'CIBLE';`, false, 'chaîne simple quote'],
    [`const s = "CIBLE";`, false, 'chaîne double quote'],
    ['const s = `CIBLE`;', false, 'gabarit sans substitution'],
    ['CIBLE(1);', true, 'appel en code'],
    ['const s = `avant ${CIBLE(1)} après`;', true, 'substitution de gabarit — du CODE'],
    [`const rx = /['"]CIBLE/;`, true, 'littéral de regexp — du CODE'],
    [`const rx = /[']/; CIBLE(1);`, true, 'une quote DANS une regexp n’ouvre aucune chaîne'],
  ]
  for (const [source, attendu, quoi] of cas) {
    assert.equal(/CIBLE/.test(codeSeul(source)), attendu, `${quoi} — source : ${source}`)
    assert.equal(codeSeul(source).length, source.length, `${quoi} : la LONGUEUR est préservée`)
  }
})

test('codeSeul : lignes préservées — un numéro rapporté désigne la même ligne à la source', () => {
  const source = ['/* bloc', ' * prose CIBLE', ' */', 'CIBLE(1);', "const s = 'CIBLE';"].join('\n')
  const lignes = codeSeul(source).split('\n')
  assert.equal(lignes.length, 5, 'même nombre de lignes')
  assert.deepEqual(
    lignes.map((l, i) => (/CIBLE/.test(l) ? i + 1 : null)).filter((n) => n !== null),
    [4],
    'seule la ligne de CODE porte encore le motif, à son numéro d’origine',
  )
})

test('codeSeul : les délimiteurs de chaîne restent — la FORME de l’appel survit, sa donnée non', () => {
  assert.equal(codeSeul(`f('abc');`), `f('   ');`)
  assert.equal(codeSeul(`f("ab");`), `f("  ");`)
})
