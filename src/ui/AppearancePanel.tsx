import { RigSprite } from '../gameIso/rig/composeRig';
import { DEFS } from '../gameIso/sprites';
import type { Appearance } from '../gameIso/rig/appearance';
import type { EquipCtx } from '../gameIso/rig/parts/equipment';

/**
 * Panneau d'apparence réutilisable (créateur de personnage). Aperçu live du rig +
 * réglages cosmétiques (sexe, morphologie, variante). Le corps/arme/armure suit la
 * carrière (et plus tard l'équipement porté) ; sexe/morpho sont libres.
 */
export function AppearancePanel({
  value,
  equip,
  career,
  onChange,
}: {
  value: Appearance;
  equip: EquipCtx;
  career?: string;
  onChange: (a: Appearance) => void;
}) {
  const set = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <svg viewBox="0 0 120 150" width={108} height={135} style={{ flex: '0 0 auto', borderRadius: 6 }}>
        <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
        <rect x={0} y={0} width={120} height={150} fill="#1d2230" rx={6} />
        <RigSprite appearance={value} equip={equip} career={career} />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <label>
          Sexe
          <select value={value.sex} onChange={(e) => set({ sex: e.target.value as 'M' | 'F' })}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </label>
        <label>
          Morphologie <em style={{ opacity: 0.7 }}>(frêle ↔ corpulent)</em>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value.build}
            onChange={(e) => set({ build: Number(e.target.value) })}
          />
        </label>
        <button type="button" className="btn small" onClick={() => set({ seed: (value.seed ?? 0) + 1 })}>
          🎲 Variante (visage / cheveux)
        </button>
      </div>
    </div>
  );
}
