/**
 * Champs « mutant modulaire » partagés : parts monstrueuses par slot (Tête, Bras G,
 * Bras D, Cornes, Queue) + Arme équipée. Utilisé par l'inspecteur d'entité ET par
 * l'inspecteur de spawn de rencontre → mêmes contrôles, séparation apparence↔stats.
 */
import { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from '../../gameIso/rig/parts/monstrous';
import { EYE_OPTIONS } from '../../gameIso/rig/parts/eyes';
import { ColorPalettePickers, MONSTER_COLOR_SLOTS } from '../ColorPalettePickers';
import { HAIRSTYLES } from '../../gameIso/rig/parts/generated/hairstyles';
import { tenueCareerNames } from '../../gameIso/rig/parts/career';
import type { MonsterPartsSel, ColorsSel } from '../../state/scene';

/** Armes équipables proposées (une par forme/groupe — affichées par le rig). */
export const EDITOR_WEAPONS = ['Épée', 'Hache', 'Masse', 'Dague', 'Lance', 'Hallebarde', 'Bâton de combat', 'Arc', 'Arbalète', 'Pistolet', 'Fronde', 'Fouet'];

export function MonsterPartsFields({
  monster,
  weapon,
  colors,
  sex,
  build,
  parts,
  career,
  eyes,
  onMonster,
  onWeapon,
  onColors,
  onSex,
  onBuild,
  onParts,
  onCareer,
  onEyes,
}: {
  monster?: MonsterPartsSel;
  weapon?: string;
  colors?: ColorsSel;
  sex?: 'M' | 'F';
  build?: number;
  parts?: { cheveux?: number; visage?: number };
  career?: string;
  eyes?: { G?: string; D?: string };
  onMonster: (patch: Partial<MonsterPartsSel>) => void;
  onWeapon: (w: string | undefined) => void;
  onColors: (patch: Partial<ColorsSel>) => void;
  onSex?: (s: 'M' | 'F') => void;
  onBuild?: (b: number) => void;
  onParts?: (patch: { cheveux?: number; visage?: number }) => void;
  onCareer?: (c: string | undefined) => void;
  onEyes?: (patch: { G?: string; D?: string }) => void;
}) {
  return (
    <>
      <div className="ed-field">
        <span>Apparence (rig)</span>
        <label className="ed-subfield">
          Sexe
          <select value={sex ?? 'M'} onChange={(e) => onSex?.(e.target.value as 'M' | 'F')}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </label>
        <label className="ed-subfield">
          Carrure
          <input type="range" min={0} max={1} step={0.05} value={build ?? 0.5} onChange={(e) => onBuild?.(Number(e.target.value))} />
        </label>
        <label className="ed-subfield">
          Coiffure
          <select value={parts?.cheveux ?? 0} onChange={(e) => onParts?.({ cheveux: Number(e.target.value) })}>
            <option value={0}>Défaut (espèce)</option>
            {HAIRSTYLES[sex ?? 'M'].map((h, i) => (
              <option key={i} value={i + 1}>{h.name}</option>
            ))}
          </select>
        </label>
      </div>
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
        <label className="ed-subfield">
          <input type="checkbox" checked={!!monster?.ailes} onChange={(e) => onMonster({ ailes: e.target.checked || undefined })} />
          Ailes
        </label>
        {onEyes && ([['Œil gauche', 'G'], ['Œil droit', 'D']] as const).map(([lbl, side]) => (
          <label key={side} className="ed-subfield">
            {lbl}
            <select value={eyes?.[side] ?? ''} onChange={(e) => onEyes({ [side]: e.target.value || undefined })}>
              <option value="">— normal —</option>
              {Object.entries(EYE_OPTIONS).map(([key, o]) => (
                <option key={key} value={key}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
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
      <label className="ed-field">
        Tenue (carrière)
        <select value={career ?? ''} onChange={(e) => onCareer?.(e.target.value || undefined)}>
          <option value="">— par défaut (selon le nom) —</option>
          {tenueCareerNames().map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <ColorPalettePickers colors={colors} onColors={onColors} slots={MONSTER_COLOR_SLOTS} />
    </>
  );
}
