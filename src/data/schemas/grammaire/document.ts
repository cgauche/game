/**
 * FABRIQUE DE DOCUMENT (#1466 L1a) — la seule façon de déclarer un document de l'application.
 *
 * Elle rend un HANDLE FERMÉ : le schéma sort SCELLÉ, si bien que `.extend` et `.shape` n'existent
 * plus NI au type NI au runtime (zod 4.4.3 perd le registre et la `.meta()` d'un nœud à l'extension —
 * la composition se fait ICI, une fois, ou pas du tout). Une clé d'ENVELOPPE redéclarée dans `champs`
 * est une erreur de TYPE (mapped type → `never`) ET une erreur d'exécution nommant la clé ; chaque
 * clé de `champs` exige sa `MetaChamp` ; chaque document déclare son EXPOSITION (Codex, éditeur).
 *
 * Ce lot POSE la fabrique ; l'adoption par les 120 defs et la migration d'enveloppe correspondante
 * sont le lot L1b (#1467) — aucun def ne l'appelle encore, aucune donnée ne change ici.
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema, variantOf } from './valeurs';
import type { MetaChamp, MetaDesChamps } from './meta';
import { exigeSource } from './sans-livre';

/** Les 4 familles mesurées de la donnée authorée (`docs/structures-donnees.md` §1). */
export type FamilleDocument = 'entite' | 'table' | 'config' | 'record';

/** Clés de l'ENVELOPPE — posées par la fabrique, jamais par un def. */
export const CLES_ENVELOPPE = ['id', 'type', 'label', 'labelF', 'desc', 'source', 'alsoIn', 'variants', 'maison', 'icon'] as const;
export type CleEnveloppe = (typeof CLES_ENVELOPPE)[number];

/**
 * Libellés FR des clés d'ENVELOPPE (#1466 L1a, point 6). `document()` REFUSE une `MetaChamp` sur une
 * clé d'enveloppe (la fabrique la pose, aucun def ne la déclare) : leur nom lisible appartient donc à
 * la FABRIQUE, ici. Consommé par la cascade de libellés de l'atelier (`src/ui/compendium/editFields.ts`).
 */
export const LIBELLES_ENVELOPPE: Readonly<Record<CleEnveloppe, string>> = {
  id: 'Identifiant',
  type: 'Type de document',
  label: 'Libellé',
  labelF: 'Libellé (forme féminine)',
  desc: 'Description',
  source: 'Source',
  alsoIn: 'Aussi publié dans',
  variants: 'Variantes',
  maison: 'Arbitrage maison',
  icon: 'Icône',
};

/** Une clé d'enveloppe présente dans `champs` s'annule en `never` : le def ne compile pas. */
export type ChampsHorsEnveloppe<C> = { [K in keyof C]: K extends CleEnveloppe ? never : C[K] };

/**
 * Ce que le CODEX expose de ce document : les clés de catégorie sous lesquelles le joueur le trouve
 * (`src/ui/compendium/registry.ts`), ou une EXEMPTION motivée. Déclarée au handle ; la DÉRIVATION des
 * tables du Codex à partir de ces déclarations est le lot L1b (#1467).
 */
export type ExpositionCodex =
  | { readonly keys: readonly string[] }
  | { readonly exempt: { readonly kind: 'vocabulaire-app-interne' | 'dette'; readonly raison: string; readonly ticket?: string } };

/**
 * Ce que l'ÉDITEUR édite : le dataset-liste dont ce document est une entrée, l'OBJET de configuration
 * qu'il forme à lui seul (`single`) ou dont il est une valeur (`record`), ou rien (raison exigée).
 */
export type ExpositionEdit =
  | { readonly dataset: string }
  | { readonly object: 'single' | 'record' }
  | { readonly none: string };

/** EXPOSITION d'un document : où il se lit (Codex) et où il s'édite. */
export interface Exposition {
  readonly codex: ExpositionCodex;
  readonly edit: ExpositionEdit;
}

/**
 * Options de `document()` — tout ce qui n'est pas la déclaration nue du document, pour garder la
 * signature positionnelle courte (`type, famille, champs, meta, exposition, options?`).
 */
export interface OptionsDocument {
  /** Champs qu'une variante réglée republie (`variantOf`, #563/#564). */
  readonly variantes?: readonly string[];
  /** Schéma d'une VALEUR du record — exigé par la famille `record`, refusé partout ailleurs. */
  readonly valeurRecord?: z.ZodTypeAny;
  /**
   * Schéma d'une CLÉ du record — défaut `z.string().min(1)`. Un def dont l'univers de clés est FERMÉ
   * le déclare ici (`src/data/schemas/defs/teintesJeu.ts:134` : `z.record(z.enum(TEINTE_KEYS), hexColor)`)
   * et garde son verrou par construction, qu'une clé libre perdrait. Mesuré (zod 4.4.3) : une clé
   * énumérée rend le record EXHAUSTIF — toute clé déclarée doit être présente.
   */
  readonly cleRecord?: z.ZodType<string>;
  /**
   * Raffinement de l'ENTRÉE, appliqué AVANT le sceau.
   * Mesuré (zod 4.4.3) : `superRefine`/`refine` rendent un `ZodObject` ENCORE extensible — l'ordre
   * entrée → affiner → `.pipe` est donc le seul qui scelle. Consommateurs cibles : `projet.ts`
   * (`superRefine` de document).
   * En famille `record`, l'ENTRÉE est le DOCUMENT ENTIER (enveloppe + `entries`) : le raffinement
   * reçoit donc l'objet qui parse le fichier, `entries` comprise.
   */
  readonly affinerEntree?: (entree: z.ZodObject<z.ZodRawShape>) => z.ZodType<unknown>;
  /**
   * Raffinement du DATASET, appliqué APRÈS l'emballage par famille.
   * Consommateurs cibles : `teintesJeu` (refines du record), unicité d'ids (dataset-liste).
   */
  readonly affinerDataset?: (dataset: z.ZodType<unknown>) => z.ZodType<unknown>;
}

/** Handle FERMÉ d'un document : ce que le registre, l'éditeur et les gardes consomment. */
export interface DocumentHandle<T extends string> {
  /**
   * LE DATASET tel qu'il vit dans son fichier, emballé PAR FAMILLE (#1467) : `entite`/`table` →
   * `z.array(entrée)`, `config` → l'entrée seule, `record` → enveloppe + `entries`. Un def n'écrit
   * plus jamais son `z.array` à la main.
   */
  readonly schema: z.ZodType<unknown>;
  /**
   * L'ENTRÉE SCELLÉE seule — pour l'EMBARQUEMENT (statblocks, table posée dans un autre fichier),
   * jamais pour l'UI, qui consomme le dataset. En famille `record`, l'entrée EST le document entier
   * (enveloppe + `entries`), donc `entree` et `schema` y coïncident.
   */
  readonly entree: z.ZodType<unknown>;
  /**
   * L'entrée en PATCH (tous champs optionnels), dérivée AVANT le sceau puis SCELLÉE à son tour :
   * `.partial()` rend un `ZodObject` NU, que `.extend` rouvrirait — la fabrique n'expose aucun nœud
   * extensible, fût-il voisin. `.optional()`/`safeParse` restent servis.
   * Consommateur mesuré : `src/data/schemas/defs-scenes/narratif.ts:49`
   * (`creaturesSchema.element.partial().optional()`) — sur le nœud SCELLÉ, `.partial` n'existe pas et l'appel JETTE.
   */
  readonly entreePartielle: z.ZodType<unknown>;
  /**
   * Clés top-level de l'entrée (enveloppe + champs, plus `entries` en famille `record`), relevées
   * AVANT le sceau.
   * Consommateurs mesurés : `src/data/variants-integrity.test.ts:29-31`
   * (`Object.keys(def.schema.element.shape)` ×3) et `scripts/guards/lib/fieldConsumerTargets.mjs:46`
   * (`if (schema?.shape)` — sans cette liste, la garde dégrade en SILENCE à zéro champ).
   */
  readonly cles: readonly string[];
  /** `type` du document, écrit dans le JSON et vérifié au parse. */
  readonly type: T;
  readonly famille: FamilleDocument;
  /** Méta d'édition, une entrée par clé de `champs`. */
  readonly meta: Readonly<Record<string, MetaChamp>>;
  /** Exposition Codex / éditeur, déclarée par le def. */
  readonly exposition: Exposition;
  /** Champs qu'une variante réglée republie (`variantOf`, #563/#564) — vide = aucune variante admise. */
  readonly variantes: readonly string[];
}

function enveloppe(type: string) {
  return {
    id: z.string().min(1),
    type: z.literal(type),
    label: z.string().min(1),
    labelF: z.string().optional(),
    desc: z.string().optional(),
    source: exigeSource(type) ? sourceRefSchema : sourceRefSchema.optional(),
    alsoIn: z.array(secondarySourceRefSchema).optional(),
    maison: z.string().optional(),
    icon: z.string().optional(),
  };
}

function verifieExposition(type: string, exposition: Exposition): void {
  const c = exposition.codex as { keys?: readonly string[]; exempt?: { raison?: string } };
  if (!(Array.isArray(c.keys) && c.keys.length) && !c.exempt?.raison) {
    throw new Error(`document('${type}') : \`codex\` exige des \`keys\` non vides ou un \`exempt\` motivé.`);
  }
  const e = exposition.edit as { dataset?: string; object?: string; none?: string };
  if (!e.dataset && !e.object && !e.none) {
    throw new Error(`document('${type}') : \`edit\` exige \`dataset\`, \`object\` ou \`none\` (raison).`);
  }
}

/**
 * Déclare un document. `champs` = la charge utile propre au type, `meta` = son libellé FR par clé,
 * `exposition` = Codex + éditeur, `options.variantes` = les champs qu'une variante réglée republie —
 * la fabrique compose `variantOf` elle-même, donc un champ hors de cette liste est refusé au parse et
 * un document sans `variantes` n'admet aucun `variants`.
 *
 * Elle rend AUSSI l'emballage du FICHIER (`schema`, par famille) : pour `record`, `champs`/`meta`
 * décrivent les champs d'ENVELOPPE additionnels éventuels — le contenu, lui, vit sous `entries`, que
 * la fabrique pose seule (`options.valeurRecord`, `options.cleRecord`) et qu'un def ne redéclare pas.
 */
export function document<T extends string, C extends Record<string, z.ZodTypeAny>>(
  type: T,
  famille: FamilleDocument,
  champs: C & ChampsHorsEnveloppe<C>,
  meta: MetaDesChamps<C>,
  exposition: Exposition,
  options: OptionsDocument = {},
): DocumentHandle<T> {
  const { variantes, valeurRecord, cleRecord, affinerEntree, affinerDataset } = options;
  if (famille === 'record' && !valeurRecord) {
    throw new Error(`document('${type}') : la famille « record » exige \`valeurRecord\` (le schéma d'une valeur de \`entries\`).`);
  }
  if (famille !== 'record' && valeurRecord) {
    throw new Error(`document('${type}') : \`valeurRecord\` n'a de sens que pour la famille « record » (ici « ${famille} »).`);
  }
  if (famille !== 'record' && cleRecord) {
    throw new Error(`document('${type}') : \`cleRecord\` n'a de sens que pour la famille « record » (ici « ${famille} »).`);
  }
  const cles = Object.keys(champs);
  for (const k of cles) {
    if (famille === 'record' && k === 'entries') {
      throw new Error(`document('${type}') : la fabrique pose « entries » pour la famille « record » — retire-le de \`champs\`.`);
    }
    if ((CLES_ENVELOPPE as readonly string[]).includes(k)) {
      throw new Error(`document('${type}') : « ${k} » est une clé d'ENVELOPPE, la fabrique la pose — retire-la de \`champs\`.`);
    }
    if (!(meta as Record<string, MetaChamp | undefined>)[k]) {
      throw new Error(`document('${type}') : le champ « ${k} » n'a pas de méta d'édition (\`{ label }\` au minimum).`);
    }
  }
  for (const k of Object.keys(meta)) {
    if (!cles.includes(k)) {
      throw new Error(`document('${type}') : méta d'édition « ${k} » sans champ correspondant.`);
    }
  }
  verifieExposition(type, exposition);
  const entree = z.strictObject({ ...enveloppe(type), ...(champs as Record<string, z.ZodTypeAny>) }) as z.ZodObject<z.ZodRawShape>;
  const declarees = [...(variantes ?? [])];
  for (const k of declarees) {
    if (!(k in entree.shape)) {
      throw new Error(`document('${type}') : « ${k} » est déclaré republiable par une variante, mais n'est pas un champ du document.`);
    }
  }
  const complet = declarees.length
    ? (z.strictObject({ ...entree.shape, variants: z.array(variantOf(entree, declarees)).optional() }) as z.ZodObject<z.ZodRawShape>)
    : entree;
  // SCEAU : `.pipe` rend un `ZodPipe` — ni `.extend` ni `.shape` AU RUNTIME, `safeParse`/`z.infer` et le
  // refus `strict` intacts (mesuré sur zod 4.4.3 : `.superRefine`/`.check`/`.refine`/`.brand` rendent,
  // eux, un `ZodObject` encore extensible).
  // En famille `record`, l'ENTRÉE est le DOCUMENT ENTIER : `entries` (posée ICI) en fait partie, donc
  // `affinerEntree`, `entreePartielle` et `cles` la voient comme n'importe quel champ.
  const corps =
    famille === 'record'
      ? (z.strictObject({
          ...complet.shape,
          entries: z.record(cleRecord ?? z.string().min(1), valeurRecord!),
        }) as z.ZodObject<z.ZodRawShape>)
      : complet;
  const entreePartielle: z.ZodType<unknown> = corps.partial().pipe(z.transform((v) => v));
  const clesEntree: readonly string[] = Object.keys(corps.shape);
  const affine = affinerEntree ? affinerEntree(corps) : corps;
  const entreeScellee: z.ZodType<unknown> = affine.pipe(z.transform((v) => v));

  // EMBALLAGE par FAMILLE (#1467) : le dataset est ce que le FICHIER porte — une LISTE d'entrées
  // (`entite`/`table`), ou l'entrée elle-même (`config`, `record`).
  const dataset: z.ZodType<unknown> = famille === 'entite' || famille === 'table' ? z.array(entreeScellee) : entreeScellee;
  const schema: z.ZodType<unknown> = affinerDataset ? affinerDataset(dataset) : dataset;
  return {
    schema,
    entree: entreeScellee,
    entreePartielle,
    cles: clesEntree,
    type,
    famille,
    meta: { ...(meta as Record<string, MetaChamp>) },
    exposition,
    variantes: declarees,
  };
}
