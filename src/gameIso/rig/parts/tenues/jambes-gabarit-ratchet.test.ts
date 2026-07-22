import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * CLIQUET — migration de la jambe vers le GABARIT partagé (#633 Lot 0).
 *
 * Chaque tenue redessinait sa jambe INLINE (~195 fois), recopiant le défaut de galbe genou/mollet.
 * Le gabarit `jambeVetue` (`parts/bodies/jambe-gabarit.ts`) porte désormais le contour + le galbe
 * lissé UNE fois ; une tenue le consomme (ou compose le corps via `BODIES.`). Ce cliquet scanne les
 * SOURCES `defs/*.ts` : un `jambes:` qui n'appelle NI `jambeVetue(` NI `BODIES.` est encore INLINE.
 *
 *   1. `JAMBE_LEGACY` — dette gelée : les defs encore inline (stock initial mesuré = 103). Ne peut que
 *      DÉCROÎTRE (cible 0). Un def migré doit SORTIR de ce stock dans le même commit (sinon `perimees`).
 *   2. `JAMBE_SILHOUETTE_OVERRIDES` — silhouettes ASSUMÉES (jambe volontairement hors gabarit) :
 *      plafond `MAX_OVERRIDES = 8`, vide au départ.
 *
 * Une jambe inline NEUVE hors des deux stocks échoue (`neuves`). Un id retiré d'un stock alors qu'il
 * est TOUJOURS inline échoue (il « traîne » : `neuves` le reprend). Un id gardé au stock alors qu'il
 * est migré échoue (`perimees` : le stock ment). Solder = migrer PUIS retirer du stock.
 */

// Stock initial mesuré (grep des `jambes:` sans `jambeVetue(`/`BODIES.` sur defs/*.ts, 2026-07-22).
const JAMBE_LEGACY: ReadonlySet<string> = new Set([
  'agitateur', 'apothicaire', 'archer', 'arquebusier', 'artilleur', 'artilleur-de-navire', 'artisan',
  'artiste', 'bailli', 'batelier', 'boucher-ogre', 'bourgeois', 'cartographe', 'cavalier',
  'cavalier-leger', 'chansonnier', 'charlatan', 'chasseur', 'chasseur-de-primes', 'chevalier',
  'chevalier-du-loup-blanc', 'chevalier-du-soleil-flamboyant', 'chevalier-errant', 'chevalier-panthere',
  'chevaucheur-de-blaireau', 'cocher', 'colporteur', 'conseiller', 'contrebandier', 'coureur-d-egout',
  'cultiste', 'debardeur', 'duelliste', 'eclaireur', 'emissaire', 'enqueteur', 'entremetteur',
  'erudit', 'esclave-skaven', 'espion', 'femme-du-fleuve', 'flagellant', 'frere-loup', 'garde',
  'gardechamps', 'gardien-de-troupeaux-de-rhinox', 'gladiateur', 'guerrier-du-chaos', 'hallebardier',
  'herboriste', 'hors-la-loi', 'ingenieur', 'intendant', 'joueur-d-epee', 'juriste',
  'mangeur-d-hommes', 'marchand', 'marin', 'medecin', 'mendiant', 'messager', 'milicien', 'mineur',
  'mystique', 'naufrageur', 'nautonier', 'noble', 'nonne', 'officier', 'ogre', 'patrouilleur-des-karak',
  'patrouilleur-fluvial', 'patrouilleur-routier', 'pilleur-de-tombes', 'piquier', 'pretre',
  'pretre-de-myrmidia', 'pretre-de-stromfels', 'pretre-guerrier', 'pretre-marin-de-manann',
  'prophete-gris', 'ranconneur', 'ratier', 'ratisseur-de-plages', 'receleur', 'repurgateur',
  'rodeur-fantome', 'saltimbanque', 'serviteur', 'skaven', 'soldat', 'sorcier', 'sorcier-de-village',
  'sorcier-dissident', 'spadassin', 'specialiste-de-siege', 'squelette', 'suiveur-de-camp', 'tueur',
  'vampire', 'vermine-de-choc', 'villageois', 'voleur',
]);
const INITIAL_LEGACY = 103;

// Silhouettes ASSUMÉES hors gabarit — vide au départ ; plafond gelé ICI (la baisse est le seul geste).
const JAMBE_SILHOUETTE_OVERRIDES: ReadonlySet<string> = new Set<string>([]);
const MAX_OVERRIDES = 8;

const DEFS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'defs');

/** Extrait le TEXTE de la valeur `jambes:` d'une source (jusqu'à la virgule/fermeture de rang 0). */
function jambesRegion(src: string): string {
  const m = src.match(/jambes:\s*/);
  if (!m || m.index == null) return '';
  let depth = 0, tick = false, out = '';
  for (let i = m.index + m[0].length; i < src.length; i++) {
    const c = src[i];
    if (c === '`') { tick = !tick; out += c; continue; }
    if (tick) { out += c; continue; }
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c)) { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) break;
    out += c;
  }
  return out;
}

function idOf(src: string, file: string): string {
  const m = src.match(/\bid:\s*["']([^"']+)["']/);
  if (!m) throw new Error(`def sans id STABLE : ${file}`);
  return m[1];
}

/** ids des defs dont la jambe est encore INLINE (ni `jambeVetue(` ni `BODIES.`). */
function inlineJambeIds(): Set<string> {
  const found = new Set<string>();
  for (const file of readdirSync(DEFS_DIR).filter((f) => f.endsWith('.ts')).sort()) {
    const src = readFileSync(join(DEFS_DIR, file), 'utf8');
    if (!/jambes:/.test(src)) continue;
    const migrated = /jambeVetue\s*\(/.test(src) || /BODIES\./.test(jambesRegion(src));
    if (!migrated) found.add(idOf(src, file));
  }
  return found;
}

function ratchet(found: ReadonlySet<string>, stock: ReadonlySet<string>) {
  return {
    neuves: [...found].filter((k) => !stock.has(k)).sort(),
    perimees: [...stock].filter((k) => !found.has(k)).sort(),
  };
}

describe('jambe : migration vers le gabarit partagé (cliquet #633 Lot 0)', () => {
  const found = inlineJambeIds();
  const stock = new Set([...JAMBE_LEGACY, ...JAMBE_SILHOUETTE_OVERRIDES]);

  it('aucune jambe inline NEUVE, et un id soldé ne traîne pas hors stock', () => {
    const { neuves } = ratchet(found, stock);
    expect(neuves, `Jambe(s) INLINE hors stock — consommer \`jambeVetue(\`/\`BODIES.\`, ou (silhouette\n` +
      `assumée) inscrire dans JAMBE_SILHOUETTE_OVERRIDES. Un id retiré de JAMBE_LEGACY encore inline\n` +
      `RETOMBE ici :\n  ${neuves.join('\n  ')}`).toEqual([]);
  });

  it('le stock ne MENT pas : un id migré en sort', () => {
    const { perimees } = ratchet(found, stock);
    expect(perimees, `Clés de stock qui ne sont plus inline (migrées) — les RETIRER de JAMBE_LEGACY /\n` +
      `JAMBE_SILHOUETTE_OVERRIDES, sinon le stock surestime la dette :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('la dette LEGACY ne peut que DÉCROÎTRE (cible 0)', () => {
    expect(JAMBE_LEGACY.size, `JAMBE_LEGACY a GONFLÉ (${JAMBE_LEGACY.size} > ${INITIAL_LEGACY}). Solder une jambe\n` +
      `= la migrer au gabarit et la retirer du stock — jamais allonger la liste.`).toBeLessThanOrEqual(INITIAL_LEGACY);
  });

  it('les silhouettes assumées restent plafonnées', () => {
    expect(JAMBE_SILHOUETTE_OVERRIDES.size).toBeLessThanOrEqual(MAX_OVERRIDES);
  });
});
