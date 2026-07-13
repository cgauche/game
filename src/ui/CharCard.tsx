import type { KeyboardEvent } from 'react';
import { Combatant } from '../engine/types';
import { CharacterPreview } from './CharacterPreview';
import { OrnateFrame } from './Ornaments';
import { Icon } from './Icon';
import { speciesSingular, findSpeciesById, careerLabelFor, levelsForCareer } from '../data';
import { CharStatsGrid } from './CharStatsGrid';
import { WoundsBadge } from './WoundsBadge';

/** Attributs de zone cliquable « ouvre la fiche complète » — partagés carte pleine / rangée compacte. */
const openAttrs = (onOpen?: () => void) =>
  onOpen
    ? {
        onClick: onOpen,
        role: 'button' as const,
        tabIndex: 0,
        title: 'Voir la fiche complète',
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
        },
      }
    : {};

/** Identité : nom, espèce · carrière (niv.), Statut social du niveau de carrière courant. */
function CharIdentity({ hero }: { hero: Combatant }) {
  const status = levelsForCareer(hero.career ?? '').find((l) => l.level === (hero.careerLevel ?? 1))?.status;
  return (
    <div className="char-id">
      <strong>{hero.name}</strong>
      {/* Race/carrière en texte simple : la zone parente est elle-même cliquable (ouvre la fiche)
          → pas de CodexRef imbriqué (conflit de clic) ; le survol-info vit sur la fiche. */}
      <span className="char-sub">
        {speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species)} · {careerLabelFor(hero)}
        {hero.careerLevel ? ` (niv. ${hero.careerLevel})` : ''}
      </span>
      {status && <span className="char-status">Statut {status}</span>}
    </div>
  );
}

/**
 * Carte de personnage v2 — le perso EN PIED (rig réel équipé, CharacterPreview) en zone dominante,
 * dans un cadre orné (OrnateFrame tone iron). Deux modes :
 *  - plein (emplacements de l'écran d'équipe) : figure + identité + carac + réserves. Le détail
 *    (équipement, compétences, talents) vit dans la fiche complète, ouverte au clic (`onOpen`) —
 *    la carte de siège reste un APERÇU compact qui tient sans ascenseur (écran de sélection).
 *  - `compact` (rangées du vivier/PartyPicker) : une RANGÉE dense — figure xs + identité + l'essentiel.
 */
export function CharCard({ hero, compact, onOpen }: { hero: Combatant; compact?: boolean; onOpen?: () => void }) {
  if (compact) {
    return (
      <div className={`char-card-row ${onOpen ? 'clickable' : ''}`} {...openAttrs(onOpen)}>
        <CharacterPreview hero={hero} size="xs" />
        <CharIdentity hero={hero} />
        <span className="char-row-stats">
          <WoundsBadge wounds={hero.wounds} />
          <span title="Mouvement"><Icon id="resource/movement" size="sm" /> {hero.movement}</span>
        </span>
      </div>
    );
  }
  return (
    <OrnateFrame className="char-card">
      <div className={`char-head ${onOpen ? 'clickable' : ''}`} {...openAttrs(onOpen)}>
        <div className="char-fig">
          <CharacterPreview hero={hero} size="fill" ambiance="panel" />
        </div>
        <CharIdentity hero={hero} />
      </div>
      <CharStatsGrid value={(k) => hero.characteristics[k]} />
      {/* Réserves en UNE ligne dense (le détail — Chance/Détermination, équipement, compétences — vit
          dans la fiche complète, ouverte au clic). La carte de siège reste un aperçu qui tient sans
          ascenseur. */}
      <div className="char-reserves">
        <span title="Blessures"><Icon id="resource/wounds" size="sm" /> <WoundsBadge wounds={hero.wounds} /></span>
        <span title="Mouvement"><Icon id="resource/movement" size="sm" /> {hero.movement}</span>
        {hero.fate != null && <span title="Destin"><Icon id="resource/fate" size="sm" /> {hero.fate}</span>}
        {hero.resilience != null && <span title="Résilience"><Icon id="resource/resilience" size="sm" /> {hero.resilience}</span>}
      </div>
    </OrnateFrame>
  );
}
