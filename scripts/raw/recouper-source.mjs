// RE-COUPE un livre déjà extrait au GRAIN DE SES SECTIONS (#1739) : le FLUX est fait des `.md` EN
// SERVICE du livre — jamais la sortie Marker, qui ne porte pas les réparations de contenu faites au
// `.md` (§ 7 de `docs/ajouter-un-livre-source.md`) —, les frontières viennent de la LISTE DE DÉCOUPE
// du livre (`scripts/raw/decoupes/<id>.json`) et la coupe se fait à la LIGNE du titre d'ouverture
// (`lib/marker-pages.mjs#couperAuxTitres`).
//
// FORME jamais SENS (#1739, #1388) : REFUS D'ÉCRIRE tant que le flux reconstruit depuis les fichiers
// écrits n'est pas identique À L'OCTET au flux lu. Cet outil ne déplace que des frontières de
// fichier.
//
// Le code ne NOMME aucun livre : le livre est un argument, sa liste est de la donnée, son dossier et
// son titre viennent du registre (`src/data/books.json`). Migrer le livre N+1 coûte UN fichier de
// donnée, zéro ligne ici.
//
// PORTÉE de la coupe, dite : la recherche est SÉQUENTIELLE (chaque titre après la coupe précédente),
// ce qui écarte un homonyme situé APRÈS la section qu'il double. Un homonyme situé AVANT ne tombe
// que par la fenêtre de PAGE, dont un flux de `.md` ne dispose pas (les ancres de page y sont rares) :
// la carte émise (`--carte`) est ce qui se relit pour le vérifier.
//
// Usage    : node scripts/raw/recouper-source.mjs <id du livre> [--dry] [--carte <fichier>]
// Idempotent : rejoué sur un livre déjà au grain, il n'écrit rien et sort 0.
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'
import { decoupeDe, readText, REGISTRE_LIVRES } from './_lib.mjs'
import { couperAuxTitres } from './lib/marker-pages.mjs'
import { INDEX } from './check-source-format.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import {
  estNomDExtraction, graphieDeChapitre, largeurDeChapitre, ligne1DePlage, numeroDuFichier,
  parseChapitre, plageDeLigne1, plageEnTexte,
} from '../../src/data/source/decoupe.ts'

/** Les `.md` de CHAPITRE d'un dossier, dans l'ordre de leur numéro — le FLUX du livre. */
export function chapitresEnService(dir) {
  return listerDossier(dir, { absent: 'lever' })
    .filter((n) => n.endsWith('.md') && numeroDuFichier(n) != null)
    .sort((a, b) => numeroDuFichier(a) - numeroDuFichier(b))
}

/** Nombre de lignes d'EN-TÊTE d'un chapitre : la ligne `*Pages PDF X-Y*` et la ligne vide qui la
 *  suit, ou 0 quand le fichier n'en porte pas — un livre sorti d'une autre chaîne d'extraction. */
export function lignesDEntete(lignes) {
  if (plageDeLigne1(lignes[0] ?? '') == null) return 0
  return lignes[1] === '' ? 2 : 1
}

/**
 * FLUX d'un livre : le corps de chaque chapitre (en-tête retiré), dans l'ordre, joint par une ligne
 * vide. C'est LA définition du « avant / après à l'octet » — les deux côtés passent par elle.
 * @param {{ nom: string, texte: string }[]} fichiers
 * @returns {{ flux: string, corps: string[], debuts: number[] }} `debuts` = indice de ligne, dans le
 *   flux, où commence le corps de chaque fichier.
 */
export function fluxDe(fichiers) {
  const corps = []
  const debuts = []
  let lignes = 0
  for (const { texte } of fichiers) {
    const l = texte.split('\n')
    const c = l.slice(lignesDEntete(l)).join('\n')
    debuts.push(lignes)
    lignes += c.split('\n').length
    corps.push(c)
  }
  return { flux: corps.join('\n'), corps, debuts }
}

/**
 * PLAN de re-découpe : une entrée par fichier à écrire, avec sa coupe, sa plage de lignes du flux,
 * son nom et son en-tête de pages. PUR.
 *
 * La plage `*Pages PDF X-Y*` est COPIÉE de la liste (`page`, `pageFin`) — elle est lue au LIVRE,
 * elle ne se calcule nulle part.
 *
 * Une entrée SANS titre imprimé n'a aucune ligne à reconnaître : sa coupe vient des ANCRES de page
 * du flux — la ligne où s'ouvrait le chapitre en service qui DÉCLARAIT cette page de début. Sans
 * ancre pour sa page, elle est NOMMÉE introuvable ; aucune coupe n'est devinée à sa place.
 * @param {string[]} lignes flux découpé en lignes
 * @param {{ titre: string, ouverture?: string, page: number, pageFin: number }[]} liste
 * @param {Map<number, number>} ancres page de début déclarée → ligne du flux
 */
export function planDe(lignes, liste, ancres = new Map()) {
  const sansAncre = liste.filter((e) => e.ouverture == null && !ancres.has(e.page))
    .map((e) => ({ cle: e.titre, ouverture: `(aucun titre imprimé, page ${e.page})`, depuis: 0, avant: lignes.length }))
  const { coupes, introuvables } = couperAuxTitres(lignes, liste.map((e) => ({
    cle: e.titre,
    ouverture: e.ouverture ?? null,
    ...(e.ouverture == null && ancres.has(e.page) ? { depuis: ancres.get(e.page) } : {}),
  })))
  if (introuvables.length || sansAncre.length) return { plan: [], introuvables: [...introuvables, ...sansAncre] }
  const largeur = largeurDeChapitre(liste.length)
  const plan = liste.map((e, i) => {
    return {
      nom: nomAscii(`${graphieDeChapitre(i + 1, largeur)} - ${e.titre}.md`),
      titre: e.titre,
      page: e.page,
      pageFin: e.pageFin,
      span: spanDe(e),
      de: coupes[i].ligne,
      a: i + 1 < coupes.length ? coupes[i + 1].ligne : lignes.length,
    }
  })
  return { plan, introuvables: [] }
}

/** Le CONTENU d'un fichier du plan : son en-tête, une ligne vide, puis sa tranche de flux TELLE
 *  QUELLE. Un corps qui ne finit pas par un saut de ligne en reçoit un — le seul octet que cet
 *  outil peut ajouter, et le contrôle à l'octet le voit. */
export const contenuDe = (lignes, e) => {
  const corps = lignes.slice(e.de, e.a).join('\n')
  return `${ligne1DePlage(e.page, e.pageFin)}\n\n${corps}${corps.endsWith('\n') ? '' : '\n'}`
}

/**
 * PLAGE d'une entrée de liste, en texte — une COPIE de la donnée : les deux découpeurs passent par
 * elle, et la forme vient de `plageEnTexte`. Une entrée sans plage lisible LÈVE en se NOMMANT : la
 * plage se lit au LIVRE, elle ne se déduit pas de la liste.
 * @param {{ titre: string, page: number, pageFin: number }} e @returns {string}
 */
export function spanDe(e) {
  try {
    return plageEnTexte(e.page, e.pageFin)
  } catch (err) {
    throw new Error(`recouper-source : « ${e.titre} » n'a pas de plage lisible — ${err.message}`, { cause: err })
  }
}

/** L'INDEX du dossier, à la forme que le découpeur produit. */
export const indexDe = (titreDuLivre, plan) =>
  `# ${titreDuLivre} — Index\n\n${plan.map((e) => `- [${e.nom.replace(/\.md$/, '')}](<${e.nom}>) — p.${e.span}`).join('\n')}\n`

/* ─── CARTE ancien → nouveau, et recalage des stocks ─────────────────────────────────────────── */

/** Section (`slug`, `occ`) → indice de ligne dans le FLUX, pour un fichier et son décalage. */
function sectionsAuFlux(texte, debut) {
  const entete = lignesDEntete(texte.split('\n'))
  const out = new Map()
  for (const s of parseChapitre(texte).sections) out.set(`${s.slug}#${s.occ}`, debut + (s.line - 1) - entete)
  return out
}

/**
 * CARTE des sections : `<ancien fichier> :: <slug>#<occ>` → `{ fichier, ref }` nouveaux. C'est elle
 * qui fait SUIVRE une entrée de stock keyée par chemin et par section (`slug#occ :: …`), sa `preuve`
 * et sa date avec elle.
 */
export function carteDesSections(anciens, debuts, plan, contenus) {
  const parLigne = new Map()
  plan.forEach((e) => {
    for (const [cle, ligne] of sectionsAuFlux(contenus.get(e.nom), e.de)) parLigne.set(ligne, { fichier: e.nom, ref: cle })
  })
  const carte = new Map()
  anciens.forEach(({ nom, texte }, i) => {
    for (const [cle, ligne] of sectionsAuFlux(texte, debuts[i])) {
      const cible = parLigne.get(ligne)
      if (cible) carte.set(`${nom} :: ${cle}`, cible)
    }
  })
  return carte
}

/**
 * ANCRES de page d'un flux : page de DÉBUT déclarée par un chapitre en service → ligne de son corps
 * dans le flux. Elles ne servent qu'à couper les fichiers SANS titre imprimé.
 * @returns {Map<number, number>}
 */
export function ancresDe(anciens, debuts) {
  const ancres = new Map()
  anciens.forEach(({ texte }, i) => {
    const plage = plageDeLigne1(texte.split('\n')[0] ?? '')
    if (plage && !ancres.has(plage.page)) ancres.set(plage.page, debuts[i])
  })
  return ancres
}

/**
 * LE GESTE, PUR : des chapitres en service et une liste de découpe → le plan, le contenu de chaque
 * fichier, la carte des sections, et le VERDICT à l'octet. Aucun accès disque ; `main` n'est que sa
 * coquille d'entrée/sortie.
 * @param {{ nom: string, texte: string }[]} anciens
 * @param {{ titre: string, ouverture?: string, page: number, pageFin: number }[]} liste
 * @returns {{ plan: object[], contenus: Map<string, string>, carte: Map<string, object>,
 *   introuvables: object[], ecart: { avant: string, apres: string, index: number } | null,
 *   flux: string, debuts: number[] }}
 */
export function recouper(anciens, liste) {
  const avant = fluxDe(anciens)
  const lignes = avant.flux.split('\n')
  const { plan, introuvables } = planDe(lignes, liste, ancresDe(anciens, avant.debuts))
  if (introuvables.length) return { plan: [], contenus: new Map(), carte: new Map(), introuvables, ecart: null, ...avant }
  const contenus = new Map(plan.map((e) => [e.nom, contenuDe(lignes, e)]))
  const apres = fluxDe(plan.map((e) => ({ nom: e.nom, texte: contenus.get(e.nom) })))
  const ecart = apres.flux === avant.flux ? null : {
    avant: avant.flux, apres: apres.flux,
    index: [...avant.flux].findIndex((c, k) => c !== apres.flux[k]),
  }
  const carte = ecart ? new Map() : carteDesSections(anciens, avant.debuts, plan, contenus)
  return { plan, contenus, carte, introuvables: [], ecart, ...avant }
}

/** Les stocks NOMINATIFS du dossier des gardes — tout `*-stock.json` : aucun n'est nommé ici. */
const stocksNominatifs = (dir) =>
  listerDossier(dir, { absent: 'vide' }).filter((n) => n.endsWith('-stock.json')).map((n) => join(dir, n))

const CLE_DE_REF = /^([a-z0-9-]*)#(\d+)(?= ::|$)/

/**
 * RECALE les entrées d'un stock qui pointent un `.md` du livre : le chemin suit la carte, et la
 * `ref` prend l'occurrence que la section a dans son NOUVEAU fichier. Rend les entrées recalées et
 * celles qu'aucune section ne porte — jamais devinées.
 * @returns {{ entrees: object[], recalees: string[], orphelines: string[] }}
 */
export function recalerStock(entrees, racine, carte) {
  const recalees = []
  const orphelines = []
  const out = entrees.map((e) => {
    const chemin = e.fichier ?? e.file
    if (typeof chemin !== 'string' || !chemin.startsWith(`${racine}/`)) return e
    const ancien = chemin.slice(racine.length + 1)
    const m = CLE_DE_REF.exec(String(e.ref ?? ''))
    const cible = m ? carte.get(`${ancien} :: ${m[0]}`) : null
    if (!cible) { orphelines.push(`${chemin} :: ${e.ref}`); return e }
    const neuf = { ...e, [e.fichier != null ? 'fichier' : 'file']: `${racine}/${cible.fichier}`, ref: String(e.ref).replace(CLE_DE_REF, cible.ref) }
    if (cible.fichier === ancien && neuf.ref === e.ref) return e
    recalees.push(`${ancien} :: ${e.ref}  →  ${cible.fichier} :: ${neuf.ref}`)
    return neuf
  })
  return { entrees: out, recalees, orphelines }
}

/* ─── CLI ────────────────────────────────────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2)
  const DRY = args.includes('--dry')
  const iCarte = args.indexOf('--carte')
  const fichierCarte = iCarte >= 0 ? args[iCarte + 1] : null
  const id = args.find((a) => !a.startsWith('--') && a !== fichierCarte)

  const livre = REGISTRE_LIVRES.find((b) => b.id === id && b.dir)
  if (!livre) {
    console.error(`recouper-source : « ${id} » n'est pas l'id d'un livre EXTRAIT de src/data/books.json`)
    process.exit(1)
  }
  const dir = livre.dir
  const racine = String(dir).split('\\').join('/').replace(/\/$/, '')
  const liste = decoupeDe(livre.id)

  const anciensNoms = chapitresEnService(dir)
  const anciens = anciensNoms.map((nom) => ({ nom, texte: readText(join(dir, nom)) }))
  const { plan, contenus, carte, introuvables, ecart, flux, debuts } = recouper(anciens, liste)
  if (introuvables.length) {
    console.error(`TITRES D'OUVERTURE INTROUVABLES dans le flux de ${racine} : ${introuvables.length} — rien n'est écrit.`)
    for (const i of introuvables) console.error(`  « ${i.ouverture} » (fichier « ${i.cle} »), cherché à partir de la ligne ${i.depuis} du flux`)
    process.exit(1)
  }
  if (ecart) {
    const i = ecart.index
    console.error(`REFUS : le flux reconstruit diffère du flux lu (${ecart.avant.length} octets → ${ecart.apres.length}, premier écart à ${i}) — rien n'est écrit.`)
    console.error(`  lu    : ${JSON.stringify(ecart.avant.slice(Math.max(0, i - 60), i + 60))}`)
    console.error(`  écrit : ${JSON.stringify(ecart.apres.slice(Math.max(0, i - 60), i + 60))}`)
    process.exit(1)
  }

  const index = indexDe(basename(racine), plan)
  const aSupprimer = listerDossier(dir, { absent: 'vide' })
    .filter((n) => n.endsWith('.md') && estNomDExtraction(n) && !contenus.has(n) && n !== INDEX)
  const aEcrire = plan.filter((e) => !existsSync(join(dir, e.nom)) || readText(join(dir, e.nom)) !== contenus.get(e.nom))
  const indexAEcrire = !existsSync(join(dir, INDEX)) || readText(join(dir, INDEX)) !== index

  // Recalage des stocks nominatifs keyés par chemin — aucun stock n'est nommé dans ce code.
  const ICI = join('scripts', 'raw')
  const stocks = []
  for (const chemin of stocksNominatifs(ICI)) {
    const brut = JSON.parse(readText(chemin))
    if (!Array.isArray(brut.entrees)) continue
    const r = recalerStock(brut.entrees, racine, carte)
    if (!r.recalees.length && !r.orphelines.length) continue
    stocks.push({ chemin, texte: `${JSON.stringify({ ...brut, entrees: r.entrees }, null, 2)}\n`, ...r })
  }

  const lignesCarte = [
    `# Carte de re-découpe — ${racine}`,
    '',
    `${anciens.length} fichier(s) en service → ${plan.length} fichier(s) au grain des sections ; flux de ${flux.length} octets, ${flux.split('\n').length} lignes.`,
    '',
    '| nouveau fichier | pages | lignes du flux | ancien fichier |',
    '| --- | --- | --- | --- |',
    ...plan.map((e) => {
      const i = debuts.findLastIndex((d) => d <= e.de)
      return `| ${e.nom} | ${e.span} | ${e.de}-${e.a - 1} | ${anciens[i].nom} |`
    }),
  ].join('\n')

  console.log(`${racine} : ${anciens.length} → ${plan.length} fichier(s) ; flux identique à l'octet (${flux.length} octets).`)
  console.log(`  à écrire : ${aEcrire.length} fichier(s)${indexAEcrire ? ' + index' : ''} ; à supprimer : ${aSupprimer.length}`)
  for (const s of stocks) {
    console.log(`  stock ${s.chemin} : ${s.recalees.length} entrée(s) recalée(s), ${s.orphelines.length} sans section porteuse`)
    for (const o of s.orphelines) console.log(`    NON RECALÉE : ${o}`)
  }

  if (DRY) {
    console.log(lignesCarte)
    console.log('--dry : rien écrit')
    return
  }

  for (const nom of aSupprimer) rmSync(join(dir, nom))
  for (const e of aEcrire) writeFileSync(join(dir, e.nom), contenus.get(e.nom))
  if (indexAEcrire) writeFileSync(join(dir, INDEX), index)
  for (const s of stocks) writeFileSync(s.chemin, s.texte)
  if (fichierCarte) writeFileSync(fichierCarte, `${lignesCarte}\n`)
  console.log(aEcrire.length || aSupprimer.length || indexAEcrire ? 'écrit' : 'déjà au grain — aucun changement')
}

const estMain = process.argv[1] && process.argv[1].endsWith('recouper-source.mjs')
if (estMain) main()
