import { IMPERIAL_MONTHS, ScheduleSpec } from '../../engine/clock';

/** Mode d'échéance dérivé de la `ScheduleSpec` posée (aucun état local — l'appelant est source de
 *  vérité). Priorité identique à `scheduleAt` (engine/clock) : atDate > afterDays > afterMinutes >
 *  atHour/atMinute seuls. */
function modeOf(spec: ScheduleSpec): 'rel' | 'days' | 'date' | 'hour' {
  if (spec.atDate) return 'date';
  if (spec.afterDays != null) return 'days';
  if (spec.afterMinutes != null) return 'rel';
  return 'hour';
}

/** Édite une `ScheduleSpec` (#668 — `delayedEffect`/`setObjective`) : un `<select>` de MODE dérivé
 *  de la spec + les champs du mode actif. Le CHANGEMENT de mode patch les discriminants des AUTRES
 *  modes à `undefined` (jamais de reconstruction d'objet — préserve les autres champs portés par
 *  l'appelant, ex. `flow`/`cancelFlag`/`id`/`text`). `atDate.month` est 0-based en donnée (index
 *  `IMPERIAL_MONTHS`) — masqué ici par un select de mois par NOM. */
export function ScheduleSpecFields({ spec, onPatch }: { spec: ScheduleSpec; onPatch: (patch: Partial<ScheduleSpec>) => void }) {
  const mode = modeOf(spec);
  const setMode = (m: 'rel' | 'days' | 'date' | 'hour') => {
    switch (m) {
      case 'rel':
        onPatch({ afterMinutes: spec.afterMinutes ?? 60, afterDays: undefined, atDate: undefined, atHour: undefined, atMinute: undefined });
        break;
      case 'days':
        onPatch({ afterMinutes: undefined, atDate: undefined, afterDays: spec.afterDays ?? 3, atHour: spec.atHour ?? 0, atMinute: spec.atMinute ?? 0 });
        break;
      case 'date':
        onPatch({ afterMinutes: undefined, afterDays: undefined, atDate: spec.atDate ?? { month: 0, day: 1, hour: 0, minute: 0 }, atHour: undefined, atMinute: undefined });
        break;
      case 'hour':
        onPatch({ afterMinutes: undefined, afterDays: undefined, atDate: undefined, atHour: spec.atHour ?? 0, atMinute: spec.atMinute ?? 0 });
        break;
    }
  };
  return (
    <div className="tf-row">
      <select value={mode} onChange={(ev) => setMode(ev.target.value as typeof mode)}>
        <option value="rel">Compte à rebours (minutes)</option>
        <option value="days">Dans N jours (à l’heure dite)</option>
        <option value="date">Date impériale</option>
        <option value="hour">Heure du jour (prochaine occurrence)</option>
      </select>
      {mode === 'rel' && (
        <label className="dr">dans <input type="number" min={0} value={spec.afterMinutes ?? 0} onChange={(ev) => onPatch({ afterMinutes: Number(ev.target.value) })} /> min</label>
      )}
      {mode === 'days' && (
        <>
          <label className="dr">dans <input type="number" min={0} value={spec.afterDays ?? 0} onChange={(ev) => onPatch({ afterDays: Math.max(0, Number(ev.target.value) || 0) })} /> j</label>
          <label className="dr">à <input type="number" min={0} max={23} value={spec.atHour ?? 0} onChange={(ev) => onPatch({ atHour: Number(ev.target.value) })} />:<input type="number" min={0} max={59} value={spec.atMinute ?? 0} onChange={(ev) => onPatch({ atMinute: Number(ev.target.value) })} /></label>
        </>
      )}
      {mode === 'date' && (
        <>
          <select
            value={spec.atDate?.month ?? 0}
            onChange={(ev) => onPatch({ atDate: { ...(spec.atDate ?? { day: 1 }), month: Number(ev.target.value) } })}
          >
            {IMPERIAL_MONTHS.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
          </select>
          <label className="dr">jour <input type="number" min={1} value={spec.atDate?.day ?? 1} onChange={(ev) => onPatch({ atDate: { ...(spec.atDate ?? { month: 0 }), day: Math.max(1, Number(ev.target.value) || 1) } })} /></label>
          <label className="dr">à <input type="number" min={0} max={23} value={spec.atDate?.hour ?? 0} onChange={(ev) => onPatch({ atDate: { ...(spec.atDate ?? { month: 0, day: 1 }), hour: Number(ev.target.value) } })} />:<input type="number" min={0} max={59} value={spec.atDate?.minute ?? 0} onChange={(ev) => onPatch({ atDate: { ...(spec.atDate ?? { month: 0, day: 1 }), minute: Number(ev.target.value) } })} /></label>
        </>
      )}
      {mode === 'hour' && (
        <label className="dr">à <input type="number" min={0} max={23} value={spec.atHour ?? 0} onChange={(ev) => onPatch({ atHour: Number(ev.target.value) })} />:<input type="number" min={0} max={59} value={spec.atMinute ?? 0} onChange={(ev) => onPatch({ atMinute: Number(ev.target.value) })} /></label>
      )}
    </div>
  );
}
