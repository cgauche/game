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

/** Handle FERMÉ d'un document : ce que le registre, l'éditeur et les gardes consomment. */
export interface DocumentHandle<T extends string> {
  /** Schéma zod du document, enveloppe + champs, `strictObject` SCELLÉ — ni `.extend` ni `.shape`. */
  readonly schema: z.ZodType<unknown>;
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
 * `exposition` = Codex + éditeur, `variantes` = les champs qu'une variante réglée republie — la
 * fabrique compose `variantOf` elle-même, donc un champ hors de cette liste est refusé au parse et
 * un document sans `variantes` n'admet aucun `variants`.
 */
export function document<T extends string, C extends Record<string, z.ZodTypeAny>>(
  type: T,
  famille: FamilleDocument,
  champs: C & ChampsHorsEnveloppe<C>,
  meta: MetaDesChamps<C>,
  exposition: Exposition,
  variantes?: readonly string[],
): DocumentHandle<T> {
  const cles = Object.keys(champs);
  for (const k of cles) {
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
  const schema: z.ZodType<unknown> = complet.pipe(z.transform((v) => v));
  return {
    schema,
    type,
    famille,
    meta: { ...(meta as Record<string, MetaChamp>) },
    exposition,
    variantes: declarees,
  };
}
