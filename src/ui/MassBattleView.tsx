import { useState } from 'react';
import { useGame } from '../state/store';
import { Prose } from './Prose';
import { BattleTestModal } from './BattleTestModal';
import { massBattleScenes, type MassBattleState, type MassBattleArmy } from '../state/massBattleFlow';
import { BATTLE_HAZARDS, inspireDifficulty, type BattleSceneDef } from '../engine/massBattle';
import { DIFFICULTY_LABELS } from '../engine/types';

/**
 * Écran de Combat de masse / Puissance de Bataille (ADE II 08). État des deux armées (Puissance
 * courante vs départ), phase de bataille, Discours inspirant pré-bataille, Scènes cinématiques du
 * Round choisies par les PJ, aléa environnemental, Test spectaculaire de Puissance, issue. Responsive.
 */
export function MassBattleView() {
  const mb = useGame((s) => s.massBattle);
  if (!mb) return null;
  return (
    <div className="menu mass-battle">
      <div className="menu-card mb-card">
        <h1 className="title">Bataille de masse</h1>
        <p className="subtitle">
          {mb.phase === 'over'
            ? 'La bataille est terminée.'
            : `Round de bataille ${mb.round} / ${mb.plannedRounds}`}
        </p>
        <div className="rule-fleur" aria-hidden>⚜</div>
        <ArmyBars mb={mb} />
        {mb.phase === 'inspire' && <PreBattle mb={mb} />}
        {mb.phase === 'round' && <RoundPanel mb={mb} />}
        {mb.phase === 'over' && <OverPanel mb={mb} />}
        <BattleLog log={mb.log} />
      </div>
      <BattleTestModal />
    </div>
  );
}

function ArmyBars({ mb }: { mb: MassBattleState }) {
  return (
    <div className="mb-armies panel-grid">
      <ArmyBar army={mb.ally} side="ally" />
      <ArmyBar army={mb.enemy} side="enemy" />
    </div>
  );
}

function ArmyBar({ army, side }: { army: MassBattleArmy; side: 'ally' | 'enemy' }) {
  return (
    <div className={`mb-army mb-${side} panel`}>
      <div className="mb-army-head">
        <strong>{army.name}</strong>
        <span className="mb-might">{army.might}</span>
      </div>
      <div className="mb-meter">
        <div className="mb-meter-fill" style={{ width: `${army.might}%` }} />
      </div>
      <div className="mb-army-sub">Puissance de départ {army.startMight}</div>
    </div>
  );
}

function PreBattle({ mb }: { mb: MassBattleState }) {
  const inspire = useGame((s) => s.massBattleInspire);
  const begin = useGame((s) => s.massBattleBegin);
  const diff = inspireDifficulty(mb.ally.might, mb.enemy.might);
  return (
    <section className="panel mb-phase">
      <h3>Avant la bataille</h3>
      <p className="mb-detail">
        Un Personnage peut galvaniser les troupes avant l'affrontement (Discours inspirant). Difficulté
        déterminée par l'écart de Puissance : <b>{DIFFICULTY_LABELS[diff]}</b>. En cas de succès :
        +10 au Test de Puissance du premier Round.
      </p>
      {mb.allyMod !== 0 && (
        <p className="mb-detail">Planification : <b>{mb.allyMod > 0 ? '+' : ''}{mb.allyMod}</b> à tous les Tests de Puissance alliés.</p>
      )}
      {mb.firstRoundBonus > 0 && (
        <p className="mb-detail mb-good">Discours réussi : +{mb.firstRoundBonus} au premier Round.</p>
      )}
      <div className="bar mb-actions">
        <button className="btn small" disabled={!!mb.inspired} onClick={inspire}>
          {mb.inspired ? 'Discours prononcé' : 'Discours inspirant (Commandement)'}
        </button>
        <button className="btn btn-primary" onClick={begin}>Engager la bataille</button>
      </div>
    </section>
  );
}

/** Aperçu chiffré de l'effet d'une Scène (delta de Puissance). */
function sceneEffectLabel(scene: BattleSceneDef): string {
  const { side, scale, amount } = scene.effect;
  const who = side === 'ally' ? 'Puissance alliée' : 'Puissance ennemie';
  const sign = amount >= 0 ? '+' : '';
  if (scale === 'perDR') return `${who} ${sign}${amount} par DR`;
  if (scale === 'perKill') return `${who} ${sign}${amount} par ennemi vaincu`;
  return `${who} ${sign}${amount}`;
}

function RoundPanel({ mb }: { mb: MassBattleState }) {
  const chooseScene = useGame((s) => s.massBattleScene);
  const rollHazard = useGame((s) => s.massBattleHazard);
  const clash = useGame((s) => s.massBattleClash);
  const scenes = massBattleScenes(mb);
  const [openScene, setOpenScene] = useState<string | null>(null);
  const allyBonus = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  return (
    <section className="panel mb-phase">
      {mb.terrain && (
        <div className="mb-terrain">
          <h3>Configuration du terrain</h3>
          <Prose md={mb.terrain} />
        </div>
      )}
      {mb.lastClash && (
        <p className="mb-detail mb-clash">
          Round précédent : les Personnages réduisent l'ennemi de {mb.lastClash.enemyLoss}, l'ennemi
          réduit les Personnages de {mb.lastClash.allyLoss}.
        </p>
      )}

      <h3>Scènes cinématiques</h3>
      {mb.sceneResolved ? (
        <p className="mb-detail mb-good">
          Scène résolue ce Round{mb.sceneDelta ? ` : ${mb.sceneDelta.label} — Puissance ${mb.sceneDelta.side === 'ally' ? 'alliée' : 'ennemie'} ${mb.sceneDelta.amount >= 0 ? '+' : ''}${mb.sceneDelta.amount}.` : '.'}
        </p>
      ) : (
        <div className="mb-scenes">
          {scenes.map((sc) => (
            <div key={sc.id} className="mb-scene">
              <div className="bar mb-scene-head">
                <button
                  className="btn small btn-primary"
                  onClick={() => chooseScene(sc.id)}
                  title={sc.kind === 'combat' ? 'Combat tactique — la victoire réduit la Puissance ennemie' : 'Test de Compétence'}
                >
                  {sc.label}
                </button>
                <span className="mb-scene-kind">{sc.kind === 'combat' ? 'Combat' : 'Compétence'}</span>
                <span className="mb-scene-eff">{sceneEffectLabel(sc)}</span>
                <button className="btn small ghost" onClick={() => setOpenScene(openScene === sc.id ? null : sc.id)}>
                  {openScene === sc.id ? 'Masquer' : 'Détails'}
                </button>
              </div>
              {openScene === sc.id && <div className="mb-scene-desc"><Prose md={sc.desc} /></div>}
            </div>
          ))}
        </div>
      )}

      <h3>Aléa de bataille</h3>
      {mb.hazard ? (
        <div className="mb-hazard">
          <strong>{mb.hazard.label}.</strong> <span className="mb-detail">{mb.hazard.text}</span>
        </div>
      ) : (
        <div className="bar mb-actions">
          <button className="btn small" onClick={() => rollHazard()}>Tirer un facteur (1d10)</button>
          <select
            className="mb-select"
            defaultValue=""
            aria-label="Choisir un facteur environnemental"
            onChange={(e) => { if (e.target.value) rollHazard(Number(e.target.value)); }}
          >
            <option value="">Choisir un facteur…</option>
            {BATTLE_HAZARDS.map((h) => <option key={h.min} value={h.min}>{h.label}</option>)}
          </select>
        </div>
      )}

      <div className="bar mb-actions mb-clash-actions">
        <button className="btn btn-primary" onClick={clash} title="Résoudre l'affrontement des deux armées (Test spectaculaire de Puissance)">
          Test spectaculaire de Puissance
        </button>
        {allyBonus !== 0 && <span className="mb-detail">Bonus allié ce Round : {allyBonus > 0 ? '+' : ''}{allyBonus}</span>}
      </div>
    </section>
  );
}

function OverPanel({ mb }: { mb: MassBattleState }) {
  const end = useGame((s) => s.endMassBattle);
  const outcomeText = mb.outcome === 'ally'
    ? `${mb.ally.name} l'emporte !`
    : mb.outcome === 'enemy'
      ? `${mb.enemy.name} l'emporte.`
      : 'Aucun vainqueur clair.';
  return (
    <section className="panel mb-phase">
      <h3>Issue de la bataille</h3>
      <p className="mb-outcome">{outcomeText}</p>
      <p className="mb-detail">
        Puissance finale — {mb.ally.name} : <b>{mb.ally.might}</b> · {mb.enemy.name} : <b>{mb.enemy.might}</b>.
        L'armée vaincue doit fuir sous peine d'être détruite.
      </p>
      <div className="bar mb-actions">
        <button className="btn btn-primary" onClick={end}>Terminer</button>
      </div>
    </section>
  );
}

function BattleLog({ log }: { log: string[] }) {
  if (!log.length) return null;
  return (
    <section className="panel mb-log">
      <h3>Déroulé</h3>
      <ul className="mb-log-list">
        {log.slice(-12).map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </section>
  );
}
