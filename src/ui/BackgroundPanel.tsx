import { useGame } from '../state/store';
import { Combatant } from '../engine/types';
import { findStarById } from '../data';

/** Onglet « Background » de la fiche : bio en LECTURE SEULE (détails physiques + astrologie, LDB 05
 *  étape 6 — cosmétique) et trois champs ÉDITABLES hors combat (Motivation + Ambitions court/long,
 *  LDB 05 l.710-717). L'édition passe par `setHeroBackground` → persistée en save + roster. En
 *  combat, l'édition est verrouillée (on ne mute que `store.party`, jamais la copie de bataille). */
export function BackgroundPanel({ hero }: { hero: Combatant }) {
  const setHeroBackground = useGame((s) => s.setHeroBackground);
  const inBattle = useGame((s) => !!s.battle);
  const d = hero.details;
  const starLabel = hero.star ? (findStarById(hero.star)?.label ?? hero.star) : undefined;

  // Bio figée : on n'affiche que les champs RÉELLEMENT présents (rien d'inventé).
  const bio: [label: string, value: string | undefined][] = [
    ['Âge', d?.age != null ? `${d.age} ans` : undefined],
    ['Taille', d?.height != null ? `${d.height} cm` : undefined],
    ['Yeux', d?.eyes],
    ['Cheveux', d?.hair],
    ['Signe astral', starLabel],
    ['Ascendant', d?.ascendant],
  ];
  const shown = bio.filter(([, v]) => v != null && v !== '');

  return (
    <div className="bg-panel">
      {shown.length > 0 && (
        <>
          <div className="mini-title">Identité</div>
          <div className="bg-grid">
            {shown.map(([label, value]) => (
              <div className="stat-chip" key={label}>
                <span className="sc-label">{label}</span>
                <span className="sc-value">{value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mini-title">
        Background <span className="bg-hint">✎ Modifiable hors combat</span>
      </div>
      <div className="bg-edit">
        <label className="bg-field">
          <span className="bg-label">Motivation</span>
          <input
            type="text"
            value={hero.motivation ?? ''}
            disabled={inBattle}
            placeholder="Aucune motivation notée"
            onChange={(e) => setHeroBackground(hero.id, { motivation: e.target.value })}
          />
        </label>
        <label className="bg-field">
          <span className="bg-label">Ambition à court terme</span>
          <textarea
            rows={2}
            value={d?.ambitionShort ?? ''}
            disabled={inBattle}
            placeholder="Aucune ambition notée"
            onChange={(e) => setHeroBackground(hero.id, { ambitionShort: e.target.value })}
          />
        </label>
        <label className="bg-field">
          <span className="bg-label">Ambition à long terme</span>
          <textarea
            rows={2}
            value={d?.ambitionLong ?? ''}
            disabled={inBattle}
            placeholder="Aucune ambition notée"
            onChange={(e) => setHeroBackground(hero.id, { ambitionLong: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
