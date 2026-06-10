import { useState } from 'react';
import { useGame, movementRemaining } from '../state/store';
import { HitLocation, HIT_LOCATION_LABELS } from '../engine/types';
import { crowdMod } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { firedWeapon, crowdEligible, previewAttack } from '../state/combatFlow';
import { attackModesFor } from '../engine/combatFeatures/dispatch';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { CombatantBadge, TeamPortrait } from './CombatantBadge';
import { RollLine } from './RollLine';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * Modale d'attaque : on choisit la localisation visée (Complexe -10), on clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'appliquer le résultat (LDB Destin / Combat).
 *
 * La mêlée est un TEST OPPOSÉ : on affiche donc les DEUX jets (attaquant ET défenseur),
 * leur cible (base + modificateurs) et leur DR — c'est le DR net qui décide.
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
  // Aperçu AVANT le jet (R4) : valeur de toucher + décomposition des modificateurs (plus de « validation à
  // l'aveugle »). Recalculé à chaque changement d'option (localisation / Tirer dans le tas / immobile).
  const preview = !res ? previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround, weaponUid: pa.weaponUid }) : null;
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doRoll = () => {
    if (reduceMotion) return roll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); roll(); }, 480); // le jet (seeded) n'a lieu qu'à la fin du frisson
  };

  return (
    <Modal title="Attaque">
        <div className="rm-vs">
          <CombatantBadge combatant={attacker} />
          <span className="rm-vs-arrow"><span className="rm-weapon">{weapon?.name ?? 'Mains nues'}</span><br />→</span>
          <CombatantBadge combatant={target} />
        </div>

        {!res ? (
          <>
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
            {/* Choix d'arme (dual-wield) : la main secondaire affiche son -20 ; l'aperçu reflète le mod.
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
            {/* Localisation visée = choix RARE (par défaut « Au hasard ») → menu déroulant compact
                plutôt qu'une grille de 7 boutons. Viser une localisation rend le Test Complexe (-10). */}
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
            {preview && (preview.blocked ? (
              <div className="rm-preview bad">⛔ Pas de ligne de vue</div>
            ) : !preview.inRange ? (
              <div className="rm-preview bad">⛔ Hors de portée</div>
            ) : (
              <div className="rm-preview">
                <div className="rm-preview-hit">🎯 Toucher : <b>{Math.max(0, Math.min(100, preview.target))}%</b></div>
                {preview.mods.length > 0 && (
                  <div className="rm-roll-mods">
                    {preview.mods.map((m, i) => (
                      <span key={i} className={`rm-mod ${m.value >= 0 ? 'pos' : 'neg'}`}>
                        {m.value >= 0 ? '+' : '−'}{Math.abs(m.value)} {m.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rm-preview-dmg" title="Blessures = Dégâts d'arme + DR du jet − (Bonus d'Endurance + PA). Plancher 1.">
                  ⚔️ Dégâts : <b>{preview.dmg}</b> + DR − <b>{preview.soak}</b> encaissé · ≈ <b>{Math.max(1, preview.dmg - preview.soak)}+</b> Blessures
                </div>
              </div>
            ))}
            {rolling ? (
              <div className="rm-rolling"><span className="rm-die">🎲</span></div>
            ) : (
              <div className="modal-actions">
                <button className="btn" onClick={cancel}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={doRoll}>
                  🎲 Lancer
                </button>
                {/* Résilience AVANT le jet (LDB 17 l.73) : force la réussite (résultat garanti, sans frisson). */}
                <ResilienceButton resilience={attacker.resilience ?? 0} show={(attacker.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Jet opposé : portrait à côté de chaque ligne pour savoir QUI a fait quel jet (R10). */}
            <div className="rm-rolls">
              {res.attackerDetail && (res.defenderDetail
                ? <div className="rm-roll-row"><TeamPortrait combatant={attacker} size={28} /><RollLine d={res.attackerDetail} /></div>
                : <RollLine d={res.attackerDetail} />)}
              {res.defenderDetail && <div className="rm-roll-row"><TeamPortrait combatant={target} size={28} /><RollLine d={res.defenderDetail} /></div>}
            </div>
            {/* Une seule ligne d'issue, dans le style du journal d'événements (la verdict + le log
                disaient la même chose) : icône par nature du coup, noms colorés par camp. */}
            <JournalLine
              className="rm-journal"
              event={ev(res.critical ? 'crit' : res.hit ? 'damage' : 'attack', res.log, attacker.id, target.id)}
              combatants={battle.combatants}
            />
            {res.critical && pa.forced && (
              <div className="rm-loc">
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
            <div className="modal-actions">
              <ChanceButtons
                fortune={fortune}
                rerollable={rerollable}
                onReroll={reroll}
                onBonusSL={bonusSL}
                darkPactable={attacker.kind === 'hero' && !pa.dualSecond && !!res && !res.attackerDetail?.success}
                onDarkPact={darkPact}
              />
              <ResilienceButton resilience={attacker.resilience ?? 0} show={!!res && !res.hit} onForce={forceSuccess} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}
