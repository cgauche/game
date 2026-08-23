import { IMPERIAL_MONTHS, ScheduleSpec } from '../../engine/clock';
import { NumberField } from '../NumberField';

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
        <label className="dr">dans <NumberField variant="nu" label="Échéance (minutes)" min={0} value={spec.afterMinutes ?? 0} onChange={(afterMinutes) => onPatch({ afterMinutes })} /> min</label>
      )}
      {mode === 'days' && (
        <>
          <label className="dr">dans <NumberField variant="nu" label="Échéance (jours)" min={0} value={spec.afterDays ?? 0} onChange={(afterDays) => onPatch({ afterDays })} /> j</label>
          <label className="dr">à <NumberField variant="nu" label="Heure (0-23)" min={0} max={23} value={spec.atHour ?? 0} onChange={(atHour) => onPatch({ atHour })} />:<NumberField variant="nu" label="Minute (0-59)" min={0} max={59} value={spec.atMinute ?? 0} onChange={(atMinute) => onPatch({ atMinute })} /></label>
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
          <label className="dr">jour <NumberField variant="nu" label="Jour du mois" min={1} value={spec.atDate?.day ?? 1} onChange={(day) => onPatch({ atDate: { ...(spec.atDate ?? { month: 0 }), day } })} /></label>
          <label className="dr">à <NumberField variant="nu" label="Heure (0-23)" min={0} max={23} value={spec.atDate?.hour ?? 0} onChange={(hour) => onPatch({ atDate: { ...(spec.atDate ?? { month: 0, day: 1 }), hour } })} />:<NumberField variant="nu" label="Minute (0-59)" min={0} max={59} value={spec.atDate?.minute ?? 0} onChange={(minute) => onPatch({ atDate: { ...(spec.atDate ?? { month: 0, day: 1 }), minute } })} /></label>
        </>
      )}
      {mode === 'hour' && (
        <label className="dr">à <NumberField variant="nu" label="Heure (0-23)" min={0} max={23} value={spec.atHour ?? 0} onChange={(atHour) => onPatch({ atHour })} />:<NumberField variant="nu" label="Minute (0-59)" min={0} max={59} value={spec.atMinute ?? 0} onChange={(atMinute) => onPatch({ atMinute })} /></label>
      )}
    </div>
  );
}
