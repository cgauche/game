/**
 * AUDIT du LITTÉRAL == JETON dans les tenues (#583 point 1) — définition UNIQUE, partagée par la
 * garde `src/gameIso/rig/parts/tenues/palette-literal.test.ts` et le régénérateur
 * `scripts/rig/regen-palette-literal-stock.mts`.
 *
 * Classe de défaut mesurée : un littéral hex (`fill`/`stroke`/`stop-color`) qui vaut EXACTEMENT
 * (distance ZÉRO, insensible à la casse) une valeur déclarée dans la `palette` du MÊME def. Ce
 * littéral devait être le jeton `@<clé>` correspondant — quelle que soit la MATIÈRE peinte (chair,
 * cuir, tissu, plume…), la réponse mécanique est identique. Interdiction MÉCANISABLE SANS FAUX
 * POSITIF : on ne compare QUE contre les valeurs déclarées PAR LE MÊME def (jamais une distance
 * colorimétrique globale — cf. `fleshGradientAudit.ts`, faux positifs confirmés #583).
 *
 * Cas fondateur vérifié (#583) : `Messager` bras.front utilise `@peau`/`@peauO` correctement, mais
 * bras.back/bras.profile recopient `#e2b48c`/`#8c4a28` — exactement `peau`/dérivés de `peauO` du
 * même def. Idem `Naufrageur` (`#8a4f2a` == son `peauO`), `Bailli` (panache de plume == `@peauH`/
 * `@peauO` — CE cas confirme que la matière n'importe pas : plume ou peau, même faute).
 *
 * Ne scanne QUE les TENUES avec une `palette` déclarée non vide (rien à comparer sinon).
 *
 * Un SITE par OCCURRENCE (`{ fichier, ref: '<id>:<slot>:<vue>', occurrence }`), et non un par
 * `slot:vue` (#583 morsure du juge, 2026-07-18) : un `break` au premier match dans une vue DÉJÀ
 * fautive masquait toute occurrence NEUVE ajoutée dans un slot:vue déjà au stock (40 littéraux
 * injectés dans `archer:torse:front`, déjà stocké → 0 clé neuve, garde verte à tort).
 *
 * ⚠ Angle mort résiduel de l'occurrence (mesuré, pas grave — la dette n'augmente pas, la classe est
 * déjà stockée) : c'est un RANG dans l'ordre d'apparition, pas une empreinte du littéral lui-même.
 * Remplacer UN littéral fautif par UN AUTRE littéral fautif (toujours == une valeur de `palette`,
 * hex différent) laisse le COMPTE et l'ORDRE inchangés → `neuves=0, perimees=0`, garde verte, alors
 * que le contenu fautif a changé sous la même clé. Cette classe-là (substitution fautif→fautif)
 * n'est PAS couverte par ce détecteur ; seule la DISPARITION d'une occurrence (littéral → jeton)
 * fait bouger le compte.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleDeSite, ecartsDeStock, type EntreeNominative } from './stock.mjs';
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import type { PartArt } from '../../../src/gameIso/rig/parts/types';
import { slugId } from '../../../src/data/slug';

export const BODY_SLOTS = ['torse', 'jambes', 'bras', 'tete'] as const;
export type BodySlot = (typeof BODY_SLOTS)[number];
export const VIEWS = ['front', 'back', 'profile'] as const;
export type View = (typeof VIEWS)[number];

const LITERAL = /(?:fill|stroke|stop-color)\s*=\s*("|')(#[0-9a-fA-F]{3,8})\1/g;

function viewsOf(art: PartArt): Partial<Record<View, string>> {
  return typeof art === 'string' ? { front: art } : art;
}

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** L'index GÉNÉRÉ des tenues : un `import` par def, puis le tableau `TENUE_DEFS` dans cet ordre. */
const REGISTRE = 'src/gameIso/rig/parts/tenues/_registry.generated.ts';

/** Le fichier de def de chaque tenue, par IDENTITÉ d'objet — le def ne porte pas son chemin, seul
 *  l'index généré le sait (`import { tenue as e8 } from './defs/Bailli'`). Lu du disque une fois :
 *  c'est la seule source de vérité du couple (def, fichier), et une tenue déposée y entre par `npm
 *  run gen`. Un index dont les alias et le tableau divergent ARRÊTE la mesure : un `fichier` deviné
 *  ferait entrer au stock des entrées qui nomment la mauvaise tenue. */
let fichiers: Map<TenueDef, string> | null = null;
export function fichierDeTenue(def: TenueDef): string {
  if (!fichiers) {
    const src = readFileSync(resolve(RACINE, REGISTRE), 'utf8');
    const parAlias = new Map<string, string>();
    for (const [, alias, nom] of src.matchAll(/import \{ tenue as (\w+) \} from '\.\/defs\/([^']+)'/g)) {
      parAlias.set(alias, `src/gameIso/rig/parts/tenues/defs/${nom}.ts`);
    }
    const tableau = /export const TENUE_DEFS: TenueDef\[\] = \[([^\]]*)\]/.exec(src);
    if (!tableau) throw new Error(`${REGISTRE} : tableau TENUE_DEFS introuvable — la mesure ne sait plus quel fichier porte quelle tenue`);
    const ordre = tableau[1].split(',').map((a) => a.trim()).filter(Boolean);
    if (ordre.length !== TENUE_DEFS.length) {
      throw new Error(`${REGISTRE} : ${ordre.length} entrée(s) au tableau pour ${TENUE_DEFS.length} def(s) importé(s) — index désaccordé`);
    }
    fichiers = new Map(ordre.map((alias, i) => {
      const fichier = parAlias.get(alias);
      if (!fichier) throw new Error(`${REGISTRE} : l'alias ${alias} du tableau n'a pas d'import — index désaccordé`);
      return [TENUE_DEFS[i], fichier] as const;
    }));
  }
  const fichier = fichiers.get(def);
  if (!fichier) throw new Error(`tenue « ${def.label} » hors de l'index ${REGISTRE} — son fichier de def est introuvable`);
  return fichier;
}

/**
 * Un SITE par occurrence d'un littéral == une valeur de la `palette` du même def, dans l'ordre du
 * balayage : `{ file: <le def qui porte la faute>, ref: '<tenueId>:<slot>:<vue>' }`. C'est la forme
 * de site que `sitesEnEntrees` (guards/lib/stock.mjs) ordinalise en entrées nominatives. Le FICHIER
 * est dans la clé parce qu'un stock ne se relit pas sans lui : c'est lui que la
 * porte de plage voit, et lui que l'artiste doit ouvrir pour solder.
 */
export function sitesPaletteLiteral(defs: readonly TenueDef[] = TENUE_DEFS): { file: string; ref: string }[] {
  const sites: { file: string; ref: string }[] = [];
  for (const def of defs) {
    const palette = def.palette;
    if (!palette) continue;
    const hexSet = new Set(Object.values(palette).map((v) => v.toLowerCase()));
    if (hexSet.size === 0) continue;
    const id = slugId(def.label);
    for (const slot of BODY_SLOTS) {
      const art = def.set[slot];
      if (art == null) continue;
      for (const [view, svg] of Object.entries(viewsOf(art))) {
        if (!svg) continue;
        LITERAL.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LITERAL.exec(svg))) {
          if (hexSet.has(m[2].toLowerCase())) sites.push({ file: fichierDeTenue(def), ref: `${id}:${slot}:${view}` });
        }
      }
    }
  }
  return sites;
}

/**
 * REFUS du régénérateur `scripts/rig/regen-palette-literal-stock.mts` : la phrase à afficher quand
 * la MESURE porte un site que le stock en place ne couvre pas, `null` quand elle n'en porte aucun.
 * Le critère est l'ÉCART NOMINATIF, jamais un TOTAL : à taille constante — une entrée soldée pendant
 * qu'un site neuf apparaît — les deux longueurs restent égales et le régénérateur entérinerait le
 * site neuf en silence, stock réécrit, garde verte (mesuré le 2026-09-14 sur le corpus réel :
 * `src/gameIso/rig/parts/tenues/defs/Apothicaire.ts :: apothicaire:torse:front :: 1`).
 * DÉCROISSANT-SEULEMENT se juge donc site par site, comme la garde elle-même.
 */
export function refusDeCroissance(
  mesurees: readonly EntreeNominative[],
  stock: Iterable<EntreeNominative>,
): string | null {
  const { neuves, taille } = ecartsDeStock({ observe: mesurees, stock, cle: cleDeSite });
  if (neuves.length === 0) return null;
  return `REFUS : ${neuves.length} site(s) MESURÉ(s) hors du stock en place (${taille} entrée(s)).\n`
    + `Cet outil ne peut qu'écrire un stock PLUS PETIT :\n  ${neuves.join('\n  ')}\n\n`
    + `Un nouveau def qui recopie un littéral == jeton se corrige (le jeton), il ne s'entérine pas ici.`;
}
