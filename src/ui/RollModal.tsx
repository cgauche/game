import { useState } from 'react';
import { useGame, movementRemaining } from '../state/store';
import { bus, EVT } from '../state/bus';
import { HitLocation, HIT_LOCATION_LABELS } from '../engine/types';
import { combatValue, crowdMod } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { firedWeapon, crowdEligible, previewAttack, previewDefense } from '../state/combatFlow';
import { attackModesFor } from '../engine/combatFeatures/dispatch';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { DeterminationButton } from './DeterminationButton';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * Modale d'attaque — modale de RÉFÉRENCE du panneau de jet unique (`RollPanel`) : l'avant-jet est
 * le même bloc que le résultat, pré-rempli. MA ligne montre mon score + mes bonus/malus ; la ligne
 * adverse ne montre QUE son portrait, sa compétence de défense probable et ses bonus/malus (pas de
 * valeur, pas de % de toucher, pas d'encaissé — LDB : le joueur ne connaît pas la cible adverse).
 *
 * La mêlée est un TEST OPPOSÉ : post-jet, les DEUX lignes sont remplies et la ligne GAGNANTE est
 * accentuée (badge « DR net »), l'issue tient en une ligne style journal.
 */
export function RollModal() {
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const setLocation = useGame((s) => s.attackSetLocation);
  const setWeapon = useGame((s) => s.attackSetWeapon);
  const setDualMode = useGame((s) => s.attackSetDualMode);
  const roll = useGame((s) => s.attackRoll);
  const reroll = useGame((s) => s.attackReroll);
  const bonusSL = useGame((s) => s.attackBonusSL);
  const darkPact = useGame((s) => s.attackDarkPact);
  const forceSuccess = useGame((s) => s.attackForceSuccess);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  const setIntoCrowd = useGame((s) => s.attackSetIntoCrowd);
  const setHeldGround = useGame((s) => s.attackSetHeldGround);
  const setCritLocation = useGame((s) => s.attackSetCritLocation);
  const setForcedRoll = useGame((s) => s.attackSetForcedRoll);
  const spendResolve = useGame((s) => s.spendResolveCondition);
  // « Frisson » du lancer (R3) : beat de roulement PUREMENT cosmétique (état UI-local, RNG seedé intact —
  // le jet réel n'a lieu qu'à la fin du beat). Honore prefers-reduced-motion.
  const [rolling, setRolling] = useState(false);
  if (!pa || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
  const target = battle.combatants.find((c) => c.id === pa.targetId);
  if (!attacker || !target) return null;
  const weapon = firedWeapon(attacker, target, pa.weaponUid); // arme choisie (ou auto, mêlée au contact / distance) + munition
  // Armes choisissables du loadout actif (hors Mains nues) : ≥2 → sélecteur d'arme d'attaque (main secondaire -20).
  const pickable = attacker.weapons.filter((w) => w.name !== 'Mains nues' && !!w.uid);
  const res = pa.result;
  // Maniement de deux armes (LDB 10 l.638) : proposé seulement à un héros qui a le talent ET tient 2 armes de
  // MÊLÉE à 1 main, sur l'attaque-ACTION (jamais une frappe gratuite/enchaînée — ni cleave, ni 2ᵉ frappe).
  const dualEligible = !res && attacker.kind === 'hero' && attackModesFor(attacker).includes('dual-wield')
    && attacker.weapons.some((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && attacker.weapons.some((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && !pa.cleave && !pa.dualSecond;
  // « Tirer dans le tas » (LDB 14 l.136/146) : proposé au TIR quand ≥3 combattants sont serrés au contact de la cible.
  const crowd = !res && weapon?.type === 'ranged' ? crowdEligible(battle, attacker, target) : [];
  const cm = crowdMod(crowd.length);
  // Tir IMMOBILE (LDB 14 l.101) : proposé au TIR d'un héros qui n'a pas encore bougé ET qui PEUT encore se
  // déplacer (sinon il est immobile d'office, pas de −10 à annuler) — annule le −10 « Tir en bougeant » au
  // prix de son Mouvement du Tour (Mouvement décomposable : sinon on tirerait puis bougerait).
  const canHoldGround = !res && weapon?.type === 'ranged' && attacker.kind === 'hero' && battle.movementUsed === 0 && movementRemaining(battle, attacker) > 0;
  const fortune = attacker.fortune ?? 0;
  const rerollable = !!res && canReroll(!res.attackerDetail?.success, !!pa.rerolled);
  // Panneau pré-rempli (l'avant-jet = le résultat, pré-rempli) : MA ligne (score + mods) recalculée à
  // chaque changement d'option ; la ligne adverse via `previewDefense` (compétence + mods, sans valeur).
  const preview = !res ? previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround, weaponUid: pa.weaponUid }) : null;
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doRoll = () => {
    bus.emit(EVT.DICE_ROLL);
    if (reduceMotion) return roll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); roll(); }, 480); // le jet (seeded) n'a lieu qu'à la fin du frisson
  };
  // Issue COURTE (1 ligne, sans répéter les noms — le panneau dit déjà qui) à la place du log complet.
  const outcome = res
    ? res.critical
      ? `Coup Critique${res.critLocation || res.location ? ` — ${HIT_LOCATION_LABELS[(res.critLocation ?? res.location)!]}` : ''}${res.woundsLost ? ` · ${res.woundsLost} Blessure${res.woundsLost > 1 ? 's' : ''}` : ''}${res.defenderDefeated ? ' · hors de combat !' : ''}`
      : res.hit
        ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost != null ? ` · ${res.woundsLost} Blessure${(res.woundsLost ?? 0) > 1 ? 's' : ''}` : ''}${res.defenderDefeated ? ' · hors de combat !' : ''}`
        : `Attaque déjouée${res.advantageTo === 'defender' ? " — l'adversaire gagne l'Avantage" : ''}`
    : '';

  return (
    <Modal title="Attaque" onClose={!res && !rolling ? cancel : undefined}>
      <VsHeader
        actor={attacker}
        target={target}
        label={<>{weapon?.name ?? 'Mains nues'}{preview ? <> · Dégâts +{preview.dmg}</> : null}</>}
      />

      {!res ? (
        <>
          <div className="rm-options">
            {/* Maniement de deux armes (LDB 10 l.638) : attaquer des DEUX armes pour son Action. */}
            {dualEligible && (
              <label
                className="rm-loc-inline rm-dual-toggle"
                title="Frapper des deux armes : 2ᵉ frappe de la main secondaire si la 1ʳᵉ touche ; -10 à TOUTES vos défenses jusqu'à votre prochain Tour ; Avantage seulement si les deux touchent."
              >
                <input type="checkbox" checked={!!pa.dualMode} onChange={(e) => setDualMode(e.target.checked)} />
                <span className="mini-title">⚔️ Des deux armes</span>
              </label>
            )}
            {/* Choix d'arme (dual-wield) : la main secondaire affiche son -20 ; le panneau reflète le mod.
                Masqué en mode « des deux armes » (l'attaque-Action utilise alors la main directrice). */}
            {pickable.length >= 2 && !pa.dualMode && (
              <div className="rm-loc-inline">
                <span className="mini-title">Arme</span>
                <select
                  className="rm-loc-select"
                  value={pa.weaponUid ?? weapon.uid ?? ''}
                  onChange={(e) => setWeapon(e.target.value || null)}
                  title="Avec quelle arme frapper ? La main secondaire subit -20 (réduit par Ambidextre)."
                >
                  {pickable.map((w) => (
                    <option key={w.uid} value={w.uid}>{w.name}{w.hand === 'off' ? ' (2nde -20)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Localisation visée = choix RARE (par défaut « Au hasard ») → menu déroulant compact.
                Viser une localisation rend le Test Complexe (-10). */}
            <div className="rm-loc-inline">
              <span className="mini-title">Localisation</span>
              <select
                className="rm-loc-select"
                value={pa.location ?? ''}
                onChange={(e) => setLocation((e.target.value as HitLocation) || null)}
                title="Où frapper ? « Au hasard » par défaut ; viser une localisation précise rend le Test Complexe (-10)."
              >
                <option value="">🎯 Au hasard</option>
                {LOCS.map((l) => (
                  <option key={l} value={l}>{HIT_LOCATION_LABELS[l]} (-10)</option>
                ))}
              </select>
            </div>
            {cm && (
              <div className="rm-crowd">
                <button
                  className={`btn small ${pa.intoCrowd ? 'btn-primary' : ''}`}
                  onClick={() => setIntoCrowd(!pa.intoCrowd)}
                  title="Tu ne choisis pas ta cible : un combattant au contact de la cible (les DEUX camps — tir fratricide possible) est touché au hasard, mais tu gagnes le bonus, et un succès dû au seul bonus est à 0 DR."
                >
                  🎯 Tirer dans le tas (+{cm.value})
                </button>
                {pa.intoCrowd && <span className="rm-crowd-note">{crowd.length} au contact — touche au hasard, 0 DR si sauvé par le bonus.</span>}
              </div>
            )}
            {canHoldGround && (
              <div className="rm-crowd">
                <button
                  className={`btn small ${pa.heldGround ? 'btn-primary' : ''}`}
                  onClick={() => setHeldGround(!pa.heldGround)}
                  title="Tire sans bouger : annule la pénalité -10 « Tir en bougeant », mais consomme ton Mouvement du Tour (tu ne pourras plus te déplacer)."
                >
                  🦿 Je ne bouge pas (annule le -10)
                </button>
                {pa.heldGround
                  ? <span className="rm-crowd-note">Immobile : pas de -10, mais Mouvement du Tour consommé.</span>
                  : <span className="rm-crowd-note">Tir mobile : -10 « Tir en bougeant » (tu gardes ton Mouvement).</span>}
              </div>
            )}
          </div>
          {preview && (preview.blocked || !preview.inRange ? (
            <div className="rm-blocked">⛔ {preview.blocked ? 'Pas de ligne de vue' : 'Hors de portée'}</div>
          ) : (
            <RollPanel
              rows={[
                {
                  combatant: attacker,
                  pending: {
                    label: preview.kind === 'ranged' ? 'Projectiles' : 'Corps à corps',
                    base: combatValue(attacker, preview.kind, weapon),
                    target: Math.max(0, Math.min(100, preview.target)),
                    mods: preview.mods,
                  },
                },
                { combatant: target, pending: { ...previewDefense(target), hideValue: true } },
              ]}
            />
          ))}
          {rolling ? (
            <div className="rm-rolling"><span className="rm-die">🎲</span></div>
          ) : (
            <>
              <div className="rm-influence">
                {/* Résilience AVANT le jet (LDB 17 l.73) : force la réussite (résultat garanti, sans frisson). */}
                <ResilienceButton resilience={attacker.resilience ?? 0} show={(attacker.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
                {/* Détermination (LDB 17 l.66) : retirer un État négatif AVANT de lancer — la ligne recalcule. */}
                <DeterminationButton combatant={attacker} onSpend={(name) => spendResolve(attacker.id, name)} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={cancel}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={doRoll}>
                  🎲 Lancer
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Test opposé : mêmes lignes que l'avant-jet, remplies — vainqueur accentué + DR net. */}
          <RollPanel
            rows={[
              { combatant: attacker, d: res.attackerDetail },
              { combatant: target, d: res.defenderDetail },
            ]}
            winnerIndex={res.defenderDetail ? (res.hit ? 0 : 1) : undefined}
            netSL={res.defenderDetail ? res.netSL : undefined}
          />
          {/* Issue courte (1 ligne, icône du journal) — le détail des noms vit dans les lignes. */}
          <JournalLine
            className="rm-journal"
            event={ev(res.critical ? 'crit' : res.hit ? 'damage' : 'attack', outcome, attacker.id, target.id)}
            combatants={battle.combatants}
          />
          {pa.forced && res.attackerDetail && (() => {
            // LDB 17 l.73 « vous choisissez le résultat » : plus haut double réussi (→ Coup Critique).
            const maxRoll = Math.min(99, res.attackerDetail!.target);
            const bestDouble = Math.floor(maxRoll / 11) * 11;
            return (
              <div className="rm-options">
                <span className="mini-title">🎲 Dé choisi (Je ne faillirai pas !)</span>
                <div className="rm-loc-grid">
                  <button className={`btn small ${res.attackerRoll === 1 ? 'btn-primary' : ''}`} title="DR maximum" onClick={() => setForcedRoll(1)}>
                    01 · DR max
                  </button>
                  {bestDouble >= 11 && (
                    <button className={`btn small ${res.attackerRoll === bestDouble ? 'btn-primary' : ''}`} title="Double réussi → Coup Critique" onClick={() => setForcedRoll(bestDouble)}>
                      {String(bestDouble).padStart(2, '0')} · Critique
                    </button>
                  )}
                  <input
                    className="rm-die-input"
                    type="number"
                    min={1}
                    max={maxRoll}
                    value={res.attackerRoll}
                    onChange={(e) => setForcedRoll(Number(e.target.value))}
                    title={`Choisir librement la valeur du dé (1 à ${maxRoll})`}
                  />
                </div>
              </div>
            );
          })()}
          {res.critical && pa.forced && (
            <div className="rm-options">
              {/* RAW-2 (LDB 17 l.73) : sur un Coup Critique forcé, le joueur CHOISIT la localisation atteinte. */}
              <span className="mini-title">🔥 Localisation du Coup Critique (Je ne faillirai pas !)</span>
              <div className="rm-loc-grid">
                {LOCS.map((l) => (
                  <button key={l} className={`btn small ${res.critLocation === l ? 'btn-primary' : ''}`} onClick={() => setCritLocation(l)}>
                    {HIT_LOCATION_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <InfluenceRow
            actor={attacker}
            rerollable={rerollable}
            onReroll={reroll}
            onBonusSL={bonusSL}
            darkPactable={attacker.kind === 'hero' && !pa.dualSecond && !!res && !res.attackerDetail?.success}
            onDarkPact={darkPact}
            onForce={forceSuccess}
            forceShow={!!res && !res.hit}
          />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={confirm}>
              Appliquer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
