import { useGame, activeCombatant } from '../state/store';
import { IsoStage } from '../gameIso/IsoStage';
import { DialogueBox } from './DialogueBox';
import { BattlePanel } from './BattlePanel';
import { TestModal } from './TestModal';
import { DocumentModal } from './DocumentModal';
import { Combatant } from '../engine/types';

export function CampaignView() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const party = useGame((s) => s.party);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const inventory = useGame((s) => s.inventory);
  const money = useGame((s) => s.money);
  const setScreen = useGame((s) => s.setScreen);

  return (
    <div className="screen campaign-view">
      <aside className="hud-left">
        <button className="btn small" onClick={() => setScreen('party')}>
          ← Quitter
        </button>
        <h3>{scene?.nom}</h3>
        <div className="party-hud">
          {party.map((h) => (
            <PartyHudCard key={h.id} hero={battleVersion(battle?.combatants, h) ?? h} />
          ))}
        </div>
        <div className="purse">
          <span className="mini-title">Bourse</span>
          <span className="coins">
            <b className="co">{money.gold}</b> CO · <b className="sc">{money.silver}</b> SC · <b className="pa">{money.brass}</b> PA
          </span>
        </div>
        <div className="inventory">
          <div className="mini-title">Inventaire ({inventory.length})</div>
          <div className="inv-list">
            {inventory.length === 0 && <p className="empty">— vide —</p>}
            {inventory.map((it, i) => (
              <span className="inv-item" key={i}>
                {it}
              </span>
            ))}
          </div>
        </div>
        <div className="journal">
          <div className="mini-title">Journal</div>
          <div className="journal-lines">
            {journal.slice(-12).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        </div>
      </aside>

      <main className="stage">
        <IsoStage />
        {mode === 'exploration' && !dialogue && (
          <div className="stage-hint">Cliquez sur une case pour vous déplacer · sur un personnage/objet pour interagir</div>
        )}
        {dialogue && <DialogueBox />}
      </main>

      {mode === 'battle' && battle && <BattlePanel />}
      <TestModal />
      <DocumentModal />
    </div>
  );
}

function battleVersion(combatants: Combatant[] | undefined, h: Combatant): Combatant | null {
  return combatants?.find((c) => c.id === h.id) ?? null;
}

function PartyHudCard({ hero }: { hero: Combatant }) {
  const ratio = hero.wounds.max > 0 ? hero.wounds.current / hero.wounds.max : 0;
  const down = hero.wounds.current <= 0;
  return (
    <div className={`party-hud-card ${down ? 'down' : ''}`}>
      <div className="phc-top">
        <strong>{hero.name}</strong>
        <span>
          {hero.wounds.current}/{hero.wounds.max}
        </span>
      </div>
      <div className="hp-bar">
        <div className="hp-fill" style={{ width: `${Math.max(0, ratio) * 100}%` }} />
      </div>
      <div className="phc-sub">
        {hero.career} {hero.advantage > 0 && <span className="adv">Av +{hero.advantage}</span>}
        {hero.conditions.map((c) => (
          <span className="cond" key={c.name}>
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}
