/**
 * Schéma de `terrains.json` — LE dataset des sols de la grille (#1690), consommé comme
 * `TerrainDef[]` (`src/data/terrains.types.ts`). 25 entrées, UNE forme, aucun discriminant : tous
 * les terrains portent les mêmes clés requises et se distinguent par leurs VALEURS.
 *
 * RÈGLE et RENDU dans la MÊME entrée : `walkable`/`priority`/`opaque`/`built` sont lus par la
 * walkability, le raccord d'arêtes et la Ligne de Vue ; `swatch`/`stops`/`detail`/`overlayProp`/
 * `solidHeightM` par les deux backends de rendu. Les scinder ferait deux catalogues à tenir
 * synchrones pour UN concept.
 *
 * PROVENANCE — `terrains` est déclaré `SANS_LIVRE` (aucun folio n'imprime de catalogue de sols) ET
 * chaque entrée EXIGE son `maison` (`exiges`), comme les 41 règles de `props.json` : l'exemption
 * couvre le DOCUMENT (de l'art), elle ne couvre pas les quatre champs de règle que chaque terrain
 * porte.
 *
 * L'id du `<linearGradient>` SVG n'est PAS une donnée : il se dérive de l'id du terrain
 * (`terrainGradientId`, `src/gameIso/catalog/terrain.ts`) : deux terrains portant des `stops`
 * différents ne peuvent pas partager une rampe.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { detailRecipeSchema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';

export const file = 'terrains.json';
export const famille = 'entite';

/** Couleur de rendu : hexadécimal `#rrggbb` en minuscules — la SEULE graphie du dépôt. */
const couleur = z.string().regex(/^#[0-9a-f]{6}$/);

/** Offset d'un arrêt de rampe : un POURCENTAGE entier `0%` à `100%`, tel que `<stop offset>` l'écrit. */
const offset = z
  .string()
  .regex(/^(?:100|[0-9]{1,2})%$/, 'offset d’arrêt : un pourcentage entier de 0% à 100% (ex. « 45% »)');

const doc = document(
  'terrains',
  famille,
  {
    walkable: z.boolean(),
    priority: z.number().int().min(0),
    opaque: z.literal(true).optional(),
    built: z.literal(true).optional(),
    swatch: couleur,
    // Record `offset → couleur` : un offset ne se répète pas sur une rampe. Au moins deux arrêts —
    // un dégradé d'un seul arrêt est un aplat, que `swatch` dit déjà.
    stops: z.record(offset, couleur).refine((r) => Object.keys(r).length >= 2, {
      message: 'une rampe porte au moins DEUX arrêts (un seul est un aplat — c’est `swatch`)',
    }),
    detail: detailRecipeSchema.optional(),
    overlayProp: idDe('prop').optional(),
    solidHeightM: z.number().positive().optional(),
  },
  {
    walkable: { label: 'Franchissable', hint: 'Le terrain se traverse à pied' },
    priority: {
      label: 'Précédence de raccord',
      hint: 'Un terrain de priorité plus haute déborde sur ses voisins de priorité plus basse',
    },
    opaque: { label: 'Bloque la vue', hint: 'Coupe la Ligne de Vue (couvert total, brouillard de vision)' },
    built: {
      label: 'Surface bâtie',
      hint: 'Ouvrage construit qui PORTE l’étage posé dessus — absent : sol nu, un étage posé dessus est signalé par `map:check`',
    },
    swatch: { label: 'Teinte d’aperçu', hint: 'Couleur `#rrggbb` de la palette de l’éditeur et des faces du monde volumique' },
    stops: {
      label: 'Arrêts du dégradé',
      hint: 'Rampe peinte par le rendu affine : offset en pourcentage → couleur `#rrggbb`',
    },
    detail: { label: 'Recette de détail' },
    overlayProp: {
      label: 'Décor posé sur chaque tuile',
      hint: 'Décor en billboard répété sur chaque case du terrain (ex. l’arbre du sous-bois) — présentation seule',
    },
    solidHeightM: {
      label: 'Hauteur du bloc plein',
      hint: 'Le terrain se rend comme un bloc plein de cette hauteur en mètres ; celle d’un mur vaut la constante de hauteur de mur du rendu (`src/gameIso/iso.ts`)',
    },
  },
  {
    codex: {
      exempt: {
        kind: 'dette',
        raison: 'onglet Codex « Terrains » non ouvert — le dataset naît au lot 2, son exposition est le lot 3',
        ticket: '#1690',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose encore, donc aucun formulaire d’atelier ne l’édite' },
  },
  {
    exiges: ['maison'],
    // Les `<stop>` d'un `<linearGradient>` se lisent DANS L'ORDRE D'ÉMISSION : SVG clampe un offset
    // qui recule sur son prédécesseur, et l'arrêt devient inerte sans un mot. L'ordre est donc une
    // contrainte de la DONNÉE, pas une convention d'écriture — les émetteurs trient en plus
    // (`terrainStopsOrdonnes`, `src/gameIso/catalog/terrain.ts`).
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id?: unknown; stops?: unknown };
        const offsets = Object.keys((e.stops ?? {}) as object);
        const paliers = offsets.map((o) => Number.parseInt(o, 10));
        if (paliers.every((n, i) => i === 0 || n > paliers[i - 1])) return;
        ctx.addIssue({
          code: 'custom',
          path: ['stops'],
          message:
            `terrain « ${typeof e.id === 'string' ? e.id : '?'} » : les arrêts de la rampe sont écrits ` +
            `${offsets.join(' → ')} — un offset doit être STRICTEMENT plus grand que le précédent`,
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
