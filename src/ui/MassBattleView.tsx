import { useState } from 'react';
import { useGame } from '../state/store';
import { Prose } from './Prose';
import { RuleDivider } from './Ornaments';
import { BattleTestModal } from './BattleTestModal';
import {
  massBattleScenes, massBattleThreatPenalty, battleActivitiesAvailable, prepCount,
  type MassBattleState, type MassBattleArmy,
} from '../state/massBattleFlow';
import { BATTLE_HAZARDS, inspireDifficulty, type BattleSceneDef, type BattleActivityDef } from '../engine/massBattle';
import { DIFFICULTY_LABELS } from '../engine/types';

/**
 * Écran de Combat de masse / Puissance de Bataille (ADE II 08). État des deux armées (Puissance
 * courante vs départ), phase de bataille, Activités pré-combat (Discours + Planification/Sabotage…),
 * SITUATION du Round (sous-ensemble de Scènes du moment + menaces imposées), Scènes cinématiques (une
 * par PJ), aléa environnemental, Test spectaculaire, Rassemblement, issue. Responsive.
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
            : mb.phase === 'inspire'
              ? 'Préparatifs — Activités de bataille'
              : `Round de bataille ${mb.round} / ${mb.plannedRounds}`}
        </p>
        <RuleDivider />
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
  const activity = useGame((s) => s.massBattleActivity);
  const begin = useGame((s) => s.massBattleBegin);
  const diff = inspireDifficulty(mb.ally.might, mb.enemy.might);
  const activities = battleActivitiesAvailable(mb);
  const count = prepCount(mb);
  const full = count >= 3;
  const [openAct, setOpenAct] = useState<string | null>(null);
  return (
    <section className="panel mb-phase">
      <h3>Avant la bataille</h3>
      <p className="mb-detail">
        Jusqu'à 3 Activités de bataille peuvent influer sur l'affrontement (Discours, Planification,
        Repérage, Sabotage…). <b>{count} / 3</b> réalisée{count > 1 ? 's' : ''}.
      </p>
      {mb.allyMod !== 0 && (
        <p className="mb-detail">Modificateur permanent aux Tests de Puissance alliés : <b>{mb.allyMod > 0 ? '+' : ''}{mb.allyMod}</b>.</p>
      )}
      {mb.firstRoundBonus > 0 && (
        <p className="mb-detail mb-good">Discours réussi : +{mb.firstRoundBonus} au premier Round.</p>
      )}
      {(mb.planned || mb.scouted || mb.planningBonus > 0) && (
        <p className="mb-detail">
          {mb.scouted && <>Ennemi repéré (Puissance connue). </>}
          {mb.planned && <>Plan de bataille établi. </>}
          {mb.planningBonus > 0 && <>Bonus de Planification : +{mb.planningBonus}.</>}
        </p>
      )}
      <div className="bar mb-actions">
        <button className="btn small" disabled={!!mb.inspired || full} onClick={inspire}>
          {mb.inspired ? 'Discours prononcé' : `Discours inspirant (Commandement — ${DIFFICULTY_LABELS[diff]})`}
        </button>
      </div>
      <div className="mb-scenes">
        {activities.map((a) => (
          <div key={a.id} className="mb-scene">
            <div className="bar mb-scene-head">
              <button className="btn small btn-primary" disabled={full} onClick={() => activity(a.id)}>{a.label}</button>
              <span className="mb-scene-eff">{activityEffectLabel(a)}</span>
              <button className="btn small ghost" onClick={() => setOpenAct(openAct === a.id ? null : a.id)}>
                {openAct === a.id ? 'Masquer' : 'Détails'}
              </button>
            </div>
            {openAct === a.id && <div className="mb-scene-desc"><Prose md={a.desc} /></div>}
          </div>
        ))}
      </div>
      <div className="bar mb-actions">
        <button className="btn btn-primary" onClick={begin}>Engager la bataille</button>
      </div>
    </section>
  );
}

/** Aperçu chiffré des effets d'une Activité (Succès / Stupéfiant). */
function activityEffectLabel(a: BattleActivityDef): string {
  const fmt = (o: { target: string; amount: number }) => `${o.amount >= 0 ? '+' : ''}${o.amount} ${ACT_TARGET[o.target] ?? o.target}`;
  const base = a.onSuccess.map(fmt).join(', ');
  return a.onStunning ? `${base} (Stupéfiant : ${a.onStunning.map(fmt).join(', ')})` : base;
}
const ACT_TARGET: Record<string, string> = {
  allyTestMod: 'Tests alliés', allyMight: 'Puiss. alliée', enemyMight: 'Puiss. ennemie',
  firstRoundBonus: '1er Round', planningBonus: 'Planification',
};

/** Aperçu chiffré des effets d'une Scène (base + conditionnels). */
function sceneEffectLabel(scene: BattleSceneDef): string {
  if (!scene.effects.length) return scene.threat ? `Menace : ${scene.threat.penalty} aux autres Scènes` : 'Sans effet direct';
  const fmt = (e: { side: 'ally' | 'enemy'; scale: string; amount: number; when?: string }) => {
    const who = e.side === 'ally' ? 'Puiss. alliée' : 'Puiss. ennemie';
    const per = e.scale === 'perDR' ? '/DR' : e.scale === 'perHit' ? '/touche' : e.scale === 'perKill' ? '/vaincu' : '';
    const cond = e.when ? ` (si ${WHEN_LABEL[e.when] ?? e.when})` : '';
    return `${who} ${e.amount >= 0 ? '+' : ''}${e.amount}${per}${cond}`;
  };
  return scene.effects.map(fmt).join(' ; ');
}
const WHEN_LABEL: Record<string, string> = {
  generalDown: 'général tué', intervention: 'intervention', noIntervention: 'duel solo',
  stunningSuccess: 'Stupéfiant', stunningFailure: 'échec Stupéfiant', success: 'succès', failure: 'échec',
};

function RoundPanel({ mb }: { mb: MassBattleState }) {
  const chooseScene = useGame((s) => s.massBattleScene);
  const rollHazard = useGame((s) => s.massBattleHazard);
  const clash = useGame((s) => s.massBattleClash);
  const rally = useGame((s) => s.massBattleRally);
  const advance = useGame((s) => s.massBattleAdvance);
  const party = useGame((s) => s.party);
  const scenes = massBattleScenes(mb);
  const [openScene, setOpenScene] = useState<string | null>(null);
  const allyBonus = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const threatPen = massBattleThreatPenalty(mb);
  const livingHeroes = party.filter((h) => !h.dead);
  const remaining = livingHeroes.filter((h) => !mb.actedHeroes.includes(h.id)).length;
  const woundedRally = mb.awaitingNext && livingHeroes.some((h) => !mb.ralliedHeroes.includes(h.id) && h.wounds.current < h.wounds.max);
  return (
    <section className="panel mb-phase">
      {mb.terrain && (
        <div className="mb-terrain">
          <h3>Configuration du terrain</h3>
          <Prose md={mb.terrain} />
        </div>
      )}
      {threatPen !== 0 && (
        <p className="mb-detail mb-clash">
          Menace non vaincue : les Tests des autres Scènes subissent {threatPen} (vainquez-la pour la lever).
        </p>
      )}
      {mb.lastClash && (
        <p className="mb-detail mb-clash">
          Round précédent : les Personnages réduisent l'ennemi de {mb.lastClash.enemyLoss}, l'ennemi
          réduit les Personnages de {mb.lastClash.allyLoss}.
        </p>
      )}

      <h3>Scènes du moment {!mb.awaitingNext && <span className="mb-scene-kind">— {remaining} PJ disponible{remaining > 1 ? 's' : ''}</span>}</h3>
      <div className="mb-scenes">
        {scenes.map((sc) => {
          const resolved = mb.resolvedScenes.includes(sc.id);
          const kindLabel = sc.kind === 'combat' ? 'Combat' : sc.kind === 'threat' ? 'Menace' : sc.kind === 'hold' ? 'Tenue' : 'Compétence';
          return (
            <div key={sc.id} className={`mb-scene${resolved ? ' mb-scene-done' : ''}`}>
              <div className="bar mb-scene-head">
                <button
                  className="btn small btn-primary"
                  disabled={resolved || mb.awaitingNext || ((sc.kind === 'test' || sc.kind === 'hold') && remaining === 0) || (sc.kind === 'hold' && !!mb.sceneState[sc.id]?.broken)}
                  onClick={() => chooseScene(sc.id)}
                  title={sc.kind === 'test' ? 'Test de Compétence' : sc.kind === 'hold' ? 'Test opposé — tenez la position (Point de rupture)' : 'Combat tactique — la victoire modifie la Puissance'}
                >
                  {sc.label}
                </button>
                <span className="mb-scene-kind">{resolved ? 'Résolue' : kindLabel}</span>
                <span className="mb-scene-eff">{sceneEffectLabel(sc)}</span>
                {sc.kind === 'hold' && sc.hold && (
                  <span className="mb-scene-kind">
                    {mb.sceneState[sc.id]?.broken ? 'Position perdue' : `Point de rupture ${mb.sceneState[sc.id]?.breakpoint ?? 0}/${sc.hold.breakpoint}`}
                  </span>
                )}
                <button className="btn small ghost" onClick={() => setOpenScene(openScene === sc.id ? null : sc.id)}>
                  {openScene === sc.id ? 'Masquer' : 'Détails'}
                </button>
              </div>
              {openScene === sc.id && <div className="mb-scene-desc"><Prose md={sc.desc} /></div>}
            </div>
          );
        })}
      </div>
      {mb.sceneDeltas.length > 0 && (
        <p className="mb-detail mb-good">
          Ce Round : {mb.sceneDeltas.map((d) => `${d.label} (${d.side === 'ally' ? 'alliée' : 'ennemie'} ${d.amount >= 0 ? '+' : ''}${d.amount})`).join(', ')}.
        </p>
      )}

      <h3>Aléa de bataille</h3>
      {mb.hazard ? (
        <div className="mb-hazard">
          <strong>{mb.hazard.label}.</strong> <span className="mb-detail">{mb.hazard.text}</span>
        </div>
      ) : (
        <div className="bar mb-actions">
          <button className="btn small" disabled={mb.awaitingNext} onClick={() => rollHazard()}>Tirer un facteur (1d10)</button>
          <select
            className="mb-select"
            defaultValue=""
            disabled={mb.awaitingNext}
            aria-label="Choisir un facteur environnemental"
            onChange={(e) => { if (e.target.value) rollHazard(Number(e.target.value)); }}
          >
            <option value="">Choisir un facteur…</option>
            {BATTLE_HAZARDS.map((h) => <option key={h.min} value={h.min}>{h.label}</option>)}
          </select>
        </div>
      )}

      {mb.awaitingNext ? (
        <div className="bar mb-actions mb-clash-actions">
          {woundedRally && (
            <button className="btn small" onClick={rally} title="Test de Résistance de guérison (l.122)">Rassemblement (Résistance)</button>
          )}
          <button className="btn btn-primary" onClick={advance}>Round suivant</button>
        </div>
      ) : (
        <div className="bar mb-actions mb-clash-actions">
          <button className="btn btn-primary" onClick={clash} title="Résoudre l'affrontement des deux armées (Test spectaculaire de Puissance)">
            Test spectaculaire de Puissance
          </button>
          {allyBonus !== 0 && <span className="mb-detail">Bonus allié ce Round : {allyBonus > 0 ? '+' : ''}{allyBonus}</span>}
        </div>
      )}
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
