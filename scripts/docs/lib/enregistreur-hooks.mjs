// Volet « graphe de modules » de l'enregistreur de lectures (#1679 L1b) — hooks de personnalisation
// de modules (`module.register`), enregistrés par `enregistreur-lectures.mjs`.
//
// RAISON MESURÉE : un générateur `runner: 'tsx'` ne lit presque rien lui-même — ses sources sont les
// modules `.ts` qu'il importe, et tsx les charge dans le THREAD DES HOOKS, où l'enveloppe de `fs`
// posée par `--import` (thread principal) ne va pas. Mesure 2026-09-02 : `gen-sorts-doc.mts` rend
// 0 source par l'enveloppe seule, alors qu'il dépend de tout `src/data`. Le hook `load` voit l'URL
// de chaque module chargé, tsx compris (tsx délègue la lecture par `nextLoad`).
//
// Chaque URL retenue est APPENDUE (le thread des hooks n'a pas d'événement de sortie fiable) dans
// `<sortie>.<pid>.hooks.jsonl` ; `fusionnerLectures` réunit ce fichier et ceux du thread principal.
import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXCLUS = /(^|\/)(?:node_modules|\.git|\.cache|dist)(?:\/|$)/

let racine = null
let sortie = null
let cibles = new Set()
const vus = new Set()

export function initialize(donnees) {
  racine = donnees.racine
  sortie = donnees.sortie
  cibles = new Set(donnees.cibles ?? [])
}

export async function load(url, contexte, suivant) {
  noter(url)
  return suivant(url, contexte)
}

function noter(url) {
  try {
    if (!racine || !sortie || !url.startsWith('file:')) return
    const abs = fileURLToPath(url)
    if (abs !== racine && !abs.startsWith(racine + path.sep)) return
    const rel = path.relative(racine, abs).split(path.sep).join('/')
    if (!rel || EXCLUS.test(rel) || cibles.has(rel) || vus.has(rel)) return
    vus.add(rel)
    appendFileSync(`${sortie}.${process.pid}.hooks.jsonl`, `${rel}\n`)
  } catch { /* un module non enregistrable ne casse jamais le générateur */ }
}
