import type { KeyboardEvent } from 'react';
import { Combatant } from '../engine/types';
import { isUnarmed, damageString } from '../engine/items';
import { CharacterPreview } from './CharacterPreview';
import { OrnateFrame } from './Ornaments';
import { Icon } from './Icon';
import { speciesSingular, findSpeciesById, findCareerById, levelsForCareer } from '../data';
import { CharStatsGrid } from './CharStatsGrid';
import { ZONES } from './EquipmentPanel';
import { SkillChip, TalentChip, EntityRef } from './EntityChip';
import { FateChips } from './FateChips';
import { CodexRef } from './compendium/CodexRef';

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
        {speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species)} · {findCareerById(hero.career)?.label ?? hero.career}
        {hero.careerLevel ? ` (niv. ${hero.careerLevel})` : ''}
      </span>
      {status && <span className="char-status">Statut {status}</span>}
    </div>
  );
}

/**
 * Carte de personnage v2 — le perso EN PIED (rig réel équipé, CharacterPreview) en zone dominante,
 * dans un cadre orné (OrnateFrame tone iron). Deux modes :
 *  - plein (emplacements de l'écran d'équipe) : figure + identité + carac + réserves + équipement + chips ;
 *  - `compact` (rangées du PartyPicker) : une RANGÉE dense — figure xs + identité + l'essentiel.
 */
export function CharCard({ hero, compact, onOpen }: { hero: Combatant; compact?: boolean; onOpen?: () => void }) {
  if (compact) {
    return (
      <div className={`char-card-row ${onOpen ? 'clickable' : ''}`} {...openAttrs(onOpen)}>
        <CharacterPreview hero={hero} size="xs" />
        <CharIdentity hero={hero} />
        <span className="char-row-stats" title="Blessures · Mouvement">
          <Icon id="resource/wounds" size="sm" /> {hero.wounds.max}
          <Icon id="resource/movement" size="sm" /> {hero.movement}
        </span>
      </div>
    );
  }
  // Aperçu d'équipement : armes en main + PA par ZONE (Tête/Bras/Corps/Jambes, couches cumulées).
  const arms = hero.weapons.filter((w) => !isUnarmed(w));
  const wornZones = ZONES.map((z) => ({ label: z.label, ap: hero.armour?.[z.apLoc] ?? 0 })).filter((z) => z.ap > 0);
  return (
    <OrnateFrame className="char-card">
      <div className={`char-head ${onOpen ? 'clickable' : ''}`} {...openAttrs(onOpen)}>
        <div className="char-fig">
          <CharacterPreview hero={hero} size="fill" ambiance="panel" />
        </div>
        <CharIdentity hero={hero} />
      </div>
      <CharStatsGrid value={(k) => hero.characteristics[k]} />
      <div className="char-vitals">
        <div className="stat-chip">
          <span className="sc-label"><CodexRef category="characteristics" label="Blessure">Blessures</CodexRef></span>
          <span className="sc-value">{hero.wounds.max}</span>
        </div>
        <div className="stat-chip">
          <span className="sc-label"><CodexRef category="characteristics" label="Mouvement">Mouvement</CodexRef></span>
          <span className="sc-value">{hero.movement}</span>
        </div>
        <FateChips c={hero} />
      </div>
      {(arms.length > 0 || wornZones.length > 0) && (
        <div className="char-equip">
          {arms.length > 0 && (
            <span className="ce-weap"><Icon id="item/weapon" size="sm" /> {arms.map((w, i) => (
              <EntityRef key={i} category="trappings" label={w.name} show={w.name} badge={damageString(w.damage)} />
            ))}</span>
          )}
          {wornZones.length > 0 && (
            <span className="ce-pa" title="Points d'Armure par zone (couches rigide + flexible cumulées)">
              <Icon id="item/armour" size="sm" /> {wornZones.map((z) => `${z.label} ${z.ap}`).join(' · ')}
            </span>
          )}
        </div>
      )}
      <div className="char-skills">
        <div className="mini-title">Compétences</div>
        <div className="skill-tags">
          {hero.skills.slice(0, 8).map((s, i) => (
            <SkillChip key={i} skill={s} />
          ))}
        </div>
        {hero.talents.length > 0 && (
          <>
            <div className="mini-title">Talents</div>
            <div className="skill-tags">
              {hero.talents.map((t, i) => (
                <TalentChip key={i} talent={t} />
              ))}
            </div>
          </>
        )}
      </div>
    </OrnateFrame>
  );
}
