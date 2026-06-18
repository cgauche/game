import { useState } from 'react';
import { Modal } from './Modal';
import { OPTIONAL_RULES, rule, type OptionalRule, type RuleValue } from '../engine/policy';
import { setHouseRule, resetHouseRule } from '../state/houseRules';

/**
 * Panneau « Règles maison » — GÉNÉRÉ depuis le registre `OPTIONAL_RULES`. Il ne connaît aucune règle
 * en dur : il itère le registre, groupe par `group` et rend un contrôle par entrée selon `kind`.
 * Ajouter une règle optionnelle = ajouter une entrée au registre, elle apparaît ICI automatiquement.
 * Les surcharges sont persistées immédiatement et lues en direct par le moteur (`rule(id)`).
 */
export function HouseRulesModal({ onClose }: { onClose: () => void }) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const change = (id: string, v: RuleValue) => { setHouseRule(id, v); rerender(); };
  const reset = (id: string) => { resetHouseRule(id); rerender(); };
  const groups = [...new Set(OPTIONAL_RULES.map((r) => r.group))];

  return (
    <Modal title="📜 Règles maison" variant="plain" className="house-rules" onClose={onClose} backdropClose>
      {groups.map((g) => (
        <section key={g} className="hr-group">
          <h4 className="mini-title">{g}</h4>
          {OPTIONAL_RULES.filter((r) => r.group === g).map((r) => (
            <HouseRuleRow key={r.id} def={r} onChange={change} onReset={reset} />
          ))}
        </section>
      ))}
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  );
}

function HouseRuleRow({
  def, onChange, onReset,
}: {
  def: OptionalRule;
  onChange: (id: string, v: RuleValue) => void;
  onReset: (id: string) => void;
}) {
  const val = rule(def.id);
  const dirty = val !== def.default;
  const tip = def.hint ? `${def.ref} — ${def.hint}` : def.ref;
  return (
    <div className="hr-row" title={tip}>
      <span className="hr-label">
        {def.label}
        {dirty && (
          <button className="hr-reset" onClick={() => onReset(def.id)} title="Revenir au défaut (RAW)">↺</button>
        )}
      </span>
      <span className="hr-control">
        {def.kind === 'flag' && (
          <input type="checkbox" checked={val === true} onChange={(e) => onChange(def.id, e.target.checked)} />
        )}
        {def.kind === 'mode' && (
          <select value={String(val)} onChange={(e) => onChange(def.id, e.target.value)}>
            {(def.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {def.kind === 'param' && (
          <input
            type="number" value={Number(val)} min={def.min} max={def.max} step={def.step ?? 1}
            onChange={(e) => onChange(def.id, Number(e.target.value))}
          />
        )}
      </span>
      <span className="hr-ref">{def.ref}</span>
    </div>
  );
}
