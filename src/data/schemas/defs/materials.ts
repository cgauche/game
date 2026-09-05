/**
 * Schéma de `materials.json` — LE dataset des matières du monde (#1686 lot 2), consommé comme
 * `MaterialEntry[]` (`src/data/materials.types.ts`). 16 entrées : 8 matières de décor volumique,
 * 4 de toiture (3 couvertures + le « plan » vu du dessus), 4 de relief.
 *
 * Le champ de charge `domain` porte l'identité : ses valeurs sont celles de `MaterialRef.domain`
 * (`src/gameIso/builders/types.ts`), servies par `DOMAINES_MATIERE`, qui les tient sous `satisfies`.
 *
 * UNE SEULE FORME D'ENTRÉE, la disjonction portée par un REFINE ⟺ (`affinerEntree`, patron
 * `defs/oups.ts`) : toutes les clés de charge sont déclarées `.optional()`, et le refine (1) EXIGE
 * par domaine ses clés requises, (2) REFUSE toute clé d'un AUTRE domaine, nommément. Une union de
 * trois `strictObject` dirait la même chose au parse, mais elle n'a ni `.shape` ni enveloppe :
 * `document()` ne saurait y poser ni sa provenance, ni son `type`, ni ses métas d'édition.
 *
 * CHARGE COMMUNE = ∅ (mesuré) : aucune clé n'est partagée par les trois domaines — `detail` l'est par
 * `roof` et `relief`, et par eux seuls. Aucun renommage : `color` (décor), `N`/`E`/`S`/`O` (pentes de
 * toit) et `face` (relief) ne sont pas la même forme (`src/gameIso/backends/webgl/faceColors.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { detailRecipeSchema } from '../grammaire/valeurs';
import { DOMAINES_MATIERE } from '../../materials.types';

export const file = 'materials.json';
export const famille = 'entite';

/**
 * Clés de CHARGE par domaine — la déclaration dont le refine tire ses DEUX verdicts (requis manquant,
 * clé étrangère). `requises` ⊆ `cles` ; ce qui n'est pas requis est optionnel dans ce domaine.
 */
const CHARGE_PAR_DOMAINE = {
  prop: { cles: ['color', 'roughness', 'metalness'], requises: ['color', 'roughness', 'metalness'] },
  roof: {
    cles: [
      'couverture', 'detail', 'N', 'E', 'S', 'O', 'line',
      'planBody', 'planEdge', 'planInner', 'planText',
      'eaveOverhangM', 'soffite', 'fasciaDropM', 'fasciaThickM', 'fascia', 'ridgeCap',
    ],
    requises: [],
  },
  relief: { cles: ['built', 'detail', 'face', 'foot', 'slopeTop', 'shadeDark'], requises: ['face'] },
} as const satisfies Record<(typeof DOMAINES_MATIERE)[number], { cles: readonly string[]; requises: readonly string[] }>;

/** Toutes les clés de charge du document, dérivées de la table ci-dessus. */
const CLES_DE_CHARGE = new Set(Object.values(CHARGE_PAR_DOMAINE).flatMap((d) => d.cles as readonly string[]));

const doc = document(
  'materials',
  famille,
  {
    domain: z.enum(DOMAINES_MATIERE),
    // ── domaine `prop`
    color: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
    roughness: z.number().min(0).max(1).optional(),
    metalness: z.number().min(0).max(1).optional(),
    // ── domaine `roof`
    couverture: z.literal(true).optional(),
    N: z.string().optional(),
    E: z.string().optional(),
    S: z.string().optional(),
    O: z.string().optional(),
    line: z.string().optional(),
    planBody: z.string().optional(),
    planEdge: z.string().optional(),
    planInner: z.string().optional(),
    planText: z.string().optional(),
    eaveOverhangM: z.number().optional(),
    soffite: z.string().optional(),
    fasciaDropM: z.number().optional(),
    fasciaThickM: z.number().optional(),
    fascia: z.string().optional(),
    ridgeCap: z.string().optional(),
    // ── domaine `relief`
    built: z.boolean().optional(),
    face: z.string().optional(),
    foot: z.string().optional(),
    slopeTop: z.string().optional(),
    shadeDark: z.number().optional(),
    // ── `roof` ET `relief`
    detail: detailRecipeSchema.optional(),
  },
  {
    domain: {
      label: 'Domaine',
      hint: 'Ce que la matière peint : décor volumique, toiture, relief — les clés admises en dépendent',
    },
    color: { label: 'Couleur', hint: 'Teinte hexadécimale `#rrggbb` du matériau' },
    roughness: { label: 'Rugosité', hint: 'Réponse mate/brillante à la lumière' },
    metalness: { label: 'Métallicité', hint: 'Part de réponse métallique à la lumière' },
    couverture: {
      label: 'Couvre un pan',
      hint: 'Matériau POSABLE sur une masse de toit — absent : entrée de rendu qui ne couvre rien (vue de dessus)',
    },
    N: { label: 'Couleur face nord' },
    E: { label: 'Couleur face est' },
    S: { label: 'Couleur face sud' },
    O: { label: 'Couleur face ouest' },
    line: { label: 'Couleur de liseré de structure', hint: 'Liseré de structure : faîte, arêtiers et égouts' },
    planBody: { label: 'Couleur du plan (corps)', hint: 'Vue de dessus, toit en plan' },
    planEdge: { label: 'Couleur du plan (bord)', hint: 'Vue de dessus : liseré du contour' },
    planInner: { label: 'Couleur du plan (intérieur)', hint: 'Vue de dessus : cadre intérieur' },
    planText: { label: 'Couleur du plan (texte)', hint: 'Vue de dessus : texte du nom' },
    eaveOverhangM: {
      label: 'Débord d’avant-toit',
      hint: 'Débord du soffite au-delà de l’égout, en CASES (le suffixe M du nom ne dit pas l’unité) — absent, aucun débord',
    },
    soffite: { label: 'Couleur de soffite', hint: 'Sous-face de l’avant-toit' },
    fasciaDropM: { label: 'Hauteur de planche de rive', hint: 'En mètres' },
    fasciaThickM: { label: 'Épaisseur de planche de rive', hint: 'En mètres' },
    fascia: { label: 'Couleur de planche de rive' },
    ridgeCap: { label: 'Couleur de faîtière' },
    built: { label: 'Relief bâti', hint: 'Ouvrage maçonné (vs relief naturel type talus)' },
    face: { label: 'Couleur de face', hint: 'Teinte de la face principale du relief' },
    foot: { label: 'Couleur de pied', hint: 'Falaise : ombre de pied' },
    slopeTop: { label: 'Couleur de nez de pente', hint: 'Rampe : arête haute éclairée de la pente (le pied est dérivé par ombrage)' },
    shadeDark: { label: 'Assombrissement', hint: 'Facteur d’assombrissement de la face sombre' },
    detail: { label: 'Recette de détail' },
  },
  {
    codex: {
      exempt: {
        kind: 'dette',
        raison:
          'exposition Codex DUE, non faite : l’onglet « Matières » PAR DOMAINE est l’arbitrage utilisateur du 2026-09-05 ; le lot 2 fusionne les trois catalogues et pose les libellés FR des 38 champs de charge, le lot 3 ouvre l’onglet et retire cette exemption',
        ticket: '#1686',
      },
    },
    edit: {
      none: 'aucune route d’édition posée au lot 2 — l’onglet Codex « Matières » du lot 3 de #1686 (arbitrage utilisateur 2026-09-05) est la route prévue, une matière s’y ajoutera et s’y retouchera',
    },
  },
  {
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as Record<string, unknown>;
        const domaine = e.domain as keyof typeof CHARGE_PAR_DOMAINE;
        const charge = CHARGE_PAR_DOMAINE[domaine];
        if (!charge) return;
        const admises = new Set<string>(charge.cles);
        for (const cle of charge.requises as readonly string[]) {
          if (e[cle] === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: [cle],
              message: `materials : le domaine « ${domaine} » EXIGE la clé « ${cle} » (${String(e.id)}).`,
            });
          }
        }
        for (const cle of Object.keys(e)) {
          if (!CLES_DE_CHARGE.has(cle) || admises.has(cle) || e[cle] === undefined) continue;
          ctx.addIssue({
            code: 'custom',
            path: [cle],
            message: `materials : la clé « ${cle} » n’appartient pas au domaine « ${domaine} » (${String(e.id)}).`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
