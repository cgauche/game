/**
 * FABRIQUE DE DOCUMENT (#1466 L1a) — la seule façon de déclarer un document de l'application.
 *
 * Elle rend un HANDLE FERMÉ : le schéma sort SCELLÉ, si bien que `.extend` et `.shape` n'existent
 * plus NI au type NI au runtime (zod 4.4.3 perd le registre et la `.meta()` d'un nœud à l'extension —
 * la composition se fait ICI, une fois, ou pas du tout). Une clé d'ENVELOPPE redéclarée dans `champs`
 * est une erreur de TYPE (mapped type → `never`) ET une erreur d'exécution nommant la clé ; chaque
 * clé de `champs` exige sa `MetaChamp` ; chaque document déclare son EXPOSITION (Codex, éditeur).
 *
 * L'adoption par les defs est le lot L1b (#1467) : 121 defs l'appellent (120 sous `defs/`, 1 sous
 * `defs-scenes/`). Les defs `entite` ont TOUS adopté, `oups.ts` excepté — schéma d'UNION, hors des
 * vagues d'adoption. Le compte fait foi à la MESURE, pas à cette phrase : c'est le mesureur de
 * `grammaire.test.ts` (« contrats d'enveloppe REQUIS dans les defs `entite` ») qui l'établit.
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

/** Clés d'enveloppe qu'un document ne peut pas EXIGER : `id`/`type`/`label` sont déjà requises,
 *  `variants` n'est pas un champ simple (la fabrique le compose depuis `options.variantes`). */
const NON_EXIGIBLES = ['id', 'type', 'label', 'variants'] as const;

/**
 * Clés d'enveloppe qu'un document peut EXIGER (`options.exiges`) — DÉRIVÉES de `CLES_ENVELOPPE`,
 * jamais re-tapées : une liste parallèle mentirait en silence au prochain champ d'enveloppe.
 */
export type CleExigible = Exclude<CleEnveloppe, (typeof NON_EXIGIBLES)[number]>;
export const CLES_EXIGIBLES: readonly CleExigible[] = CLES_ENVELOPPE.filter(
  (k): k is CleExigible => !(NON_EXIGIBLES as readonly string[]).includes(k),
);

/** Une clé d'enveloppe présente dans `champs` s'annule en `never` : le def ne compile pas. */
export type ChampsHorsEnveloppe<C> = { [K in keyof C]: K extends CleEnveloppe ? never : C[K] };

/**
 * Vue TS de l'ENVELOPPE que la fabrique pose (`enveloppe()` ci-dessous), `type` élargi à `string`.
 *
 * Le handle rend ses nœuds SCELLÉS (`z.ZodType<unknown>`) : `z.infer<typeof schema>` d'un def adopté
 * vaut donc `unknown`. Un def qui exporte la VUE TS de son document (les casts de `src/data/index.ts`)
 * la recompose ici — `EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>` — sans jamais rouvrir
 * un nœud ni élargir un cast.
 */
export type EnveloppeDocument = Omit<z.infer<z.ZodObject<ReturnType<typeof enveloppe>>>, 'type'> & { type: string };

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
   * Schéma d'une LIGNE de la table — exigé par la famille `table`, refusé partout ailleurs. Même
   * mécanique que `valeurRecord` : la fabrique pose `entries: z.array(ligneTable)` sur l'entrée, un
   * def de table ne redéclare donc jamais sa charge. Un document `table` EST une table (identité,
   * provenance, rangées) ; son fichier en porte une LISTE.
   */
  readonly ligneTable?: z.ZodTypeAny;
  /**
   * Schéma d'une CLÉ du record — défaut `z.string().min(1)`. Un def dont l'univers de clés est FERMÉ
   * le déclare ici (`src/data/schemas/defs/teintesJeu.ts:134` : `z.record(z.enum(TEINTE_KEYS), hexColor)`)
   * et garde son verrou par construction, qu'une clé libre perdrait. Mesuré (zod 4.4.3) : une clé
   * énumérée rend le record EXHAUSTIF — toute clé déclarée doit être présente.
   */
  readonly cleRecord?: z.ZodType<string>;
  /**
   * Schéma de l'ID du document — défaut `z.string().min(1)`. Même mécanique que `cleRecord` : un def
   * dont le catalogue d'ids est FERMÉ le déclare ici et garde son verrou par construction, qu'un id
   * libre perdrait. Consommateur cible : `src/data/schemas/defs/characteristics.ts:13-19`
   * (`z.union([charKeySchema, z.enum([...])])` ; à la ligne 15 : « Catalogue FERMÉ (19 entrées) — union
   * énumérée, pas `z.string()` ») — sans cette option, l'adoption de la fabrique remplacerait ce verrou
   * par `z.string().min(1)` EN SILENCE.
   * Un schéma qui admettrait la chaîne vide ré-ouvrirait le contrat que l'enveloppe ferme (`.min(1)`) :
   * `document()` le REFUSE nommément (garde ci-dessous).
   */
  readonly idDocument?: z.ZodType<string>;
  /**
   * Clés d'ENVELOPPE que CE document rend REQUISES (l'enveloppe les pose optionnelles).
   * EXIGER = requis ET NON VIDE : les clés de chaîne exigées prennent `.min(1)`, `alsoIn` exigé prend
   * `.min(1)` sur son tableau — une exigence satisfaite par `''` ou `[]` ne prouverait rien (`desc` et
   * `maison` portent déjà ce `.min(1)` structurellement : pour elles, `exiges` ne change que l'optionalité).
   * Ce que l'adoption relâcherait sans cette option est MESURÉ et figé par le test
   * `grammaire.test.ts` « contrats d'enveloppe REQUIS dans les defs `entite` » — mesureur : `shape[k]`
   * dont `safeParse(undefined)` est ROUGE, sur les defs `entite` du registre. Les CHIFFRES vivent
   * dans ce test, jamais recopiés ici : une copie se périme en silence à chaque vague d'adoption, et
   * un JSDoc ne rend aucun verdict vérifiable. Le verrou de contrepartie (l'entrée AMPUTÉE d'une clé
   * exigée est refusée, def par def) vit dans le même fichier.
   * ATTENTION : `source` dans `exiges` la rend STRICTEMENT requise : le refine de provenance `source ∨ maison`
   * en devient INATTEIGNABLE (il ne s'exécute que sur un objet dont `source` est déjà validée) — il n'y
   * a donc pas de second chemin à éteindre, c'est une conséquence de la forme, pas un branchement.
   */
  readonly exiges?: readonly CleExigible[];
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
   * Consommateurs mesurés : `names` (exhaustivité des ids du dataset-liste). Un invariant de record se
   * porte, lui, par `affinerEntree` — en famille `record` l'entrée EST le document, `entries` comprise.
   */
  readonly affinerDataset?: (dataset: z.ZodType<unknown>) => z.ZodType<unknown>;
}

/** Handle FERMÉ d'un document : ce que le registre, l'éditeur et les gardes consomment. */
export interface DocumentHandle<T extends string> {
  /**
   * LE DATASET tel qu'il vit dans son fichier, emballé PAR FAMILLE (#1467) : `entite`/`table` →
   * `z.array(entrée)`, `config` → l'entrée seule, `record` → enveloppe + `entries`. Un def n'écrit
   * plus jamais son `z.array` à la main. En famille `table`, ce `z.array` est celui des DOCUMENTS du
   * fichier — chaque document portant à son tour ses rangées sous `entries` (`options.ligneTable`).
   */
  readonly schema: z.ZodType<unknown>;
  /**
   * L'ENTRÉE SCELLÉE seule — pour l'EMBARQUEMENT (statblocks, table posée dans un autre fichier),
   * jamais pour l'UI, qui consomme le dataset. En famille `record`, l'entrée EST le document entier
   * (enveloppe + `entries`), donc `entree` et `schema` y coïncident. En famille `table`, l'entrée est
   * UN document (enveloppe + ses rangées) et le `schema` en est la liste.
   */
  readonly entree: z.ZodType<unknown>;
  /**
   * L'entrée en PATCH (tous champs optionnels), dérivée AVANT le sceau puis SCELLÉE à son tour :
   * `.partial()` rend un `ZodObject` NU, que `.extend` rouvrirait — la fabrique n'expose aucun nœud
   * extensible, fût-il voisin. `.optional()`/`safeParse` restent servis.
   * Consommateur mesuré : `narratif.ts` (`presetPnjSchema.profil`, profil de PNJ embarqué) — il
   * CONSOMME désormais `entreePartielle`. Sur le nœud SCELLÉ, `.partial` n'existe pas et l'appel
   * JETTE : c'est bien cette propriété-ci qui lui tient lieu de `.partial()`.
   */
  readonly entreePartielle: z.ZodType<unknown>;
  /**
   * Clés top-level de l'entrée (enveloppe + champs, plus `entries` en famille `record`/`table`),
   * relevées AVANT le sceau.
   * Consommateurs mesurés : `variants-integrity.test.ts` (`SHAPE_BY_FILE`, où les TROIS defs à
   * variantes lisent désormais `cles` — plus aucun `element.shape`, le dernier est mort avec
   * l'adoption de `spells`) et `scripts/guards/lib/fieldConsumerTargets.mjs` (`if (schema?.shape)` —
   * sans cette liste, la garde dégrade en SILENCE à zéro champ).
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
  /**
   * Clés d'ENVELOPPE que ce document rend REQUISES (`options.exiges`) — la DÉCLARATION, lisible.
   * Le handle la publie ; le registre généré, lui, n'importe que les quatre exports plats
   * (`file`/`schema`/`famille`/`meta`, contrat `defsSansExportsPlats`), si bien qu'une garde qui part
   * du registre mesure l'exigence sur le SCHÉMA (l'entrée ampuée est-elle refusée ?) et non sur cette
   * liste — les deux disent la même chose, la seconde est la seule observable de l'extérieur.
   */
  readonly exiges: readonly CleExigible[];
}

/**
 * Pose un champ d'enveloppe : OPTIONNEL par défaut, ou sa forme NON VIDE quand le document l'EXIGE
 * (`options.exiges`). Le cast garde la VUE TS la plus permissive (`EnveloppeDocument` reste « tout
 * optionnel ») : le verrou d'un document qui exige est au PARSE, il ne rétrécit jamais le type
 * partagé par tous les documents.
 */
function champEnveloppe<S extends z.ZodTypeAny>(optionnel: S, exige: boolean, nonVide: S = optionnel): z.ZodOptional<S> {
  return (exige ? nonVide : optionnel.optional()) as z.ZodOptional<S>;
}

function enveloppe(type: string, idDocument?: z.ZodType<string>, exiges: readonly CleExigible[] = []) {
  const requis = (k: CleExigible) => exiges.includes(k);
  return {
    id: (idDocument ?? z.string().min(1)) as z.ZodType<string>,
    type: z.literal(type),
    label: z.string().min(1),
    labelF: champEnveloppe(z.string(), requis('labelF'), z.string().min(1)),
    /** Prose du document — `.min(1)` STRUCTUREL, même classe que le `maison` ci-dessous : une chaîne
     *  vide est un TROISIÈME état, vu « présent » par `search.ts` et « absent » par `CodexRef`. Absente
     *  plutôt que vide ou nulle. */
    desc: champEnveloppe(z.string().min(1), requis('desc')),
    source: champEnveloppe(sourceRefSchema, requis('source')),
    alsoIn: champEnveloppe(z.array(secondarySourceRefSchema), requis('alsoIn'), z.array(secondarySourceRefSchema).min(1)),
    /**
     * Arbitrage MAISON — la RAISON, en clair, de ce que le canon ne tranche pas. `.min(1)` est
     * STRUCTUREL : une chaîne vide ne prouve rien et le refine de provenance ci-dessous ne saurait
     * pas la distinguer d'une raison réelle. Mesuré (2026-08-27) : aucune chaîne vide dans la donnée.
     *
     * Le TYPE est le contrat : une raison est une CHAÎNE. La forme booléenne (un drapeau « c'est
     * maison », qui ne dit aucune raison) est ÉTEINTE de la donnée — zéro `maison` non-chaîne sur les
     * deux racines, mesuré RÉCURSIVEMENT et gardé par `src/data/maison-sans-source.test.ts`.
     */
    maison: champEnveloppe(z.string().min(1), requis('maison')),
    icon: champEnveloppe(z.string(), requis('icon'), z.string().min(1)),
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
 * Elle rend AUSSI l'emballage du FICHIER (`schema`, par famille) : pour `record` comme pour `table`,
 * `champs`/`meta` décrivent les champs d'ENVELOPPE additionnels éventuels — le contenu, lui, vit sous
 * `entries`, que la fabrique pose seule (`options.valeurRecord`/`options.cleRecord` en `record`,
 * `options.ligneTable` en `table`) et qu'un def ne redéclare pas.
 */
export function document<T extends string, C extends Record<string, z.ZodTypeAny>>(
  type: T,
  famille: FamilleDocument,
  champs: C & ChampsHorsEnveloppe<C>,
  meta: MetaDesChamps<C>,
  exposition: Exposition,
  options: OptionsDocument = {},
): DocumentHandle<T> {
  const { variantes, valeurRecord, cleRecord, idDocument, exiges = [], ligneTable, affinerEntree, affinerDataset } = options;
  if (idDocument && idDocument.safeParse('').success) {
    throw new Error(
      `document('${type}') : \`idDocument\` admet la CHAÎNE VIDE — l'enveloppe ferme l'id à \`.min(1)\`, un schéma d'id ne le ré-ouvre pas.`,
    );
  }
  for (const [i, k] of exiges.entries()) {
    if ((NON_EXIGIBLES as readonly string[]).includes(k)) {
      throw new Error(`document('${type}') : « ${k} » n'est pas exigible — l'enveloppe la pose déjà ainsi (clés exigibles : ${CLES_EXIGIBLES.join(', ')}).`);
    }
    if (!(CLES_EXIGIBLES as readonly string[]).includes(k)) {
      throw new Error(
        `document('${type}') : \`exiges\` nomme « ${k} », qui n'est pas une clé exigible de l'enveloppe (${CLES_EXIGIBLES.join(', ')}).`,
      );
    }
    if (exiges.indexOf(k) !== i) {
      throw new Error(`document('${type}') : \`exiges\` répète « ${k} ».`);
    }
  }
  if (famille === 'record' && !valeurRecord) {
    throw new Error(`document('${type}') : la famille « record » exige \`valeurRecord\` (le schéma d'une valeur de \`entries\`).`);
  }
  if (famille === 'table' && !ligneTable) {
    throw new Error(`document('${type}') : la famille « table » exige \`ligneTable\` (le schéma d'une rangée de \`entries\`).`);
  }
  if (famille !== 'table' && ligneTable) {
    throw new Error(`document('${type}') : \`ligneTable\` n'a de sens que pour la famille « table » (ici « ${famille} »).`);
  }
  if (famille !== 'record' && valeurRecord) {
    throw new Error(`document('${type}') : \`valeurRecord\` n'a de sens que pour la famille « record » (ici « ${famille} »).`);
  }
  if (famille !== 'record' && cleRecord) {
    throw new Error(`document('${type}') : \`cleRecord\` n'a de sens que pour la famille « record » (ici « ${famille} »).`);
  }
  const cles = Object.keys(champs);
  for (const k of cles) {
    if ((famille === 'record' || famille === 'table') && k === 'entries') {
      throw new Error(`document('${type}') : la fabrique pose « entries » pour la famille « ${famille} » — retire-le de \`champs\`.`);
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
  const entree = z.strictObject({
    ...enveloppe(type, idDocument, exiges),
    ...(champs as Record<string, z.ZodTypeAny>),
  }) as z.ZodObject<z.ZodRawShape>;
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
  // En famille `record` comme en famille `table`, la CHARGE (`entries`) est posée ICI : `affinerEntree`,
  // `entreePartielle` et `cles` la voient comme n'importe quel champ. Les deux familles diffèrent par la
  // forme de la charge (record clé→valeur, table liste ordonnée de rangées) et par l'emballage de
  // FICHIER (un record EST son fichier ; une table en partage un avec ses sœurs).
  const corps =
    famille === 'record'
      ? (z.strictObject({
          ...complet.shape,
          entries: z.record(cleRecord ?? z.string().min(1), valeurRecord!),
        }) as z.ZodObject<z.ZodRawShape>)
      : famille === 'table'
        ? (z.strictObject({ ...complet.shape, entries: z.array(ligneTable!) }) as z.ZodObject<z.ZodRawShape>)
        : complet;
  const entreePartielle: z.ZodType<unknown> = corps.partial().pipe(z.transform((v) => v));
  const clesEntree: readonly string[] = Object.keys(corps.shape);
  // PROVENANCE : `source` OU `maison`, jamais NI L'UN NI L'AUTRE. Une entrée sans folio n'est pas
  // interdite — elle doit DIRE pourquoi. `exigeSource` consulte l'UNION `SANS_PROVENANCE_EXIGEE`
  // (`SANS_LIVRE` ∪ `SOURCE_EN_PROFONDEUR`) : sont hors régime les documents SANS aucun livre comme
  // ceux dont le livre est cité par SOUS-ENTRÉE — dans les deux cas rien n'est exigible à l'entrée de
  // racine. Refine PRÉ-sceau : `superRefine` rend un `ZodObject` encore extensible (mesuré zod
  // 4.4.3), donc `affinerEntree` reçoit bien un objet.
  // `exiges: ['source']` rend `source` structurellement requise : le refine ci-dessous ne s'exécute
  // alors que sur un objet dont `source` est déjà validée et ne peut JAMAIS lever — inatteignable par
  // construction, donc rien à éteindre ici (mesuré : un branchement qui l'éteindrait est inobservable).
  const avecProvenance = !exigeSource(type)
    ? corps
    : (corps.superRefine((v, ctx) => {
        const d = v as { source?: unknown; maison?: unknown };
        if (d.source === undefined && d.maison === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['source'],
            message: `document('${type}') : entrée sans \`source\` — un document sans folio porte \`maison\` (la raison de l'arbitrage).`,
          });
        }
      }) as z.ZodObject<z.ZodRawShape>);
  const affine = affinerEntree ? affinerEntree(avecProvenance) : avecProvenance;
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
    exiges: [...exiges],
  };
}
