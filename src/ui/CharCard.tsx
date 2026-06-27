import type { KeyboardEvent } from 'react';
import { Combatant } from '../engine/types';
import { isUnarmed } from '../engine/items';
import { PortraitTile } from './PortraitTile';
import { speciesSingular, findSpeciesById, findCareerById } from '../data';
import { CharStatsGrid } from './CharStatsGrid';
import { ZONES } from './EquipmentPanel';
import { SkillChip, TalentChip } from './EntityChip';
import { FateChips } from './FateChips';

export function CharCard({ hero, compact, onOpen }: { hero: Combatant; compact?: boolean; onOpen?: () => void }) {
  // F4/T3 : aperçu d'équipement sur la mini-carte — armes en main + PA par ZONE (le défaut était
  // « armure réduite au corps » ; on montre Tête/Bras/Corps/Jambes, couches rigide + flexible cumulées).
  const arms = hero.weapons.filter((w) => !isUnarmed(w));
  const wornZones = ZONES.map((z) => ({ label: z.label, ap: hero.armour?.[z.apLoc] ?? 0 })).filter((z) => z.ap > 0);
  return (
    <div className={`char-card panel ${compact ? 'compact' : ''}`}>
      <div
        className={`char-head ${onOpen ? 'clickable' : ''}`}
        {...(onOpen
          ? { onClick: onOpen, role: 'button', tabIndex: 0, title: 'Voir la fiche complète',
              onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } }
          : {})}
      >
        {/* identity sans jauge : hors partie, la vie courante n'informe de rien (toujours au max).
            Anneau or « méta » — pas encore de couleur de groupe. Le nom RESTE : écran méta. */}
        <PortraitTile c={hero} ring="var(--gold)" variant="identity" size={compact ? 'sm' : 'lg'} />
        <div className="char-id">
          <strong>{hero.name}</strong>
          {/* Race/carrière en texte simple : `.char-head` est lui-même cliquable (ouvre la fiche)
              → pas de CodexRef imbriqué (conflit de clic) ; le survol-info vit sur la fiche. */}
          <span className="char-sub">
            {speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species)} · {findCareerById(hero.career)?.label ?? hero.career}
          </span>
        </div>
      </div>
      <CharStatsGrid value={(k) => hero.characteristics[k]} />
      <div className="char-vitals">
        <div className="stat-chip">
          <span className="sc-label">Blessures</span>
          <span className="sc-value">{hero.wounds.max}</span>
        </div>
        <div className="stat-chip">
          <span className="sc-label">Mouvement</span>
          <span className="sc-value">{hero.movement}</span>
        </div>
        <FateChips c={hero} />
      </div>
      {(arms.length > 0 || wornZones.length > 0) && (
        <div className="char-equip">
          {arms.length > 0 && <span className="ce-weap">⚔ {arms.map((w) => w.name).join(', ')}</span>}
          {wornZones.length > 0 && (
            <span className="ce-pa" title="Points d'Armure par zone (couches rigide + flexible cumulées)">
              🛡 {wornZones.map((z) => `${z.label} ${z.ap}`).join(' · ')}
            </span>
          )}
        </div>
      )}
      {!compact && (
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
      )}
    </div>
  );
}
