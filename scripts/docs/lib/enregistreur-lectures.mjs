// Enregistreur de LECTURES d'un générateur de doc dérivé (#1679 L1b) — préchargeur `node --import`,
// posé par `scripts/docs/build-all.mjs` dans `NODE_OPTIONS` pour que TOUT sous-processus node
// l'hérite (`build-donnees.mjs` et `build-codex-relations.mjs` lancent des dumpers tsx, qui eux-mêmes
// re-spawnent). Ce qu'un générateur lit se MESURE ici : aucune liste de sources n'est écrite à la
// main (doctrine `user-doctrine-gardes-schema-unique-manifeste`, 2026-08-23).
//
// `module.syncBuiltinESMExports()` est OBLIGATOIRE après l'enveloppement : les liaisons nommées d'un
// builtin ESM sont figées à l'instanciation du module, donc un `import { readFileSync } from
// 'node:fs'` déjà chargé continue d'appeler la fonction d'origine. Mesure du juge de design
// (2026-09-02) : 5 lectures capturées sans l'appel, 1 006 avec.
//
// Périmètre : chemins sous `WFRP_LECTURES_RACINE`, hors `node_modules`/`.git`/`.cache`/`dist`, hors
// les cibles écrites par le générateur (`WFRP_LECTURES_CIBLE`, séparées par des virgules — un
// générateur relit son propre .md en mode `--check`). `statSync` reste HORS empreinte : la sonde
// `V2-analyse.mjs` en a compté 255 sur 260 pointant des `*.test.*` et des snapshots, jamais lus.
// Un `readdirSync` enregistre le DOSSIER et son listing brut trié : un fichier ajouté au dossier
// change ce que le générateur AURAIT lu, sans qu'aucun contenu ne bouge.
//
// Les ÉCRITURES sont mesurées elles aussi : un fichier écrit par le générateur n'est pas une de ses
// sources (le pied du doc ne peut pas dépendre de lui-même).
// Sortie : UN fichier par PID (`<WFRP_LECTURES_SORTIE>.<pid>.json`), écrit à la sortie du processus ;
// l'appelant fusionne le dossier (`fusionnerLectures`, `empreinte-sources.mjs`).
import fs from 'node:fs'
import path from 'node:path'
import { register, syncBuiltinESMExports } from 'node:module'

const MARQUE = Symbol.for('wfrp.enregistreur-lectures')
const RACINE = process.env.WFRP_LECTURES_RACINE
const SORTIE = process.env.WFRP_LECTURES_SORTIE

/** Noms de dossier jamais suivis par git : leur contenu n'entre dans aucune empreinte. */
const EXCLUS = /(^|\/)(?:node_modules|\.git|\.cache|dist)(?:\/|$)/

/** Enveloppe `fs` et rend le collecteur — exporté pour que le test monte la mécanique à nu. */
export function installer({ racine, cibles = [] } = {}) {
  const base = path.resolve(racine)
  const exclues = new Set(cibles)
  const fichiers = new Set()
  const dossiers = new Map()

  /** Chemin RELATIF POSIX retenu, ou `null` (hors racine, exclu, cible, ou descripteur de fichier). */
  const retenu = (p) => {
    if (typeof p === 'number') return null
    const brut =
      typeof p === 'string' ? p
      : Buffer.isBuffer(p) ? p.toString('utf8')
      : p instanceof URL && p.protocol === 'file:' ? decodeURIComponent(p.pathname).replace(/^\/([A-Za-z]:)/, '$1')
      : null
    if (!brut) return null
    const abs = path.resolve(base, brut)
    if (abs !== base && !abs.startsWith(base + path.sep)) return null
    const rel = path.relative(base, abs).split(path.sep).join('/')
    if (!rel || EXCLUS.test(rel) || exclues.has(rel)) return null
    return rel
  }

  const ecrits = new Set()
  const brut = {
    readFileSync: fs.readFileSync,
    readdirSync: fs.readdirSync,
    openSync: fs.openSync,
    writeFileSync: fs.writeFileSync,
    appendFileSync: fs.appendFileSync,
    promisesReadFile: fs.promises.readFile,
    promisesReaddir: fs.promises.readdir,
    promisesWriteFile: fs.promises.writeFile,
  }
  /** `openSync` sert aussi à écrire : seul le mode lecture (`r`, `rs`, `O_RDONLY`) est une source. */
  const estLecture = (drapeaux) =>
    drapeaux === undefined || drapeaux === null || drapeaux === 0 || /^rs?\+?$/.test(String(drapeaux))

  const noterFichier = (p) => {
    try {
      const rel = retenu(p)
      if (rel) fichiers.add(rel)
    } catch { /* une lecture non enregistrable ne casse jamais le générateur */ }
  }
  const noterEcriture = (p) => {
    try {
      const rel = retenu(p)
      if (rel) ecrits.add(rel)
    } catch { /* idem */ }
  }
  const noterDossier = (p) => {
    try {
      const rel = retenu(p)
      if (rel === null || dossiers.has(rel)) return
      dossiers.set(rel, brut.readdirSync(path.resolve(base, rel)).map(String).sort())
    } catch { /* idem */ }
  }

  // Une lecture qui ÉCHOUE n'est pas une source : un `.npmrc` sondé et absent n'a pas de blob à
  // hasher. Chaque enveloppe note APRÈS coup, sur le chemin qui a rendu un résultat.
  fs.readFileSync = function (p, ...a) { const r = brut.readFileSync.call(this, p, ...a); noterFichier(p); return r }
  fs.readdirSync = function (p, ...a) { const r = brut.readdirSync.call(this, p, ...a); noterDossier(p); return r }
  fs.openSync = function (p, d, ...a) { const r = brut.openSync.call(this, p, d, ...a); (estLecture(d) ? noterFichier : noterEcriture)(p); return r }
  fs.promises.readFile = function (p, ...a) { return brut.promisesReadFile.call(this, p, ...a).then((r) => { noterFichier(p); return r }) }
  fs.promises.readdir = function (p, ...a) { return brut.promisesReaddir.call(this, p, ...a).then((r) => { noterDossier(p); return r }) }
  fs.writeFileSync = function (p, ...a) { const r = brut.writeFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.appendFileSync = function (p, ...a) { const r = brut.appendFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.promises.writeFile = function (p, ...a) { return brut.promisesWriteFile.call(this, p, ...a).then((r) => { noterEcriture(p); return r }) }
  syncBuiltinESMExports()

  return {
    fichiers,
    dossiers,
    ecrits,
    // Un fichier ÉCRIT par le générateur n'est pas une de ses sources, même s'il l'a relu avant
    // (`build-implemente.mjs` réinjecte un champ dans les fiches docs/raw qu'il vient de lire).
    rendu: () => ({
      fichiers: [...fichiers].filter((p) => !ecrits.has(p)).sort(),
      dossiers: Object.fromEntries([...dossiers].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
      ecrits: [...ecrits].sort(),
    }),
  }
}

if (RACINE && SORTIE && !globalThis[MARQUE]) {
  globalThis[MARQUE] = true
  const collecteur = installer({
    racine: RACINE,
    cibles: (process.env.WFRP_LECTURES_CIBLE ?? '').split(',').filter(Boolean),
  })
  // Les modules chargés par un THREAD DE HOOKS (tsx) échappent à l'enveloppe de `fs` : le volet
  // `enregistreur-hooks.mjs` les enregistre depuis ce thread-là.
  register(new URL('enregistreur-hooks.mjs', import.meta.url).href, {
    data: {
      racine: path.resolve(RACINE),
      sortie: SORTIE,
      cibles: (process.env.WFRP_LECTURES_CIBLE ?? '').split(',').filter(Boolean),
    },
  })
  process.on('exit', () => {
    try {
      fs.writeFileSync(`${SORTIE}.${process.pid}.json`, JSON.stringify(collecteur.rendu()))
    } catch { /* un enfant sans droit d'écriture ne fait pas échouer le générateur */ }
  })
}
