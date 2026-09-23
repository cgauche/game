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
import './locale-fr';
import { IDS_PAR_DATASET, IDS_PAR_DISCRIMINANT, SPECS_PAR_DATASET } from '../_ids.generated';
import { idsVivants, idsVivantsDuDiscriminant } from './idsVivants';

declare const marqueDeType: unique symbol;
/** Id BRANDÉ par son type — frappé à la porte zod, jamais par un `as` d'appelant. */
export type Id<T extends string> = string & { readonly [marqueDeType]: T };

/** Ce qu'un type d'entité déclare : son dataset cible et le régime de ses spécialisations. */
export interface CibleDeType {
  /** Nom de fichier du dataset qui fait AUTORITÉ sur les ids de ce type. */
  readonly dataset: string;
  /**
   * Régime de la spécialisation d'une entité DÉJÀ spécialisable — la spécialisabilité, elle, est
   * portée PAR ENTRÉE (`SPECS_PAR_DATASET`, cf. `estSpecialisable`). CONSTRUCTION du registre, et
   * non une règle du livre : ce drapeau dit comment la DONNÉE de ce type d'entité s'écrit.
   * `true` = spécialisations OUVERTES : pour une Compétence Groupée, le joueur peut « créer une
   * Spécialisation unique » (`LDB 09 l.40`) — la valeur est donc un libellé libre, pas une clé
   * étrangère. `false` = pool FERMÉ : la spec doit appartenir au catalogue de l'entrée
   * (`specCatalogOf`).
   */
  readonly specsOpen: boolean;
}

/**
 * Types d'entité déclarés à la grammaire. La liste est celle des concepts que les lots L2/L3 du
 * chantier migrent (Compétence, puis Talent/Trait/Objet/Sort/Créature/Véhicule/Structure, +
 * Carrière et Trait NAVAL au L-gram-2 #1463) + la TABLE, cible de `pick({ table })`, + la MATIÈRE du
 * monde (#1686), premier type dont le dataset est DISCRIMINÉ (`idDe('material', 'prop')`), + le
 * TERRAIN et le DÉCOR (#1690 : `layer.tiles` résout un terrain, `terrains › overlayProp` un décor).
 * Un type s'ajoute avec le lot qui le migre, jamais « au cas où ».
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
  career: { dataset: 'careers.json', specsOpen: false },
  navalTrait: { dataset: 'naval-traits.json', specsOpen: false },
  // PORT du catalogue naval : `MapPlace.port.ref` résout AU PARSE, toutes les réfs mortes nommées.
  navalPort: { dataset: 'naval-ports.json', specsOpen: false },
  shipStation: { dataset: 'ship-stations.json', specsOpen: false },
  crewRole: { dataset: 'crew-roles.json', specsOpen: false },
  table: { dataset: 'tables.json', specsOpen: false },
  etat: { dataset: 'etats.json', specsOpen: false },
  maladie: { dataset: 'maladies.json', specsOpen: false },
  symptome: { dataset: 'symptoms.json', specsOpen: false },
  material: { dataset: 'materials.json', specsOpen: false },
  // RÈGLE OPTIONNELLE : cible du terme `{rule}` d'une `Formula` (#1599) — une quantité que le livre ne
  // chiffre pas se lit au registre, l'id résout donc AU PARSE comme toute autre référence.
  regleOptionnelle: { dataset: 'reglesOptionnelles.json', specsOpen: false },
  terrain: { dataset: 'terrains.json', specsOpen: false },
  // PALIER D'ÉCLAIRAGE (#1716) : la semence d'éclairage d'une scène neuve (`semences-de-scene.json`)
  // nomme un palier — l'id résout AU PARSE, là où `Scene.ambientLight` reste une chaîne libre.
  lightLevel: { dataset: 'lightLevels.json', specsOpen: false },
  prop: { dataset: 'props.json', specsOpen: false },
  building: { dataset: 'buildings.json', specsOpen: false },
  // AXE de forces/faiblesses (#409) : `activeAxes` d'un projet de scène résout AU PARSE (#1473 R1).
  axe: { dataset: 'axes.json', specsOpen: false },
} as const satisfies Record<string, CibleDeType>;

export type TypeEntite = keyof typeof TYPES;

/** Dataset qui fait autorité sur les ids d'un type. */
export function cibleDe(type: TypeEntite): string {
  return TYPES[type].dataset;
}

function idsDe(type: TypeEntite): readonly string[] {
  const dataset = cibleDe(type);
  // La MÉMOIRE d'abord (`idsVivants`, second régime déclaré par `_ids.generated.ts`) : une entité
  // créée ou renommée à l'atelier est référençable IMMÉDIATEMENT. Hors application (scripts, gardes,
  // `npm run gen`), aucune source n'est posée et le fichier généré fait foi.
  return idsVivants(dataset) ?? IDS_PAR_DATASET[dataset] ?? [];
}

/**
 * Ids d'une SOUS-LISTE du dataset d'un type : ceux dont le champ DISCRIMINANT du document vaut
 * `valeur` — lus en MÉMOIRE quand une source vivante est posée (`idsVivants.ts`), sinon au registre
 * généré `IDS_PAR_DISCRIMINANT` (`npm run gen` — le def déclare son `discriminant`).
 * FAIL-FAST à la CONSTRUCTION du schéma : un type non discriminé, ou une valeur qu'aucune entrée ne
 * porte, ferait un nœud qui refuse TOUT en silence.
 */
function idsSousListe(type: TypeEntite, valeur: string): readonly string[] {
  const dataset = cibleDe(type);
  const table = IDS_PAR_DISCRIMINANT[dataset];
  if (!table) {
    throw new Error(
      `idDe('${type}', '${valeur}') : ${dataset} ne déclare aucun champ discriminant — poser \`export const discriminant\` sur son def, ou référer le type sans valeur.`,
    );
  }
  // EXISTENCE de la valeur : le registre GÉNÉRÉ en fait foi (fail-fast à la construction) — une valeur
  // discriminante est un univers FERMÉ (enum du def), que la mémoire ne peut pas élargir. Le CONTENU de
  // la sous-liste, lui, se lit vivant : une matière créée à l'atelier est référençable aussitôt.
  if (!table[valeur]) {
    throw new Error(
      `idDe('${type}', '${valeur}') : « ${valeur} » n'est aucune des valeurs discriminantes de ${dataset} (${Object.keys(table).join(', ')}).`,
    );
  }
  return idsVivantsDuDiscriminant(dataset, valeur) ?? table[valeur];
}

/** Catalogue de spécialisations d'UNE entrée (vide = l'entrée n'en déclare aucune). */
function catalogueSpecs(type: TypeEntite, id: string): readonly string[] {
  return SPECS_PAR_DATASET[cibleDe(type)]?.[id] ?? [];
}

/**
 * L'entrée porte-t-elle des Spécialisations ? La DONNÉE le dit, par un catalogue NON VIDE — `specs[]`
 * inline ou pool dérivé d'une `specsSource` (registre `SPECS_PAR_DATASET`, `npm run gen`). Sans
 * catalogue, ni `spec` ni `choix` n'ont de sens : la réf est un `ref(type)` nu. Pour les Compétences,
 * ce catalogue est celui des Compétences Groupées (`LDB 09 l.36`) ; pour les autres types, c'est une
 * déclaration du catalogue app-owned, sans équivalent au livre.
 */
export function estSpecialisable(type: TypeEntite, id: string): boolean {
  return catalogueSpecs(type, id).length > 0;
}

/**
 * Clé du repère dans les `params` d'une issue : privée au module, donc infalsifiable par un autre
 * émetteur. Le repère porte le type d'entité validé.
 */
const REPERE: unique symbol = Symbol('repère de parse de mesure');

/** Vrai le temps SYNCHRONE d'un `reperesDuParse`, qui seul l'écrit, et jamais ailleurs : aucun export n'expose l'état. */
let parseDeMesure = false;

/** Les feuilles construites par `idDe` — ce que la garde du masquage (`parse-de-mesure.test.ts`) instrumente. */
const FEUILLES_D_ID = new WeakSet<object>();

/** Le nœud est-il une feuille construite par `idDe` ? */
export const estFeuilleDId = (noeud: unknown): boolean =>
  typeof noeud === 'object' && noeud !== null && FEUILLES_D_ID.has(noeud);

/**
 * Schéma d'un id NU de `type` : refiné contre le registre, brandé `Id<type>` à la sortie. C'est la
 * FEUILLE porteuse de la référence, et la SEULE vérification d'un id contre le registre sous
 * `src/data/schemas` : au parse de mesure (`reperesDuParse`), chaque validation réussie y émet un
 * REPÈRE, que le volet SLOTS de `docs/structures-donnees.md` lit comme le côté DÉCLARÉ.
 *
 * La liste admise se LIT À CHAQUE VALIDATION, parce que le registre a deux régimes déclarés
 * (`_ids.generated.ts`) : le fichier généré figé au commit, et le RECALCUL en mémoire de l'éditeur
 * (`CodexEdit.save` → `validateDataset`), qui remplace l'entrée du dataset. Les schémas, eux, se
 * construisent UNE fois au chargement du module : une lecture faite à la construction rendrait une
 * entité créée au Compendium invalide pour toute donnée qui la référence. La construction ne fait
 * qu'un contrôle FAIL-FAST de la sous-liste demandée.
 */
export function idDe<T extends TypeEntite>(type: T, valeur?: string): z.ZodType<Id<T>, string> {
  const dataset = cibleDe(type);
  if (valeur !== undefined) idsSousListe(type, valeur);
  const admis = (): readonly string[] => (valeur === undefined ? idsDe(type) : idsSousListe(type, valeur));
  const site = valeur === undefined ? `idDe('${type}')` : `idDe('${type}', '${valeur}')`;
  const feuille = z
    .string()
    .superRefine((v, ctx) => {
      if (admis().includes(v)) {
        if (parseDeMesure) ctx.addIssue({ code: 'custom', message: `repère de ${site}`, params: { [REPERE]: type }, continue: true });
        return;
      }
      ctx.addIssue({
        code: 'custom',
        message:
          valeur === undefined
            ? `ref('${type}') : id « ${v} » absent de ${dataset} (registre _ids.generated.ts).`
            : `ref('${type}', '${valeur}') : id « ${v} » hors de la sous-liste « ${valeur} » de ${dataset} (registre _ids.generated.ts).`,
      });
    })
    .transform((v) => v as Id<T>);
  FEUILLES_D_ID.add(feuille);
  return feuille;
}

/** Une référence validée par `idDe` au parse de mesure : son path de DONNÉE et son type. `parCle` :
 *  la valeur validée est la CLÉ d'un record (dernier segment du path), pas la valeur qu'elle pose. */
export interface RepereDeMesure {
  readonly path: readonly PropertyKey[];
  readonly type: TypeEntite;
  readonly parCle: boolean;
}

/** Une issue zod telle que `reperesDuParse` la lit. */
type IssueLue = {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly params?: { readonly [REPERE]?: TypeEntite };
  readonly errors?: readonly (readonly IssueLue[])[];
  readonly issues?: readonly IssueLue[];
};

const typeDuRepere = (issue: IssueLue): TypeEntite | undefined => issue.params?.[REPERE];

/** L'issue n'est-elle faite QUE de repères (union dont une branche l'est, clé/élément dont toutes les issues le sont) ? */
const estPropre = (issue: IssueLue): boolean =>
  typeDuRepere(issue) !== undefined ||
  (issue.code === 'invalid_union' && (issue.errors ?? []).some((b) => b.length > 0 && b.every(estPropre))) ||
  ((issue.code === 'invalid_key' || issue.code === 'invalid_element') && (issue.issues ?? []).length > 0 && issue.issues!.every(estPropre));

function recueillir(issues: readonly IssueLue[], prefixe: readonly PropertyKey[], parCle: boolean, out: RepereDeMesure[]): void {
  for (const issue of issues) {
    const path = [...prefixe, ...issue.path];
    const type = typeDuRepere(issue);
    if (type !== undefined) {
      out.push({ path, type, parCle });
      continue;
    }
    // La PREMIÈRE branche propre est celle que le parse normal choisit : la première sans issue.
    const branche = issue.code === 'invalid_union' ? issue.errors?.find((b) => b.length > 0 && b.every(estPropre)) : undefined;
    if (branche) recueillir(branche, path, parCle, out);
    else if (issue.code === 'invalid_key' && estPropre(issue)) recueillir(issue.issues!, path, true, out);
    else if (issue.code === 'invalid_element' && estPropre(issue)) recueillir(issue.issues!, path, parCle, out);
    else
      throw new Error(
        `parse de mesure : issue « ${issue.code} » à « ${path.map(String).join('.') || '(racine)'} » (${issue.message}) — ni repère d'\`idDe\`, ni union, clé ou élément fait de repères : le document est invalide au parse normal.`,
      );
  }
}

/**
 * PARSE DE MESURE d'une donnée par son schéma RÉEL : les références que `idDe` y valide, à leur path
 * de DONNÉE. Le mode est borné par construction : `parseDeMesure` n'est vrai que pendant l'appel
 * SYNCHRONE à `safeParse` (zod lève sur tout nœud async), et le `finally` le rend à sa valeur
 * précédente, y compris quand le recueil lève. Les seuls parses exécutés dans cette fenêtre sont
 * ceux que ce `safeParse` imbrique (payload d'une op, `grammaire/mecanique.ts › gameOpSchema`).
 * La donnée doit être VALIDE au parse normal, et c'est ce parse, exécuté HORS de la fenêtre de mesure,
 * qui en juge : dans la fenêtre, le repère d'une feuille `idDe` fait avorter le `pipe` qui la porte, et
 * un raffinement posé EN SORTIE de la feuille (`.transform`, `.pipe`) ne s'y exécute pas. Un échec du
 * parse normal LÈVE en nommant sa première issue ; dans la fenêtre, une issue qui n'est pas un repère
 * LÈVE aussi.
 */
export function reperesDuParse(schema: z.ZodType, donnee: unknown): RepereDeMesure[] {
  const normal = schema.safeParse(donnee);
  if (!normal.success) {
    const [premiere] = normal.error.issues;
    throw new Error(
      `parse de mesure : la donnée est invalide au parse normal — issue « ${premiere.code} » à « ${premiere.path.map(String).join('.') || '(racine)'} » (${premiere.message}).`,
    );
  }
  const precedent = parseDeMesure;
  parseDeMesure = true;
  try {
    const resultat = schema.safeParse(donnee);
    const out: RepereDeMesure[] = [];
    if (!resultat.success) recueillir(resultat.error.issues as unknown as readonly IssueLue[], [], false, out);
    return out;
  } finally {
    parseDeMesure = precedent;
  }
}

/**
 * Liste d'ids nus de `type` — SEULE graphie de « liste de références » de la grammaire (un
 * `z.array(idDe(...))` écrit au site en serait une seconde, sur le ticket même qui chasse les
 * divergences de forme). `min` borne la liste quand le porteur EXIGE au moins une référence :
 * `ShipCrewHit.crewTarget.stations` vise au moins une présence, une liste vide ne désignant
 * personne. Le retour n'est PAS érasé en `z.ZodType` — sinon `.min()` ne survivrait pas à l'appel,
 * et le site le réécrirait à la main.
 */
export function refs<T extends TypeEntite>(type: T, opts?: { min?: number }): z.ZodArray<z.ZodType<Id<T>, string>> {
  const liste = z.array(idDe(type));
  return opts?.min === undefined ? liste : liste.min(opts.min);
}

/** Référence `{ id }` de `type`, composée FERMÉE avec les champs propres au porteur (`extra`). */
export function ref<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return z.strictObject({ id: idDe(type), ...((extra ?? {}) as Record<string, z.ZodType>) });
}

/**
 * Référence À SPÉCIALISATION : `{ id, spec }` XOR `{ id, choix: true | [ids] }` — exactement UN des
 * deux régimes (une réf sans spécialisation est un `ref(type)` nu). L'entrée VISÉE doit d'abord être
 * spécialisable, c'est-à-dire déclarer un catalogue de specs (`estSpecialisable`) ; `spec`/`choix`
 * sont ensuite validés contre ce catalogue quand le type ferme ses spécialisations.
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
  extra: Record<string, z.ZodType> | undefined,
  exigeUnRegime: boolean,
): z.ZodType<RefASpecialisation> {
  const dataset = cibleDe(type);
  const ouvert = TYPES[type].specsOpen;
  return z
    .strictObject({
      id: idDe(type),
      spec: z.string().min(1).optional(),
      choix: z.union([z.literal(true), z.array(z.string().min(1))]).optional(),
      ...((extra ?? {}) as Record<string, z.ZodType>),
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
          message: `ref('${type}') : « ${String(v.id)} » ne déclare aucune spécialisation dans ${dataset} — « spec »/« choix » ne s'y applique pas (catalogue vide au registre « SPECS_PAR_DATASET »).`,
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
 * site accepte les deux). L'entrée VISÉE doit d'abord être spécialisable, c'est-à-dire déclarer un
 * catalogue de specs (`estSpecialisable`) ; `spec`/`choix` sont ensuite validés contre ce catalogue
 * quand le type ferme ses spécialisations.
 */
export function specRef<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return noeudASpecialisation(type, extra, true);
}

/**
 * Référence dont la spécialisation est FACULTATIVE : `{ id }` (aucune spécialisation visée) OU
 * `{ id, spec }` / `{ id, choix }`. MÊME nœud que `specRef`, seul le régime obligatoire tombe — donc
 * UN seul nœud par site (jamais une union de deux graphies du même emplacement) : c'est la forme à
 * écrire dès qu'une donnée désigne une entrée « toute spécialisation comprise » aussi bien qu'une
 * spécialisation précise.
 */
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
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
 * un choix, y compris un tirage sur table). La récursion se referme sur le nœud LUI-MÊME (`noeud`).
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

