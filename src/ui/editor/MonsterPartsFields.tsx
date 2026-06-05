/**
 * Champs « mutant modulaire » partagés : parts monstrueuses par slot (Tête, Bras G,
 * Bras D, Cornes, Queue) + Arme équipée. Utilisé par l'inspecteur d'entité ET par
 * l'inspecteur de spawn de rencontre → mêmes contrôles, séparation apparence↔stats.
 */
import { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from '../../gameIso/rig/parts/monstrous';
import { DEFAULT_PALETTE } from '../../gameIso/rig/palette';
import type { MonsterPartsSel, ColorsSel } from '../../state/scene';

/** Armes équipables proposées (une par forme/groupe — affichées par le rig). */
export const EDITOR_WEAPONS = ['Épée', 'Hache', 'Masse', 'Dague', 'Lance', 'Hallebarde', 'Bâton de combat', 'Arc', 'Arbalète', 'Pistolet', 'Fronde', 'Fouet'];

const COLOR_SLOTS: [label: string, slot: keyof ColorsSel][] = [
  ['Peau', 'peau'], ['Cheveux', 'cheveux'], ['Vêtement 1', 'vet1'], ['Vêtement 2', 'vet2'], ['Cuir', 'cuir'], ['Métal', 'metal'],
];

export function MonsterPartsFields({
  monster,
  weapon,
  colors,
  onMonster,
  onWeapon,
  onColors,
}: {
  monster?: MonsterPartsSel;
  weapon?: string;
  colors?: ColorsSel;
  onMonster: (patch: Partial<MonsterPartsSel>) => void;
  onWeapon: (w: string | undefined) => void;
  onColors: (patch: Partial<ColorsSel>) => void;
}) {
  return (
    <>
      <div className="ed-field">
        <span>Mutations (rig humanoïde)</span>
        {([
          ['Tête', 'tete', MONSTER_HEAD_OPTIONS],
          ['Bras gauche', 'brasG', MONSTER_ARM_OPTIONS],
          ['Bras droit', 'brasD', MONSTER_ARM_OPTIONS],
          ['Jambes', 'jambes', MONSTER_LEG_OPTIONS],
        ] as const).map(([lbl, slot, opts]) => (
          <label key={slot} className="ed-subfield">
            {lbl}
            <select value={monster?.[slot] ?? ''} onChange={(e) => onMonster({ [slot]: e.target.value || undefined })}>
              {opts.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="ed-subfield">
          <input type="checkbox" checked={!!monster?.cornes} onChange={(e) => onMonster({ cornes: e.target.checked || undefined })} />
          Cornes
        </label>
        <label className="ed-subfield">
          <input type="checkbox" checked={!!monster?.queue} onChange={(e) => onMonster({ queue: e.target.checked || undefined })} />
          Queue
        </label>
      </div>
      <label className="ed-field">
        Arme équipée
        <select value={weapon ?? ''} onChange={(e) => onWeapon(e.target.value || undefined)}>
          <option value="">— aucune —</option>
          {EDITOR_WEAPONS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>
      <div className="ed-field">
        <span>Couleurs (palette)</span>
        {COLOR_SLOTS.map(([lbl, slot]) => (
          <label key={slot} className="ed-subfield" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ flex: 1 }}>{lbl}</span>
            <input
              type="color"
              value={colors?.[slot] ?? DEFAULT_PALETTE[slot]}
              onChange={(e) => onColors({ [slot]: e.target.value })}
            />
            {colors?.[slot] && (
              <button className="btn small" title="Réinitialiser" onClick={() => onColors({ [slot]: undefined })}>✕</button>
            )}
          </label>
        ))}
      </div>
    </>
  );
}
