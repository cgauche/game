// Fabrique d'ATLAS JETABLE pour les bancs de ses lecteurs (#1825) — un seul site sait bâtir un Atlas
// valide, et ce site suit la couture (`pagesDeLAtlas`, `_lib.mjs`) quand la partition évolue.
//
// Pourquoi une fabrique et pas quatre copies : un Atlas est PARTITIONNÉ par cœur — une page de règles
// posée à la racine d'un `rawDir` temporaire n'est pas un Atlas, et la couture le REFUSE. Quatre
// bancs qui poseraient chacun leur arborescence à la main seraient quatre occasions de figer la forme
// d'aujourd'hui.
//
// Le cœur des fixtures vient du REGISTRE, par son RÉGIME (`coeursDuRegistre`) — jamais un nom de cœur
// recopié : un banc dit la PARTITION, pas l'identité d'un cœur.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { coeursDuRegistre } from './_lib.mjs'

/** Le cœur sous lequel les bancs posent leurs pages — pris au registre, jamais écrit. LÈVE en
 *  NOMMANT la cause : un `undefined` rendrait un chemin `undefined/x.md` et un rouge trompeur. */
export function coeurDeBanc(coeurs = coeursDuRegistre()) {
  const [premier] = coeurs
  if (!premier) throw new Error('atlasFixture: le registre `src/data/books.json` ne déclare aucun cœur (champ `coeur`)')
  return premier
}

/**
 * Bâtit un Atlas JETABLE, joue `fn(rawDir, coeur)`, puis l'efface — quoi qu'il arrive.
 * @param {Record<string, string>} pages nom de page (ou chemin relatif AU CŒUR) -> contenu. Une clé
 *   qui commence par `/` est posée à la RACINE de l'Atlas (pages transverses).
 * @param {(rawDir: string, coeur: string) => any} fn
 * @param {{ prefixe?: string, coeur?: string }} [options] `coeur` n'est à donner que par un banc qui
 *   injecte son PROPRE registre (cœurs INVENTÉS) : sans lui, la fabrique prend celui du registre.
 */
export function avecAtlasFixture(pages, fn, { prefixe = 'atlas-banc-', coeur = coeurDeBanc() } = {}) {
  const dir = mkdtempSync(join(tmpdir(), prefixe))
  try {
    mkdirSync(join(dir, coeur), { recursive: true })
    for (const [cle, contenu] of Object.entries(pages)) {
      const relatif = cle.startsWith('/') ? cle.slice(1) : `${coeur}/${cle}`
      const coupe = relatif.lastIndexOf('/')
      if (coupe >= 0) mkdirSync(join(dir, relatif.slice(0, coupe)), { recursive: true })
      writeFileSync(join(dir, relatif), contenu, 'utf8')
    }
    return fn(dir, coeur)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
