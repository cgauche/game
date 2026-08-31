/**
 * Inférence de formulaire DEPUIS la donnée (pas de schéma par dataset → un nouveau dataset s'édite
 * tout seul). Métadonnées de RENDU uniquement : décrit comment afficher un champ, sans introduire de
 * structure intermédiaire — on édite les vrais objets de `src/data`. Consommé par `CodexEdit`.
 */
import { LIBELLES_ENVELOPPE, type CleEnveloppe } from '../../data/schemas/grammaire/document';
import type { MetaChamp } from '../../data/schemas/grammaire/meta';

export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'stringList' | 'numberList' | 'source' | 'recordNumber' | 'recordText' | 'object' | 'json';

export interface FieldDesc {
  key: string;
  /** Libellé FR affiché (`libelleDuChamp`) — AFFICHAGE seul : `key` reste l'identité du champ. */
  label: string;
  kind: FieldKind;
  /** Le champ est null/absent sur au moins une entrée (autorise le vide). */
  nullable: boolean;
}

function kindOf(key: string, v: unknown): FieldKind {
  // `source` = composite {book,page} SEULEMENT quand la donnée l'est réellement — un `source` MAISON
  // (littéral string, ex. `axes.json` #409, aucune page RAW à citer) retombe sur l'inférence générique
  // (chaîne courte) plutôt que le widget livre/page (qui écraserait la valeur par un objet au 1er edit).
  if (key === 'source' && v != null && typeof v === 'object') return 'source';
  if (key === 'desc') return 'textarea';
  if (typeof v === 'string') return v.length > 80 ? 'textarea' : 'text';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'checkbox';
  // Tableau d'objets = json (un éditeur dédié le sort du repli ; chaînes = stringList, nombres = numberList).
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return 'stringList';
    if (v.every((x) => typeof x === 'number')) return 'numberList';
    return 'json';
  }
  if (v && typeof v === 'object') {
    if ('book' in (v as object) && 'page' in (v as object)) return 'source';
    const vals = Object.values(v as Record<string, unknown>);
    // Record homogène : valeurs toutes nombres → grille de nombres ; toutes chaînes → grille de textes.
    if (vals.length > 0 && vals.every((x) => typeof x === 'number' || x === null)) return 'recordNumber';
    if (vals.length > 0 && vals.every((x) => typeof x === 'string')) return 'recordText';
    // Objet de config hétérogène (ex. interludeEvents.fx, raceAppearance.eyes) → sous-formulaire inféré
    // (récursif) plutôt que JSON brut — chaque sous-champ retrouve son kind structuré.
    return 'object';
  }
  return 'text';
}

/**
 * RÉGIME de libellé d'un champ : à quel étage du document il vit, et quelle méta d'édition le nomme.
 * L'enveloppe (`id`/`desc`/`source`…) n'existe qu'au PREMIER NIVEAU : un `maison` de bande de coût
 * (`naval-traits.json install.cost.bands[]`) ou un `id` d'op (`activities.json outcomes[].ops[]`) n'est
 * PAS le champ d'enveloppe du même nom — lui poser « Arbitrage maison » / « Identifiant » mentirait.
 */
export interface RegimeDeLibelle {
  /** Méta d'édition du document, par le canal registre (`SchemaDef.meta`) — champs de premier niveau. */
  meta?: Readonly<Record<string, MetaChamp>>;
  /** `document` = champ de premier niveau ; `profondeur` = sous-champ (méta dérivée : lot #1466 L6). */
  niveau?: 'document' | 'profondeur';
}

/**
 * Cascade du LIBELLÉ d'un champ (#1466 L1a, point 6), au régime `document` : clé d'ENVELOPPE → table
 * FR de la fabrique (`LIBELLES_ENVELOPPE`, seule détentrice de ces noms puisque `document()` refuse
 * une méta dessus) ; sinon méta d'édition du def ; sinon la clé technique — seam d'extinction à
 * mesure de l'adoption (L1b #1467).
 *
 * Au régime `profondeur`, un sous-champ rend TOUJOURS sa clé : enveloppe et méta décrivent le PREMIER
 * NIVEAU du document (`document()` exige une méta par clé de `champs`, tous de premier niveau), et le
 * nommage d'un sous-champ est la dérivation du lot #1466 L6.
 *
 * EXCLUSION : `type` sur un document SANS méta (donc sans handle) n'est pas le type de document mais
 * un DISCRIMINANT de charge utile (characteristics/qualities/skills/trappings/spells, mesuré) — le
 * libeller « Type de document » mentirait à l'écran.
 */
export function libelleDuChamp(key: string, { meta, niveau = 'document' }: RegimeDeLibelle = {}): string {
  if (niveau === 'profondeur') return key;
  // Lecture sur les PROPRES clés de la table (jamais la chaîne de prototypes : `toString` rendrait
  // une fonction là où l'écran attend une chaîne).
  if (Object.prototype.hasOwnProperty.call(LIBELLES_ENVELOPPE, key) && !(key === 'type' && !meta)) return LIBELLES_ENVELOPPE[key as CleEnveloppe];
  return meta?.[key]?.label ?? key;
}

/** Champs (ordre = 1re apparition), type inféré du 1er échantillon non-null de chaque clé — et, pour
 *  un tableau, de l'UNION de ses éléments sur toutes les entrées ; libellé par `libelleDuChamp`
 *  (la `meta` du def, quand il en a une, arrive par le registre de schémas). */
export function inferFields(entries: Record<string, unknown>[], regime: RegimeDeLibelle = {}): FieldDesc[] {
  const keys: string[] = [];
  for (const e of entries) for (const k of Object.keys(e)) if (!keys.includes(k)) keys.push(k);
  return keys.map((key) => {
    let sample: unknown;
    let sawNull = false;
    // Un TABLEAU se classe sur l'UNION de ses éléments à travers TOUTES les entrées : `every` est VRAI
    // à vide, donc un premier échantillon `[]` (fréquent en tête de dataset) ne prouve RIEN sur la forme
    // des éléments — et une liste d'OBJETS ne peut jamais tomber en `stringList`/`numberList` (#1548).
    // DEUX cliquets : `editfields-union-elements.test.ts` tient l'ALGORITHME (union vs premier
    // échantillon) sur des entrées forgées ; `editfields-listes-objets.test.ts` scanne la DONNÉE
    // réelle de toutes les catégories éditables. Mesuré 2026-08-31 : le second reste VERT sous
    // l'algorithme « premier échantillon » (les champs qui basculeraient sont tous filtrés par
    // `dedicatedFieldKeys`/`refFieldCfg`) — seul le premier mord.
    const elements: unknown[] = [];
    for (const e of entries) {
      const v = e[key];
      if (v == null) { sawNull = true; continue; }
      if (Array.isArray(v)) elements.push(...v);
      if (sample === undefined) sample = v;
    }
    const echantillon = Array.isArray(sample) ? elements : sample;
    return { key, label: libelleDuChamp(key, regime), kind: kindOf(key, echantillon), nullable: sawNull || sample === undefined };
  });
}
