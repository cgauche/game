import { useState, useEffect, useRef } from 'react';
import { useGame } from '../state/store';
import { ownsLocal } from './ownership';
import { harvestProfileFor } from '../engine/harvest';
import { Coins } from './Coins';
import { TeamPortrait } from './TeamPortrait';
import { GearAssignList } from './GearAssignList';
import { RuleDivider } from './Ornaments';
import { Icon } from './Icon';
import { useModalA11y } from './Modal';

/** Beat de lisibilité avant l'écran plein écran : on laisse voir le COUP FATAL et la chute du dernier
 *  ennemi (le champ de bataille reste rendu sous l'overlay) avant de recouvrir la scène — sinon la victoire
 *  « avale » la mort dès le 0 PB (retour playtest 2026-06-27 : « le combat s'est fini si vite que je n'ai pas
 *  vu l'adversaire tomber »). ~Une seconde, calé sur le beat `postAttack` du Réalisateur (tempo.ts). */
const VICTORY_REVEAL_MS = 950;

/**
 * Écran de VICTOIRE plein écran (demande utilisateur) : récapitulatif de fin de combat — XP gagnée, or
 * récupéré, ennemis vaincus, et butin d'ÉQUIPEMENT assignable à un héros (`assignVictoryGear` applique
 * le `giveTrapping` de la rencontre sur le portrait choisi, qualités préservées).
 * « Continuer » revient à l'exploration. Ne s'affiche que sur `battle.over === 'victory'`.
 * COOP : écran SYNCHRONISÉ — chacun n'attribue le butin qu'à SES héros ; « Continuer » = ✓ de son
 * siège (portraits + ✓), l'hôte ferme à l'unanimité (spec §4bis).
 */
export function VictoryScreen() {
  const battle = useGame((s) => s.battle);
  const pv = useGame((s) => s.pendingVictory);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const assignGear = useGame((s) => s.assignVictoryGear);
  const harvest = useGame((s) => s.harvestCreature);
  const appraiseGear = useGame((s) => s.appraiseGear);
  const dismiss = useGame((s) => s.dismissVictory);
  const victoryReady = useGame((s) => s.victoryReady);
  const state = useGame();
  // Tenue du coup fatal : on diffère l'apparition de l'écran d'un beat après `over:'victory'` (la scène, avec
  // l'ennemi à terre, reste visible dessous). Les hooks restent AVANT tout early-return (règles des Hooks).
  const overVictory = battle?.over === 'victory';
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!overVictory) { setRevealed(false); return; }
    const id = setTimeout(() => setRevealed(true), VICTORY_REVEAL_MS);
    return () => clearTimeout(id);
  }, [overVictory]);
  const online = net.mode !== 'local';
  const ready = pv?.readyBySeat ?? {};
  // Échap = MÊME action que [Continuer] (jamais une fermeture qui perdrait le butin non attribué) :
  // en coop, seulement tant que ce siège n'a pas déjà validé (bouton alors désactivé, Échap inerte).
  const boxRef = useRef<HTMLDivElement>(null);
  const continueAction = online ? (ready[net.mySeat] ? undefined : () => victoryReady(net.mySeat)) : dismiss;
  useModalA11y(boxRef, continueAction);
  if (!battle || battle.over !== 'victory' || !revealed) return null;
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const assignable = party.filter((h) => ownsLocal(state, h.id)); // solo : tous (#1262)

  const xp = pv?.xp ?? 0;
  const gold = pv?.gold ?? { gold: 0, silver: 0, brass: 0 };
  const gear = pv?.gear ?? [];
  const defeated = pv?.defeated ?? [];
  // #377 : un compteur à ZÉRO ne s'affiche jamais nu — masqué, et si le récapitulatif entier tombe à
  // rien (pas de PX, pas d'or), une ligne narrative sobre le remplace plutôt qu'une rangée vide.
  const hasXp = xp > 0;
  const hasGold = (gold.gold ?? 0) > 0 || (gold.silver ?? 0) > 0 || (gold.brass ?? 0) > 0;
  const hasRewards = hasXp || hasGold;

  return (
    <div className="victory-overlay">
      <div ref={boxRef} role="dialog" aria-modal="true" aria-label="Victoire" className="victory-screen">
        <h1 className="victory-title">Victoire</h1>
        <RuleDivider />

        {/* #9 : messages de journal de la victoire (ex. annonce de l'arène) affichés ICI. */}
        {(pv?.messages?.length ?? 0) > 0 && (
          <div className="victory-messages">
            {pv!.messages!.map((m, i) => <p key={i} className="victory-msg">{m}</p>)}
          </div>
        )}

        {hasRewards ? (
          <div className="victory-rewards">
            {hasXp && (
              <div className="victory-stat"><span className="vs-ico"><Icon id="action/cast" size="sm" /></span> <b>{xp}</b> <span className="vs-unit">PX</span></div>
            )}
            {hasGold && (
              <div className="victory-stat"><span className="vs-ico"><Icon id="resource/gold-purse" size="sm" /></span> <Coins money={gold} /></div>
            )}
          </div>
        ) : (
          <p className="victory-msg victory-msg-empty">Ni or ni gloire sonnante sur ces adversaires — le groupe repart les mains vides, mais entier.</p>
        )}

        {/* Équipement EN AVANT (#377) : la section « qui l'emporte ? » se joue AVANT le récapitulatif
            des vaincus — c'est elle qui donne quelque chose à TOUCHER, jamais reléguée en bas d'écran. */}
        {gear.length > 0 && (
          <div className="victory-section victory-section-gear">
            <h3><Icon id="resource/gold-purse" size="sm" /> Équipement — qui l'emporte&nbsp;?</h3>
            <GearAssignList
              gear={gear}
              assignable={assignable}
              onAssign={assignGear}
              onAppraise={net.mode === 'guest' ? undefined : (i, mode) => appraiseGear('victory', i, mode)}
            />
          </div>
        )}

        {defeated.length > 0 && (
          <div className="victory-section">
            <h3>Ennemis vaincus</h3>
            <div className="victory-defeated">
              {defeated.map((d) => {
                const canHarvest = !!harvestProfileFor(d.creatureId) && net.mode !== 'guest';
                const done = (pv?.harvested ?? []).includes(d.creatureId ?? '');
                return (
                  <span key={d.label} className="victory-foe">
                    {d.label}{d.count > 1 ? ` ×${d.count}` : ''}
                    {canHarvest && (
                      <button
                        className="btn btn-ghost victory-harvest"
                        disabled={done}
                        onClick={() => harvest(d.creatureId!)}
                        title="Récolter les pièces de monstre (Test de Savoir (Bêtes))"
                      >
                        {done ? '✓ récolté' : <><Icon id="medical/scalpel" size="sm" /> Récolter</>}
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {online ? (
          <>
            <div className="ready-row">
              {seats.map(({ seat, name }) => {
                const h = party.find((x) => !x.dead && (net.ownership[x.id] ?? 0) === seat);
                return (
                  <span key={seat} className={`ready-chip${ready[seat] ? ' ok' : ''}`} title={name}>
                    {h ? <TeamPortrait combatant={h} size={28} /> : <span className="ready-noportrait"><Icon id="nav/seat-owner" size="sm" /></span>}
                    {ready[seat] ? '✓' : '…'}
                  </span>
                );
              })}
            </div>
            <button className="btn btn-primary victory-continue" disabled={!!ready[net.mySeat]} onClick={() => victoryReady(net.mySeat)}>
              {ready[net.mySeat] ? <><Icon id="ui/wait" size="sm" /> En attente des autres…</> : 'Continuer'}
            </button>
          </>
        ) : (
          <button className="btn btn-primary victory-continue" onClick={dismiss}>Continuer</button>
        )}
      </div>
    </div>
  );
}
