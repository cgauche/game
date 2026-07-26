import { useState } from 'react';
import { PREFERENCES, pref, setPreference, type PrefValue } from '../state/preferences';

/**
 * Panneau « Confort de jeu » — GÉNÉRÉ depuis le registre `PREFERENCES` (`state/preferences.ts`).
 * Il ne connaît AUCUNE préférence : il itère le registre, rend un contrôle par entrée selon `kind`
 * et écrit par la couture unique `setPreference` (qui persiste et joue l'effet DÉCLARÉ sur l'entrée).
 * Ajouter un réglage de confort = ajouter une entrée au registre, zéro ligne ici.
 *
 * Ces réglages ne changent aucun état de jeu construit : ils restent modifiables PENDANT un combat,
 * contrairement aux règles optionnelles (`HouseRulesPanel`, verrou `houseRulesMutability`).
 */
export function PreferencesPanel() {
  const [, force] = useState(0);
  const change = (id: string, v: PrefValue) => {
    setPreference(id, v);
    force((n) => n + 1);
  };
  return (
    <div className="house-rules">
      <div className="hr-body">
        {PREFERENCES.map((p) => {
          const val = pref(p.id);
          return (
            <div key={p.id} className="hr-row" title={p.hint}>
              <span className="hr-label">{p.label}</span>
              <span className="hr-control">
                {p.kind === 'flag' && (
                  <input
                    type="checkbox" aria-label={p.label} checked={val === true}
                    onChange={(e) => change(p.id, e.target.checked)}
                  />
                )}
                {p.kind === 'mode' && (
                  <select aria-label={p.label} value={String(val)} onChange={(e) => change(p.id, e.target.value)}>
                    {(p.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {p.kind === 'param' && (
                  <input
                    type="number" aria-label={p.label} value={Number(val)} min={p.min} max={p.max} step={p.step ?? 1}
                    onChange={(e) => change(p.id, Number(e.target.value))}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
