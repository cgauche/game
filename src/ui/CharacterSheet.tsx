import { useGame } from '../state/store';
import { maxEncumbrance } from '../engine/items';
import { CHAR_KEYS, CharKey, HitLocation, ItemInstance } from '../engine/types';

const LOC_SHORT: Record<HitLocation, string> = {
  tete: 'Tête',
  brasG: 'Bras G',
  brasD: 'Bras D',
  corps: 'Corps',
  jambeG: 'Jambe G',
  jambeD: 'Jambe D',
};
const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
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

export function CharacterSheet({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  const hero = useGame((s) => s.party.find((h) => h.id === heroId));
  const toggleEquip = useGame((s) => s.toggleEquip);
  if (!hero) return null;

  const items = hero.items ?? [];
  const enc = hero.encumbrance ?? 0;
  const maxEnc = maxEncumbrance(hero);
  const over = enc > maxEnc;
  const activeWeapons = hero.weapons.filter((w) => w.name !== 'Mains nues');

  const itemStats = (it: ItemInstance): string => {
    if (it.kind === 'melee' || it.kind === 'ranged')
      return [it.damage && `Dégâts ${it.damage}`, it.reach && `Allonge ${it.reach}`, it.range && `Portée ${it.range} m`, it.qualities.join(', ')]
        .filter(Boolean)
        .join(' · ');
    if (it.kind === 'armor') return [it.pa != null && `PA ${it.pa}`, (it.locs ?? []).map((l) => LOC_SHORT[l]).join(', ')].filter(Boolean).join(' · ');
    return it.qualities.join(', ');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <h3>{hero.name}</h3>
            <span className="char-sub">
              {hero.species} · {hero.career}
            </span>
          </div>
          <button className="btn small" onClick={onClose}>
            Fermer
          </button>
        </header>

        <div className="char-stats sheet-stats">
          {CHAR_KEYS.map((k) => (
            <div className="stat" key={k}>
              <span className="stat-label">{SHORT[k]}</span>
              <span className="stat-val">{hero.characteristics[k]}</span>
            </div>
          ))}
        </div>

        <div className="sheet-combat">
          <div className="sc-block">
            <span className="mini-title">Défense — Points d'Armure</span>
            <div className="ap-row">
              {LOCS.map((l) => (
                <div className="ap-cell" key={l}>
                  <span>{LOC_SHORT[l]}</span>
                  <b className={hero.armour[l] > 0 ? 'on' : ''}>{hero.armour[l]}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="sc-meta">
            <span>
              Blessures <b>{hero.wounds.current}/{hero.wounds.max}</b>
            </span>
            <span>
              Mvt <b>{hero.movement}</b>
            </span>
            <span className={over ? 'enc-over' : ''}>
              Encombrement <b>{enc}</b>/{maxEnc}
              {over && ' ⚠'}
            </span>
          </div>
          <div className="sc-weapons">
            <span className="mini-title">Armes actives</span>
            {activeWeapons.length === 0 ? (
              <span className="muted">Mains nues</span>
            ) : (
              activeWeapons.map((w, i) => (
                <span className="weap" key={i}>
                  {w.name} <em>({w.damage})</em>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="sheet-skills">
          <div className="mini-title">Compétences</div>
          <div className="skill-grid">
            {hero.skills.length === 0 && <span className="muted">Aucune.</span>}
            {hero.skills.map((s, i) => {
              const val = (hero.characteristics[s.characteristic] ?? 0) + s.advances;
              return (
                <div className="skill-line" key={i} title={`${s.characteristic} ${hero.characteristics[s.characteristic]} + ${s.advances}`}>
                  <span className="sk-name">
                    {s.name}
                    {s.spec ? ` (${s.spec})` : ''}
                  </span>
                  <span className="sk-val">{val}</span>
                  <span className="sk-adv">+{s.advances}</span>
                </div>
              );
            })}
          </div>
          {hero.talents.length > 0 && (
            <>
              <div className="mini-title">Talents</div>
              <div className="skill-tags">
                {hero.talents.map((t, i) => (
                  <span className="tag talent" key={i}>
                    {t.name}
                    {t.times > 1 ? ` ×${t.times}` : ''}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sheet-inventory">
          <div className="mini-title">Inventaire & équipement ({items.length})</div>
          <div className="inv-rows">
            {items.length === 0 && <p className="muted">Aucun objet.</p>}
            {items.map((it) => {
              const equipable = it.kind === 'melee' || it.kind === 'ranged' || it.kind === 'armor';
              return (
                <div className={`inv-row kind-${it.kind} ${it.equipped ? 'equipped' : ''}`} key={it.uid}>
                  <div className="ir-main">
                    <span className="ir-name">{it.name}</span>
                    <span className="ir-stats">{itemStats(it)}</span>
                  </div>
                  <span className="ir-enc">Enc {it.enc}</span>
                  {equipable ? (
                    <button className={`btn small ${it.equipped ? 'btn-primary' : ''}`} onClick={() => toggleEquip(hero.id, it.uid)}>
                      {it.equipped ? 'Équipé' : 'Équiper'}
                    </button>
                  ) : (
                    <span className="ir-kind">{it.kind}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
