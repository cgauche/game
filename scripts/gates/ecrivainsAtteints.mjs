// CONFRONTATION DE LA TABLE ÉCRIT/LU À LA SOURCE (#1679 L2 T1d) — pour chaque gate de `ci.yml`, les
// scripts LOCAUX qu'elle atteint (imports transitifs depuis la commande dépliée) et qui portent un
// appel d'ÉCRITURE de fichier.
//
// À quoi ça sert : `ECRIT_LU` (scripts/gates/toutes.mjs) est ce qui autorise deux gates à tourner en
// même temps. Une table qui se démode en silence est pire que pas de table — le cas est vécu :
// `test:hooks` mutait `scripts/hooks/ecrans-ui.json` (un fichier COMMITTÉ) sans que rien ne le dise,
// et le `finally` censé le remettre a échoué sous charge le 2026-09-04.
//
// CE QUE ÇA MESURE, ET CE QUE ÇA NE MESURE PAS : le grain est le SCRIPT, pas la ligne — une gate qui
// se met à atteindre un module écrivain de plus est vue ; une écriture NEUVE dans un module qui en
// portait déjà ne l'est pas. La lecture statique ne suit ni `require`, ni un chemin calculé, ni ce
// qu'un outil externe (eslint, knip, tsc, vitest) fait de son côté — d'où les entrées `lit`/`ecrit`
// de la table, qui restent une MESURE, pas une déduction.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { gatesRequises, commandeEffective } from '../guards/lib/justificatif.mjs'

/** Appels qui ÉCRIVENT sur le disque. Le `\b` évite `outputFile` dans une liste de drapeaux. */
const ECRITURE =
  /\b(?:writeFileSync|writeFile|createWriteStream|appendFileSync|appendFile|mkdirSync|mkdir|rmSync|rmdirSync|unlinkSync|renameSync|rename|cpSync|copyFileSync|truncateSync)\s*\(/

/** Une ligne de commentaire ou d'import ne prouve aucune écriture. */
const inerte = (ligne) => /^\s*(?:\/\/|\*|\/\*)/.test(ligne) || /^\s*import\s/.test(ligne)

/** Chemins de script d'une commande npm dépliée, tels que la racine les porte. */
function fichiersDe(commande, racine) {
  const out = []
  for (const jeton of commande.split(/\s+/))
    if (/^[\w./-]+\.(?:mjs|mts|js|ts)$/.test(jeton) && existsSync(join(racine, jeton))) out.push(jeton)
  return out
}

/** Résout un spécificateur RELATIF vers un chemin du dépôt, ou `null`. */
function resoudre(depuis, specificateur, racine) {
  if (!specificateur.startsWith('.')) return null
  const base = resolve(dirname(depuis), specificateur)
  for (const candidat of [base, `${base}.mjs`, `${base}.js`, `${base}.mts`, `${base}.ts`])
    if (existsSync(candidat)) return relative(racine, candidat).split('\\').join('/')
  return null
}

/** Fermeture transitive des imports locaux, depuis des graines relatives à la racine. */
export function transitif(graines, racine) {
  const vus = new Set()
  const pile = [...graines]
  while (pile.length) {
    const fichier = pile.pop()
    if (!fichier || vus.has(fichier)) continue
    vus.add(fichier)
    let texte
    try {
      texte = readFileSync(join(racine, fichier), 'utf8')
    } catch {
      continue
    }
    for (const motif of [/from\s+['"]([^'"]+)['"]/g, /import\(\s*['"]([^'"]+)['"]/g])
      for (const m of texte.matchAll(motif)) {
        const cible = resoudre(join(racine, fichier), m[1], racine)
        if (cible && !vus.has(cible)) pile.push(cible)
      }
  }
  return [...vus]
}

/** `true` si ce script porte au moins un appel d'écriture hors commentaire et hors import. */
export function porteUneEcriture(chemin, racine) {
  let texte
  try {
    texte = readFileSync(join(racine, chemin), 'utf8')
  } catch {
    return false
  }
  return texte.split('\n').some((l) => !inerte(l) && ECRITURE.test(l))
}

/** `{ [gate]: [scripts écrivains atteints, triés] }` pour toutes les gates de `ci.yml`. */
export function ecrivainsParGate(racine = process.cwd()) {
  const scripts = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8')).scripts ?? {}
  const par = {}
  for (const gate of gatesRequises({ cwd: racine })) {
    let commande = commandeEffective(scripts, gate.nom) || gate.commande
    for (let i = 0; i < 4; i += 1)
      commande = commande.replace(/npm run ([A-Za-z0-9:_.-]+)/g, (tel, nom) => (scripts[nom] ? `(${scripts[nom]})` : tel))
    par[gate.nom] = transitif(fichiersDe(commande, racine), racine)
      .filter((f) => porteUneEcriture(f, racine))
      .sort()
  }
  return par
}
