// SONDE des TITRES D'ENTRÉE d'un livre extrait (#1739) : apparie chaque titre IMPRIMÉ au PDF (gabarit
// typographique `gabaritTitre` de `scripts/raw/decoupes/<id>.json`) à la ligne du `.md` qui précède la
// 1re ligne de SON corps, et classe chaque écart. Lecture seule : rien n'est écrit sous le dépôt.
//
// Le CORPS est l'ancre (il ne bouge jamais) : il se localise au PDF comme les lignes qui suivent le
// titre dans l'ordre de lecture (`scripts/raw/lib/colonnes.mjs`), puis dans le `.md`.
// FAMILLES : `entree` (le run de tête contient la typographie `titre`), `encadre` (le run commence par
// la typographie `encadre`, corps en prose), `tableau` (même typographie, corps en ligne de tableau `|`),
// `capitales` (le run est de la typographie `capitales` : titres de section en petites capitales, noms
// de créature compris), `intertitre` (le run commence par la typographie `intertitre` : titres du fil du
// texte d'un corps plus petit, événements et niveaux de carrière compris). `entree` et `intertitre` sont
// les familles d'ENTRÉE (`ENTREES`).
// FORMES (`FORMES`) :
//  — S : titre soudé à son corps ;
//  — F : gras de tête (hors étiquette `X:`) soudé à un corps ÉTRANGER, souvent celui de son JUMEAU
//    (titre imprimé au même y de la même page) ;
//  — M : titre migré (ligne de titre isolée, gras seul, ou groupe d'un titre composite avec son jumeau,
//    ailleurs) ;
//  — S′ : titre absent du livre comme titre et comme fragment, restauré ; les MENTIONS en prose sont
//    rapportées, elles ne valent pas fragment ;
//  — B : gras sans `#` ;
//  — O : entrée hors de l'ordre du PDF, à poser `devant` le titre qui la suit au PDF ;
//  — P : paragraphe scindé au milieu d'une phrase — une ligne du `.md` ouverte par un gras sans `:`,
//    que précède une ligne de prose coupée (`lib/titres-soudes.mjs#prosePrecedenteCoupee`), PROUVÉE au
//    PDF par deux lignes CONSÉCUTIVES d'une colonne au gras CONTINU d'une ligne à l'autre ;
//  — N : niveau différent du frère de même famille qui précède (rapporté) ;
//  — `corps-introuvable`, avec sa cause (`sans-ligne` : suivi d'un autre titre ; `cle-courte` : aucune
//    ligne de corps de deux mots ; `hors-md` : corps absent des `.md` de sa page) ;
//  — `cible-invalide` : une cible qui n'est pas le DÉBUT d'un bloc Markdown ;
//  — `doublon` : DÉBRIS devant un corps dont le titre est à sa place (toutes familles), un titre imprimé
//    UNE fois au PDF et porté une seconde fois par le `.md` — preuve : les deux comptes.
// Pour les encadrés, les tableaux et les capitales, seules S et F sont rendues (leur place dans le `.md`
// suit la mise en page, pas l'ordre du PDF), et, des capitales, le S′ par COMPTAGE : un titre que les
// pages de son fichier impriment PLUS de fois que son `.md` ne le porte (une fois au moins).
// Toute CIBLE (`cible`, `devant`) est le DÉBUT d'un bloc Markdown ; une ligne de tableau se remonte à
// l'en-tête de son bloc ; sinon le site sort en `cible-invalide`, avec sa forme visée et la ligne visée.
// `titreMd` : le texte EXACT du titre dans le `.md` (S, F, M, B, O), ce que la réparation déplace.
// Les ancres `<span id="page-…"></span>` ne comptent pas (`stripSpans`, `src/data/source/decoupe.ts`).
//
// Usage :
//   node scripts/raw/sonde-titres.mjs <id> [--boites <boites.json>] [--json <sortie.json>]
//   `--boites` : le JSON de `scripts/raw/lib/pdf-lignes.py` déjà produit (sinon la sonde le produit
//   dans un dossier temporaire) ; `--json` : les sites, pour la réparation, HORS du dépôt.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decoupeDe, gabaritTitreDe, livreExtraitDe, nomsDeLaListe, normalize, readText } from './_lib.mjs'
import { lignes } from './lib/colonnes.mjs'
import { stripSpans } from '../../src/data/source/decoupe.ts'
import { grasOuvert, prosePrecedenteCoupee } from './lib/titres-soudes.mjs'
import { canoniser, relatifSousRacine } from '../docs/lib/chemin-mesure.mjs'

const PDF_LIGNES = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'pdf-lignes.py')

/** Forme de comparaison : `normalize` (emphase, tirets, apostrophes, casse), plus le glyphe de
 *  remplacement que l'extraction PDF rend pour l'apostrophe, l'échappement Markdown, les préfixes de
 *  ligne (`#`, `>`, puce `-`) et les séparateurs de cellule de tableau (`|`). PURE. */
export const cle = (s) =>
  normalize(stripSpans(String(s)).replace(/^(?:#{1,6}|>|-)\s+/, '').replace(/\\(.)/g, '$1').replace(/[\ufffd‘]/g, "'").replace(/\|/g, ' '))

const cleDeTitre = (s) => cle(s).replace(/:$/, '')

/** Clé d'un titre IMPRIMÉ : sans préfixe Markdown à ôter (`# Tentacles` est le titre). PURE. */
export const cleDuPdf = (s) => normalize(String(s).replace(/[\ufffd‘]/g, "'")).replace(/:$/, '')

const memeTypo = (s, t) => s.police === t.police && (t.taille == null || Math.abs(s.taille - t.taille) < 0.5)

/**
 * Les TITRES imprimés d'une page, dans l'ordre de lecture : une ligne dont le RUN de tête (spans
 * consécutifs aux typographies du gabarit) CONTIENT la typographie `titre` (entrée), COMMENCE par
 * `encadre` (encadré ou tableau), par `capitales` ou par `intertitre`, et dont aucun span n'est d'une typographie
 * `exclusions`. `texte` = la ligne quand le run la couvre (espacement lu par pdfminer : `T`+`roll` =
 * `Troll`), sinon les spans du run séparés d'une espace. Un titre imprimé sur DEUX lignes (lignes de
 * titre consécutives, même gabarit, même colonne, interligne < 1,4 × la taille) est UN titre ; `fin` =
 * l'indice de sa dernière ligne. PURE.
 * @returns {{ index: number, fin: number, texte: string, gabarit: 'entree' | 'encadre' | 'capitales' | 'intertitre' }[]}
 */
export function titresDeLaPage(lignesDeLaPage, gabarit) {
  const out = []
  const familles = [
    ['entree', [gabarit.titre, ...gabarit.accompagnement], gabarit.titre],
    ['encadre', [gabarit.encadre], gabarit.encadre],
    ['capitales', [gabarit.capitales], gabarit.capitales],
    ['intertitre', [gabarit.intertitre], gabarit.intertitre],
  ]
  lignesDeLaPage.forEach((l, index) => {
    if (l.spans.some((s) => gabarit.exclusions.some((t) => memeTypo(s, t)))) return
    for (const [nom, typos, tete] of familles) {
      let n = 0
      while (n < l.spans.length && typos.some((t) => memeTypo(l.spans[n], t))) n++
      const run = l.spans.slice(0, n)
      if (run.some((s) => memeTypo(s, tete))) {
        const texte = n === l.spans.length ? l.texte : run.map((s) => s.texte).join(' ')
        const p = out.at(-1)
        const q = lignesDeLaPage[index - 1]
        if (p && p.fin === index - 1 && p.gabarit === nom && q.colonne === l.colonne && q.y0 - l.y0 > 0 && q.y0 - l.y0 < 1.4 * l.spans[0].taille) {
          Object.assign(p, { fin: index, texte: `${p.texte} ${texte}` })
        } else out.push({ index, fin: index, texte, gabarit: nom })
        return
      }
    }
  })
  return out
}

/** Clés de CORPS d'un titre, une par ligne qui le suit dans l'ordre de lecture (3 au plus) : ses 8
 *  premiers mots, sans le dernier au-delà de 3 (césure possible), 2 mots au moins. Une ligne du PDF ne
 *  déborde jamais sur la suivante : le `.md` peut couper là où le PDF enchaîne. PURE. */
export function clesDeCorps(suivantes) {
  const cles = []
  for (const l of suivantes) {
    const m = cle(l).split(' ').filter(Boolean)
    const k = (m.length > 3 ? m.slice(0, -1) : m).slice(0, 8)
    if (k.length >= 2) cles.push(k.join(' '))
    if (cles.length === 3) break
  }
  return cles
}

/** Ligne de titre Markdown : `{ niveau, texte, groupes }` (groupes gras), ou null. PURE. */
export function enTete(ligne) {
  const m = /^(#{1,6})\s+(.*)$/.exec(stripSpans(ligne))
  if (!m) return null
  return { niveau: m[1].length, texte: cleDeTitre(m[2]), groupes: [...m[2].matchAll(/\*\*([^*]+)\*\*/g)].map((g) => cleDeTitre(g[1])) }
}

/** Ligne FAITE d'un seul groupe gras (titre sans `#`) : son texte, ou null. PURE. */
export const grasSeul = (ligne) => {
  const m = /^\*\*([^*]+)\*\*\s*$/.exec(stripSpans(ligne).trimStart())
  return m ? cleDeTitre(m[1]) : null
}

/** Groupe gras de TÊTE d'une ligne (après `#` éventuels) : `{ texte, reste, etiquette }` —
 *  `etiquette` : le groupe finit par `:` (étiquette en ligne, `**Combat Reflexes:** …`) —, ou null. PURE. */
export const grasDeTete = (ligne) => {
  const m = /^(?:#{1,6}\s+)?\*\*([^*]+)\*\*\s*(.*)$/.exec(stripSpans(ligne).trimStart())
  return m ? { texte: cleDeTitre(m[1]), reste: m[2], etiquette: /:\s*$/.test(m[1]) } : null
}

/** Le texte EXACT d'un titre de clé `k` dans sa ligne `.md` : le plus court préfixe (`#` compris)
 *  de clé `k`, sinon le groupe gras de clé `k` (titre composite), sinon null. PURE. */
export function texteExact(ligne, k) {
  for (const m of ligne.matchAll(/\s|$/g)) {
    const p = ligne.slice(0, m.index).trim()
    if (p && cleDeTitre(p) === k) return p
  }
  return [...ligne.matchAll(/\*\*[^*]+\*\*/g)].find((g) => cleDeTitre(g[0]) === k)?.[0] ?? null
}

/** La casse d'un titre du `.md` : `titre` (chaque mot capitalisé), `majuscules`, ou `autre`. PURE. */
export const casseDe = (texte) => {
  const mots = texte.match(/\p{L}+/gu) ?? []
  if (mots.length && mots.every((m) => m === m.toUpperCase()) && mots.some((m) => m.length > 1)) return 'majuscules'
  return mots.length && mots.every((m) => m[0] === m[0].toUpperCase() && m.slice(1) === m.slice(1).toLowerCase()) ? 'titre' : 'autre'
}

/** Le texte `texte` dans la casse `casse` (`casseDe`), ou null pour `autre`. PURE. */
export const enCasse = (texte, casse) =>
  casse === 'majuscules' ? texte.toUpperCase() : casse === 'titre' ? texte.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : null

/** Indices de la plus longue sous-suite croissante de `vals` (ordre du PDF tenu par le `.md`). PURE. */
export function plusLongueCroissante(vals) {
  const pred = new Array(vals.length).fill(-1)
  const fins = []
  vals.forEach((v, i) => {
    let lo = 0
    let hi = fins.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (vals[fins[mid]] < v) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) pred[i] = fins[lo - 1]
    fins[lo] = i
  })
  const garde = new Set()
  for (let i = fins.at(-1) ?? -1; i >= 0; i = pred[i]) garde.add(i)
  return garde
}

/**
 * Le CLASSEMENT (PUR) : `pages` = `[{ page, lignes }]` dans l'ordre de lecture (`lib/colonnes.mjs`),
 * `fichiers` = `[{ nom, page, pageFin, lignes }]` dans l'ordre du livre, `gabarit` = `gabaritTitre`.
 * Rend `{ sites, titres }` : un site par écart, `titres` = tous les titres du PDF avec leur forme et leur
 * famille (`ok` compris).
 */
export function classer(pages, fichiers, gabarit) {
  const flux = pages.flatMap((p) => p.lignes.map((l) => ({ ...l, page: p.page })))
  const debutDePage = new Map()
  let n = 0
  for (const p of pages) {
    debutDePage.set(p.page, n)
    n += p.lignes.length
  }
  const titres = pages.flatMap((p) =>
    titresDeLaPage(p.lignes, gabarit).map((t) => ({ ...t, index: debutDePage.get(p.page) + t.index, fin: debutDePage.get(p.page) + t.fin, page: p.page })),
  )
  const estTitre = new Set(titres.flatMap((t) => Array.from({ length: t.fin - t.index + 1 }, (_, k) => t.index + k)))
  const cles = fichiers.map((f) => f.lignes.map(cle))
  const fichiersDeLaPage = (p) => [...fichiers.keys()].filter((i) => fichiers[i].page <= p + 1 && p <= fichiers[i].pageFin)
  const precedente = (fi, li) => {
    for (let f = fi, l = li - 1; f >= 0; f--, l = f >= 0 ? fichiers[f].lignes.length - 1 : 0) {
      for (; l >= 0; l--) if (fichiers[f].lignes[l].trim() && !/^\*Pages PDF/.test(fichiers[f].lignes[l])) return { f, l }
    }
    return null
  }
  const tousTitres = new Set(titres.map((t) => cleDuPdf(t.texte)))
  const clesDuFlux = flux.map((l) => ({ page: l.page, cle: cleDuPdf(l.texte) }))
  // DÉBRIS `k` devant un corps du fichier `f` : texte imprimé au PDF sur ses pages et porté plus de fois
  // par son `.md` (doublon). Un autre texte n'est pas un débris : la clé de corps a été trouvée plus
  // loin dans sa ligne.
  const debris = (k, f) => {
    const auPdf = clesDuFlux.filter((l) => fichiers[f].page <= l.page && l.page <= fichiers[f].pageFin && l.cle.startsWith(k))
    const auMd = cles[f].flatMap((c, j) => (c.startsWith(k) ? [adresse(f, j)] : []))
    if (auPdf.length && auMd.length > auPdf.length) return { forme: 'doublon', texte: k, auMd, auPdf: auPdf.map((l) => `p.${l.page} « ${l.cle} »`) }
    return null
  }
  const pris = new Set()
  let curseur = { f: -1, l: -1 }
  const adresse = (f, l) => `${fichiers[f].nom.slice(0, 3)}:${l + 1}`

  for (const t of titres) {
    const l = flux[t.index]
    Object.assign(t, { colonne: l.colonne, x0: l.x0, y0: l.y0, cle: cleDuPdf(t.texte), famille: t.gabarit })
    // Une ligne IMPRIMÉE que pdfminer rend en plusieurs boîtes (même page, colonne et y) est UNE ligne,
    // ses morceaux de gauche à droite.
    const morceaux = []
    for (let i = t.fin + 1; i < flux.length && morceaux.length < 6 && flux[i].page <= t.page + 1; i++) {
      if (estTitre.has(i)) break
      const p = morceaux.at(-1)?.[0]
      if (p && p.page === flux[i].page && p.colonne === flux[i].colonne && Math.abs(p.y0 - flux[i].y0) < 1) morceaux.at(-1).push(flux[i])
      else morceaux.push([flux[i]])
    }
    const suivantes = morceaux.map((m) => m.sort((x, y) => x.x0 - y.x0).map((x) => x.texte).join(' '))
    t.corpsPdf = suivantes[0] ?? null
    t.cles = clesDeCorps(suivantes)
    t.corps = null
    for (const k of t.cles) {
      const vus = fichiersDeLaPage(t.page).flatMap((fi) =>
        cles[fi].flatMap((c, j) => (c.includes(k) && !pris.has(`corps ${fi}:${j}:${k}`) ? [{ f: fi, l: j, cle: k }] : [])),
      )
      t.corps = vus.find((v) => v.f > curseur.f || (v.f === curseur.f && v.l > curseur.l)) ?? vus[0] ?? null
      if (t.corps) break
    }
    if (!t.corps) {
      t.forme = 'corps-introuvable'
      t.cause = !suivantes.length ? 'sans-ligne' : !t.cles.length ? 'cle-courte' : 'hors-md'
      continue
    }
    curseur = t.corps
    const { f, l: li, cle: k } = t.corps
    pris.add(`corps ${f}:${li}:${k}`)
    if (t.gabarit === 'encadre' && /^\s*\|/.test(fichiers[f].lignes[li])) t.famille = 'tableau'
    const pos = cles[f][li].indexOf(k)
    const prefixe = cles[f][li].slice(0, pos).trim().replace(/:$/, '')
    if (pos > 0 && prefixe === t.cle) {
      t.forme = 'S'
      t.titreMd = { f, l: li }
      pris.add(`titre ${f}:${li}`)
      continue
    }
    {
      // Un corps en LISTE se lit dès sa 1re puce : on remonte les puces qui précèdent la ligne trouvée.
      let depuis = li
      while (/^- /.test(fichiers[f].lignes[depuis] ?? '') && /^- /.test(fichiers[f].lignes[precedente(f, depuis)?.l ?? -1] ?? '') && precedente(f, depuis).f === f) {
        depuis = precedente(f, depuis).l
      }
      const p = precedente(f, depuis)
      const h = p && enTete(fichiers[p.f].lignes[p.l])
      if (h && h.texte === t.cle) {
        t.forme = 'ok'
        if (pos > 0 && !tousTitres.has(prefixe) && !/^\s*\|/.test(fichiers[f].lignes[li])) {
          t.debris = debris(prefixe, f)
          if (t.debris) t.debris.texteMd = texteExact(fichiers[f].lignes[li], prefixe)
        }
        t.titreMd = { ...p, niveau: h.niveau }
        pris.add(`titre ${p.f}:${p.l}`)
        continue
      }
      if (p && grasSeul(fichiers[p.f].lignes[p.l]) === t.cle) {
        t.forme = 'B'
        t.titreMd = p
        pris.add(`titre ${p.f}:${p.l}`)
        continue
      }
    }
    t.forme = 'absent'
  }

  // Titre ABSENT devant son corps : son occurrence LIBRE la plus proche (fichiers de sa page, puis le
  // livre). Ne vaut titre ou fragment qu'une ligne de titre isolée, un gras seul, un groupe d'un titre
  // composite avec son JUMEAU, ou un gras de TÊTE de ligne qui n'est pas une étiquette (`X:`) : soudé au
  // corps de son jumeau ou à un autre corps. Le reste est MENTION.
  // Règle du DOUBLON inversée : les pages du fichier de son corps impriment le titre PLUS de fois que
  // ce `.md` ne le porte, une fois au moins (le `.md` a gardé l'en-tête de profil, perdu le titre).
  const comptage = (t) => {
    const f = t.corps.f
    const auPdf = clesDuFlux.filter((l) => fichiers[f].page <= l.page && l.page <= fichiers[f].pageFin && l.cle === t.cle).length
    const auMd = cles[f].filter((c) => c === t.cle).length
    return auMd && auPdf > auMd ? { auPdf, auMd } : null
  }
  const jumeaux = (t) => titres.filter((u) => u !== t && u.page === t.page && Math.abs(u.y0 - t.y0) <= 2)
  const ordreDeRecherche = (p) => [...new Set([...fichiersDeLaPage(p), ...fichiers.keys()])]
  for (const t of titres.filter((x) => x.forme === 'absent')) {
    const siens = jumeaux(t)
    const entree = ENTREES.has(t.famille)
    let vu = null
    for (const fi of ordreDeRecherche(t.page)) {
      for (let li = 0; li < fichiers[fi].lignes.length && !vu; li++) {
        if (pris.has(`titre ${fi}:${li}`)) continue
        const ligne = fichiers[fi].lignes[li]
        const h = enTete(ligne)
        const tete = grasDeTete(ligne)
        if (entree && h && h.texte === t.cle) vu = { forme: 'M', f: fi, l: li, comment: 'ligne de titre isolée' }
        else if (entree && grasSeul(ligne) === t.cle) vu = { forme: 'M', f: fi, l: li, comment: 'gras seul' }
        else if (entree && h && h.groupes.includes(t.cle) && siens.some((u) => h.groupes.includes(u.cle))) {
          vu = { forme: 'M', f: fi, l: li, comment: 'groupe d’un titre composite avec son jumeau' }
        } else if (tete && tete.texte === t.cle && !tete.etiquette && tete.reste.trim()) {
          const jumeau = siens.some((u) => u.cles.some((k) => cle(tete.reste).startsWith(k)))
          vu = { forme: 'F', f: fi, l: li, comment: jumeau ? 'soudé en tête du corps de son jumeau' : 'soudé en tête d’un corps étranger' }
        }
      }
      if (vu) break
    }
    if (vu) {
      Object.assign(t, { forme: vu.forme, titreMd: { f: vu.f, l: vu.l }, comment: vu.comment })
      if (!vu.comment.startsWith('groupe')) pris.add(`titre ${vu.f}:${vu.l}`)
    } else {
      t.forme = "S'"
      t.mentions = fichiers.flatMap((fx, fi) => fx.lignes.flatMap((x, li) => (cles[fi][li].includes(t.cle) ? [adresse(fi, li)] : [])))
      if (t.famille === 'capitales' && t.corps) t.comptage = comptage(t)
    }
  }

  // O : l'entrée (titre et corps) hors de la plus longue sous-suite qui tient l'ordre du PDF, parmi les
  // ENTRÉES seules (`ENTREES` ; encadrés, tableaux et capitales suivent la mise en page).
  const places = titres.filter((t) => t.corps && ENTREES.has(t.famille))
  const tenus = plusLongueCroissante(places.map((t) => t.corps.f * 1e6 + t.corps.l))
  places.forEach((t, i) => {
    if (!tenus.has(i)) t.hors = true
  })

  // N : niveau différent du frère de même famille qui le précède dans le même fichier.
  const dernier = new Map()
  for (const t of titres) {
    if (t.forme !== 'ok') continue
    const k = `${t.famille} ${t.titreMd.f}`
    const avant = dernier.get(k)
    if (avant && avant.titreMd.niveau !== t.titreMd.niveau) {
      t.niveauErratique = { niveau: t.titreMd.niveau, frere: avant.texte, niveauFrere: avant.titreMd.niveau }
    }
    dernier.set(k, t)
  }

  // Toute CIBLE (`cible`, `devant`) est le DÉBUT d'un bloc Markdown : ligne non vide, en tête de fichier
  // ou après une ligne vide ou un titre. Une ligne de tableau se remonte d'abord au DÉBUT de son bloc
  // contigu (l'en-tête). Sinon le site sort en `cible-invalide`, avec la forme visée : poser un titre là
  // casserait le bloc.
  const debutDeBloc = ({ f, l }) => {
    const x = fichiers[f].lignes
    if (/^\s*\|/.test(x[l] ?? '')) while (l > 0 && /^\s*\|/.test(x[l - 1])) l--
    return x[l]?.trim() && (l === 0 || !x[l - 1].trim() || enTete(x[l - 1])) ? { f, l } : null
  }
  const sites = []
  const emettre = (s, cibles) => {
    const poses = {}
    for (const [champ, v] of Object.entries(cibles)) {
      if (!v) continue
      const d = debutDeBloc(v)
      if (!d) return sites.push({ ...s, forme: 'cible-invalide', formeVisee: s.forme, champ, [champ]: adresse(v.f, v.l), ligneCible: fichiers[v.f].lignes[v.l] })
      poses[champ] = adresse(d.f, d.l)
    }
    sites.push({ ...s, ...poses })
  }
  const cible = (t) => (t.corps ? adresse(t.corps.f, t.corps.l) : null)
  const ouEst = (t) => t.titreMd ?? t.corps
  const exact = (t) => (t.titreMd ? texteExact(fichiers[t.titreMd.f].lignes[t.titreMd.l], t.cle) : null)
  // La LIGNE DE TITRE à poser : niveau du FRÈRE TYPOGRAPHIQUE précédent (titre du PDF de même gabarit, à
  // sa place dans le MÊME fichier que son corps ; le suivant pour le premier du fichier), gras comme lui ;
  // texte = celui du `.md` (`titreMd`), ou, restauré (S′), le texte imprimé — des capitales, dans la
  // casse du frère (le span SC700 n'en porte pas).
  const poser = (t, i, texteMd) => {
    let u = null
    const frere = (j) => titres[j].gabarit === t.gabarit && titres[j].forme === 'ok' && titres[j].titreMd.f === t.corps.f
    for (let j = i - 1; j >= 0 && !u; j--) if (frere(j)) u = titres[j]
    for (let j = i + 1; j < titres.length && !u; j++) if (frere(j)) u = titres[j]
    if (!u) return { ligneTitre: null, frere: null }
    const ligneU = stripSpans(fichiers[u.titreMd.f].lignes[u.titreMd.l]).replace(/^#{1,6}\s+/, '')
    const nu = texteMd ? texteMd.replace(/^#{1,6}\s+/, '') : ENTREES.has(t.famille) ? t.texte : enCasse(t.texte, casseDe(ligneU.replace(/\*/g, '')))
    const texte = nu && /^\*\*[^*]+\*\*/.test(ligneU) && !nu.startsWith('**') ? `**${nu}**` : nu && grasOuvert(nu) ? `${nu}**` : nu
    return { ligneTitre: texte ? `${'#'.repeat(u.titreMd.niveau)} ${texte}` : null, frere: `${adresse(u.titreMd.f, u.titreMd.l)} « ${u.texte} »` }
  }
  // Un titre DÉPLACÉ vers un autre fichier (F, M, O) : sa page doit tenir dans la découpe de celui-ci.
  const decoupe = (t, vers) => {
    const de = t.titreMd?.f
    if (vers == null || de == null || de === vers.f) return {}
    const ok = fichiers[vers.f].page <= t.page && t.page <= fichiers[vers.f].pageFin
    return { interFichiers: `${fichiers[de].nom.slice(0, 3)} → ${fichiers[vers.f].nom.slice(0, 3)}, p.${t.page} ${ok ? 'dans' : 'HORS de'} ${fichiers[vers.f].page}-${fichiers[vers.f].pageFin}`, horsDecoupe: !ok }
  }
  titres.forEach((t, i) => {
    const base = { famille: t.famille, page: t.page, colonne: t.colonne, x0: t.x0, y0: t.y0, titre: t.texte }
    const site = t.titreMd ? adresse(t.titreMd.f, t.titreMd.l) : null
    if (t.debris) sites.push({ ...t.debris, site: cible(t), ...base })
    const pose = () => poser(t, i, t.forme === "S'" ? null : exact(t))
    if (!ENTREES.has(t.famille)) {
      if (t.forme === 'S') sites.push({ forme: 'S', site, titreMd: exact(t), ...pose(), ...base })
      else if (t.forme === 'F') emettre({ forme: 'F', site, titreMd: exact(t), cible: cible(t), ...pose(), ...decoupe(t, t.corps), comment: t.comment, ...base }, { cible: t.corps })
      else if (t.forme === "S'" && t.comptage) emettre({ forme: "S'", site: null, cible: cible(t), ...pose(), mentions: t.mentions, comptage: t.comptage, ...base }, { cible: t.corps })
      return
    }
    if (t.forme === 'S' || t.forme === 'B') sites.push({ forme: t.forme, site, titreMd: exact(t), ...pose(), ...base })
    else if (t.forme === 'F' || t.forme === 'M') emettre({ forme: t.forme, site, titreMd: exact(t), cible: cible(t), ...pose(), ...decoupe(t, t.corps), comment: t.comment, ...base }, { cible: t.corps })
    else if (t.forme === "S'") emettre({ forme: "S'", site: null, cible: cible(t), ...pose(), mentions: t.mentions, ...base }, { cible: t.corps })
    else if (t.forme === 'corps-introuvable') sites.push({ forme: 'corps-introuvable', site: null, cause: t.cause, corpsPdf: t.corpsPdf, ...base })
    if (t.hors) {
      const suivant = titres.slice(i + 1).find((u) => ENTREES.has(u.famille) && ouEst(u))
      const devant = suivant && ouEst(suivant)
      emettre({ forme: 'O', site, titreMd: exact(t), corps: cible(t), devant: devant ? adresse(devant.f, devant.l) : null, titreSuivant: suivant?.texte ?? null, ...decoupe(t, devant), ...base }, { devant })
    }
    if (t.niveauErratique) sites.push({ forme: 'N', site, ...t.niveauErratique, ...base })
  })

  // P : la ligne `i` ouverte par un gras qui n'est pas un libellé (sans `:`), sa ligne de prose
  // précédente `j` coupée ; la preuve est au PDF, deux lignes consécutives d'une colonne sur les pages du
  // fichier (`a` finit comme `j`, `b` commence comme `i`, en gras ; si `j` finit en gras, `a` aussi)
  // dont le gras est CONTINU d'une ligne à l'autre : `a` finit en gras, ou `b`, tout en gras, se
  // poursuit en gras sur la ligne suivante.
  const gras = (span) => /Bold/.test(span?.police ?? '')
  const grasContinu = (a, b, c) => gras(a.spans.at(-1))
    || (b.spans.every(gras) && c?.page === b.page && c.colonne === b.colonne && b.y0 - c.y0 > 0 && b.y0 - c.y0 < 16 && gras(c.spans[0]))
  const prefixes = (x, y) => x.length > 0 && y.length > 0 && (x.startsWith(y) || y.startsWith(x))
  const suffixes = (x, y) => x.length > 0 && y.length > 0 && (x.endsWith(y) || y.endsWith(x))
  fichiers.forEach((fx, f) => {
    fx.lignes.forEach((ligne, i) => {
      if (!/^\*\*[^*:]+\*\*/.test(ligne)) return
      const j = prosePrecedenteCoupee(fx.lignes, i)
      if (j < 0) return
      const [ci, cj] = [cles[f][i], cles[f][j]]
      const finGrasse = /\*\*\s*$/.test(fx.lignes[j])
      const k = flux.findIndex((b, n) => {
        const a = flux[n - 1]
        return n > 0 && fx.page <= b.page && b.page <= fx.pageFin && !estTitre.has(n) && gras(b.spans[0]) && prefixes(cleDuPdf(b.texte), ci)
          && a.page === b.page && a.colonne === b.colonne && a.y0 - b.y0 > 0 && a.y0 - b.y0 < 16
          && suffixes(cleDuPdf(a.texte), cj) && (!finGrasse || gras(a.spans.at(-1))) && grasContinu(a, b, flux[n + 1])
      })
      if (k < 0) return
      const b = flux[k]
      sites.push({ forme: 'P', site: adresse(f, i), avec: adresse(f, j), ligneMd: ligne, famille: 'paragraphe', page: b.page, colonne: b.colonne, x0: b.x0, y0: b.y0, titre: b.texte, preuve: `p.${b.page} col.${b.colonne} y${Math.round(flux[k - 1].y0)}→${Math.round(b.y0)}` })
    })
  })
  return { sites, titres }
}

/** Le livre `id` sur le disque : ses fichiers `.md` (liste de découpe) et son gabarit. */
function livre(id) {
  const l = livreExtraitDe(id)
  if (!l) throw new Error(`sonde-titres : aucun livre extrait d'id « ${id} » au registre`)
  const dir = String(l.dir).split('\\').join('/').replace(/\/$/, '')
  const liste = decoupeDe(id)
  const fichiers = nomsDeLaListe(liste).map((nom, i) => ({
    nom,
    page: liste[i].page,
    pageFin: liste[i].pageFin,
    lignes: readText(`${dir}/${nom}`).split('\n'),
  }))
  return { fichiers, gabarit: gabaritTitreDe(id) }
}

/** Les sites d'un livre sur le disque : `boites` = le JSON de `pdf-lignes.py` (sinon lu au PDF). */
export function sondeDuLivre(id, boites = null) {
  const { fichiers, gabarit } = livre(id)
  if (!gabarit) return null
  const brut = boites ?? boitesDuPdf(id)
  return classer(brut.map((p) => ({ page: p.page, lignes: lignes(p.boites) })), fichiers, gabarit)
}

function boitesDuPdf(id) {
  const dir = mkdtempSync(join(tmpdir(), 'sonde-titres-'))
  try {
    const sortie = join(dir, 'boites.json')
    execFileSync('python', [PDF_LIGNES, id, sortie], { stdio: ['ignore', 'ignore', 'inherit'] })
    return JSON.parse(readFileSync(sortie, 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FORMES = ['S', 'F', 'M', "S'", 'B', 'O', 'P', 'N', 'corps-introuvable', 'cible-invalide', 'doublon']
const FAMILLES = ['entree', 'encadre', 'tableau', 'capitales', 'intertitre']
/** Les familles d'ENTRÉE : titres du fil du texte, dans l'ordre du PDF, sondés dans toutes leurs formes. */
const ENTREES = new Set(['entree', 'intertitre'])

function main() {
  const args = process.argv.slice(2)
  const opt = (nom) => {
    const i = args.indexOf(nom)
    return i >= 0 ? args[i + 1] : null
  }
  const id = args.find((a, i) => !a.startsWith('--') && !['--boites', '--json'].includes(args[i - 1]))
  if (!id) {
    console.error('usage : node scripts/raw/sonde-titres.mjs <id> [--boites <boites.json>] [--json <sortie.json>]')
    process.exitCode = 2
    return
  }
  const sortie = opt('--json')
  if (sortie && relatifSousRacine(canoniser(RACINE), sortie) !== null) {
    console.error(`sonde-titres : --json ${sortie} est sous le dépôt — la sonde n'écrit rien sous le dépôt`)
    process.exitCode = 2
    return
  }
  const sonde = sondeDuLivre(id, opt('--boites') ? JSON.parse(readFileSync(opt('--boites'), 'utf8')) : null)
  if (!sonde) {
    console.error(`sonde-titres : ${id} déclare \`gabaritTitre: null\` — aucun titre à sonder`)
    return
  }
  const { sites, titres } = sonde
  for (const fam of FAMILLES) {
    const de = titres.filter((t) => t.famille === fam)
    console.log(`${id} [${fam}] : ${de.length} titres au PDF, ${de.filter((t) => t.forme === 'ok').length} à leur place`)
  }
  for (const f of FORMES) {
    const de = sites.filter((s) => s.forme === f)
    const parFamille = FAMILLES.map((fam) => `${fam} ${de.filter((s) => s.famille === fam).length}`).join(' · ')
    const parFichier = {}
    for (const s of de) {
      const k = (s.site ?? s.cible ?? '---').slice(0, 3)
      parFichier[k] = (parFichier[k] ?? 0) + 1
    }
    console.log(`== ${f} : ${de.length} (${parFamille})  ${Object.entries(parFichier).map(([k, v]) => `${k}×${v}`).join(' ')}`)
    for (const s of de) {
      const ou = `p.${s.page} col.${s.colonne} x=${s.x0.toFixed(1)} y=${s.y0.toFixed(1)}`
      const extra = s.avec ? ` -> recollée à ${s.avec} [${s.preuve}]` : s.devant ? ` -> devant ${s.devant} (« ${s.titreSuivant} »)` : s.cible ? ` -> devant ${s.cible}` : ''
      const v = `${s.titreMd ? ` titreMd « ${s.titreMd} »` : ''}${s.ligneTitre !== undefined ? ` → « ${s.ligneTitre} » (frère ${s.frere})` : ''}${s.comptage ? ` (PDF ${s.comptage.auPdf} / .md ${s.comptage.auMd})` : ''}${s.interFichiers ? ` [${s.interFichiers}]` : ''}${s.mentions?.length ? ` mentions ${s.mentions.slice(0, 5).join(',')}…` : ''}${s.texteMd ? ` texteMd « ${s.texteMd} »` : ''}`
      const nv = s.forme === 'N' ? ` niveau ${s.niveau} ≠ ${s.niveauFrere} de « ${s.frere} »` : ''
      const c = s.cause ? ` (${s.cause}) corps PDF « ${String(s.corpsPdf ?? '').slice(0, 50)} »` : ''
      const d = s.texte ? ` débris « ${s.texte} »${s.auMd ? ` .md ${s.auMd.join(',')} / PDF ${s.auPdf.join(',')}` : ''}` : ''
      console.log(`  [${s.famille}] ${s.site ?? '---'}${extra} « ${s.titre} » ${ou}${s.comment ? ` [${s.comment}]` : ''}${v}${nv}${c}${d}`)
    }
  }
  if (sortie) writeFileSync(sortie, `${JSON.stringify({ livre: id, sites }, null, 1)}\n`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
