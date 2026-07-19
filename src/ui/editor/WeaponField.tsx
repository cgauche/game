/**
 * Éditeur RÉUTILISABLE d'une `Weapon` (arme dérivée/naturelle conférée par une mutation, un trait, un
 * objet…). Édite le VRAI objet `Weapon` — pas de structure intermédiaire. Les champs de LOADOUT
 * (hand/uid/reload/bypass/skin) sont runtime et hors édition : on ne décrit ici que l'arme elle-même.
 */
import type { Weapon, QualityInstance } from '../../engine/types';
import { damageString, parseDamage } from '../../engine/items';
import { parseQualityInstance } from '../../engine/qualities/normalize';
import { qualityRefLabel } from '../../data';

export function WeaponField({ value, onChange }: { value: Weapon | undefined; onChange: (v: Weapon | undefined) => void }) {
  if (!value) {
    return (
      <div className="ed-field">
        <label className="dr"><input type="checkbox" checked={false} onChange={() => onChange({ label: '', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] })} /> confère une ARME (naturelle / dérivée)</label>
      </div>
    );
  }
  const w = value;
  const patch = (p: Partial<Weapon>) => onChange({ ...w, ...p });
  // Portée : SPEC (mètres fixes OU `{bf}` = BF×N, arme de jet). Toggle « ×BF » + valeur, sans perte de donnée.
  const rangeBf = typeof w.range === 'object' && w.range != null;
  const rangeNum: number | '' = rangeBf ? (w.range as { bf: number }).bf : typeof w.range === 'number' ? w.range : '';
  return (
    <div className="ed-field ed-weapon">
      <label className="dr"><input type="checkbox" checked onChange={() => onChange(undefined)} /> ARME conférée</label>
      <div className="tf-row">
        <input placeholder="Nom (ex. Cornes)" value={w.label} onChange={(e) => patch({ label: e.target.value })} />
        <label className="dr">Type
          <select value={w.type} onChange={(e) => patch({ type: e.target.value as Weapon['type'] })}>
            <option value="melee">Mêlée</option>
            <option value="ranged">Distance</option>
          </select>
        </label>
        <label className="dr">Dégâts<input placeholder="+BF / +BF+4 / +9" value={damageString(w.damage)} onChange={(e) => patch({ damage: parseDamage(e.target.value) })} /></label>
        <label className="dr">Mains
          <select value={w.hands ?? 1} onChange={(e) => patch({ hands: Number(e.target.value) === 2 ? 2 : 1 })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label className="dr">Groupe<input placeholder="Base, Cavalerie…" value={w.subType ?? ''} onChange={(e) => patch({ subType: e.target.value || undefined })} /></label>
        {w.type === 'melee' ? (
          <label className="dr">Allonge<input placeholder="Moyenne…" value={w.reach ?? ''} onChange={(e) => patch({ reach: e.target.value || undefined })} /></label>
        ) : (
          <label className="dr">Portée {rangeBf ? '(×BF)' : '(m)'}
            <input type="number" min={0} value={rangeNum}
              onChange={(e) => patch({ range: e.target.value === '' ? undefined : (rangeBf ? { bf: Math.max(0, Number(e.target.value) || 0) } : Math.max(0, Number(e.target.value) || 0)) })} />
            <label className="bf-toggle"><input type="checkbox" checked={rangeBf}
              onChange={(e) => { const n = typeof rangeNum === 'number' ? rangeNum : 0; patch({ range: e.target.checked ? { bf: n } : n }); }} /> ×BF</label>
          </label>
        )}
      </div>
      <label className="dr">Qualités<input placeholder="Perçante, Solide 3… (séparées par des virgules)" value={w.qualities.map(qualityRefLabel).join(', ')}
        onChange={(e) => patch({ qualities: e.target.value.split(',').map((s) => parseQualityInstance(s.trim())).filter((q): q is QualityInstance => q != null) })} /></label>
    </div>
  );
}
