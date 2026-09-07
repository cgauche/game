/**
 * Chargement d'un chapitre du `Source/` DANS LE NAVIGATEUR, par son adresse-URL.
 *
 * Consommateur : le champ d'édition d'une adresse de prose (`DescRefField`, Codex) — et lui seul.
 * AUCUN consommateur joueur : la prose adressée est matérialisée au build par
 * `scripts/source/prose-source-plugin.mjs`, donc une fiche lit `entry.desc` sans rien charger.
 *
 * Les chapitres sont servis EN DEV SEULEMENT, par le middleware de ce même plugin
 * (`/source/<livre>/<NN>.md`) : l'adresse est l'URL. Le build n'émet AUCUN asset `source/**` (garde
 * `src/data/source/prose-source.test.ts`), donc hors dev ces deux chargeurs refusent — c'est l'état
 * attendu, et `DescRefField` le dit en toutes lettres.
 */
import { parseChapitre, type ChapitreParse } from './decoupe.ts';

/** Un chapitre du manifeste des assets émis par le plugin (`source/manifest.json`). */
export interface ChapitreManifeste { ch: string; fichier: string; titre: string; octets: number }
/** L'index des chapitres servis, par livre. */
export type Manifeste = Record<string, { abbr: string; chapitres: ChapitreManifeste[] }>;

/** Un chapitre par clé `livre|chapitre` — la PROMESSE est mémorisée, donc N appels = 1 requête. */
const enVol = new Map<string, Promise<ChapitreParse>>();
/** Même régime pour le manifeste : une seule requête, et l'ÉCHEC n'est pas mémorisé. */
let manifesteEnVol: Promise<Manifeste> | undefined;

async function telecharger(book: string, ch: string): Promise<ChapitreParse> {
  const r = await fetch(`${import.meta.env.BASE_URL}source/${book}/${ch}.md`);
  if (!r.ok) throw new Error(`chapitre-introuvable : ${book} ch.${ch} (HTTP ${r.status})`);
  return parseChapitre(await r.text());
}

/**
 * Chapitre PARSÉ, chargé une seule fois. Un échec n'est pas mémorisé : la clé est libérée, un appel
 * suivant retente (une coupure réseau ne condamne pas l'éditeur pour la session).
 */
export function chargerChapitre(book: string, ch: string): Promise<ChapitreParse> {
  const clef = `${book}|${ch}`;
  const dejaEnVol = enVol.get(clef);
  if (dejaEnVol) return dejaEnVol;
  const p = telecharger(book, ch).catch((e: unknown) => {
    enVol.delete(clef);
    throw e;
  });
  enVol.set(clef, p);
  return p;
}

/**
 * INDEX des chapitres servis, chargé une seule fois. MÊME CONTRAT D'ÉCHEC que `chargerChapitre` : un
 * refus n'est pas mémorisé (la promesse est oubliée), donc un 404 transitoire ne condamne pas la
 * liste des chapitres pour toute la session — l'appel suivant retente.
 */
export function chargerManifeste(): Promise<Manifeste> {
  if (manifesteEnVol) return manifesteEnVol;
  const p = (async () => {
    const r = await fetch(`${import.meta.env.BASE_URL}source/manifest.json`);
    if (!r.ok) throw new Error(`manifeste-introuvable : ${r.status}`);
    return (await r.json()) as Manifeste;
  })().catch((e: unknown) => {
    manifesteEnVol = undefined;
    throw e;
  });
  manifesteEnVol = p;
  return p;
}
