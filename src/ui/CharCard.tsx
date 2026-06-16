import type { KeyboardEvent } from 'react';
import { Combatant, CHAR_KEYS, CharKey } from '../engine/types';
import { PortraitTile } from './PortraitTile';
import { speciesSingular } from '../data';
import { CodexRef } from './compendium/CodexRef';
import { FateChips } from './FateChips';
import { splitLabel } from '../engine/careerSlots';

const SHORT: Record<CharKey, string> = {
  CC: 'CC',
  CT: 'CT',
  F: 'F',
  E: 'E',
  I: 'I',
  Ag: 'Ag',
  Dex: 'Dex',
  Int: 'Int',
  FM: 'FM',
  Soc: 'Soc',
};

export function CharCard({ hero, compact, onOpen }: { hero: Combatant; compact?: boolean; onOpen?: () => void }) {
  // F4 : aperçu d'équipement sur la mini-carte — armes en main + PA du corps.
  const arms = hero.weapons.filter((w) => w.name !== 'Mains nues');
  const bodyPA = hero.armour?.corps ?? 0;
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
          <span className="char-sub">
            {speciesSingular(hero.species)} · {hero.career}
          </span>
        </div>
      </div>
      <div className="char-stats">
        {CHAR_KEYS.map((k) => (
          <div className="stat" key={k}>
            <span className="stat-label">{SHORT[k]}</span>
            <span className="stat-val">{hero.characteristics[k]}</span>
          </div>
        ))}
      </div>
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
      {(arms.length > 0 || bodyPA > 0) && (
        <div className="char-equip">
          {arms.length > 0 && <span className="ce-weap">⚔ {arms.map((w) => w.name).join(', ')}</span>}
          {bodyPA > 0 && <span className="ce-pa" title="Points d'Armure (corps)">🛡 PA {bodyPA}</span>}
        </div>
      )}
      {!compact && (
        <div className="char-skills">
          <div className="mini-title">Compétences</div>
          <div className="skill-tags">
            {hero.skills.slice(0, 8).map((s, i) => (
              <span className="tag" key={i}>
                <CodexRef category="skills" label={splitLabel(s.name).name}>
                  {s.name}{s.spec ? ` (${s.spec})` : ''}
                </CodexRef> +{s.advances}
              </span>
            ))}
          </div>
          {hero.talents.length > 0 && (
            <>
              <div className="mini-title">Talents</div>
              <div className="skill-tags">
                {hero.talents.map((t, i) => (
                  <span className="tag talent" key={i}>
                    <CodexRef category="talents" label={splitLabel(t.name).name}>{t.name}</CodexRef>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
