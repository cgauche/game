/**
 * FABRIQUE DE RÉFÉRENCE (#1466 L1a) — la seule façon de désigner une entité par son id.
 *
 * `ref(type)` construit ET ENREGISTRE le nœud FINAL : l'id est refiné AU PARSE contre le registre
 * généré `IDS_PAR_DATASET` (`npm run gen`), si bien qu'une référence morte casse au chargement, en
 * test et à la sauvegarde du Compendium — sans qu'aucune garde nominative n'ait à l'énumérer
 * (clause B absorbée de #1473). La fabrique n'expose aucun nœud extensible : zod 4.4.3 perd le
 * registre et la `.meta()` au `.extend`, la composition se fait donc ICI via `extra`.
 *
 * Ce lot POSE la fabrique ; l'adoption par les defs et la migration des graphies historiques
 * (`{ref:{id}}`, `{wildcard}`, `{skillId, spec}`…) sont les lots L2/L3 (#1463).
 */
import { z } from 'zod';
import { IDS_PAR_DATASET, SPECS_PAR_DATASET } from '../_ids.generated';

declare const marqueDeType: unique symbol;
/** Id BRANDÉ par son type — frappé à la porte zod, jamais par un `as` d'appelant. */
export type Id<T extends string> = string & { readonly [marqueDeType]: T };

/** Ce qu'un type d'entité déclare : son dataset cible et le régime de ses spécialisations. */
export interface CibleDeType {
  /** Nom de fichier du dataset qui fait AUTORITÉ sur les ids de ce type. */
  readonly dataset: string;
  /**
   * Régime de la spécialisation d'une entité DÉJÀ spécialisable (`LDB 09 l.36-40` — la
   * spécialisabilité, elle, est portée PAR ENTRÉE : `SPECS_PAR_DATASET`, cf. `estSpecialisable`).
   * `true` = spécialisations OUVERTES : le joueur peut « créer une Spécialisation unique »
   * (`LDB 09 l.40`), la valeur est donc un libellé libre et non une clé étrangère.
   * `false` = pool FERMÉ : la spec doit appartenir au catalogue de l'entrée (`specCatalogOf`).
   */
  readonly specsOpen: boolean;
}

/**
 * Types d'entité déclarés à la grammaire. La liste est celle des concepts que les lots L2/L3 du
 * chantier migrent (Compétence, puis Talent/Trait/Objet/Sort/Créature/Véhicule/Structure) + la
 * TABLE, cible de `pick({ table })`. Un type s'ajoute avec le lot qui le migre, jamais « au cas où ».
 */
export const TYPES = {
  skill: { dataset: 'skills.json', specsOpen: true },
  talent: { dataset: 'talents.json', specsOpen: false },
  trait: { dataset: 'traits.json', specsOpen: false },
  trapping: { dataset: 'trappings.json', specsOpen: false },
  spell: { dataset: 'spells.json', specsOpen: false },
  creature: { dataset: 'creatures.json', specsOpen: false },
  vehicle: { dataset: 'vehicles.json', specsOpen: false },
  structure: { dataset: 'structures.json', specsOpen: false },
  table: { dataset: 'tables.json', specsOpen: false },
} as const satisfies Record<string, CibleDeType>;

export type TypeEntite = keyof typeof TYPES;

/** Dataset qui fait autorité sur les ids d'un type. */
export function cibleDe(type: TypeEntite): string {
  return TYPES[type].dataset;
}

const SLOTS: { type: TypeEntite; extra: readonly string[] }[] = [];

/** Slots de référence construits par la grammaire — la source de l'intégrité référentielle générique. */
export function slots(): readonly { type: TypeEntite; extra: readonly string[] }[] {
  return SLOTS.map((s) => ({ type: s.type, extra: [...s.extra] }));
}

function idsDe(type: TypeEntite): readonly string[] {
  return IDS_PAR_DATASET[cibleDe(type)] ?? [];
}

/** Catalogue de spécialisations d'UNE entrée (vide = l'entrée n'en déclare aucune). */
function catalogueSpecs(type: TypeEntite, id: string): readonly string[] {
  return SPECS_PAR_DATASET[cibleDe(type)]?.[id] ?? [];
}

/**
 * L'entrée porte-t-elle des Spécialisations ? `LDB 09 l.36-40`. La donnée l'exprime par un catalogue
 * NON VIDE — `specs[]` inline ou pool dérivé d'une `specsSource` (registre `SPECS_PAR_DATASET`,
 * `npm run gen`). Sans catalogue, ni `spec` ni `choix` n'ont de sens : la réf est un `ref(type)` nu.
 */
export function estSpecialisable(type: TypeEntite, id: string): boolean {
  return catalogueSpecs(type, id).length > 0;
}

/** Schéma d'un id NU de `type` : refiné contre le registre, brandé `Id<type>` à la sortie. */
export function idDe<T extends TypeEntite>(type: T): z.ZodType<Id<T>, string> {
  const dataset = cibleDe(type);
  return z
    .string()
    .superRefine((v, ctx) => {
      if (idsDe(type).includes(v)) return;
      ctx.addIssue({
        code: 'custom',
        message: `ref('${type}') : id « ${v} » absent de ${dataset} (registre _ids.generated.ts).`,
      });
    })
    .transform((v) => v as Id<T>);
}

/** Liste d'ids nus de `type`. */
export function refs<T extends TypeEntite>(type: T): z.ZodType<Id<T>[], string[]> {
  SLOTS.push({ type, extra: [] });
  return z.array(idDe(type));
}

/** Référence `{ id }` de `type`, composée FERMÉE avec les champs propres au porteur (`extra`). */
export function ref<T extends TypeEntite, E extends Record<string, z.ZodTypeAny> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  SLOTS.push({ type, extra: Object.keys(extra ?? {}) });
  return z.strictObject({ id: idDe(type), ...((extra ?? {}) as Record<string, z.ZodTypeAny>) });
}

/** Slot POLYMORPHE `{ type, id }` — le type est porté par la donnée, l'id résolu contre son dataset. */
export function typedRef(types: readonly TypeEntite[] = Object.keys(TYPES) as TypeEntite[]): z.ZodType<unknown> {
  for (const t of types) SLOTS.push({ type: t, extra: ['type'] });
  return z
    .strictObject({ type: z.enum(types as [TypeEntite, ...TypeEntite[]]), id: z.string() })
    .superRefine((v, ctx) => {
      if (idsDe(v.type).includes(v.id)) return;
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: `ref('${v.type}') : id « ${v.id} » absent de ${cibleDe(v.type)} (registre _ids.generated.ts).`,
      });
    });
}

/**
 * Référence À SPÉCIALISATION : `{ id, spec }` XOR `{ id, choix: true | [ids] }` — exactement UN des
 * deux régimes (une réf sans spécialisation est un `ref(type)` nu). L'entrée VISÉE doit d'abord être
 * spécialisable (`estSpecialisable`, `LDB 09 l.36-40`) ; `spec`/`choix` sont ensuite validés contre le
 * catalogue de l'entrée quand le type ferme ses spécialisations.
 */
export function specRef<T extends TypeEntite, E extends Record<string, z.ZodTypeAny> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  const dataset = cibleDe(type);
  const ouvert = TYPES[type].specsOpen;
  SLOTS.push({ type, extra: ['spec', 'choix', ...Object.keys(extra ?? {})] });
  return z
    .strictObject({
      id: idDe(type),
      spec: z.string().min(1).optional(),
      choix: z.union([z.literal(true), z.array(z.string().min(1))]).optional(),
      ...((extra ?? {}) as Record<string, z.ZodTypeAny>),
    })
    .superRefine((v, ctx) => {
      if (!estSpecialisable(type, String(v.id))) {
        ctx.addIssue({
          code: 'custom',
          message: `ref('${type}') : « ${String(v.id)} » ne déclare aucune spécialisation dans ${dataset} — « spec »/« choix » ne s'y applique pas (LDB 09 l.36-40).`,
        });
        return;
      }
      const aSpec = v.spec != null;
      const aChoix = v.choix != null;
      if (aSpec === aChoix) {
        ctx.addIssue({
          code: 'custom',
          message: `ref('${type}') à spécialisation : « spec » OU « choix », exactement un des deux (id « ${String(v.id)} »).`,
        });
        return;
      }
      if (ouvert) return;
      const pool = catalogueSpecs(type, String(v.id));
      const candidats = aSpec ? [v.spec as string] : Array.isArray(v.choix) ? (v.choix as string[]) : [];
      for (const c of candidats) {
        if (pool.includes(c)) continue;
        ctx.addIssue({
          code: 'custom',
          path: [aSpec ? 'spec' : 'choix'],
          message: `ref('${type}') : spécialisation « ${c} » absente du pool de « ${String(v.id)} » dans ${dataset} (pool fermé).`,
        });
      }
    });
}

/**
 * Choix « n parmi » : `{ pick, of: [refs] }` (liste énumérée) ou `{ pick, table }` (tirage sur une
 * table d100). Remplace les graphies `choice[]` et `random` des lots L2/L3.
 */
export function pick<T extends TypeEntite>(type: T): z.ZodType<unknown> {
  const n = z.number().int().positive();
  return z.union([
    z.strictObject({ pick: n, of: z.array(ref(type)).min(1) }),
    z.strictObject({ pick: n, table: ref('table') }),
  ]);
}

/**
 * Signature de la PORTE moteur de résolution d'une référence : le type et l'id doivent s'accorder
 * (`byId('talent', unIdDeCompetence)` ne compile pas, `NoInfer` empêchant le type de s'élargir).
 * L'implémentation vit dans le moteur au lot L2 — la grammaire en déclare le contrat, pas un stub.
 */
export type SignatureById = <T extends TypeEntite>(type: T, id: Id<NoInfer<T>>) => unknown;
