import { Combatant, CHAR_KEYS, CharKey } from '../engine/types';

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

export function CharCard({ hero, compact }: { hero: Combatant; compact?: boolean }) {
  return (
    <div className={`char-card panel ${compact ? 'compact' : ''}`}>
      <div className="char-head">
        <strong>{hero.name}</strong>
        <span className="char-sub">
          {hero.species} · {hero.career}
        </span>
      </div>
      <div className="char-stats">
        {CHAR_KEYS.map((k) => (
          <div className="stat" key={k}>
            <span className="stat-label">{SHORT[k]}</span>
            <span className="stat-val">{hero.characteristics[k]}</span>
          </div>
        ))}
      </div>
      <div className="char-bottom">
        <span>
          Blessures <b>{hero.wounds.max}</b>
        </span>
        <span>
          Mvt <b>{hero.movement}</b>
        </span>
        {hero.fate != null && (
          <span>
            Destin <b>{hero.fate}</b>
          </span>
        )}
        {hero.resilience != null && (
          <span>
            Résilience <b>{hero.resilience}</b>
          </span>
        )}
      </div>
      {!compact && (
        <div className="char-skills">
          <div className="mini-title">Compétences</div>
          <div className="skill-tags">
            {hero.skills.slice(0, 8).map((s, i) => (
              <span className="tag" key={i}>
                {s.name}
                {s.spec ? ` (${s.spec})` : ''} +{s.advances}
              </span>
            ))}
          </div>
          {hero.talents.length > 0 && (
            <>
              <div className="mini-title">Talents</div>
              <div className="skill-tags">
                {hero.talents.map((t, i) => (
                  <span className="tag talent" key={i}>
                    {t.name}
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
