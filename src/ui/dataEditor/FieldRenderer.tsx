/** Rendu d'UN champ d'entrée selon son `FieldKind` inféré. Écrit la valeur typée via `onChange`. */
import { useState } from 'react';
import type { FieldDesc } from './fieldSchema';

interface Props {
  field: FieldDesc;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function FieldRenderer({ field, value, onChange }: Props) {
  const { key, kind } = field;
  switch (kind) {
    case 'textarea':
      return (
        <label className="ed-field">
          <span>{key}</span>
          <textarea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case 'number':
      return (
        <label className="ed-field">
          <span>{key}</span>
          <input type="number" value={value === null || value === undefined ? '' : (value as number)}
            onChange={(e) => onChange(e.target.value === '' ? (field.nullable ? null : 0) : Number(e.target.value))} />
        </label>
      );
    case 'checkbox':
      return (
        <label className="ed-check">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>{key}</span>
        </label>
      );
    case 'stringList':
      return (
        <label className="ed-field">
          <span>{key} <em className="de-hint">(un par ligne)</em></span>
          <textarea rows={4} value={((value as string[]) ?? []).join('\n')}
            onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} />
        </label>
      );
    case 'source': {
      const s = (value as { book?: string; page?: number }) ?? {};
      return (
        <div className="ed-field">
          <span>{key}</span>
          <div className="de-source">
            <input placeholder="livre" value={s.book ?? ''} onChange={(e) => onChange({ ...s, book: e.target.value })} />
            <input type="number" placeholder="page" value={s.page ?? ''} onChange={(e) => onChange({ ...s, page: Number(e.target.value) || 0 })} />
          </div>
        </div>
      );
    }
    case 'recordNumber': {
      const rec = (value as Record<string, number | null>) ?? {};
      const keys = Object.keys(rec);
      return (
        <div className="ed-field">
          <span>{key}</span>
          {keys.length === 0 ? <em className="de-hint">vide</em> : (
            <div className="de-grid">
              {keys.map((k) => (
                <label key={k} className="de-cell">
                  <span>{k}</span>
                  <input type="number" value={rec[k] ?? ''}
                    onChange={(e) => onChange({ ...rec, [k]: e.target.value === '' ? null : Number(e.target.value) })} />
                </label>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'json':
      return <JsonField field={field} value={value} onChange={onChange} />;
    default:
      return (
        <label className="ed-field">
          <span>{key}</span>
          <input value={(value as string) ?? ''} onChange={(e) => onChange(field.nullable && e.target.value === '' ? null : e.target.value)} />
        </label>
      );
  }
}

/** Champ imbriqué/complexe édité en JSON brut (repli) — valide à la frappe. */
function JsonField({ field, value, onChange }: Props) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState(false);
  return (
    <label className="ed-field">
      <span>{field.key} <em className="de-hint">(JSON)</em></span>
      <textarea rows={4} className={err ? 'de-invalid' : ''} value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); }
        }} />
    </label>
  );
}
