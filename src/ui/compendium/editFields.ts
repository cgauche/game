/**
 * Inférence de formulaire DEPUIS la donnée (pas de schéma par dataset → un nouveau dataset s'édite
 * tout seul). Métadonnées de RENDU uniquement : décrit comment afficher un champ, sans introduire de
 * structure intermédiaire — on édite les vrais objets de `src/data`. Consommé par `CodexEdit`.
 */
export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'stringList' | 'numberList' | 'source' | 'recordNumber' | 'recordText' | 'object' | 'json';

export interface FieldDesc {
  key: string;
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

/** Champs (ordre = 1re apparition), type inféré du 1er échantillon non-null de chaque clé. */
export function inferFields(entries: Record<string, unknown>[]): FieldDesc[] {
  const keys: string[] = [];
  for (const e of entries) for (const k of Object.keys(e)) if (!keys.includes(k)) keys.push(k);
  return keys.map((key) => {
    let sample: unknown;
    let sawNull = false;
    for (const e of entries) {
      const v = e[key];
      if (v == null) sawNull = true;
      else if (sample === undefined) sample = v;
    }
    return { key, kind: kindOf(key, sample), nullable: sawNull || sample === undefined };
  });
}
