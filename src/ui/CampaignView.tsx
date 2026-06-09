import { useState } from 'react';
import { useGame } from '../state/store';
import { formatImperial, toDate, dayPhase } from '../engine/clock';
import { IsoStage } from '../gameIso/IsoStage';
import { ViewControls } from './ViewControls';
import { DialogueBox } from './DialogueBox';
import { MerchantPanel } from './MerchantPanel';
import { formatMoney } from '../engine/money';
import { BattlePanel } from './BattlePanel';
import { ActionBar } from './ActionBar';
import { CombatBanner } from './CombatBanner';
import { ActiveModal } from './ActiveModal'; // arbitre R2 : une seule modale de combat à la fois
import { LegendPanel } from './LegendPanel';
import { VictoryScreen } from './VictoryScreen';
import { BargainModal } from './BargainModal';
import { AppraiseModal } from './AppraiseModal';
import { DocumentModal } from './DocumentModal';
import { CharacterSheet } from './CharacterSheet';
import { GroupPanel } from './GroupPanel';
import { InspectPanel } from './InspectPanel';

export function CampaignView() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const inventory = useGame((s) => s.inventory);
  const money = useGame((s) => s.money);
  const merchant = useGame((s) => s.merchant);
  const establishing = useGame((s) => s.establishing); // plan d'ensemble d'ouverture (R2)
  const inspectEnabled = useGame((s) => s.inspectEnabled); // option de jeu : inspection des combattants
  const gameTime = useGame((s) => s.gameTime);
  const setScreen = useGame((s) => s.setScreen);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  const rotateCam = useGame((s) => s.rotateCam);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const clockDate = toDate(gameTime);
  const phase = dayPhase(gameTime);
  const inspected = inspectEnabled && inspectId ? battle?.combatants.find((c) => c.id === inspectId) ?? null : null;

  return (
    <div className="screen campaign-view">
      <aside className="hud-left">
        <button className="btn small" onClick={() => setScreen('party')}>
          ← Quitter
        </button>
        <h3>{scene?.nom}</h3>
        {/* Groupe détaillé (PB + équipement + effets) — affiché EN COMBAT comme HORS COMBAT. */}
        <GroupPanel onOpen={setSheetId} />
        {mode !== 'battle' && (
          <>
            <div className="purse">
              <span className="mini-title">Bourse</span>
              <span className="coins">
                {formatMoney(money)}
              </span>
            </div>
            <div className="game-clock" title={`${phase.label} — Calendrier Impérial`}>
              {phase.icon} {clockDate.weekday ? `${clockDate.weekday} · ` : ''}{formatImperial(gameTime)}
            </div>
            {/* Pas de bouton « Dormir » global : le repos est une OPTION DE CONTENU (choix de dialogue avec
                coût éventuel, ex. l'auberge — Effet `rest`), jamais une action gratuite imposée par le HUD. */}
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
          </>
        )}
      </aside>

      <main className="stage">
        <IsoStage />
        {mode === 'battle' && battle && <CombatBanner />}
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
        {/* Plan d'ensemble (R2) : bandeau d'ouverture pendant que le champ est montré, avant toute modale. */}
        {establishing && <div className="combat-banner">⚔️ Le combat commence !</div>}
        {merchant && <MerchantPanel />}
        {/* Barre d'action + portrait du héros actif EN BAS (cf. ActionBar). */}
        {mode === 'battle' && battle && <ActionBar />}
      </main>

      {mode === 'battle' && battle && <BattlePanel onInspect={inspectEnabled ? setInspectId : undefined} />}
      {mode === 'battle' && battle && <LegendPanel />}
      <VictoryScreen />{/* écran de fin de combat plein écran (se gate sur battle.over==='victory') */}
      {/* Arbitre R2 : UNE seule modale de combat à la fois, par priorité (cf. ActiveModal). */}
      <ActiveModal />
      {/* Modales HORS combat (contexte exclusif) : restent montées indépendamment. */}
      <BargainModal />
      <AppraiseModal />
      <DocumentModal />
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
      {inspected && <InspectPanel combatant={inspected} onClose={() => setInspectId(null)} />}
    </div>
  );
}
