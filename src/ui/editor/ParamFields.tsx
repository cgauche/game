import { ParamField } from '../../gameIso/catalog/types';

/** Éditeur de paramètres générique, piloté par un `paramsSchema` de catalogue. */
export function ParamFields({
  schema,
  values,
  onChange,
}: {
  schema: ParamField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      {schema.map((f) => (
        <label className="ed-field" key={f.key}>
          {f.label}
          {f.type === 'number' && (
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step ?? 1}
              value={Number(values[f.key] ?? f.min ?? 0)}
              onChange={(e) => onChange(f.key, Number(e.target.value))}
            />
          )}
          {f.type === 'select' && (
            <select value={String(values[f.key] ?? f.options[0]?.value)} onChange={(e) => onChange(f.key, e.target.value)}>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {f.type === 'color' && (
            <input type="color" value={String(values[f.key] ?? '#888888')} onChange={(e) => onChange(f.key, e.target.value)} />
          )}
        </label>
      ))}
    </>
  );
}
