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
 * (`{ref:{id}}`, `{wildcard}`, `{talentId, spec}`…) sont les lots L2/L3 (#1463).
 */
import { z } from 'zod';
import { IDS_PAR_DATASET, SPECS_PAR_DATASET } from '../_ids.generated';
import { marque } from './slots';

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

/**
 * Schéma d'un id NU de `type` : refiné contre le registre, brandé `Id<type>` à la sortie. C'est la
 * FEUILLE porteuse de la référence — elle porte la marque que la marche des slots retrouve
 * (`slots.ts`), jamais l'enveloppe `ref()`/`specRef()` qui la compose.
 */
export function idDe<T extends TypeEntite>(type: T): z.ZodType<Id<T>, string> {
  const dataset = cibleDe(type);
  return marque(
    z
      .string()
      .superRefine((v, ctx) => {
        if (idsDe(type).includes(v)) return;
        ctx.addIssue({
          code: 'custom',
          message: `ref('${type}') : id « ${v} » absent de ${dataset} (registre _ids.generated.ts).`,
        });
      })
      .transform((v) => v as Id<T>),
    { espece: 'id', type, site: `idDe('${type}')` },
  );
}

/** Liste d'ids nus de `type`. */
export function refs<T extends TypeEntite>(type: T): z.ZodType<Id<T>[], string[]> {
  return z.array(idDe(type));
}

/** Référence `{ id }` de `type`, composée FERMÉE avec les champs propres au porteur (`extra`). */
export function ref<T extends TypeEntite, E extends Record<string, z.ZodTypeAny> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return z.strictObject({ id: idDe(type), ...((extra ?? {}) as Record<string, z.ZodTypeAny>) });
}

/** Slot POLYMORPHE `{ type, id }` — le type est porté par la donnée, l'id résolu contre son dataset. */
export function typedRef(types: readonly TypeEntite[] = Object.keys(TYPES) as TypeEntite[]): z.ZodType<unknown> {
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
/** FORME de sortie d'un nœud de référence à spécialisation — DÉCLARÉE (et non inferée) : les `extra`
 *  du porteur n'y figurent pas, un site qui les lit redéclare son type (patron `AxesData`,
 *  `schemas/defs/axes.ts`). Sans cette déclaration, tout schéma RÉCURSIF annoté qui compose une réf
 *  (`flowSchema: ZodType<Flow<EffectOp>>`) perdrait sa forme et cesserait de typer son arbre. */
export interface RefASpecialisation { id: string; spec?: string; choix?: true | string[] }

/**
 * Le littéral que le livre imprime à la place d'une spécialisation : `LDB 09 l.40`. Ce n'est pas une
 * spécialisation, c'est un EMPLACEMENT non désigné — la grammaire l'écrit `choix`. Refusé AU SCHÉMA
 * (et non par un seul contrat de dataset) : le verrou couvre du même geste `src/data` et `src/scenes`,
 * y compris les types à spécialisations OUVERTES que le pool fermé ne filtre pas.
 */
const SENTINELLE_DE_SPEC = /^au[\s-]+choix$/i;

/** Nœud `{ id, spec?, choix?, …extra }` + validation de la spécialisation. `exigeUnRegime` : `true`
 *  = `spec` XOR `choix` obligatoire (`specRef`), `false` = les deux peuvent manquer (`refOuSpec`). */
function noeudASpecialisation<T extends TypeEntite>(
  type: T,
  extra: Record<string, z.ZodTypeAny> | undefined,
  exigeUnRegime: boolean,
): z.ZodType<RefASpecialisation> {
  const dataset = cibleDe(type);
  const ouvert = TYPES[type].specsOpen;
  return z
    .strictObject({
      id: idDe(type),
      spec: z.string().min(1).optional(),
      choix: z.union([z.literal(true), z.array(z.string().min(1))]).optional(),
      ...((extra ?? {}) as Record<string, z.ZodTypeAny>),
    })
    .superRefine((v, ctx) => {
      const aSpec = v.spec != null;
      const aChoix = v.choix != null;
      if (!aSpec && !aChoix) {
        if (!exigeUnRegime) return;
        ctx.addIssue({
          code: 'custom',
          message: `ref('${type}') à spécialisation : « spec » OU « choix », exactement un des deux (id « ${String(v.id)} »).`,
        });
        return;
      }
      if (!estSpecialisable(type, String(v.id))) {
        ctx.addIssue({
          code: 'custom',
          message: `ref('${type}') : « ${String(v.id)} » ne déclare aucune spécialisation dans ${dataset} — « spec »/« choix » ne s'y applique pas (LDB 09 l.36-40).`,
        });
        return;
      }
      if (aSpec && aChoix) {
        ctx.addIssue({
          code: 'custom',
          message: `ref('${type}') à spécialisation : « spec » OU « choix », exactement un des deux (id « ${String(v.id)} »).`,
        });
        return;
      }
      const candidats = aSpec ? [v.spec as string] : Array.isArray(v.choix) ? (v.choix as string[]) : [];
      let sentinelle = false;
      for (const c of candidats) {
        if (!SENTINELLE_DE_SPEC.test(c)) continue;
        sentinelle = true;
        ctx.addIssue({
          code: 'custom',
          path: [aSpec ? 'spec' : 'choix'],
          message: `ref('${type}') : « ${c} » n'est pas une spécialisation mais un EMPLACEMENT non désigné (${dataset}, « ${String(v.id)} ») — s'écrit « choix » (LDB 09 l.40).`,
        });
      }
      if (sentinelle) return;
      if (ouvert) return;
      const pool = catalogueSpecs(type, String(v.id));
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
 * Référence À SPÉCIALISATION : `{ id, spec }` XOR `{ id, choix: true | [ids] }` — exactement UN des
 * deux régimes (une réf sans spécialisation est un `ref(type)` nu, ou un `refOuSpec(type)` quand le
 * site accepte les deux). L'entrée VISÉE doit d'abord être spécialisable (`estSpecialisable`,
 * `LDB 09 l.36-40`) ; `spec`/`choix` sont ensuite validés contre le catalogue de l'entrée quand le
 * type ferme ses spécialisations.
 */
export function specRef<T extends TypeEntite, E extends Record<string, z.ZodTypeAny> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return noeudASpecialisation(type, extra, true);
}

/**
 * Référence dont la spécialisation est FACULTATIVE : `{ id }` (aucune spécialisation visée) OU
 * `{ id, spec }` / `{ id, choix }`. MÊME nœud que `specRef`, seul le régime obligatoire tombe — donc
 * UNE seule marque de slot par site (jamais une union, qui en poserait deux) : c'est la forme à
 * écrire dès qu'une donnée désigne une entrée « toute spécialisation comprise » aussi bien qu'une
 * spécialisation précise.
 */
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodTypeAny> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<RefASpecialisation> {
  return noeudASpecialisation(type, extra, false);
}

/**
 * Choix « n parmi » : `{ pick, of: [...] }` (liste énumérée) ou `{ pick, table }` (tirage sur une
 * table d100). Remplace les graphies `choice[]` et `random` des lots L2/L3.
 *
 * Une entrée de `of` est l'UNION des trois façons de désigner une option : référence nue `ref(type)`,
 * référence à spécialisation `specRef(type)` (`{id, spec}` XOR `{id, choix}`, validée contre le pool
 * de l'entrée À TRAVERS l'`of`), ou un `pick` IMBRIQUÉ (un « n parmi » dont une option est elle-même
 * un choix, y compris un tirage sur table). La récursion se referme sur le nœud LUI-MÊME (`noeud`),
 * que la marche des slots retrouve dans sa pile d'ancêtres et coupe là (`slots.ts`).
 *
 * `optionsDuPorteur` ouvre l'`of` aux formes que le PORTEUR admet en plus des trois ci-dessus —
 * même composition FERMÉE que l'`extra` de `ref()`/`specRef()` : le porteur déclare ce qu'il
 * accepte, la fabrique ne connaît aucun cas particulier (cf. `avancement.ts`, `{random}`).
 */
export function pick<T extends TypeEntite>(type: T, optionsDuPorteur: readonly z.ZodType<unknown>[] = []): z.ZodType<unknown> {
  const n = z.number().int().positive();
  const option: z.ZodType<unknown> = z.lazy(() => z.union([ref(type), specRef(type), noeud, ...optionsDuPorteur]));
  const noeud: z.ZodType<unknown> = z.union([
    z.strictObject({ pick: n, of: z.array(option).min(1) }),
    z.strictObject({ pick: n, table: ref('table') }),
  ]);
  return noeud;
}

