import { useState } from 'react';
import { useGame } from '../state/store';
import { Prose } from './Prose';
import { RuleDivider } from './Ornaments';
import { ActiveModal } from './ActiveModal';
import { StationSheet } from './StationSheet';
import { AssignRow } from './AssignRow';
import { battleScenesToStations, type Station } from '../state/stations';
import {
  massBattleThreatPenalty, battleActivitiesAvailable, armyMight, armyStartMight,
  battleSceneById, battleActivityEffectLabel, battleSceneEffectLabel,
  type MassBattleState, type MassBattleArmy,
} from '../state/massBattleFlow';
import { BATTLE_HAZARDS, inspireDifficulty } from '../engine/massBattle';
import type { ActivityDef } from '../engine/activities';
import { DIFFICULTY_LABELS, type Combatant } from '../engine/types';

/**
 * Écran de Combat de masse / Puissance de Bataille (ADE II 08). État des deux armées (Puissance
 * courante vs départ), phase de bataille, Activités pré-combat (Discours + Planification/Sabotage…),
 * SITUATION du Round (sous-ensemble de Scènes du moment + menaces imposées), Scènes cinématiques
 * MULTI-PJ (résolues en Soutien, ADE II ch.8 l.116-118), aléa environnemental, Test spectaculaire,
 * Rassemblement, issue. Responsive.
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
            : mb.phase === 'prep'
              ? 'Préparatifs — Activités de bataille'
              : `Round de bataille ${mb.round} / ${mb.plannedRounds}`}
        </p>
        <RuleDivider />
        <ArmyBars mb={mb} />
        {mb.phase === 'prep' && <PreBattle mb={mb} />}
        {mb.phase === 'round' && <RoundPanel mb={mb} />}
        {mb.phase === 'over' && <OverPanel mb={mb} />}
        <BattleLog log={mb.log} />
      </div>
      {/* Jets de bataille = Activités : la modale unifiée (RollShell) est rendue par l'arbitre R2. */}
      <ActiveModal />
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
  const might = armyMight(army);
  return (
    <div className={`mb-army mb-${side} panel`}>
      <div className="mb-army-head">
        <strong>{army.name}</strong>
        <span className="mb-might">{might}</span>
      </div>
      <div className="mb-meter">
        <div className="mb-meter-fill" style={{ width: `${might}%` }} />
      </div>
      <div className="mb-army-sub">Puissance de départ {armyStartMight(army)}</div>
    </div>
  );
}

function PreBattle({ mb }: { mb: MassBattleState }) {
  const inspire = useGame((s) => s.massBattleInspire);
  const activity = useGame((s) => s.massBattleActivity);
  const begin = useGame((s) => s.massBattleBegin);
  const setHero = useGame((s) => s.setMassBattleHero);
  const party = useGame((s) => s.party);
  const interlude = useGame((s) => s.interlude);
  const living = party.filter((h) => !h.dead);
  const diff = inspireDifficulty(armyMight(mb.ally), armyMight(mb.enemy));
  const activities = battleActivitiesAvailable(mb);
  // BUDGET UNIQUE (ADE II ch.8 l.65 / LDB 23 l.6) : la prépa de bataille EST une Activité d'interlude.
  // Sans interlude ouvert → aucune Activité de préparation possible (Round 1 direct, sans bonus).
  const budget = interlude ? living.reduce((n, h) => n + (interlude.perHero[h.id]?.left ?? 0), 0) : 0;
  const full = budget <= 0;
  const [openAct, setOpenAct] = useState<string | null>(null);
  // Le posté d'une action pré-combat SOLO (Discours l.71 / la plupart des Activités « un Personnage »),
  // résolu en héros vivant : premier id de la liste d'affectation.
  const postedOf = (id: string): Combatant[] => {
    const h = living.find((x) => x.id === mb.assignment[id]?.[0]);
    return h ? [h] : [];
  };
  // Équipage COMPLET posté à une action SOUTENABLE (Planification l.81, plusieurs PJ), résolu en héros
  // vivants dans l'ordre d'affectation (miroir UI-side de `assignedHeroesFor`, sans filtre `actedHeroes` :
  // en pré-bataille aucun PJ n'a encore « agi »).
  const crewOf = (id: string): Combatant[] =>
    (mb.assignment[id] ?? []).map((hid) => living.find((x) => x.id === hid)).filter((h): h is Combatant => !!h);
  return (
    <section className="panel mb-phase">
      <h3>Avant la bataille</h3>
      <p className="mb-detail">
        Les Activités de bataille (Discours, Planification, Repérage, Sabotage…) puisent dans le budget
        d'Activités <em>Entre deux aventures</em> (max 3, ADE II ch.8). {interlude
          ? <>Activités d'interlude restantes : <b>{budget}</b>.</>
          : <><b>Aucun interlude ouvert</b> — la bataille démarrera au Round 1 sans préparation.</>}
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
      <div className="mb-scenes">
        <div className="mb-scene">
          <div className="bar mb-scene-head">
            <span className="mb-scene-kind">Discours inspirant</span>
            <span className="mb-scene-eff">Commandement — {DIFFICULTY_LABELS[diff]}</span>
          </div>
          <AssignRow
            assigned={postedOf('inspire')}
            candidates={living}
            onAssign={(id) => setHero('inspire', [id])}
            onRemove={() => setHero('inspire', [])}
            max={1}
            verb="prononce le Discours"
            canPick={!full}
          />
          <div className="bar mb-actions">
            <button className="btn small btn-primary" disabled={!!mb.inspired || full} onClick={inspire}>
              {mb.inspired ? 'Discours prononcé' : 'Prononcer'}
            </button>
          </div>
        </div>
        {activities.map((a) => (
          <div key={a.id} className="mb-scene">
            <div className="bar mb-scene-head">
              <span className="mb-scene-kind">{a.label}</span>
              <span className="mb-scene-eff">{battleActivityEffectLabel(a)}</span>
              <button className="btn small ghost" onClick={() => setOpenAct(openAct === a.id ? null : a.id)}>
                {openAct === a.id ? 'Masquer' : 'Détails'}
              </button>
            </div>
            {openAct === a.id && a.desc && <div className="mb-scene-desc"><Prose md={a.desc} /></div>}
            <AssignRow
              assigned={a.assisted ? crewOf(a.id) : postedOf(a.id)}
              candidates={living}
              // Soutenable (Planification l.81) : le picker AJOUTE un assistant ; sinon il REMPLACE le posté SOLO.
              onAssign={(id) => setHero(a.id, a.assisted ? [...(mb.assignment[a.id] ?? []), id] : [id])}
              onRemove={(id) => setHero(a.id, a.assisted ? (mb.assignment[a.id] ?? []).filter((x) => x !== id) : [])}
              max={a.assisted ? Infinity : 1}
              verb={`réalise « ${a.label} »`}
              canPick={!full}
            />
            <div className="bar mb-actions">
              <button className="btn small btn-primary" disabled={full} onClick={() => activity(a.id)}>Réaliser</button>
            </div>
          </div>
        ))}
      </div>
      <div className="bar mb-actions">
        {interlude && <BackToInterlude />}
        <button className="btn btn-primary" onClick={begin}>Engager la bataille</button>
      </div>
    </section>
  );
}

/** Retour à l'écran d'interlude (coexistence prépa ⇄ interlude, ADE II ch.8) : la préparation puise
 *  dans le budget d'Activités d'interlude — on peut faire l'aller-retour tant que la bataille n'est pas
 *  engagée. */
function BackToInterlude() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <button className="btn small" onClick={() => setScreen('interlude')}>Retour à l'interlude</button>
  );
}

function RoundPanel({ mb }: { mb: MassBattleState }) {
  const rollHazard = useGame((s) => s.massBattleHazard);
  const clash = useGame((s) => s.massBattleClash);
  const rally = useGame((s) => s.massBattleRally);
  const advance = useGame((s) => s.massBattleAdvance);
  const scene = useGame((s) => s.scene);
  const party = useGame((s) => s.party);
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(undefined);
  const allyBonus = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const threatPen = massBattleThreatPenalty(mb);
  // Stations = les Scènes de la situation posées sur le plan (ancres authorées + affectation E3).
  const battleStations = battleScenesToStations(mb.situation, mb.assignment, scene);
  const woundedRally = mb.awaitingNext
    && party.some((h) => !h.dead && !mb.ralliedHeroes.includes(h.id) && h.wounds.current < h.wounds.max);
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

      <StationSheet
        scene={scene}
        stations={battleStations}
        selectedStationId={selectedStationId}
        onSelectStation={(s) => setSelectedStationId(s.id)}
        detailTitle="Scènes du moment"
        renderDetail={(s) => <SceneStationDetail mb={mb} station={s} />}
      />
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

/**
 * Détail d'une Station de Scène (colonne droite du `StationSheet`) : genre, effet chiffré, état de tenue,
 * description VERBATIM, puis résolution. La CARDINALITÉ suit le RAW : une Scène de combat/menace engage
 * TOUT le groupe (pas d'affectation par PJ) ; une Scène de Compétence/Tenue est MULTI-PJ (ADE II ch.8
 * l.116-118 : « les Personnages peuvent choisir de participer à l'une des Scènes ») → `AssignRow`
 * (max Infinity) : le joueur affecte N PJ, résolus en SOUTIEN (l.153/157). La désactivation du Résoudre
 * reste IDENTIQUE à l'ancienne liste plate (résolue / Round figé / plus de PJ pour un Test·Tenue / rompue).
 */
function SceneStationDetail({ mb, station }: { mb: MassBattleState; station: Station }) {
  const chooseScene = useGame((s) => s.massBattleScene);
  const setHero = useGame((s) => s.setMassBattleHero);
  const party = useGame((s) => s.party);
  if (station.ref.kind !== 'battleScene') return null;
  const sceneId = station.ref.sceneId;
  const sc = battleSceneById(sceneId);
  if (!sc) return null;
  const resolved = mb.resolvedScenes.includes(sceneId);
  const kindLabel = sc.sceneKind === 'combat' ? 'Combat' : sc.sceneKind === 'threat' ? 'Menace' : sc.sceneKind === 'hold' ? 'Tenue' : 'Compétence';
  const hold = mb.sceneState[sceneId];
  const living = party.filter((h) => !h.dead);
  // PJ encore libres ce Round.
  const available = living.filter((h) => !mb.actedHeroes.includes(h.id));
  const remaining = available.length;
  // Équipage POSTÉ à cette Scène (Scène MULTI-PJ) — ids résolus en héros vivants, ordre préservé.
  const postedIds = mb.assignment[sceneId] ?? [];
  const posted = postedIds.map((id) => living.find((h) => h.id === id)).filter((h): h is Combatant => !!h);
  // Un combat (Scène 'combat'/'threat', incl. le Duel) engage tout le groupe → PAS de garde « plus de PJ libre ».
  const isCombat = sc.sceneKind === 'combat' || sc.sceneKind === 'threat';
  const disabled = resolved || mb.awaitingNext
    || (!isCombat && remaining === 0)
    || (sc.sceneKind === 'hold' && !!hold?.broken);
  return (
    <div className={`mb-scene${resolved ? ' mb-scene-done' : ''}`}>
      <div className="bar mb-scene-head">
        <span className="mb-scene-kind">{resolved ? 'Résolue' : kindLabel}</span>
        <span className="mb-scene-eff">{battleSceneEffectLabel(sc)}</span>
        {sc.sceneKind === 'hold' && sc.hold && (
          <span className="mb-scene-kind">
            {hold?.broken ? 'Position perdue' : `Point de rupture ${hold?.breakpoint ?? 0}/${sc.hold.breakpoint}`}
          </span>
        )}
      </div>
      {sc.desc && <div className="mb-scene-desc"><Prose md={sc.desc} /></div>}
      {isCombat ? (
        <p className="mb-detail">Tout le groupe engage le combat.</p>
      ) : (
        // Scène MULTI-PJ (l.116-118) : le joueur affecte N PJ (résolus en Soutien) — ajout/retrait sur la liste.
        <AssignRow
          assigned={posted}
          candidates={available}
          onAssign={(id) => setHero(sceneId, [...postedIds, id])}
          onRemove={(id) => setHero(sceneId, postedIds.filter((x) => x !== id))}
          max={Infinity}
          verb="rejoint cette Scène"
          canPick={!resolved && !mb.awaitingNext}
        />
      )}
      <div className="bar mb-actions">
        <button
          className="btn small btn-primary"
          disabled={disabled}
          onClick={() => chooseScene(sceneId)}
          title={sc.sceneKind === 'test' ? 'Test de Compétence' : sc.sceneKind === 'hold' ? 'Test opposé — tenez la position (Point de rupture)' : 'Combat tactique — la victoire modifie la Puissance'}
        >
          {resolved ? 'Scène résolue' : isCombat ? 'Engager le combat' : 'Résoudre'}
        </button>
      </div>
    </div>
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
        Puissance finale — {mb.ally.name} : <b>{armyMight(mb.ally)}</b> · {mb.enemy.name} : <b>{armyMight(mb.enemy)}</b>.
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
