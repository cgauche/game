import { useState } from 'react';
import { useGame } from '../state/store';
import { maxEncumbrance } from '../engine/items';
import { CHAR_KEYS, CharKey, HitLocation, ItemInstance, Combatant } from '../engine/types';
import { buildAdvancementView } from '../state/advancement';
import { careers } from '../data';

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
  const [tab, setTab] = useState<'fiche' | 'avancement'>('fiche');
  if (!hero) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <h3>{hero.name}</h3>
            <span className="char-sub">
              {hero.species} · {hero.career}
              {hero.careerLevel ? ` (niv. ${hero.careerLevel})` : ''}
            </span>
          </div>
          <div className="sheet-tabs">
            <button className={`tab ${tab === 'fiche' ? 'on' : ''}`} onClick={() => setTab('fiche')}>
              Fiche
            </button>
            <button className={`tab ${tab === 'avancement' ? 'on' : ''}`} onClick={() => setTab('avancement')}>
              Avancement
            </button>
          </div>
          <button className="btn small" onClick={onClose}>
            Fermer
          </button>
        </header>

        {tab === 'fiche' ? <FicheBody hero={hero} /> : <AdvancementPanel hero={hero} />}
      </div>
    </div>
  );
}

function FicheBody({ hero }: { hero: Combatant }) {
  const toggleEquip = useGame((s) => s.toggleEquip);
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
    <>
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
    </>
  );
}

export function AdvancementPanel({ hero }: { hero: Combatant }) {
  const grantXp = useGame((s) => s.grantXp);
  const buyCharAdvance = useGame((s) => s.buyCharAdvance);
  const buySkillAdvance = useGame((s) => s.buySkillAdvance);
  const buyTalent = useGame((s) => s.buyTalent);
  const changeCareer = useGame((s) => s.changeCareer);
  const [target, setTarget] = useState('');

  const v = buildAdvancementView(hero);
  const afford = (c: number) => v.xp >= c;
  const pill = (inC: boolean) => <span className={`career-pill ${inC ? 'in' : 'out'}`}>{inC ? 'carrière' : '×2'}</span>;

  return (
    <div className="adv-panel">
      <div className="adv-top">
        <div className="adv-xp">
          PX disponibles <b>{v.xp}</b>
        </div>
        <div className="adv-grant">
          <span className="muted">Octroyer</span>
          {[10, 50, 100].map((n) => (
            <button key={n} className="btn small" onClick={() => grantXp(hero.id, n)}>
              +{n}
            </button>
          ))}
        </div>
      </div>

      <div className="mini-title">Caractéristiques</div>
      <div className="adv-grid">
        {v.chars.map((c) => (
          <div className="adv-row" key={c.key}>
            <span className="adv-name">
              {c.label} <em>{c.value}</em> {pill(c.inCareer)}
            </span>
            <span className="adv-meta">×{c.advances}</span>
            <button className="btn small" disabled={!afford(c.nextCost)} onClick={() => buyCharAdvance(hero.id, c.key)}>
              +1 · {c.nextCost} PX
            </button>
          </div>
        ))}
      </div>

      <div className="mini-title">Compétences</div>
      <div className="adv-grid">
        {v.skills.map((s) => (
          <div className={`adv-row ${s.known ? '' : 'acquire'}`} key={s.name}>
            <span className="adv-name">
              {s.name} <em>{(hero.characteristics[s.characteristic] ?? 0) + s.advances}</em> {pill(s.inCareer)}
              {s.known ? '' : <span className="acquire-tag">à apprendre</span>}
            </span>
            <span className="adv-meta">+{s.advances}</span>
            <button className="btn small" disabled={!afford(s.nextCost)} onClick={() => buySkillAdvance(hero.id, s.name)}>
              {s.known ? '+1' : 'Apprendre'} · {s.nextCost} PX
            </button>
          </div>
        ))}
      </div>

      <div className="mini-title">Talents</div>
      <div className="adv-grid">
        {v.talents.length === 0 && <span className="muted">Aucun Talent de carrière disponible.</span>}
        {v.talents.map((t) => (
          <div className={`adv-row ${t.times > 0 ? '' : 'acquire'}`} key={t.name}>
            <span className="adv-name">
              {t.name}
              {t.times > 0 ? ` ×${t.times}` : ''} {pill(t.inCareer)}
            </span>
            <span className="adv-meta" />
            <button className="btn small" disabled={!afford(t.nextCost)} onClick={() => buyTalent(hero.id, t.name)}>
              {t.times > 0 ? '+1' : 'Acquérir'} · {t.nextCost} PX
            </button>
          </div>
        ))}
      </div>

      <div className="mini-title">Carrière</div>
      <div className="adv-career">
        <div className="adv-career-cur">
          <b>{v.levelLabel}</b> <span className="muted">niv. {v.careerLevel} · {v.status}</span>
          <span className={`career-status ${v.completed ? 'done' : ''}`}>{v.completed ? '✓ niveau complété' : 'niveau en cours'}</span>
        </div>
        {v.targets.map((t) => (
          <button key={t.level} className="btn small" disabled={!afford(t.cost)} onClick={() => changeCareer(hero.id, t.career, t.level)}>
            Monter : {t.label} (niv. {t.level}) · {t.cost} PX
          </button>
        ))}
        <div className="adv-change">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— changer de carrière —</option>
            {careers.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            className="btn small"
            disabled={!target || !afford(v.changeCost)}
            onClick={() => {
              if (target) changeCareer(hero.id, target, 1);
              setTarget('');
            }}
          >
            Changer · {v.changeCost} PX
          </button>
        </div>
      </div>
    </div>
  );
}
