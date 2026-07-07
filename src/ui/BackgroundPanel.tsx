import { useGame } from '../state/store';
import { Combatant } from '../engine/types';
import { findStarById } from '../data';
import { BackgroundFields } from './BackgroundFields';
import { Icon } from './Icon';

/** Onglet « Background » de la fiche : bio en LECTURE SEULE (détails physiques + astrologie, LDB 05
 *  étape 6 — cosmétique) et les champs ÉDITABLES hors combat (Motivation + Ambitions court/long,
 *  LDB 05 l.710-717) — rendus par la primitive PARTAGÉE `BackgroundFields` (même markup/hints que le
 *  créateur). L'édition passe par `setHeroBackground` → persistée en save + roster. En combat, c'est
 *  verrouillé (on ne mute que `store.party`, jamais la copie de bataille). */
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
                <span className="sc-label" title={label}>{label}</span>
                <span className="sc-value">{value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mini-title">
        Background <span className="bg-hint"><Icon id="ui/edit" size="sm" /> Modifiable hors combat</span>
      </div>
      <BackgroundFields
        values={{ motivation: hero.motivation ?? '', ambitionShort: d?.ambitionShort ?? '', ambitionLong: d?.ambitionLong ?? '' }}
        onChange={(patch) => setHeroBackground(hero.id, patch)}
        disabled={inBattle}
      />
    </div>
  );
}
