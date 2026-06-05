import { DEFAULT_PALETTE, type Palette } from '../gameIso/rig/palette';

/** Emplacements de couleur exposés (ordre d'affichage). */
const COLOR_SLOTS: [label: string, slot: keyof Palette][] = [
  ['Peau', 'peau'],
  ['Cheveux', 'cheveux'],
  ['Yeux', 'yeux'],
  ['Vêtement 1', 'vet1'],
  ['Vêtement 2', 'vet2'],
  ['Cuir', 'cuir'],
  ['Métal', 'metal'],
];

/**
 * Sélecteurs de couleur de palette (peau / cheveux / yeux / vêtements / cuir / métal).
 * Partagé par le créateur de personnage (héros) ET l'éditeur de niveau (PNJ). Une valeur
 * absente = défaut (affiché par DEFAULT_PALETTE) ; ✕ réinitialise le slot.
 */
export function ColorPalettePickers({ colors, onColors }: { colors?: Palette; onColors: (patch: Partial<Palette>) => void }) {
  return (
    <div className="ed-field">
      <span>Couleurs (palette)</span>
      {COLOR_SLOTS.map(([lbl, slot]) => (
        <label key={slot} className="ed-subfield" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ flex: 1 }}>{lbl}</span>
          <input type="color" value={colors?.[slot] ?? DEFAULT_PALETTE[slot]} onChange={(e) => onColors({ [slot]: e.target.value })} />
          {colors?.[slot] && (
            <button type="button" className="btn small" title="Réinitialiser" onClick={() => onColors({ [slot]: undefined })}>
              ✕
            </button>
          )}
        </label>
      ))}
    </div>
  );
}
