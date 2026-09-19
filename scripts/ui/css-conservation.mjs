#!/usr/bin/env node
// Preuve de CONSERVATION d'une migration CSS (#1806, épic #1811) — à jouer AVANT de committer un lot
// qui déplace des règles entre modules :
//   node scripts/ui/css-conservation.mjs [--base <ref git>] [--entree <feuille>]
// AVANT = la feuille d'entrée et ses imports à `<ref>` (défaut `HEAD`) ; APRÈS = le disque.
// Sortie : les déclarations DISPARUES et APPARUES (groupées par règle), les BASCULES de cascade
// causées par un changement de sélecteur, puis les INVERSIONS d'ordre à poids égal. Code de sortie
// 0 : la sonde RAPPORTE, elle ne juge pas — le reliquat d'une recomposition est la liste des
// changements voulus, à relire ; une bascule ou une inversion ne compte que si ses deux sélecteurs
// peuvent viser le même élément (angles morts : en-tête de `scripts/guards/lib/cssConservation.mjs`).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { aplatir, bascules, ecarts, inversions } from '../guards/lib/cssConservation.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const option = (nom, defaut) => {
  const i = process.argv.indexOf(nom)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut
}
const base = option('--base', 'HEAD')
const entree = option('--entree', 'src/ui/styles.css')

const lireAvant = (rel) => {
  try {
    return execFileSync('git', ['show', `${base}:${rel}`], { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}
const lireApres = (rel) => (existsSync(RACINE + rel) ? readFileSync(RACINE + rel, 'utf8') : null)

const avant = aplatir(entree, lireAvant)
const apres = aplatir(entree, lireApres)
const { disparues, apparues } = ecarts(avant, apres)

const parRegle = (liste) => {
  const m = new Map()
  for (const e of liste) {
    const k = `${e.rel} :: ${e.sel}${e.media ? ` ${e.media}` : ''}`
    m.set(k, [...(m.get(k) ?? []), `${e.prop}: ${e.valeur}`])
  }
  return [...m].map(([k, v]) => `  ${k}\n      ${v.join(' ; ')}`).join('\n')
}

console.log(`css-conservation — ${entree}, ${base} → disque : ${avant.length} → ${apres.length} déclarations`)
console.log(`\n=== DISPARUES (${disparues.length}) ===\n${parRegle(disparues)}`)
console.log(`\n=== APPARUES (${apparues.length}) ===\n${parRegle(apparues)}`)
const bas = bascules(avant, apres)
console.log(`\n=== BASCULES de cascade par changement de sélecteur (${bas.length}) ===`)
for (const x of bas) {
  console.log(`  ${x.avant}\n    → ${x.apres}\n      contre ${x.contre} : ${x.gagnaitAvant ? 'GAGNAIT' : 'perdait'} avant, ${x.gagneApres ? 'GAGNE' : 'perd'} après`)
}
const inv = inversions(avant, apres)
console.log(`\n=== INVERSIONS d'ordre à poids égal (${inv.length}) ===`)
for (const i of inv) {
  console.log(`  ${i.groupe}\n      ${i.a}  [${i.deplacements[0].join(' → ')}]\n      ${i.b}  [${i.deplacements[1].join(' → ')}]`)
}
