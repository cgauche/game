import { useState } from 'react';
import { useGame } from '../state/store';
import { IsoStage } from '../gameIso/IsoStage';
import { ViewControls } from './ViewControls';
import { DialogueBox } from './DialogueBox';
import { BattlePanel } from './BattlePanel';
import { ActionBar } from './ActionBar';
import { TestModal } from './TestModal';
import { RollModal } from './RollModal';
import { ReloadModal } from './ReloadModal';
import { DefenseModal } from './DefenseModal';
import { RoundStartModal } from './RoundStartModal';
import { FateSaveModal } from './FateSaveModal';
import { DisengageModal } from './DisengageModal';
import { CleaveModal } from './CleaveModal';
import { TrampleModal } from './TrampleModal';
import { CastModal } from './CastModal';
import { FumbleModal } from './FumbleModal';
import { RevealModal } from './RevealModal';
import { DocumentModal } from './DocumentModal';
import { CharacterSheet } from './CharacterSheet';
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
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  const rotateCam = useGame((s) => s.rotateCam);
  const [sheetId, setSheetId] = useState<string | null>(null);

  return (
    <div className="screen campaign-view">
      <aside className="hud-left">
        <button className="btn small" onClick={() => setScreen('party')}>
          ← Quitter
        </button>
        <h3>{scene?.nom}</h3>
        <div className="party-hud">
          {party.map((h) => (
            <PartyHudCard key={h.id} hero={battleVersion(battle?.combatants, h) ?? h} onOpen={() => setSheetId(h.id)} />
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
        <ViewControls
          zoom={zoom}
          onZoomIn={() => setZoom(zoom + 0.3)}
          onZoomOut={() => setZoom(zoom - 0.3)}
          onZoomReset={() => setZoom(1)}
          onRotateLeft={() => rotateCam(-1)}
          onRotateRight={() => rotateCam(1)}
        />
        {mode === 'exploration' && !dialogue && (
          <div className="stage-hint">Cliquez sur une case pour vous déplacer · sur un personnage/objet pour interagir</div>
        )}
        {dialogue && <DialogueBox />}
        {mode === 'battle' && battle && <ActionBar />}
      </main>

      {mode === 'battle' && battle && <BattlePanel />}
      <TestModal />
      <RollModal />
      <ReloadModal />
      <DefenseModal />
      <DisengageModal />
      <CleaveModal />
      <TrampleModal />
      <CastModal />
      <FumbleModal />
      <RevealModal />
      <RoundStartModal />
      <FateSaveModal />
      <DocumentModal />
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
    </div>
  );
}

function battleVersion(combatants: Combatant[] | undefined, h: Combatant): Combatant | null {
  return combatants?.find((c) => c.id === h.id) ?? null;
}

function PartyHudCard({ hero, onOpen }: { hero: Combatant; onOpen?: () => void }) {
  const ratio = hero.wounds.max > 0 ? hero.wounds.current / hero.wounds.max : 0;
  const down = hero.wounds.current <= 0;
  return (
    <div className={`party-hud-card clickable ${down ? 'down' : ''}`} onClick={onOpen} title="Voir la fiche / l'équipement">
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
