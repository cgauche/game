/**
 * Inférence de formulaire DEPUIS la donnée elle-même (pas de schéma à maintenir par dataset → un
 * nouveau dataset s'édite tout seul). Le « field-schema » n'est que des métadonnées de RENDU : il
 * décrit comment afficher un champ, il n'introduit AUCUNE structure de données intermédiaire — on
 * édite les vrais objets de `src/data`.
 */
export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'stringList' | 'source' | 'recordNumber' | 'json';

export interface FieldDesc {
  key: string;
  kind: FieldKind;
  /** Le champ est null/absent sur au moins une entrée (autorise le vide). */
  nullable: boolean;
}

function kindOf(key: string, v: unknown): FieldKind {
  if (key === 'source') return 'source';
  if (key === 'desc') return 'textarea';
  if (typeof v === 'string') return v.length > 80 ? 'textarea' : 'text';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'checkbox';
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string') ? 'stringList' : 'json';
  if (v && typeof v === 'object') {
    if ('book' in (v as object) && 'page' in (v as object)) return 'source';
    const vals = Object.values(v as Record<string, unknown>);
    if (vals.length > 0 && vals.every((x) => typeof x === 'number' || x === null)) return 'recordNumber';
    return 'json';
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

/** Valeur par défaut d'un champ neuf (entrée ajoutée). */
export function defaultFor(kind: FieldKind): unknown {
  switch (kind) {
    case 'number': return 0;
    case 'checkbox': return false;
    case 'stringList': return [];
    case 'source': return { book: '', page: 0 };
    case 'recordNumber': return {};
    case 'json': return null;
    default: return '';
  }
}
