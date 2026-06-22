/**
 * Tranche « combat » du store (Zustand) — `createCombatSlice(get, set)` renvoie les ACTIONS de
 * combat inline (battleClick*, attaque/défense/cascade, désengagement, monture, fin de tour, Destin,
 * magie de combat, etc.) qui vivaient dans l'objet du `create` de `store.ts`. Elles sont déplacées
 * VERBATIM (mêmes corps, mêmes `get()/set()`, mêmes imports d'origine) et spreadées EN TÊTE du store :
 *   `create<GameState>((set, get) => ({ ...createCombatSlice(get, set), ...reste, ...état }))`.
 * L'ÉTAT reste assemblé dans le `create` (forme à plat unique) ; cette tranche n'expose que des
 * ACTIONS. Surface IDENTIQUE : aucune clé ajoutée/retirée/renommée. Pas de value-import de `store.ts`
 * (les actions ne référencent jamais `useGame`) → import de TYPE seulement, aucun cycle d'exécution.
 */
import type { Get, Set } from './flowTypes';
import type { GameState, BattleState } from './store';
import type { CounterParticipant } from './pendings';
import { SceneEntity, Effect } from './scene';
import * as travelFlow from './travelFlow';
import { Combatant, HitLocation, DIFFICULTY_MODIFIERS } from '../engine/types';
import { creatureAttacks, type AttackKind } from '../engine/creatureAttacks';
import { battleRng } from './battleRng';
import { activeCombatant, occupied, removeEntity, entityPickables, applyEffects, applySonneMeleeAdvantage, firedWeapon, firedAttackBlock, resolveAttack, disengageOutcome, startDisengage, applyAttackResult, castSpell, applyCast, castWardPenalty, domainCastBonus, applyZoneCrossings, effectiveSpellOf, finishPlayerAction, applyMiscast, useSpellComponent, checkBattleOver, resumeEnemyTurn, advanceTurn, resolveRoundBoundary, enterRoundStartPause, maybeRunEnemyTurn, resumeSuspendedAI, aiDriven, attackerFumbled, defenderFumbled, applyOups, autoCleave, maybeHeroCleave, cleaveTargets, dualStrikeTargets, resolveDualSecond, overcastTargetCandidates, aiCreatureFreeAttacks, aiFrenzyAttack, resolveTalentFreeAttacks, applyFreeAttackEffects, trampleTarget, TRAMPLE_WEAPON, pushReveal, pushCombatStep, aiOvercastPlan, selectedAttackOption, hasFreeWeaponAttack, freeAttackWeapon, applyWail, resolveManeuver, spellSightOf, castZoneSpell, zoneRadiusTilesAt, placingZoneOf, commitPlacedZone, counterspellCandidates, applyCounterspell, applyCounterspellOutcome, openCastOpposition, openRoundStartPsych, displaceSmaller, applySurprise, displayedReach, computeRunReach, attackPlan, fearedSourceTowards, frenzyTarget, rollInitiative, handleConditionGained, routeTriggeredTest, freeAttackHookImpl, setFreeAttackHook, applyFocusInterruption, setFocusInterruptHook, applyBladeTrap, setBladeTrapHook, fireTurnStartTriggers, finishCombatEnd } from './combatFlow';
import { setTriggeredTestRouter, fireTriggers } from './triggeredEffects';
import { EMPTY_FLOW, flowEffects } from './flow';
import { pickActiveModalKey } from './modalArbiter';
import { mountMovement, canMove, mountUp, dismount, mountOf, mountableNear } from './mount';
import { ev, evLines } from './combatLog';
import { afterApproach } from './combatDirector';
import { initiativeOrder, combatValue, rollMeleeDefender, resolveBackstabAttack, resolveMeleePassive, attackWeapon } from '../engine/combat';
import { disengageFrom, isEngaged, meleeReachTiles } from '../engine/engagement';
import { gainAdvantage } from '../engine/advantage';
import { rule } from '../engine/policy';
import { resolveMagicMissile, resolveCasting, isArcaneSpell, isMagicMissile, isDispellableSpell, castingValue, castBlockedBy, hasTalent } from '../engine/magic';
import { rollTest, resolveOpposed, evaluateTest } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { hasActiveFlag } from '../engine/activeFlags';
import { isFrenzyCapable, spendResolveForPsychImmunity } from '../engine/psychology';
import { recomputeLoadout, itemFromGive, compatibleAmmo, loadoutSetActive } from '../engine/items';
import { magazineSize, canPushback, strikesLast, canStrikeFirst, reloadDRTarget } from '../engine/qualities/dispatch';
import { talentFearIndice, canPreemptRanged, fleeMovementBonus, reloadDRBonus } from '../engine/combatFeatures/dispatch';
import { itemUse, applyItemUse } from '../engine/consumables';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, addCondition, removeCondition, hasCondition, canTakeAction, loseWounds, stacks, recoveredStacks, COND, setConditionGainedHook } from '../engine/conditions';
import { hasHealSkill, availableHealModes, resolveWoundsHeal, resolveBleedHeal, type HealMode } from '../engine/healing';
import { treatTrauma } from '../engine/trauma';
import { persistentConditions } from '../engine/persistence';
import { testValue } from '../engine/skills';
import { rollOups } from '../engine/oups';
import { spawnEnemy } from './spawn';
import { sceneZonesToBattle } from './zones';
import { resetFields } from './stateFields';
import { actorIn } from './combatOrParty';
import { FLOWS, rollFlowActions, rollFlowActionsMulti } from './rollFlows';
import { resolveRenounce } from './corruptionFlow';
import { add as moneyAdd, toMoney } from '../engine/money';
import type {
  ConjureForm,
} from '../engine/conjuredWeapons';
import { findSpellById } from '../data/index';
import { reachable, moveReachFor, fleeReachable, pathTo, chebyshev, Pt } from './path';
import { sizeFootprint, combatDistance } from './footprint';
import { bus, EVT } from './bus';
import { startCascade, advanceCascade, resolveRemainingCascade, finalizeCascade, setCascadeChoice } from './cascade';
import { describeFrenzy, describeReload, describeStateRecovery } from './flowOutcomes';

/** Un flux DIFFÉRÉ tient la main (modale de jet/révélation, ciblage par carte : Frappe Mortelle,
 *  2ᵉ frappe, Surincantation +Cible, pose de zone) :
 *  toutes les actions d'INTENTION de la hotbar sont inertes — on ne change pas d'action au milieu
 *  d'un jet. La barre est masquée (ActionBar), mais ce garde-fou couvre AUSSI le clavier, les
 *  intents coop et la recette. (La PAUSE de début de Round, elle, est gatée à l'entrée UI —
 *  performClick d'IsoStage — pour rester neutre vis-à-vis des harnais de test sans UI.) */
const combatBusy = (s: Pick<GameState, 'pendingCleave' | 'pendingDualStrike' | 'pendingCast'>): boolean =>
  !!(pickActiveModalKey(s as never) || s.pendingCleave || s.pendingDualStrike || s.pendingCast);

/** Avance l'étape-jet d'attaque de la cascade combat à la FIN de la chaîne (plus de `pendingAttack` NI
 *  d'enchaînement balayage/dual) → conséquences inline ou reprise. La cascade reste ouverte pendant la
 *  chaîne ; on n'avance qu'au bout. Partagé par attackConfirm / cleaveEnd / dualStrikeSkip (zéro duplication). */
function advanceCombatJet(get: () => GameState): void {
  const seq = get().pendingCascade;
  if (seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack'
    && !get().pendingAttack && !get().pendingCleave && !get().pendingDualStrike) get().cascadeNext();
}

/** Actions de combat inline du store — déplacées VERBATIM. Spreadées EN TÊTE du `create`. */
export function createCombatSlice(get: Get, set: Set) {
  // Câble le déclencheur `onGainCondition` (Mâchoires d'acier…) : le moteur `addCondition` est PUR
  // (hook injecté) ; la logique vit dans la brique feuille `combat/triggeredTest`, get/set liés ici.
  // Idem pour le ROUTEUR de Test des triggers (héros manuel → cascade ; sinon inline) — installé ICI
  // au RUNTIME (pas au top-level de la brique : `setTriggeredTestRouter` est en amont d'un cycle d'imports).
  setConditionGainedHook((c, name) => handleConditionGained(get, set, c, name));
  setTriggeredTestRouter(routeTriggeredTest);
  // Hook `grantFreeAttack` (op IMPURE) : pont exécuteur de Flow → vraie frappe — `runCombatFlow` l'appelle
  // sur le `do`/`grantFreeAttack` (Frappe réactive / Assaut féroce / Frénésie). Inversion de dépendance.
  setFreeAttackHook(freeAttackHookImpl);
  // Hook `interruptFocus` (op IMPURE) : conséquence d'un Test de Calme d'interruption de Focalisation RATÉ
  // (perte des DR + Imparfaite Mineure, LDB 46 l.194) — appelée par `runCombatFlow` sur le `do`/`interruptFocus`.
  setFocusInterruptHook(applyFocusInterruption);
  // Hook `breakBlade` (op IMPURE) : conséquence d'un Test opposé de Piège-lame GAGNÉ (désarme/brise la lame,
  // LDB 62 l.295) — appelée par `runCombatFlow` sur le `do`/`breakBlade`.
  setBladeTrapHook(applyBladeTrap);
  return {
    // ── Combat monté : Monter / Descendre (LDB 14 l.212-225) ──
    // Enfourcher/descendre ne demande AUCUN jet (Chevaucher sans Test si l'on a la Compétence, LDB 09 l.99)
    // → ce n'est PAS une Action (critère : tout jet = une Action) : c'est juste du MOUVEMENT (repositionnement
    // sur/hors la monture). On consomme donc le Mouvement du tour, pas l'Action — on peut enfourcher PUIS attaquer.
    battleMount: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || active.mountId) return;
      const mount = mountableNear(battle, active);
      if (!mount) return;
      mountUp(active, mount);
      set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('move', `${active.name} enfourche ${mount.name}.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    battleDismount: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !active.mountId) return;
      const mountName = mountOf(battle, active)?.name ?? 'sa monture';
      dismount(battle, scene, active);
      set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('move', `${active.name} descend de ${mountName}.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Combat monté (LDB 14 l.219) : applique le choix de cible (cavalier OU monture) puis relance l'attaque/charge
    // sur l'id choisi en court-circuitant la modale (skipMountChoice). Annuler ne consomme rien.
    mountTargetSelect: (id: string) => {
      if (!get().pendingMountTarget) return;
      set({ pendingMountTarget: null });
      get().battleClickEntity(id, { skipMountChoice: true });
    },
    mountTargetCancel: () => set({ pendingMountTarget: null }),

    // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15-Dépl l.84-89) ──
    battleDisengage: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return; // option A (Sacrifier l'Avantage) reste possible même après avoir agi
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !isEngaged(active)) return;
      startDisengage(get, set, active);
    },
    // « Sacrifier l'Avantage » (l.87) → ramener l'Avantage à 0, partir libre. L'Action N'EST PAS consommée.
    disengageConfirmA: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd || !pd.canSacrifice) return;
      const mover = battle.combatants.find((c) => c.id === pd.moverId);
      if (!mover) return set({ pendingDisengage: null, pendingCascade: null });
      const foes = (mover.engagedWith ?? [])
        .map((id) => battle.combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c);
      mover.advantage = 0; // « ramener votre Avantage à 0 » (l.87)
      for (const f of foes) disengageFrom(mover, f); // se place hors de portée de TOUS (l.87)
      const blocked = occupied(battle, mover);
      set({
        pendingDisengage: null,
        pendingCascade: null, // ferme la cascade-hôte du Désengagement
        battle: {
          ...battle,
          action: null, // mouvement libre rouvert (clic-sol), sans pénalité (l.87) ; Action préservée
          reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), blocked, sizeFootprint(mover.size)),
          log: [...battle.log, ev('flee', `${mover.name} se désengage en sacrifiant son Avantage.`, mover.id)],
        },
      });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Esquiver » → Test opposé Esquive (mover) vs Corps à corps (foe), jet du foe figé. Passe en phase 'esquive'.
    disengageRoll: () => {
      const { battle, pendingDisengage: pd } = get();
      if (!battle || !pd || pd.phase !== 'choice') return;
      const mover = battle.combatants.find((c) => c.id === pd.moverId);
      if (!mover) return;
      const def = rollMeleeDefender(mover, 'esquive', battleRng());
      const opp = resolveOpposed(def, pd.atk!); // mover = « attaquant » du Test opposé
      set({ pendingDisengage: { ...pd, phase: 'esquive', def, result: disengageOutcome(opp.winner) } });
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `disengage`) : foe (atk) figé, seule l'Esquive du mover se (re)joue.
    ...rollFlowActions('disengage', FLOWS.disengage, get, set, ['reroll', 'bonusSL', 'darkPact', 'forceSuccess']),

    // « Appliquer » : l'Esquive consomme l'Action dans les DEUX issues (l.89).
    disengageConfirm: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd || !pd.result) return;
      const mover = battle.combatants.find((c) => c.id === pd.moverId);
      const foe = battle.combatants.find((c) => c.id === pd.foeId);
      set({ pendingDisengage: null, pendingCascade: null });
      if (!mover || !foe) return;
      const log = [...battle.log];
      if (pd.result === 'success') {
        gainAdvantage(mover); // +1 Avantage (l.89)
        mover.gainedAdvThisRound = true;
        // Esquive réussie = on s'extrait du corps à corps → libéré de TOUS les Engagements
        // (cohérent avec l'option A, qui libère aussi tous les foes).
        const foes = (mover.engagedWith ?? [])
          .map((id) => battle.combatants.find((c) => c.id === id))
          .filter((c): c is Combatant => !!c);
        for (const f of foes) disengageFrom(mover, f);
        const blocked = occupied(battle, mover);
        log.push(ev('flee', `${mover.name} se désengage (Esquive réussie, +1 Avantage).`, mover.id, foe.id));
        set({
          battle: { ...battle, acted: true, action: null, reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), blocked, sizeFootprint(mover.size)), log },
        });
      } else if (pd.result === 'tie') {
        // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
        // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
        log.push(ev('flee', `${mover.name} : échange neutre, le désengagement échoue (personne ne prend l'avantage).`, mover.id, foe.id));
        set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
      } else {
        gainAdvantage(foe); // l'adversaire gagne +1, la fuite échoue (l.89)
        foe.gainedAdvThisRound = true;
        log.push(ev('flee', `${mover.name} échoue à se désengager ; ${foe.name} gagne +1 Avantage.`, mover.id, foe.id));
        set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Fuir » (LDB 15-Dépl l.98-109) : l'adversaire gagne +1 Avantage + une attaque gratuite dans
    // le dos (+20) ; si elle touche, +1 Avantage de plus et Test de Calme ou État Brisé ; puis on
    // se libère de TOUS les Engagements et on peut courir (Mouvement de Course).
    disengageFlee: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd) return;
      const mover = battle.combatants.find((c) => c.id === pd.moverId);
      const foe = battle.combatants.find((c) => c.id === pd.foeId);
      if (!mover || !foe) return set({ pendingDisengage: null, pendingCascade: null });
      const log = [...battle.log];
      gainAdvantage(foe); // l'adversaire gagne immédiatement +1 Avantage (l.101)
      foe.gainedAdvThisRound = true;
      const res = resolveBackstabAttack(foe, mover, battleRng());
      log.push(ev('flee', `${mover.name} fuit — ${foe.name} frappe dans le dos : ${res.log}`, mover.id, foe.id));
      let calmeRoll: number | undefined;
      let broken = 0;
      if (res.hit && res.woundsLost) {
        loseWounds(mover, res.woundsLost); // perte de PB centralisée : −Avantage du fuyard + À Terre à 0 (LDB 15 l.40 / 18 l.28)
        gainAdvantage(foe); // touché → +1 Avantage de plus (l.107)
        // Test de Calme Intermédiaire (+0) ou État Brisé (+1 par DR négatif).
        const calme = effectiveChar(mover, 'FM') + (mover.skills.find((s) => s.skillId === 'calme')?.advances ?? 0);
        const ct = rollTest(calme, 'intermediaire', battleRng());
        broken = ct.success ? 0 : 1 + Math.max(0, -ct.sl);
        calmeRoll = ct.roll;
        if (broken) {
          addCondition(mover, COND.brise, broken);
          log.push(ev('fear', `${mover.name} panique : ${broken} État(s) Brisé.`, mover.id));
        }
      }
      const foes = (mover.engagedWith ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
      for (const f of foes) disengageFrom(mover, f);
      const blocked = occupied(battle, mover);
      // Fuite : déplacement jusqu'à la Course (2×Mouvement) MAIS dans la direction opposée à l'adversaire
      // (LDB 15-Déplacement l.109) — les cases qui rapprochent du `foe` sont exclues du déplaçable.
      // Fuite ! (LDB 10) : Mouvement +1 quand on fuit.
      set({ battle: { ...battle, action: null, reachable: fleeReachable(scene, mover.pos!, foe.pos!, (effectiveMovement(mover) + fleeMovementBonus(mover)) * 2, blocked, sizeFootprint(mover.size)), log } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
      // Coup dans le dos INTÉGRÉ à la modale (plus de popin RevealModal séparée) : on garde la modale
      // ouverte sur la phase 'fuir' pour MONTRER le dé subi + le Test de Calme ; « Continuer » ferme et
      // libère le déplacement de Fuite. Cas particuliers (PNJ, combat fini, mort→Destin, autre révélation
      // en attente) : on ferme tout de suite pour ne pas empiler les modales.
      const st = get();
      if (mover.kind !== 'hero' || st.battle?.over || st.pendingFateSave || st.pendingReveals.length) {
        set({ pendingDisengage: null, pendingCascade: null });
        return;
      }
      set({ pendingDisengage: { ...pd, phase: 'fuir', fuir: { attackerRoll: res.attackerRoll, hit: res.hit, woundsLost: res.woundsLost ?? 0, calmeRoll, broken } } });
    },
    disengageFleeAck: () => set({ pendingDisengage: null, pendingCascade: null }), // « Continuer » : ferme la modale (conséquences déjà appliquées)
    disengageCancel: () => set({ pendingDisengage: null, pendingCascade: null }), // renonce avant tout jet : aucun coût

    battleClickTile: (pt: Pt, opts?: { confirm?: boolean }) => {
      const { battle, scene } = get();
      if (!battle || !scene || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      // TÉLÉPORTATION (Jalon 2.6 — sort « Téléportation », LDB 47) : après l'Appliquer, le lanceur
      // choisit sa case d'arrivée parmi les cases en surbrillance (survol des obstacles).
      if (battle.action === 'teleport') {
        const k = `${pt.x},${pt.y}`;
        if (!battle.reachable.has(k)) return;
        const from = { ...active.pos! };
        const mount = mountOf(battle, active);
        active.pos = { ...pt };
        if (mount) mount.pos = { ...pt }; // couple cavalier↔monture solidaire (comme le déplacement)
        get().faceFromPath(active.id, [from, pt]);
        bus.emit(EVT.ANIM_MOVE, { id: active.id, path: [{ ...pt }] });
        if (mount) bus.emit(EVT.ANIM_MOVE, { id: mount.id, path: [{ ...pt }] });
        set({ battle: { ...battle, action: null, reachable: new Map(), preview: null, log: [...battle.log, ev('move', `${active.name} se téléporte.`, active.id)] } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // POSE de zone en cours (source UNIQUE placingZoneOf — toute zone à poser librement) :
      // le clic-case dépose le gabarit FINAL (gates portée/LdV chez le consommateur).
      if (placingZoneOf(get())) {
        commitPlacedZone(get, set, pt);
        return;
      }
      // Sort de ZONE sélectionné : le clic-case (comme le clic-token) OUVRE la modale — le centre
      // se choisit APRÈS le jet (flux ci-dessus). Sort non-zone : clic-sol sans effet en mode cast.
      if (battle.action === 'cast' && battle.selectedSpellId && !battle.acted && !get().pendingCast) {
        castZoneSpell(get, set, active, battle.selectedSpellId);
        return;
      }
      // Mode NEUTRE = clic-sol implicite (les modes restants — heal/ammo/trample/resolve… — ne
      // déplacent pas au clic-case ; le cas cast-zone est traité plus haut).
      if (battle.action !== null) return;
      // Engagé : pas de déplacement libre (LDB 15 l.84) → le clic-sol route vers le Désengagement.
      if (isEngaged(active)) {
        startDisengage(get, set, active);
        return;
      }
      if (!canMove(battle, active)) return;
      const reach = displayedReach(get);
      const k = `${pt.x},${pt.y}`;
      const inWalk = reach.has(k);
      // Au-delà de la Marche : zone de COURSE (LDB 15 l.79-82) — le commit demande le Test d'Athlétisme,
      // et le déplacement réel s'arrêtera là où le jet porte (runConfirm).
      const runReach = inWalk ? null : computeRunReach(get);
      if (!inWalk && !runReach?.has(k)) {
        // Clic hors de toute portée : purge l'aperçu en cours (geste « annuler »).
        if (battle.preview) {
          set({ battle: { ...battle, preview: null } });
          bus.emit(EVT.SCENE_DIRTY);
        }
        return;
      }
      const stepCost = (inWalk ? reach.get(k) : runReach!.get(k)) ?? 0; // coût (cases) du segment
      // Peur (LDB 21 l.29) : se RAPPROCHER d'une source de Peur exige un Test de Calme Intermédiaire (+0)
      // — vérifié au COMMIT seulement (l'aperçu reste libre). Une tentative par Tour (battle.fearGate) :
      // succès → approches libres ce Tour ; échec → aucune approche ce Tour.
      const fearGateBlocks = (): boolean => {
        if (battle.fearGate === 'passed') return false;
        const feared = fearedSourceTowards(battle, active, pt);
        if (!feared) return false;
        if (battle.fearGate === 'failed') {
          get().log(`${active.name} ne peut pas s'approcher de ${feared.name} : la Peur le cloue (ce Tour).`);
          return true;
        }
        set({ pendingApproach: { combatantId: active.id, sourceId: feared.id, intent: { kind: 'tile', pt: { ...pt } }, result: null }, battle: { ...battle, preview: null } });
        bus.emit(EVT.SCENE_DIRTY);
        return true;
      };
      // Frénésie (LDB 21 l.34) : « vous devez vous déplacer à votre maximum en direction de l'ennemi
      // le plus proche dans votre Ligne de Vue » → seules les cases qui RAPPROCHENT de cette cible.
      const frenzyBlocks = (): boolean => {
        if (!active.frenzied) return false;
        const ft = frenzyTarget(get, active);
        if (!ft?.pos || chebyshev(pt, ft.pos) < chebyshev(active.pos!, ft.pos)) return false;
        get().log(`${active.name} est en Frénésie : il doit foncer sur ${ft.name}.`);
        return true;
      };
      // Combat monté : la géométrie (empreinte/collisions) est celle de la MONTURE ; le cavalier la suit.
      const geom = mountOf(battle, active) ?? active;
      const blocked = occupied(battle, geom);
      const prev = battle.preview;
      if (!inWalk) {
        // Zone de Course : tap 1 = aperçu « Courir » ; tap 2 = Test d'Athlétisme (pendingRun + destination).
        if (!opts?.confirm && !(prev?.kind === 'run' && prev.tile.x === pt.x && prev.tile.y === pt.y)) {
          const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size)) ?? [];
          set({ battle: { ...battle, preview: { kind: 'run', tile: { ...pt }, path, cost: stepCost } } });
          bus.emit(EVT.SCENE_DIRTY);
          return;
        }
        if (fearGateBlocks() || frenzyBlocks()) return;
        get().battleRun({ ...pt }); // ouvre la modale de Course ; le déplacement suivra le jet (runConfirm)
        return;
      }
      // Tap 1 : APERÇU (chemin + coût) — sauf confirmation directe ou re-tap de la même case.
      if (!opts?.confirm && !(prev?.kind === 'move' && prev.tile.x === pt.x && prev.tile.y === pt.y)) {
        const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size)) ?? [];
        set({ battle: { ...battle, preview: { kind: 'move', tile: { ...pt }, path, cost: stepCost } } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Tap 2 : COMMIT.
      if (fearGateBlocks() || frenzyBlocks()) return;
      // Annulation (R6/LOT 6) : au PREMIER segment du Tour (movementUsed === 0), on capture l'état
      // positionnel AVANT de bouger, pour pouvoir tout annuler tant qu'aucune Action n'a été prise.
      const snapshot =
        (battle.movementUsed ?? 0) === 0
          ? {
              pos: Object.fromEntries(battle.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
              facing: { ...get().facing },
              movedPreAction: battle.movedPreAction,
            }
          : battle.moveSnapshot ?? null;
      const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size));
      active.pos = { ...pt };
      if (geom !== active) geom.pos = { ...pt }; // déplace la monture sous le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.308-309)
      get().faceFromPath(active.id, path);
      if (geom !== active) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      applyZoneCrossings(get, active, path ?? [{ ...pt }]); // Mur de feu & co (L11) : traverser coûte
      // Mouvement décomposable : cumule le coût du segment ; reste en mode neutre → le joueur peut
      // re-cliquer une case (s'il reste du Mouvement) OU enchaîner une Action. Si ce segment précède
      // l'Action, on marque `movedPreAction` (verrouille tout Mouvement post-Action).
      set({ battle: { ...battle, moveSnapshot: snapshot, movementUsed: (battle.movementUsed ?? 0) + stepCost, movedPreAction: battle.movedPreAction || !battle.acted, action: null, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    cancelMove: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const snap = battle.moveSnapshot;
      const active = activeCombatant(battle);
      // Aide PRÉ-Action uniquement : on n'annule que tant qu'aucune Action n'a été prise ce Tour (sinon
      // l'Action aurait été résolue depuis une position désormais effacée). Rien à annuler sans segment.
      if (!snap || !active || active.kind !== 'hero' || battle.acted || (battle.movementUsed ?? 0) === 0) return;
      for (const c of battle.combatants) {
        const p = snap.pos[c.id];
        if (p) c.pos = { ...p }; // restaure TOUS (un grand a pu en déplacer d'autres sous son empreinte)
      }
      set({
        facing: { ...snap.facing },
        battle: { ...battle, movementUsed: 0, movedPreAction: snap.movedPreAction, moveSnapshot: null, action: null, reachable: new Map(), preview: null },
      });
      bus.emit(EVT.SCENE_DIRTY);
    },

    battleClickEntity: (id: string, opts?: { confirm?: boolean; skipMountChoice?: boolean; forceAttackId?: string; wardCleared?: boolean }) => {
      const { battle, scene } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      // Ciblage CHAMP DE BATAILLE des flux différés (plus de boutons-noms en modale) — AVANT le
      // verrou `battle.acted` (ces frappes surviennent après l'attaque-Action) :
      // Frappe Mortelle / 2ᵉ frappe (Deux armes) / cibles supplémentaires de Surincantation.
      if (get().pendingCleave && !get().pendingAttack) return get().cleaveAttack(id);
      if (get().pendingDualStrike && !get().pendingAttack) return get().dualStrikeAttack(id);
      if (get().pendingCast?.pickingTargets) return get().castToggleExtraTarget(id);
      // Pose de zone en cours : cliquer un combattant = poser la zone sur SA case.
      if (placingZoneOf(get())) {
        const t = battle.combatants.find((c) => c.id === id);
        if (t?.pos) get().battleClickTile({ ...t.pos });
        return;
      }
      const target = battle.combatants.find((c) => c.id === id);
      if (!target) return;
      if (battle.action === 'cast' && battle.selectedSpellId) {
        // Sort de ZONE : un token n'est pas une cible (la zone se pose après le jet) → modale.
        if (castZoneSpell(get, set, active, battle.selectedSpellId)) return;
        // L'incantation peut viser un allié, un ennemi ou soi-même.
        castSpell(get, set, active, target, battle.selectedSpellId);
        return;
      }
      // ATTAQUE unifiée : l'`AttackOption` armée (clic droit = première abordable via `forceAttackId` ; sinon
      // `selectedAttack`, défaut 'arme' ; les anciens modes maneuver/tentacle/trample mappent sur leur option).
      // `undefined` = mode non-attaque (cast/heal/…) ou aucune attaque abordable (Action dépensée sans gratuite).
      const option = selectedAttackOption(active, battle, opts?.forceAttackId);
      if (!option || !scene) return;
      if (target.kind === 'hero') return; // l'attaque ne vise que les ennemis (soin/sort via leurs modes)
      if (!canTakeAction(active) || hasCondition(active, COND.brise)) return; // Sonné/Brisé : pas d'attaque (parité boutons)
      // Frénésie (LDB 21 l.34) : la cible est IMPOSÉE — l'ennemi le plus proche en Ligne de Vue.
      if (active.frenzied) {
        const ft = frenzyTarget(get, active);
        if (ft && ft.id !== id) {
          get().log(`${active.name} est en Frénésie : il doit attaquer ${ft.name} (le plus proche).`);
          if (battle.preview) set({ battle: { ...battle, preview: null } });
          return;
        }
      }
      // Aiguillage par NATURE de l'attaque : Piétinement (Taille) → flux dédié ; zone ciblée (Souffle/Vomi/
      // Langue/Regard/Étreinte) → `pendingManeuver` (jet d'ATTAQUANT influençable ;
      // `targetId` = clic = victime/point d'impact ; Avantage variable de Regard → 1) ; la MÊLÉE (Arme +
      // Morsure/Caudale/Tentacule) passe par l'approche-puis-frappe ci-dessous.
      if (option.targeting === 'trample') return get().battleTrample(target.id);
      if (option.targeting === 'zone') {
        set({ pendingManeuver: { attackerId: active.id, kind: option.kind!, targetId: target.id, avantageSpent: option.advantageMode === 'variable' ? 1 : option.cost.advantage, result: null }, battle: { ...battle, action: null, selectedAttack: undefined } });
        return;
      }
      // === MÊLÉE : approche-puis-frappe (le SEUL exécuteur charge/moveAttack du jeu) ===
      const plan = attackPlan(get, active, target, { reach: option.reach, forceMelee: option.forceMelee });
      // L'Action dépensée interdit le DÉPLACEMENT combiné pour une attaque qui COÛTE l'Action (Arme hors
      // Frénésie) → frappe directe seulement. Une attaque GRATUITE (Morsure/Caudale/Tentacule, ou l'Arme en
      // attaque libre de Frénésie → `cost.action===false`) PEUT s'approcher (charge) même l'Action dépensée
      // (LDB 21 l.34 : « se déplacer au maximum vers l'ennemi le plus proche pour l'attaquer »).
      if (battle.acted && option.cost.action && plan.kind !== 'attack') return;
      if (plan.kind === 'blocked') {
        get().log(plan.reason);
        if (battle.preview) set({ battle: { ...battle, preview: null } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Tir refusé faute de RESSOURCE (arme à Recharge non chargée / plus de munition) : on coupe AVANT
      // l'aperçu (tap-1) pour que l'affordance ne mente pas — même prédicat que le réticule au survol
      // (firedAttackBlock). Concerne UNIQUEMENT l'attaque directe (plan 'attack') avec l'arme tenue : une
      // Charge/rejoindre (mêlée) ou une attaque gratuite (freeKind) n'emploie jamais l'arme à distance.
      if (plan.kind === 'attack' && !option.freeKind) {
        const block = firedAttackBlock(active, target);
        if (block) {
          get().log(block.detail);
          if (battle.preview) set({ battle: { ...battle, preview: null } });
          bus.emit(EVT.SCENE_DIRTY);
          return;
        }
      }
      // Tap 1 : APERÇU — sauf confirmation (tests), ré-entrée du choix cavalier/monture,
      // ou re-tap de la même cible avec le même plan.
      const prev = battle.preview;
      const samePreview = !!prev && 'targetId' in prev && prev.targetId === id && prev.kind === plan.kind;
      if (!opts?.confirm && !opts?.skipMountChoice && !samePreview) {
        set({ battle: { ...battle, preview: plan.kind === 'attack' ? { kind: 'attack', targetId: id } : { ...plan, targetId: id } } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Tap 2 : COMMIT. Choix cavalier/monture (LDB 14 l.219) AVANT toute résolution — on n'ouvre la
      // modale qu'une fois (skipMountChoice évite la ré-entrée après le choix).
      if (!opts?.skipMountChoice) {
        const rider = target.mountId ? target : battle.combatants.find((c) => c.id === target.riderId);
        const mount = target.riderId ? target : battle.combatants.find((c) => c.id === target.mountId);
        if (rider && mount && rider.kind !== 'hero' && mount.kind !== 'hero' && !isOutOfAction(rider) && !isOutOfAction(mount)) {
          set({ pendingMountTarget: { riderId: rider.id, mountId: mount.id } });
          return;
        }
      }
      // Peur (LDB 21 l.29) : charger / rejoindre une source de Peur = s'en RAPPROCHER → même Test de
      // Calme d'approche que le clic-sol (une tentative par Tour, battle.fearGate).
      if (plan.kind === 'charge' || plan.kind === 'moveAttack') {
        const feared = battle.fearGate === 'passed' ? null : fearedSourceTowards(battle, active, plan.dest);
        if (feared) {
          if (battle.fearGate === 'failed') {
            get().log(`${active.name} ne peut pas s'approcher de ${feared.name} : la Peur le cloue (ce Tour).`);
            return;
          }
          set({ pendingApproach: { combatantId: active.id, sourceId: feared.id, intent: { kind: 'entity', id }, result: null }, battle: { ...get().battle!, preview: null } });
          bus.emit(EVT.SCENE_DIRTY);
          return;
        }
      }
      if (battle.preview) set({ battle: { ...get().battle!, preview: null } });
      // Bénédiction de Protection (LDB 41 l.105) : la cible bénie impose un Test de FM Accessible (+20)
      // AVANT d'engager quoi que ce soit (charge comprise). Le jet du HÉROS est INFLUENÇABLE (Chance/
      // Résilience) → il DIFFÈRE la déclaration derrière `pendingWard` (comme l'approche d'une source de
      // Peur juste au-dessus) ; `wardConfirm` relance l'attaque sur un succès (`wardCleared`), l'échec
      // l'abandonne. `wardCleared` = ce gate a déjà été franchi pour CE clic (relance) → on le saute.
      if (!opts?.wardCleared && hasActiveFlag(target, 'attackWardFM')) {
        set({ pendingWard: { attackerId: active.id, targetId: target.id, result: null }, battle: { ...get().battle!, preview: null } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Avantage de la manœuvre dépensé UNE fois, à la frappe (après TOUS les portails — aperçu/monture/Peur/
      // ward) : gratuites de mêlée (Morsure/Caudale… coût RAW). L'Arme (cost.advantage 0) ne dépense rien.
      if (option.cost.advantage) active.advantage = Math.max(0, active.advantage - option.cost.advantage);
      // === Approche-puis-frappe : DEUX beats explicites ===
      //   (1) APPROCHE — appliquer le déplacement animé (charge / rejoindre) et calculer la charge utile
      //       de frappe `pa` (PAS de modale ici).
      //   (2) FRAPPE — ouvrir la SÉQUENCE de combat, mais SEULEMENT après le glissé d'approche (beat
      //       `afterApproach` du Réalisateur, PARTAGÉ avec l'IA) : on VOIT le héros rejoindre la cible
      //       avant la modale, au lieu de la modale par-dessus une téléportation.
      let approachPath: { x: number; y: number }[] | null = null;
      let pa: GameState['pendingAttack'];
      if (plan.kind === 'charge') {
        // Charge (LDB 15-Dépl l.74-77) : se ruer au contact (portée de Course) puis attaquer — manœuvre
        // PLEINE (consomme tout le Mouvement). Combat monté : empreinte/Course de la MONTURE.
        const geom = mountOf(battle, active) ?? active;
        approachPath = plan.path;
        active.pos = { ...plan.dest };
        if (geom !== active) geom.pos = { ...plan.dest }; // la monture charge sous le cavalier
        displaceSmaller(get, geom); // charge d'un grand : idem dégage les plus petits (85 l.308-309)
        get().faceFromPath(active.id, approachPath);
        if (geom !== active) get().faceFromPath(geom.id, approachPath);
        bus.emit(EVT.ANIM_MOVE, { id: active.id, path: approachPath });
        if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: approachPath });
        applyZoneCrossings(get, active, approachPath); // Mur de feu & co (L11) : charger À TRAVERS coûte
        gainAdvantage(active, plan.adv); // +1 si « fonçant » de ≥ M mètres (l.77, lecture stricte), AVANT le jet
        if (plan.adv > 0) active.gainedAdvThisRound = true;
        active.chargedThisTurn = true; // Charge → Atouts de Dégâts d'une arme Épuisante actifs (LDB 63 l.16-17) ; consommé en fin de tour
        set({ battle: { ...get().battle!, movementUsed: mountMovement(battle, active), action: null, preview: null, log: [...battle.log, ev('charge', `${active.name} charge ${target.name}${plan.adv ? ` (+${plan.adv} Avantage)` : ''}.`, active.id, target.id)] } });
        pa = { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true, ...(option.freeKind ? { freeKind: option.freeKind, ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) } : {}) };
      } else {
        if (plan.kind === 'moveAttack') {
          // Rejoindre la cible dans la Marche restante (pas une Charge → pas de bonus), puis attaquer.
          // MÊMES mutations qu'un segment de battleClickTile (snapshot d'annulation compris).
          const b = get().battle!;
          const snapshot =
            (b.movementUsed ?? 0) === 0
              ? {
                  pos: Object.fromEntries(b.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
                  facing: { ...get().facing },
                  movedPreAction: b.movedPreAction,
                }
              : b.moveSnapshot ?? null;
          const geom = mountOf(b, active) ?? active;
          approachPath = plan.path;
          active.pos = { ...plan.dest };
          if (geom !== active) geom.pos = { ...plan.dest };
          displaceSmaller(get, geom);
          get().faceFromPath(active.id, approachPath);
          if (geom !== active) get().faceFromPath(geom.id, approachPath);
          bus.emit(EVT.ANIM_MOVE, { id: active.id, path: approachPath });
          if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: approachPath });
          applyZoneCrossings(get, active, approachPath); // Mur de feu & co (L11)
          set({ battle: { ...b, moveSnapshot: snapshot, movementUsed: (b.movementUsed ?? 0) + plan.cost, movedPreAction: b.movedPreAction || !b.acted, action: null, reachable: new Map(), preview: null } });
          bus.emit(EVT.SCENE_DIRTY);
        }
        if (option.freeKind) {
          // Frappe GRATUITE (Morsure/Caudale/Tentacule) — déjà à portée (Allonge 1) : résolveur = arme
          // naturelle synthétique (freeAttackWeapon, via `pa.freeKind`) ; pas de gate Allonge/munitions.
          pa = { attackerId: active.id, targetId: target.id, location: null, result: null, freeKind: option.freeKind, ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
        } else {
          // Arme effectivement employée selon la distance (mêlée à portée d'Allonge, distance sinon) — PAS
          // weapons[0], sinon un héros mixte mêlée+distance ne pourrait jamais tirer une cible éloignée (LDB
          // Armes l.297-298). Portée de mêlée = Allonge de l'arme (RAW-3, LDB 62 l.211/213), footprint inclus.
          const adj = combatDistance(active, target) <= meleeReachTiles(active.weapons);
          const w = attackWeapon(active.weapons, adj);
          if (!adj && w.type === 'melee') {
            get().log('Cible hors de portée de mêlée.'); // aucune arme à distance dispo → mêlée hors de portée
            return;
          }
          // Le gate de RESSOURCE (Recharge/munition) a déjà été appliqué plus haut (firedAttackBlock).
          pa = { attackerId: active.id, targetId: target.id, location: null, result: null };
        }
      }
      // (2) FRAPPE — après le glissé d'approche : ouvre la SÉQUENCE de combat (jet d'attaque = ÉTAPE 0,
      // CascadeModal via useAttackJetProps ; ses conséquences s'empilent APRÈS dans la MÊME fenêtre). Garde
      // dans le différé : encore le tour de l'acteur et aucune autre cascade ouverte (anti double-ouverture).
      afterApproach(get, approachPath, () => {
        const b = get().battle;
        if (!b || b.over || b.order[b.turn] !== active.id || get().pendingCascade) return;
        set({ pendingAttack: pa });
        startCascade(get, set, { title: 'Attaque', icon: '⚔️', purpose: 'combat', steps: [{ id: 'attack-jet', kind: 'attackJet', jet: 'attack', actorId: active.id }] });
      });
    },

    dismissReveal: () => {
      set((s) => ({ pendingReveals: s.pendingReveals.slice(1) }));
      resumeSuspendedAI(get, set); // file vidée alors qu'un tour d'IA était suspendu → reprendre l'avancement
    },
    battleTrample: (targetId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || active.advantage < 1) return; // exige ≥1 Avantage (LDB 85 l.320)
      const target = trampleTarget(battle, active, targetId); // adversaire adjacent plus petit
      if (!target) return;
      // OUVRE la modale (le jet se fait au clic « Lancer »)
      set({ pendingTrample: { attackerId: active.id, targetId: target.id, result: null }, battle: { ...battle, action: null } });
    },
    // ── Sélection d'ATTAQUE (« Attaque ▾ ») : arme une `AttackOption` (Arme + gratuites/zone/Piétinement/
    // Tentacule). Source des entrées : `availableAttacks` (combatFlow). Le clic-ennemi résout l'armée. ──
    battleSelectAttack: (id: string) => {
      if (combatBusy(get())) return;
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      // Arme une attaque pour le clic-ennemi (mode neutre : `action===null`). Re-sélectionner revient à l'Arme.
      const next = battle.selectedAttack === id ? 'arme' : id;
      set({ battle: { ...battle, action: null, selectedAttack: next, selectedSpellId: null, preview: null } });
    },
    battleManeuverArea: (kind: AttackKind) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      const a = creatureAttacks(active.traits ?? []).find((x) => x.kind === kind);
      if (!a) return;
      if (active.advantage < a.avantage) return; // Hurlement : ≥ coût RAW (2, dépense tout à l'application)
      set({ battle: { ...battle, action: null } }); // referme le menu avant la résolution
      // Hurlement (LDB 85 l.135) : PAS de jet d'attaquant — chaque cible tire son 1d10 + Test de
      // Résistance (jets SUBIS montrés au feed). Aucune modale différable → résolution immédiate (le
      // wrapper roule les jets subis + checkBattleOver). Dépense TOUS les Avantages (min 2).
      if (kind === 'hurlement') applyWail(get, set, active);
    },
    ...rollFlowActions('trample', FLOWS.trample, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
    trampleConfirm: () => {
      const { battle, pendingTrample: pt } = get();
      if (!battle || !pt || !pt.result) return;
      const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
      const target = battle.combatants.find((c) => c.id === pt.targetId);
      set({ pendingTrample: null });
      if (!attacker || !target) return;
      const prevActed = battle.acted; // action GRATUITE : ne consomme pas l'Action
      attacker.advantage = Math.max(0, attacker.advantage - 1); // coût : 1 Avantage (LDB 85 l.320)
      applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, pt.result);
      set({ battle: { ...get().battle!, acted: prevActed } });
    },
    trampleCancel: () => set({ pendingTrample: null }),

    // ── Manœuvre de créature par modale (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) : le jet de
    //    l'ATTAQUANT passe par FLOWS.maneuver (Lancer/Chance/Pacte/Résilience) ; « Appliquer » roule les
    //    défenseurs et résout l'opposition au feed via le RÉSOLVEUR GÉNÉRIQUE `resolveManeuver`. ──
    ...rollFlowActions('maneuver', FLOWS.maneuver, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
    maneuverConfirm: () => {
      const { battle, pendingManeuver: pm } = get();
      if (!battle || !pm || !pm.result) return;
      const attacker = battle.combatants.find((c) => c.id === pm.attackerId);
      set({ pendingManeuver: null });
      if (!attacker) return;
      const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === pm.kind);
      if (!a) return;
      const prevActed = battle.acted;
      // RÉSOLVEUR GÉNÉRIQUE unique : dépense `avantageSpent`, choisit la/les cible(s) (clic = `targetId`),
      // roule les défenseurs, applique les effets AUTHORÉS de la `ManeuverDef`. Étreinte/Regard = Action.
      const chosen = pm.targetId ? battle.combatants.find((c) => c.id === pm.targetId) : undefined;
      resolveManeuver(get, set, attacker, a.def, a.indice, pm.result, pm.avantageSpent, chosen);
      // Manœuvre GRATUITE de zone (Souffle/Vomi/Langue/Regard) : 1/tour aussi (RAW « une Attaque gratuite ») —
      // même compteur partagé. (Étreinte/Regard à l'Action ne comptent pas — gérées par `acted` ci-dessous.)
      if (a.trigger === 'free') {
        const atk = get().battle?.combatants.find((c) => c.id === pm.attackerId);
        if (atk) atk.freeAttacksThisTurn = { ...atk.freeAttacksThisTurn, [a.kind]: (atk.freeAttacksThisTurn?.[a.kind] ?? 0) + 1 };
      }
      const acted = a.trigger === 'action' ? true : prevActed; // Action consommée seulement par Étreinte/Regard
      set({ battle: { ...get().battle!, acted } });
      checkBattleOver(get, set);
    },
    maneuverCancel: () => set({ pendingManeuver: null }),
    maneuverSetAvantage: (n: number) => {
      const { battle, pendingManeuver: pm } = get();
      if (!battle || !pm || pm.result) return; // pas après le jet (l'Avantage fixe le DR)
      const attacker = battle.combatants.find((c) => c.id === pm.attackerId);
      if (!attacker) return;
      const clamped = Math.max(1, Math.min(n, attacker.advantage)); // 1..Avantage (LDB 85 l.238)
      set({ pendingManeuver: { ...pm, avantageSpent: clamped } });
    },

    // ── Course (LDB 15-Déplacement l.79-82) : utilise l'Action + un Test d'Athlétisme (+20) → déplacement
    //    étendu (Marche + Course + DR) vers la destination cliquée dans la zone de Course. « Un jet = une
    //    modale » : le Test passe par pendingRun. ──
    battleRun: (dest?: Pt) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted || battle.movementUsed > 0) return; // Course = Marche + Action (exige le plein Mouvement)
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || isEngaged(active) || hasCondition(active, COND.aTerre) || !canTakeAction(active)) return; // Engagé/À Terre → pas de Course (LDB 16 l.37)
      set({ pendingRun: { combatantId: active.id, dest, result: null }, battle: { ...battle, action: null, preview: null } });
    },
    ...rollFlowActions('run', FLOWS.run, get, set, ['roll', 'reroll', 'forceSuccess', 'darkPact']),
    runConfirm: () => {
      const { battle, scene, pendingRun: pr } = get();
      if (!battle || !scene || !pr || !pr.result || !pr.dest) return;
      const c = battle.combatants.find((x) => x.id === pr.combatantId);
      set({ pendingRun: null });
      if (!c) return;
      // Combat monté : Course au Mouvement de la monture, empreinte/collisions de la monture (couple solidaire).
      const geom = mountOf(battle, c) ?? c;
      const range = mountMovement(battle, c) + pr.result.bonusCases; // Marche + (Course + DR) (LDB 15 l.80)
      const blocked = occupied(battle, geom);
      const skill = c.mountId ? 'Chevaucher' : 'Athlétisme';
      // Le jet peut porter MOINS loin que la destination demandée : on suit le chemin et on s'arrête au
      // dernier point que le budget permet (« au max qu'il puisse faire »).
      const reach = reachable(scene, c.pos!, range, blocked, sizeFootprint(geom.size));
      const path = pathTo(scene, c.pos!, pr.dest, blocked, sizeFootprint(geom.size)) ?? [];
      let stopIdx = -1;
      for (let i = path.length - 1; i >= 0; i--) {
        if (reach.has(`${path[i].x},${path[i].y}`)) { stopIdx = i; break; }
      }
      const stop = stopIdx >= 0 ? path[stopIdx] : null;
      const log = [...battle.log];
      if (!stop || (stop.x === c.pos!.x && stop.y === c.pos!.y)) {
        // Jet désastreux : aucun pas possible — l'Action est tout de même consommée (le Test a eu lieu).
        log.push(ev('move', `${c.name} trébuche dans sa Course (${skill} ${pr.result.roll === 100 ? '00' : pr.result.roll}) : sur place.`, c.id));
        set({ battle: { ...get().battle!, action: null, acted: true, runBudget: range, reachable: new Map(), preview: null, log } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      const sub = path.slice(0, stopIdx + 1);
      const cost = reach.get(`${stop.x},${stop.y}`) ?? sub.length;
      c.pos = { ...stop };
      if (geom !== c) geom.pos = { ...stop }; // la monture court sous le cavalier
      displaceSmaller(get, geom);
      get().faceFromPath(c.id, sub);
      if (geom !== c) get().faceFromPath(geom.id, sub);
      bus.emit(EVT.ANIM_MOVE, { id: c.id, path: sub });
      if (geom !== c) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: sub });
      const short = stop.x !== pr.dest.x || stop.y !== pr.dest.y;
      log.push(ev('move', `${c.name} prend sa Course (${skill} ${pr.result.roll === 100 ? '00' : pr.result.roll}) : ${cost} cases${short ? ' — le souffle manque avant la destination' : ''}.`, c.id));
      // Budget du Tour étendu à Marche + Course + DR (l.80) : le reliquat non parcouru reste dépensable
      // en segments (A-M*) — `movementRemaining` lit `runBudget`.
      set({ battle: { ...get().battle!, action: null, acted: true, runBudget: range, movementUsed: (battle.movementUsed ?? 0) + cost, reachable: new Map(), preview: null, log } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    runCancel: () => set({ pendingRun: null }),

    // ── Approche d'une source de Peur (LDB 21 l.29) : Test de Calme Intermédiaire (+0) qui DIFFÈRE le
    //    clic d'approche. Succès → fearGate 'passed' (approches libres ce Tour) + l'intention est relancée ;
    //    échec → fearGate 'failed' (aucune approche ce Tour). « Un jet = une modale ». ──
    ...rollFlowActions('approach', FLOWS.approach, get, set, ['roll', 'reroll', 'forceSuccess', 'darkPact']),
    approachConfirm: () => {
      const { battle, pendingApproach: pa } = get();
      if (!battle || !pa || !pa.result) return;
      const c = battle.combatants.find((x) => x.id === pa.combatantId);
      const src = battle.combatants.find((x) => x.id === pa.sourceId);
      set({ pendingApproach: null });
      if (!c) return;
      const ok = pa.result.success;
      const log = [...battle.log, ev('fear', ok
        ? `${c.name} rassemble son courage : il peut approcher ${src?.name ?? 'la source de sa Peur'} ce Tour.`
        : `${c.name} n'ose pas approcher ${src?.name ?? 'la source de sa Peur'} : la Peur le cloue (ce Tour).`, c.id, src?.id)];
      set({ battle: { ...get().battle!, fearGate: ok ? 'passed' : 'failed', log } });
      if (ok) {
        // Relance l'intention différée (le gate est désormais 'passed').
        if (pa.intent.kind === 'tile') get().battleClickTile(pa.intent.pt, { confirm: true });
        else get().battleClickEntity(pa.intent.id, { confirm: true });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    approachCancel: () => set({ pendingApproach: null }), // renonce avant le jet : aucune trace, re-cliquable

    // ── Bénédiction de Protection (LDB 41 l.105) : Test de FM Accessible (+20) qui DIFFÈRE la déclaration
    //    d'attaque sur une cible bénie. Succès → l'attaque est relancée (`wardCleared` saute ce gate) ;
    //    échec → l'attaque n'a pas lieu (rien n'est consommé). « Un jet = une modale ». ──
    ...rollFlowActions('ward', FLOWS.ward, get, set, ['roll', 'reroll', 'forceSuccess', 'darkPact']),
    wardConfirm: () => {
      const { battle, pendingWard: pw } = get();
      if (!battle || !pw || !pw.result) return;
      const attacker = battle.combatants.find((x) => x.id === pw.attackerId);
      const target = battle.combatants.find((x) => x.id === pw.targetId);
      set({ pendingWard: null });
      if (!attacker || !target) return;
      const ok = pw.result.success;
      const log = [...battle.log, ev('info', ok
        ? `${attacker.name} surmonte sa honte (FM 🎲 ${pw.result.roll}/${pw.result.target ?? '?'}) et attaque ${target.name} malgré la Bénédiction de Protection.`
        : `${attacker.name} ne peut se résoudre à frapper ${target.name} (Bénédiction de Protection) — il doit choisir une autre cible ou une autre Action.`, attacker.id, target.id)];
      set({ battle: { ...get().battle!, log } });
      // Succès : relance la déclaration d'attaque (le gate est franchi pour CE clic via `wardCleared`).
      if (ok) get().battleClickEntity(pw.targetId, { confirm: true, wardCleared: true });
      bus.emit(EVT.SCENE_DIRTY);
    },
    wardCancel: () => set({ pendingWard: null }), // renonce avant le jet : aucune trace, re-cliquable

    // ── Se relever d'À Terre (LDB 16-États l.37) : utilise le Mouvement pour se mettre debout. Impossible
    //    tant qu'on n'a pas regagné ≥1 PB (LDB 18 l.28 : à 0 PB on reste au sol). Ne consomme PAS l'Action. ──
    battleStandUp: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !hasCondition(active, COND.aTerre) || active.wounds.current <= 0) return;
      removeCondition(active, COND.aTerre);
      set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, log: [...battle.log, ev('move', `${active.name} se relève.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    battleEndTurn: () => {
      if (combatBusy(get())) return; // finir le tour sous un flux différé corromprait l'état
      advanceTurn(get, set);
    },

    // ── Chance, 3e usage : pré-emption d'initiative en début de Round (LDB ch.17 l.27) ──
    roundStartPromote: (heroId: string) => {
      const { battle, pendingRoundStart } = get();
      if (!battle || !pendingRoundStart) return;
      const hero = battle.combatants.find((c) => c.id === heroId);
      // Rapide (LDB 62 l.318-319) / Tir rapide (LDB 10, arme à distance chargée) : pré-emption
      // GRATUITE ; sinon 1 point de Chance (LDB ch.17 l.27).
      const free = !!hero && (canStrikeFirst(hero.weapons) || canPreemptRanged(hero));
      if (!hero || hero.kind !== 'hero' || (!free && (hero.fortune ?? 0) <= 0)) return;
      if (battle.order[0] === heroId) return; // déjà en tête
      if (!free) hero.fortune = (hero.fortune ?? 0) - 1;
      const order = [heroId, ...battle.order.filter((id) => id !== heroId)]; // en tête de l'ordre du Round
      set({ battle: { ...battle, order, log: [...battle.log, ev('info', `${hero.name} choisit d'agir en premier (${free ? 'arme Rapide' : 'Chance'}).`, hero.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    roundStartReady: (seat: number) => {
      const prs = get().pendingRoundStart;
      if (!prs) return;
      const readyBySeat = { ...(prs.readyBySeat ?? {}), [seat]: true };
      set({ pendingRoundStart: { ...prs, readyBySeat } });
      // L'HÔTE lance quand TOUS les sièges requis ont validé (sièges possédant ≥1 héros vivant + l'hôte).
      const s = get();
      if (s.net.mode === 'guest') return; // l'invité ne fait que marquer (l'intent porte son siège)
      const required = new Set<number>([0]);
      for (const h of s.party) {
        if (h.dead || h.outOfRencontre) continue;
        const owner = s.net.ownership[h.id] ?? 0;
        if (s.net.seatNames[owner] != null) required.add(owner);
      }
      if ([...required].every((st) => readyBySeat[st])) get().confirmRoundStart();
    },
    confirmRoundStart: () => {
      const battle = get().battle;
      set({ pendingRoundStart: null });
      if (!battle) return;
      // Premier combattant valide de l'ordre (réordonné) à partir de l'index 0.
      let turn = 0;
      for (let i = 0; i < battle.order.length; i++) {
        const c = battle.combatants.find((x) => x.id === battle.order[i]);
        if (c && !isOutOfAction(c)) {
          turn = i;
          break;
        }
      }
      const active = battle.combatants.find((c) => c.id === battle.order[turn]);
      if (active) active.defensiveStance = false;
      fireTurnStartTriggers(get, set, active); // effets de bord « début de tour » du 1ᵉʳ combattant du Round (inerte sans donnée)
      set({ battle: { ...battle, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false, reachable: new Map() } });
      if (checkBattleOver(get, set)) return;
      bus.emit(EVT.SCENE_DIRTY);
      // Psychologie de DÉBUT de Round (LDB 21 l.14) : Traits ciblés (Animosité/Haine/…) + nouvelles
      // Terreurs → UNE cascade (un héros par étape) qui suspend l'IA jusqu'à résolution.
      openRoundStartPsych(get, set);
      if (get().pendingCascade) return; // la cascade tient la main ; sa fermeture reprendra l'IA
      maybeRunEnemyTurn(get, set);
    },

    // ── Destin sacrifié (LDB ch.17 l.31-35) — résolution de la suspension pendingFateSave ──
    fateNegate: () => {
      const { battle, pendingFateSave: p } = get();
      if (!battle || !p || p.source !== 'hit') return; // « Comment ça a pu rater ? » : coup létal seulement
      const hero = battle.combatants.find((c) => c.id === p.heroId);
      set({ pendingFateSave: null });
      if (!hero) return;
      hero.fate = (hero.fate ?? 0) - 1;
      if (p.restoreWounds != null) hero.wounds.current = p.restoreWounds; // annule tout le coup (restaure les PB)
      hero.criticalWounds = Math.max(0, (hero.criticalWounds ?? 0) - 1);
      set({ battle: { ...battle, log: [...battle.log, ev('info', `${hero.name} : « Comment ça a pu rater ? » — le coup fatal est évité (Destin −1).`, hero.id)] } });
      resumeEnemyTurn(get, set);
    },
    fateSurvive: () => {
      const { battle, pendingFateSave: p } = get();
      if (!battle || !p) return;
      const hero = battle.combatants.find((c) => c.id === p.heroId);
      const source = p.source;
      set({ pendingFateSave: null });
      if (!hero) return;
      hero.fate = (hero.fate ?? 0) - 1;
      hero.outOfRencontre = true; // survit mais éjecté de la rencontre (vivant)
      if (!hero.conditions.some((c) => c.name === COND.inconscient)) addCondition(hero, COND.inconscient);
      set({ battle: { ...battle, log: [...battle.log, ev('info', `${hero.name} : « Meurs un autre jour » — survit mais quitte le combat (Destin −1).`, hero.id)] } });
      if (source === 'slow') resolveRoundBoundary(get, set);
      else resumeEnemyTurn(get, set);
    },
    fateAccept: () => {
      const { battle, pendingFateSave: p } = get();
      if (!battle || !p) return;
      const hero = battle.combatants.find((c) => c.id === p.heroId);
      const source = p.source;
      set({ pendingFateSave: null });
      if (hero) {
        hero.dead = true;
        set({ battle: { ...battle, log: [...battle.log, ev('death', `${hero.name} succombe.`, hero.id)] } });
      }
      if (source === 'slow') resolveRoundBoundary(get, set);
      else resumeEnemyTurn(get, set);
    },

    battleDefendTotal: () => {
      if (!rule('combat-defensive-stance')) return; // règle optionnelle : Action « Sur la Défensive » désactivée (LDB 13 l.118)
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      if (!canTakeAction(active)) return; // Sonné : pas d'Action (LDB États l.123)
      active.defensiveStance = true;
      active.aiming = false; // une autre action que le tir gâche la visée
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('defensive', `${active.name} se met sur la défensive (+20 en défense).`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Changer de set d'armes en combat (Action gratuite, 1/tour, AUTORISÉ même Engagé — LDB 13 l.116) ──
    battleSwitchLoadout: (loadoutId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.loadoutSwapped) return; // 1 switch gratuit / tour
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || active.activeLoadoutId === loadoutId) return;
      loadoutSetActive(active, loadoutId);
      recomputeLoadout(active); // re-dérive les armes actives du combattant
      const name = active.loadouts?.find((l) => l.id === loadoutId)?.name ?? 'set';
      set({ battle: { ...battle, loadoutSwapped: true, log: [...battle.log, ev('detail', `${active.name} dégaine : ${name}.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Action Viser (LDB table des Difficultés, 14 - _GoBack.md l.90 : +20 au prochain tir, sans jet) ──
    battleAim: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
      if (!active.weapons.some((w) => w.type === 'ranged')) return; // viser = pour le tir
      active.aiming = true;
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('aim', `${active.name} vise soigneusement (+20 au prochain tir).`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Perturbante (LDB 62 l.275-276) : arme le mode « Repousser » — la prochaine attaque réussie
    // repousse d'1 m/DR AU LIEU de causer des Dégâts. Simple bascule (pas une Action).
    battleTogglePushback: () => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !active.weapons.some((w) => w.type === 'melee' && canPushback(w))) return;
      active.pushbackMode = !active.pushbackMode;
      set({ battle: { ...battle } });
    },

    // ── Rechargement = Test étendu de Projectiles (LDB 63-Armures l.28-29 + 12-Tests l.199-211) — par modale ──
    battleReload: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
      const w = active.weapons.find((x) => x.type === 'ranged');
      if (!w || (w.reload ?? 0) <= 0 || active.loaded) return; // rien à recharger (Arc = pas de défaut, ou déjà chargé)
      const skillValue = combatValue(active, 'ranged', w); // CT + avances Projectiles (Spé du groupe d'arme)
      set({
        pendingReload: {
          actorId: active.id,
          actorName: active.name,
          weaponUid: w.uid!,
          reload: reloadDRTarget(w), // Recharge ×2 si Arme d'équipe maniée seul (Aux Armes p.124)
          progressBefore: active.reloadProgress ?? 0,
          skillValue,
          difficulty: 'intermediaire',
          roll: null,
          target: skillValue + DIFFICULTY_MODIFIERS.intermediaire,
          sl: 0,
          success: false,
        },
      });
    },
    ...rollFlowActions('reload', FLOWS.reload, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
    reloadConfirm: () => {
      const { battle, pendingReload: pr } = get();
      if (!battle || !pr || pr.roll == null) return;
      const a = battle.combatants.find((c) => c.id === pr.actorId);
      set({ pendingReload: null });
      if (!a) return;
      a.aiming = false; // recharger est une autre action → la visée est perdue
      // Rechargement rapide / Artilleur (LDB 10) : +niveau DR au Test de rechargement (sur un jet réussi).
      const reloadTalent = pr.success ? reloadDRBonus(a, a.weapons.find((x) => x.type === 'ranged')) : 0;
      const progress = Math.max(0, pr.progressBefore + pr.sl + reloadTalent); // Test étendu : cumul des DR, plancher 0 (recommence)
      if (progress >= pr.reload) {
        a.loaded = true;
        a.reloadProgress = 0;
        a.chambered = magazineSize(a.weapons.find((x) => x.type === 'ranged')); // À Répétition : chargeur rempli (LDB 62 l.264-265)
      } else {
        a.reloadProgress = progress;
      }
      // Issue = source UNIQUE avec la popin (describeReload) — `progress` inclut le bonus de Talent (réalisé à l'application).
      const reloadName = a.weapons.find((w) => w.uid === pr.weaponUid)?.name ?? 'arme'; // uid → NOM (affichage)
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('reload', describeReload(pr, progress, reloadName), a.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      // Acteur PILOTÉ par l'IA (Auto-combat) : son tour était suspendu par la modale → reprise (comme cast/défense).
      if (aiDriven(get(), a) && get().battle) resumeEnemyTurn(get, set);
    },
    reloadCancel: () => set({ pendingReload: null }), // avant le jet : aucun coût
    battleRecoverState: (state: 'empetre' | 'en-flammes') => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
      const n = stacks(active, state);
      if (n <= 0) return; // pas porteur de l'État
      // Empêtré : Test OPPOSÉ de Force contre la « Force d'entrave » (LDB 16 l.61). Priorité à la Force
      // FIGÉE par l'effet (escapeStrength — ex. Force Mentale du lanceur d'un Enchevêtrement, vaut même
      // lanceur absent) ; sinon, Force de la source VIVANTE ; sinon, Test simple.
      let opposed = false, opponentValue: number | undefined, opponentName: string | undefined;
      if (state === COND.empetre) {
        const cond = active.conditions.find((c) => c.name === COND.empetre);
        const srcId = cond?.sourceId;
        const src = srcId ? battle.combatants.find((c) => c.id === srcId && !isOutOfAction(c)) : undefined;
        if (cond?.escapeStrength != null) {
          opposed = true; opponentValue = cond.escapeStrength; opponentName = src?.name ?? 'l’entrave';
        } else if (src) {
          opposed = true; opponentValue = testValue(src, undefined, 'F'); opponentName = src.name;
        }
      }
      const skillValue = state === COND.empetre ? testValue(active, undefined, 'F') : testValue(active, 'athletisme');
      set({
        pendingStateRecovery: {
          actorId: active.id, actorName: active.name, state,
          skillLabel: state === COND.empetre ? 'Force' : 'Athlétisme',
          skillValue, difficulty: 'intermediaire',
          opposed, opponentValue, opponentName, stacks: n,
          roll: null, opponentRoll: null, netSL: 0, success: false,
        },
      });
    },
    ...rollFlowActions('recover', FLOWS.recover, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
    recoverConfirm: () => {
      const { battle, pendingStateRecovery: sr } = get();
      if (!battle || !sr || sr.roll == null) return;
      const a = battle.combatants.find((c) => c.id === sr.actorId);
      set({ pendingStateRecovery: null });
      if (!a) return;
      const removed = recoveredStacks(sr.netSL, stacks(a, sr.state), sr.success); // 1 + DR, borné
      if (removed > 0) removeCondition(a, sr.state, removed);
      // Issue = source UNIQUE avec la popin (describeStateRecovery).
      finishPlayerAction(get, set, [describeStateRecovery(sr, a.name)], 'condition'); // consomme l'Action
    },
    recoverCancel: () => set({ pendingStateRecovery: null }), // avant le jet : aucun coût
    battleSelectAmmo: (uid: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      active.ammoUid = uid;
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Détermination (Resolve) : retirer un État de l'actif, +1 PB si À Terre (LDB ch.17 l.62-66) ──
    battleSpendResolve: (conditionName: string) => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || (active.resolve ?? 0) <= 0) return;
      if (!active.conditions.some((c) => c.name === conditionName)) return;
      active.resolve = (active.resolve ?? 0) - 1;
      removeCondition(active, conditionName, 1); // « Retirez un État » (un pion), LDB ch.17 l.66
      let extra = '';
      if (conditionName === COND.aTerre) {
        active.wounds.current = Math.min(active.wounds.max, active.wounds.current + 1); // +1 PB en se relevant (l.66)
        extra = ' (+1 PB en se relevant)';
      }
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', `${active.name} puise dans sa Détermination : retire l'État ${conditionName}${extra}.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    /** Détermination depuis une MODALE de jet (LDB 17 l.62-66) : même règle que `battleSpendResolve`,
     *  mais pour N'IMPORTE QUEL héros (en défense, le héros n'est pas l'actif) et sans toucher au
     *  mode d'action — le panneau pré-rempli recalcule ses modificateurs au re-rendu. */
    spendResolveCondition: (combatantId: string, conditionName: string) => {
      const s = get();
      const hero = (s.battle?.combatants ?? s.party).find((c) => c.id === combatantId);
      if (!hero || hero.kind !== 'hero' || (hero.resolve ?? 0) <= 0) return;
      if (!hero.conditions.some((c) => c.name === conditionName)) return;
      hero.resolve = (hero.resolve ?? 0) - 1;
      removeCondition(hero, conditionName, 1); // « Retirez un État » (un pion), LDB ch.17 l.66
      let extra = '';
      if (conditionName === COND.aTerre) {
        hero.wounds.current = Math.min(hero.wounds.max, hero.wounds.current + 1); // +1 PB en se relevant (l.66)
        extra = ' (+1 PB en se relevant)';
      }
      if (s.battle) {
        set({ battle: { ...s.battle, log: [...s.battle.log, ev('info', `${hero.name} puise dans sa Détermination : retire l'État ${conditionName}${extra}.`, hero.id)] } });
      } else {
        set({ party: [...s.party] });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    /** Détermination (LDB 17 l.62) : immunisé à la Psychologie jusqu'à la fin du PROCHAIN Round. */
    battleResolvePsychImmune: () => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      const msg = spendResolveForPsychImmunity(active); // SOURCE UNIQUE de l'immunité par Détermination
      if (!msg) return;
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', msg, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    /** Détermination (LDB 17 l.64) : ignore les modificateurs de Blessure critique jusqu'au début du prochain Round. */
    battleResolveIgnoreCrit: () => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || (active.resolve ?? 0) <= 0) return;
      active.resolve = (active.resolve ?? 0) - 1;
      active.ignoreCritMods = true; // effacé au début du prochain Round (passage de Round)
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', `${active.name} puise dans sa Détermination : ignore les modificateurs de Blessure critique ce Round.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Ramasser un objet au sol pendant un Round (un à la fois, LDB ch.13 l.115-116) ──
    battlePickup: (entityId: string, key: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || battle.over || battle.acted || !scene) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || !canTakeAction(active)) return; // ramasser = une Action
      if (get().flags[`__fouille_${entityId}`]) return; // déjà entièrement fouillé en exploration
      const ent = scene.entities.find((e) => e.id === entityId && e.kind === 'prop' && !!e.interact);
      if (!ent || !ent.interact || !active.pos || chebyshev(active.pos, ent.pos) > 1) return; // doit être adjacent/sur la case
      const [tag, idxStr] = key.split(':');
      if (tag !== 'eff') return; // clé = `eff:<index dans flowEffects(interact.flow)>` (cf. entityPickables)
      const idx = Number(idxStr);
      const eff = flowEffects(ent.interact.flow)[idx];
      if (!eff) return;
      let label: string; // assigné dans chaque branche atteignant l'usage (le cas `else` renvoie)
      if (eff.type === 'giveTrapping') {
        const it = itemFromGive(eff); // catalogue (trappingId) sinon objet custom
        label = it.name;
        // ajout NON équipé au combattant actif (clone battle) ET au membre party (persiste post-combat).
        active.items = [...(active.items ?? []), it];
        recomputeLoadout(active);
        set((s) => ({
          party: s.party.map((h) => {
            if (h.id !== active.id) return h;
            const clone: Combatant = JSON.parse(JSON.stringify(h));
            clone.items = [...(clone.items ?? []), JSON.parse(JSON.stringify(it))];
            recomputeLoadout(clone);
            return clone;
          }),
        }));
      } else if (eff.type === 'giveMoney') {
        label = 'Argent';
        applyEffects(get, set, [eff]); // bourse party (or/argent/cuivre)
      } else return; // effet non ramassable (journal/document…) : pas grappillable en combat
      // Retire la i-ème feuille `do` du flow de fouille (les props ramassables sont des seq de `do`).
      const flow = ent.interact.flow;
      if (flow.kind === 'seq') {
        let seen = -1;
        flow.steps = flow.steps.filter((s) => (s.kind === 'do' ? ++seen !== idx : true));
      } else ent.interact.flow = EMPTY_FLOW;
      // Pool de ramassables vidé : `consume` → le décor disparaît ; sinon il reste (ses Effets non-objet
      // — journal/document — restent fouillables en exploration ; pas de sens à les grappiller en combat).
      if (entityPickables(ent).length === 0 && ent.interact.consume) {
        removeEntity(get, set, entityId);
        set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('item', `${active.name} ramasse : ${label}.`, active.id)] } });
      } else {
        set({ scene: { ...scene }, battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('item', `${active.name} ramasse : ${label}.`, active.id)] } });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },

    attackSetLocation: (loc: HitLocation | null) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // la visée ne change plus après le jet
      set({ pendingAttack: { ...pa, location: loc } });
    },
    attackSetWeapon: (uid: string | null) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix d'arme avant le jet seulement
      set({ pendingAttack: { ...pa, weaponUid: uid ?? undefined } });
    },
    attackSetDualMode: (on: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix avant le jet seulement
      // Mode « des deux armes » : l'attaque-Action utilise la MAIN DIRECTRICE (la 2ᵉ frappe suit, off-hand).
      const a = get().battle?.combatants.find((c) => c.id === pa.attackerId);
      const mainUid = a?.weapons.find((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)?.uid;
      set({ pendingAttack: { ...pa, dualMode: on, weaponUid: on ? (mainUid ?? pa.weaponUid) : pa.weaponUid } });
    },
    attackSetIntoCrowd: (v: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix avant le jet seulement
      set({ pendingAttack: { ...pa, intoCrowd: v } });
    },
    attackSetHeldGround: (v: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix avant le jet seulement
      set({ pendingAttack: { ...pa, heldGround: v } });
    },
    attackSetCritLocation: (loc: HitLocation) => {
      const pa = get().pendingAttack;
      // RAW-2 (LDB 17 l.73) : réservé à un Coup Critique issu d'un succès FORCÉ (« Je ne faillirai pas ! »).
      if (!pa || !pa.forced || !pa.result?.critical) return;
      set({ pendingAttack: { ...pa, result: { ...pa.result, critLocation: loc } } });
    },
    attackRoll: () => {
      const { battle, pendingAttack: pa } = get();
      if (!battle || !pa || pa.result) return;
      const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
      const target = battle.combatants.find((c) => c.id === pa.targetId);
      if (!attacker || !target) return;
      applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
      const r = resolveAttack(get, attacker, target, pa.location ?? undefined, pa.fromCharge, pa.intoCrowd, pa.heldGround, pa.weaponUid); // charge montée → Force+Taille de la monture aux dégâts (LDB 14 l.223)
      if (!r) {
        get().log(firedWeapon(attacker, target, pa.weaponUid).type === 'ranged' ? 'Pas de ligne de vue (cible masquée).' : 'Cible hors de portée de mêlée.');
        set({ pendingAttack: null });
        return;
      }
      set({ pendingAttack: { ...pa, result: r.res, victimId: r.victim?.id } });
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `attack`) — Résilience (forceSuccess/setForcedRoll) plus bas.
    ...rollFlowActions('attack', FLOWS.attack, get, set, ['reroll', 'bonusSL', 'darkPact']),
    attackConfirm: () => {
      const { battle, pendingAttack: pa } = get();
      if (!battle || !pa || !pa.result) return;
      const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
      const target = battle.combatants.find((c) => c.id === pa.targetId);
      // Tir dévié dans la mêlée (LDB 14 l.136) : la touche est appliquée à l'allié intercalé, pas à la cible.
      const victim = pa.victimId ? battle.combatants.find((c) => c.id === pa.victimId) ?? target : target;
      const wasChain = !!pa.cleave; // cette attaque faisait-elle partie d'un balayage en cours ?
      const dualBefore = get().pendingDualStrike; // données de la 1ʳᵉ frappe (présentes quand on confirme la 2ᵉ)
      set({ pendingAttack: null });
      if (attacker && target && victim) {
        // Manœuvre de mêlée d'un trait SANS arme équipée (Morsure/Attaque caudale) : on synthétise l'arme
        // naturelle (même que l'IA, freeAttackWeapon) avec l'Indice lu du profil — source unique. La
        // mutation Tentacule, elle, A une arme équipée (`nat-tentacule`) → firedWeapon la résout normalement.
        const freeNatural = pa.freeKind && !attacker.weapons.some((w) => w.uid === pa.weaponUid)
          ? freeAttackWeapon(pa.freeKind, creatureAttacks(attacker.traits ?? []).find((a) => a.kind === pa.freeKind)?.bonus ?? 0)
          : null;
        const weapon = freeNatural ?? firedWeapon(attacker, target, pa.weaponUid);
        const prevActed = battle.acted; // pour la Frénésie : la 1re attaque du Round est GRATUITE
        const isDualMain = !!pa.dualMode && !pa.dualSecond && attacker.kind === 'hero'; // main directrice d'un dual
        const isDualSecond = !!pa.dualSecond; // 2ᵉ frappe (off-hand)
        // Maniement de deux armes (LDB 10 l.638) : l'Avantage des deux frappes est différé — accordé seulement
        // si LES DEUX touchent (cf. blocs isDualSecond ci-dessous).
        applyAttackResult(get, set, attacker, victim, weapon, pa.result, undefined, undefined, isDualMain || isDualSecond);
        // Maladresse d'un HÉROS (jet propre raté + double) → modale Tableau des Oups ! (LDB 14 l.53) ; elle interrompt le balayage.
        if (attacker.kind === 'hero' && attackerFumbled(pa.result, weapon)) {
          // Maladresse = étape de la cascade d'attaque (comme le Critique) ; advanceCombatJet l'enchaîne au bout.
          // La donnée (arme/résultat) vit SUR l'étape — source unique, plus de `pendingFumble` à désynchroniser.
          pushCombatStep(set, { id: `cons-fumble-${attacker.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: attacker.id, fumble: { weapon, result: null } });
          set({ pendingCleave: null });
        } else if (!isDualMain && !isDualSecond && !pa.freeKind) {
          // Frappe Mortelle (LDB 14 l.12 / 85 l.299) : démarre/poursuit le balayage d'un héros plus grand
          // (jamais en mode dual ni sur une Attaque gratuite de manœuvre).
          maybeHeroCleave(get, set, attacker, victim, pa.result, wasChain);
        }
        // Action « des deux armes » (LDB 10 l.638) : on a CHOISI d'attaquer des deux → −10 à toutes ses défenses
        // jusqu'à son prochain Tour ; si la main directrice TOUCHE, on ouvre la sélection de la 2ᵉ cible.
        if (isDualMain) {
          attacker.dualStrikeDefensePenalty = true;
          const off = attacker.weapons.find((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1);
          const mainRoll = pa.result.attackerDetail?.roll;
          if (pa.result.hit && mainRoll != null && off?.uid) {
            // Exception Critique : la 2ᵉ frappe utilise la valeur du tableau des Critiques (révélation poussée par applyAttackResult).
            const critValue = pa.result.critical ? get().pendingReveals.find((r) => r.kind === 'critical')?.dice : undefined;
            set({ pendingDualStrike: { attackerId: attacker.id, offWeaponUid: off.uid, mainRoll, critValue } });
          }
          set({ battle: { ...get().battle! } });
        }
        // 2ᵉ frappe résolue (LDB 10 l.638) : +1 Avantage UNIQUE si LES DEUX frappes touchent (pas +1 par frappe).
        // `dualBefore` n'existe que si la 1ʳᵉ a touché ; `pa.result.hit` = la 2ᵉ touche → les deux touchent.
        if (isDualSecond) {
          if (dualBefore && pa.result.hit) { gainAdvantage(attacker); attacker.gainedAdvThisRound = true; }
          set({ pendingDualStrike: null, battle: { ...get().battle! } });
        }
        // Attaque gratuite de MANŒUVRE de mêlée (Morsure/Attaque caudale/Tentacules, LDB 85) : l'Action est
        // préservée et les effets onHit PROPRES à la manœuvre s'appliquent (Caudale → À Terre si plus petit ;
        // Tentacules → Empêtré). On COMPTE l'usage : RAW « une Attaque gratuite pendant son tour » → 1/tour
        // (ou N/tour « par tentacule »), plafond appliqué par `availableAttacks` (compteur partagé).
        if (attacker.kind === 'hero' && pa.freeKind) {
          attacker.freeAttacksThisTurn = { ...attacker.freeAttacksThisTurn, [pa.freeKind]: (attacker.freeAttacksThisTurn?.[pa.freeKind] ?? 0) + 1 };
          applyFreeAttackEffects(get, attacker, victim, pa.freeKind, pa.result);
          set({ battle: { ...get().battle!, acted: prevActed } });
        }
        // Attaque d'Arme GRATUITE accordée par un talent (Frénésie : `grantFreeAttack{available}`, LDB 21 l.34) :
        // la 1ʳᵉ attaque d'arme du Round ne consomme PAS l'Action ; on COMPTE l'usage (plafond /Round = niveau,
        // via `freeAttacksThisTurn['arme']`) → l'attaque d'arme suivante coûtera l'Action. Donnée, plus de booléen.
        if (attacker.kind === 'hero' && !wasChain && !isDualSecond && !pa.freeKind && hasFreeWeaponAttack(attacker)) {
          attacker.freeAttacksThisTurn = { ...attacker.freeAttacksThisTurn, arme: (attacker.freeAttacksThisTurn?.['arme'] ?? 0) + 1 };
          set({ battle: { ...get().battle!, acted: prevActed, log: [...get().battle!.log, ev('frenzy', `${attacker.name} : attaque d'arme libre (Action préservée).`, attacker.id)] } });
        }
        // Talents d'attaque DÉCLENCHÉE (Assaut féroce : « une fois par Round, si vous touchez en mêlée →
        // attaque supplémentaire ») : une touche du héros résout ses `grantFreeAttack{onHit, immediate}` en
        // DONNÉE — instantanées, Action préservée, plafond /Round (qui borne aussi toute récursion).
        if (attacker.kind === 'hero' && pa.result?.hit && !wasChain && !isDualSecond && !pa.freeKind) {
          resolveTalentFreeAttacks(get, set, attacker, 'onHit', victim);
        }
        // Tir IMMOBILE (LDB 14 l.101) : le héros a renoncé à bouger pour annuler le −10 → on consomme son
        // Mouvement du Tour (il ne pourra plus se déplacer après ce tir).
        if (pa.heldGround && weapon.type === 'ranged') {
          const b2 = get().battle;
          if (b2) set({ battle: { ...b2, movementUsed: mountMovement(b2, attacker) } });
        }
      }
      // Séquence de combat (jet = étape 0) : enchaîner sur les conséquences empilées par applyAttackResult,
      // ou clore (resume) si aucune. La cascade RESTE ouverte tant qu'un enchaînement est en cours
      // (balayage `pendingCleave` / 2ᵉ frappe `pendingDualStrike`) → la frappe suivante se rend dans la MÊME
      // étape `attack` (`pendingAttack` mis à jour par cleaveAttack/dualStrikeAttack) ; on n'avance qu'au bout.
      advanceCombatJet(get);
    },
    attackCancel: () => {
      const pa = get().pendingAttack;
      if (pa?.fromCharge) return; // après une Charge, l'attaque est obligatoire (LDB 15-Dépl l.75)
      if (pa?.dualSecond) return; // 2ᵉ frappe d'un dual : engagée dès que la cible est choisie (le jet est imposé)
      if (pa?.cleave) { set({ pendingAttack: null }); return get().cleaveEnd(); } // annuler = terminer le balayage (cleaveEnd clôt la cascade)
      // Annuler ferme aussi la séquence-jet de combat (étape 0 non encore validée).
      const seq = get().pendingCascade;
      const closeSeq = seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack';
      set({ pendingAttack: null, ...(closeSeq ? { pendingCascade: null } : {}) });
    },
    cleaveAttack: (targetId: string) => {
      const { battle, pendingCleave: pc } = get();
      if (!battle || !pc) return;
      const attacker = battle.combatants.find((c) => c.id === pc.attackerId);
      const target = battle.combatants.find((c) => c.id === targetId);
      if (!attacker || !target) return;
      if (pc.count >= bonus(effectiveChar(attacker, 'CC'))) return; // borné à BCC enchaînements (LDB 14 l.12)
      if (!cleaveTargets(battle, attacker, pc.hitIds).some((t) => t.id === targetId)) return; // cible invalide (non adjacente / déjà frappée)
      set({ pendingAttack: { attackerId: attacker.id, targetId, location: null, result: null, cleave: true } });
    },
    cleaveEnd: () => { set({ pendingCleave: null }); advanceCombatJet(get); }, // fin du balayage → clore l'étape-jet de la cascade (reprise)
    dualStrikeAttack: (targetId: string) => {
      const { battle, pendingDualStrike: ds } = get();
      if (!battle || !ds) return;
      const attacker = battle.combatants.find((c) => c.id === ds.attackerId);
      const target = battle.combatants.find((c) => c.id === targetId);
      if (!attacker || !target || isOutOfAction(target)) return;
      const off = attacker.weapons.find((w) => w.uid === ds.offWeaponUid);
      if (!off) { set({ pendingDualStrike: null }); return; }
      if (!dualStrikeTargets(battle, attacker, off).some((t) => t.id === targetId)) return; // cible invalide (hors d'Allonge)
      // 2ᵉ frappe : jet IMPOSÉ (inversé / valeur du Critique) + pénalité main 2nde + nouveau jet de défense (LDB 10 l.638).
      const res = resolveDualSecond(get, attacker, target, off, ds.mainRoll, { critValue: ds.critValue });
      set({ pendingAttack: { attackerId: attacker.id, targetId, location: res.location ?? null, result: res, dualSecond: true, weaponUid: off.uid } });
    },
    dualStrikeSkip: () => { set({ pendingDualStrike: null }); advanceCombatJet(get); }, // « peut viser » = optionnel : pas de 2ᵉ → pas d'Avantage (LDB 10 l.638)
    // Maladresse : la donnée vit SUR l'étape COURANTE de la cascade (`step.fumble`) — source unique.
    fumbleRoll: () => {
      const pc = get().pendingCascade;
      const i = pc?.cursor ?? -1;
      const step = pc?.participants[i];
      if (!pc || step?.jet !== 'fumble' || !step.fumble || step.fumble.result) return; // un seul jet sur le Tableau des Oups !
      const result = rollOups(step.fumble.weapon, battleRng());
      set({ pendingCascade: { ...pc, participants: pc.participants.map((s, k) => (k === i ? { ...s, fumble: { ...s.fumble!, result } } : s)) } });
    },
    fumbleConfirm: () => {
      const { battle, pendingCascade: pc } = get();
      const step = pc?.participants[pc.cursor];
      if (!battle || !pc || step?.jet !== 'fumble' || !step.fumble?.result) return;
      const c = battle.combatants.find((x) => x.id === step.actorId);
      if (c) applyOups(get, set, c, step.fumble.weapon, step.fumble.result);
      // La Maladresse est l'étape COURANTE de la cascade combat → enchaîner le curseur (sa clôture reprend l'IA).
      get().cascadeNext();
    },

    // ── Défense réactive (héros attaqué par l'IA en mêlée) ──
    defenseSetMode: (mode: 'parade' | 'esquive') => {
      const pd = get().pendingDefense;
      if (!pd || pd.result) return; // le mode ne change plus après le jet
      set({ pendingDefense: { ...pd, mode } });
    },
    defenseSetParryWeapon: (uid: string | null) => {
      const pd = get().pendingDefense;
      if (!pd || pd.result) return; // choix d'arme de parade avant le jet seulement
      set({ pendingDefense: { ...pd, parryWeaponUid: uid ?? undefined } });
    },
    // Cycle unifié (spec `defense`) : jet initial = résolution pure (`atk` figé) ; Chance/Pacte ici,
    // Résilience (forceSuccess/setForcedRoll) plus bas.
    ...rollFlowActions('defense', FLOWS.defense, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
    defenseConfirm: () => {
      // « Appliquer » : applique le résultat puis REPREND le tour de l'IA suspendu.
      const { battle, pendingDefense: pd } = get();
      if (!battle || !pd || !pd.result) return;
      const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
      const defender = battle.combatants.find((c) => c.id === pd.defenderId);
      set({ pendingDefense: null }); // null AVANT la reprise → ré-entrance/double-advance impossibles
      if (attacker && defender) {
        const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, pd.result);
        if (suspended) return; // Déviation Critique du héros : l'étape 'deviation' (resolveDeviation) rejouera autoCleave/Piétinement/fumble/reprise
        if (pd.free) {
          set({ battle: { ...get().battle!, acted: pd.prevActed ?? get().battle!.acted } }); // attaque gratuite : ne consomme pas l'Action
          applyFreeAttackEffects(get, attacker, defender, pd.freeKind ?? '', pd.result); // À Terre (Attaque caudale)…
        } else autoCleave(get, set, attacker, defender, pd.result); // Frappe Mortelle (attaque principale)
      }
      // Maladresse du DÉFENSEUR héros (sa défense ratée sur un double, LDB 14 l.48-51) → étape Oups! de SA
      // cascade combat (donnée SUR l'étape — plus de `pendingFumble` à orpheliner), SANS déclencher la
      // Frénésie de l'attaquant (comme avant le fold).
      const parryWeapon = defender ? (pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : undefined) ?? defender.weapons[0] : undefined;
      if (defender && defender.kind === 'hero' && defenderFumbled(pd.result, parryWeapon) && !isOutOfAction(defender)) {
        // L'Oups ! porte sur l'ARME DE PARADE réellement utilisée (dégât d'arme / quelle arme casse), pas weapons[0].
        pushCombatStep(set, { id: `cons-fumble-${defender.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: defender.id, fumble: { weapon: parryWeapon!, result: null } });
        // Positionne le curseur défense → Maladresse quand la défense est l'étape courante (sinon
        // `pushCombatStep` a créé une cascade neuve déjà au curseur 0 sur la Maladresse).
        const casc = get().pendingCascade;
        if (casc && casc.participants[casc.cursor]?.jet === 'defense') get().cascadeNext();
        return;
      }
      // Frénésie : Test de CC gratuit après l'attaque PRINCIPALE (jamais après une attaque gratuite : `!pd.free`) → fire une seule fois.
      if (attacker && !pd.free) aiFrenzyAttack(get, set, attacker);
      // Attaques gratuites de créature : enchaîne la file (peut rouvrir une modale → ne pas reprendre).
      if (attacker && aiCreatureFreeAttacks(get, set, attacker)) return;
      // la défense est l'étape de SA cascade combat → enchaîner le curseur
      // (les conséquences empilées — Critique/Maladresse — s'affichent inline ; la clôture reprend l'IA).
      const seq = get().pendingCascade;
      if (seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'defense' && !get().pendingDefense) get().cascadeNext();
      else resumeEnemyTurn(get, set);
    },
    defenseCancel: () => {
      // « Subir » : défense passive (aucune réaction), puis reprise du tour de l'IA.
      const { battle, pendingDefense: pd } = get();
      if (!pd) return;
      const attacker = battle?.combatants.find((c) => c.id === pd.attackerId);
      const defender = battle?.combatants.find((c) => c.id === pd.defenderId);
      set({ pendingDefense: null });
      if (attacker && defender) {
        const res = resolveMeleePassive(attacker, defender, pd.weapon, pd.atk, pd.location ?? undefined);
        const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, res);
        if (suspended) return; // Déviation Critique du héros (même après « Subir » : la déviation d'armure est un choix distinct) — l'étape 'deviation' (resolveDeviation) reprend
        if (pd.free) {
          set({ battle: { ...get().battle!, acted: pd.prevActed ?? get().battle!.acted } }); // attaque gratuite : ne consomme pas l'Action
          applyFreeAttackEffects(get, attacker, defender, pd.freeKind ?? '', res); // À Terre (Attaque caudale)…
        } else autoCleave(get, set, attacker, defender, res); // Frappe Mortelle (attaque principale)
      }
      // Frénésie : Test de CC gratuit après l'attaque PRINCIPALE (jamais après une attaque gratuite : `!pd.free`) → fire une seule fois.
      if (attacker && !pd.free) aiFrenzyAttack(get, set, attacker);
      // Attaques gratuites de créature : enchaîne la file (peut rouvrir une modale → ne pas reprendre).
      if (attacker && aiCreatureFreeAttacks(get, set, attacker)) return;
      // la défense est l'étape de SA cascade combat → enchaîner le curseur.
      const seq = get().pendingCascade;
      if (seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'defense' && !get().pendingDefense) get().cascadeNext();
      else resumeEnemyTurn(get, set);
    },
    renounceResolve: (renounce: boolean) => resolveRenounce(get, set, renounce),

    ...rollFlowActions('attack', FLOWS.attack, get, set, ['forceSuccess', 'setForcedRoll']),
    ...rollFlowActions('defense', FLOWS.defense, get, set, ['forceSuccess', 'setForcedRoll']),

    startCombat: (encounterId: string, onVictory?: Effect[], opts?: { noSurprise?: boolean }) => {
      const { scene, party, partyPos } = get();
      if (!scene) return;
      const enc = scene.encounters.find((e) => e.id === encounterId);
      if (!enc) return;
      // Placer les héros près de leur position de groupe, les ennemis selon l'encounter.
      // Carry-in : on n'instancie pas les morts/éjectés ; on ré-importe les États PERSISTANTS du
      // groupe (Hémorragique, Empoisonné…) et on réinitialise tout l'état de combat transitoire.
      const livingParty = party.filter((h) => !h.dead && !h.outOfRencontre);
      const heroes = livingParty.map((h, i) => {
        const c = {
          ...JSON.parse(JSON.stringify(h)),
          pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i) },
          advantage: 0,
          conditions: persistentConditions(h), // États persistants seuls (le transitoire est jeté)
          activeEffects: [],                    // buffs en Rounds : ne survivent pas entre combats
          engagedWith: [], // pas d'Engagement hérité d'un combat précédent
          meleeThisRound: [],
          roundsAtZero: 0, // l'horloge de mort lente repart à neuf
          soinRencontreUtilise: false, // nouvelle rencontre → droit à un soin de Blessures (LDB 09 l.233)
          woundDressed: false, // « pansé pendant CE combat » repart à zéro (anti-Infection, LDB 18 l.382)
          tookCriticalThisFight: false, // critique « de ce combat » : repart à zéro
          wounds: { ...h.wounds },
        } as Combatant;
        // Re-dérive les armes ACTIVES depuis les items persistés : une arme usée/détruite au combat
        // précédent (damageTaken/destroyed sur l'ItemInstance) reste usée/détruite (LDB 62 l.177-180).
        if (c.items?.length) recomputeLoadout(c);
        // Munition par défaut + arme à distance chargée au début du combat (le `loaded` ne sert qu'aux armes à Recharge).
        const rw = c.weapons.find((w) => w.type === 'ranged');
        c.loaded = true;
        c.reloadProgress = 0;
        c.chambered = magazineSize(rw); // À Répétition : chargeur plein au début du combat (LDB 62 l.264)
        if (rw) c.ammoUid = compatibleAmmo(c, rw)[0]?.uid;
        return c;
      });
      // Chaque membre RÉFÉRENCE une entité de la scène. L'entité PORTE le profil/apparence/arme/traits
      // — on résout (membre + entité appariés), puis on spawne en CONSERVANT l'id de l'entité :
      // identité UNIFIÉE explo↔combat (Combatant.id === SceneEntity.id) → apparence identique (même seed),
      // pas de figurant dupliqué, et réconciliation post-combat directe (finalizeBattle).
      const byEntity = new Map(scene.entities.map((e) => [e.id, e]));
      const roster = (enc.members ?? [])
        .map((m) => ({ m, ent: byEntity.get(m.entityId) }))
        .filter((r): r is { m: typeof r.m; ent: SceneEntity } => !!r.ent);
      const enemies = roster.map(({ ent }) =>
        spawnEnemy(ent.ref, ent.statblock, ent.id, { ...ent.pos }, {
          appearance: ent.appearance, weapon: ent.weapon,
          optionals: ent.combat?.optionals, spells: ent.combat?.spells, randomChars: ent.combat?.randomChars, // LDB 76/78
        }));
      // Combat monté (LDB 14) : marquer les montures rideables, basculer les « alliés », puis appairer
      // les couples pré-montés (ridesEntityId → la monture). Le cavalier monte SUR sa monture.
      const idxByEntity = new Map(roster.map((r, i) => [r.ent.id, i]));
      roster.forEach(({ m }, i) => {
        if (m.side === 'ally') enemies[i].kind = 'hero';
        if (m.mount) enemies[i].mountable = true;
      });
      roster.forEach(({ m }, i) => {
        if (m.ridesEntityId == null) return;
        const mi = idxByEntity.get(m.ridesEntityId);
        const mount = mi == null ? undefined : enemies[mi];
        if (!mount) return;
        mount.mountable = true;
        mountUp(enemies[i], mount); // partage la position/empreinte de la monture (LDB 14 l.215)
      });
      const all = [...heroes, ...enemies];
      // Surprise (LDB 13) : si l'encounter le déclare, le camp embusqué teste Perception vs Discrétion.
      // `noSurprise` : le voyage annule l'embuscade quand le groupe « les voit venir » (Perception réussie).
      // Le Test (héros-atteignable) est ROUTÉ cadence-aware par `applySurprise` APRÈS la pose du `battle`
      // (héros manuel → cascade influençable ; embusqué ennemi → inline) — d'où le drapeau retenu ici.
      const doSurprise = !!enc.surprise && !opts?.noSurprise;
      // Initiative : on fixe l'Initiative de chaque combattant (point nommé `rollInitiative` — seam de la
      // règle « méthode d'Initiative »). Combat instinctif (LDB 10) : +10 × niveau, via talentInitiativeBonus.
      for (const c of all) c.initiative = rollInitiative(c, battleRng());
      // Effrayant (LDB 10) : le porteur inspire Peur (Indice = niveau) — comme un statbloc « Peur N ».
      for (const c of all) {
        const fear = talentFearIndice(c);
        if (fear > 0) c.causesPeur = Math.max(c.causesPeur ?? 0, fear);
      }
      // Lente (LDB 63 l.25) : le porteur d'une arme Lente frappe toujours en dernier dans le Round.
      const ordered = initiativeOrder(all);
      const order = [...ordered.filter((c) => !strikesLast(c.weapons)), ...ordered.filter((c) => strikesLast(c.weapons))].map((c) => c.id);
      const battle: BattleState = {
        combatants: all,
        order,
        baseOrder: order,
        // Pause d'ouverture : PERSONNE n'est actif (turn -1) tant qu'on n'a pas « Commencé » —
        // toutes les affordances (marche/course, anneaux, visée, clics, IA) dérivent de l'actif
        // et se taisent d'elles-mêmes ; confirmRoundStart pose le vrai tour (LDB ch.17 l.27).
        turn: -1,
        round: 1,
        action: null,
        selectedSpellId: null,
        reachable: new Map(),
        movementUsed: 0,
        movedPreAction: false,
        acted: false,
        log: [ev('round', `Le combat commence ! (Round 1)`)],
        over: null,
        onVictory: onVictory ?? enc.onVictory,
        // Pièges/hasards authorés de la scène → zones de bataille PERMANENTES (même runtime que les sorts).
        zones: sceneZonesToBattle(scene.effectZones),
      };
      // Repart d'aucune modale de jet héritée d'un combat/contexte précédent.
      // Ouverture = pause de début du Round 1 (pendingRoundStart) : champ visible, ordre d'Initiative dans la
      // frise, pré-emption « agir en premier » (Chance, #12a) — IA gelée. Un seul bouton « Commencer le combat »
      // (pas de phase « plan d'ensemble » séparée : c'était redondant avec la pause de Round).
      set({ ...resetFields('combatStart'), battle, mode: 'battle', pendingRoundStart: { round: battle.round } });
      // Effets « début de combat » authorés de chaque combattant (inerte tant qu'aucune donnée ne porte
      // un effet `onCombatStart`) — APRÈS la pose du `battle`, journalisés dans le journal de combat.
      for (const c of battle.combatants) {
        if (isOutOfAction(c)) continue;
        for (const line of fireTriggers(get, c, 'onCombatStart', { rng: battleRng(), set })) battle.log.push(ev('detail', line, c.id));
      }
      // Surprise APRÈS la pose du `battle` : le Test du guetteur est cadence-aware (héros manuel → cascade
      // influençable, qui s'OUVRE par-dessus la pause d'ouverture ; embusqué ennemi → inline dans le journal).
      if (doSurprise) applySurprise(get, set, enc.surprise!);
      get().faceAtCombatStart();
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Écran de victoire : assignation du butin (même flux que le marchand) + fermeture ──

    battleSelectAction: (a: 'cast' | 'resolve' | 'ammo' | 'heal' | null) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || !scene) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      // Surpris (LDB 16 l.132) : ni Mouvement ni Action ce tour — seule la Détermination (resolve) peut
      // le retirer (LDB 13 l.81). Tout le reste est bloqué.
      if (hasCondition(active, COND.surpris) && a !== 'resolve' && a !== null) {
        get().log(`${active.name} est Surpris : ni Mouvement ni Action ce tour (Détermination possible).`);
        return;
      }
      // Brisé (LDB 16 l.55) : Mouvement + Action doivent servir à FUIR / se cacher — aucune action
      // offensive. Le déplacement (fuite) passe par le clic-sol implicite (filtre dans computeMoveReach) ;
      // ici seuls « resolve » (Détermination, qui peut retirer le Brisé) et la fermeture (null) passent.
      // (« Se cacher » par Discrétion = pas de système de furtivité en combat ; approximé par « rester
      // hors de vue » → récupération en fin de Round, cf. brokenRecovery.)
      if (hasCondition(active, COND.brise) && a !== 'resolve' && a !== null) {
        get().log(`${active.name} est Brisé : il ne peut que fuir ou puiser dans sa Détermination.`);
        return;
      }
      // Sonné : pas d'Action (attaque/incantation/soin). La Détermination ('resolve') ne coûte pas l'Action
      // et peut retirer le Sonné (LDB ch.17 l.62-66) ; les manœuvres situationnelles gratuites (Se relever,
      // Se désengager…) sont des slots DIRECTS qui n'appellent pas battleSelectAction → elles passent ce garde.
      if (a !== 'resolve' && a !== null && !canTakeAction(active)) return;
      // Quitter le mode incantation oublie le sort sélectionné. Le déplacement et l'attaque n'ont PLUS de
      // mode : ils sont implicites au clic (battleClickTile/battleClickEntity) — le reachable stocké ne
      // porte que les budgets spéciaux (Course, post-Désengagement), on ne le touche pas ici.
      const selectedSpellId = a === 'cast' ? battle.selectedSpellId : null;
      set({ battle: { ...battle, action: a, selectedSpellId, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Guérison (LDB 09-Compétences l.226-243) — soin de Blessures / arrêt d'Hémorragie ──

    battleHeal: (targetId: string, mode: HealMode) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle) return;
      const healer = activeCombatant(battle);
      if (!healer || healer.kind !== 'hero' || !hasHealSkill(healer) || battle.acted || !canTakeAction(healer)) return;
      const target = battle.combatants.find((c) => c.id === targetId);
      if (!target || !availableHealModes(target).includes(mode)) return;
      const skillValue = testValue(healer, 'guerison');
      set({
        pendingHeal: {
          healerId: healer.id, healerName: healer.name, targetId: target.id, targetName: target.name,
          mode, intBonus: bonus(effectiveChar(healer, 'Int')),
          skillValue, difficulty: 'intermediaire', target: skillValue, roll: null, success: false, sl: 0,
        },
        battle: { ...battle, action: null },
      });
    },

    // ── Infirmerie (hors combat) : modale de soins PERSISTANTE — cf. state/medicFlow ──

    ...rollFlowActions('heal', FLOWS.heal, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess']),

    /** « Appliquer » : applique le soin (le jet est déjà figé). Coûte l'Action en combat. L'infirmerie
     *  (`medic`) n'est PAS touchée : la modale persistante reste ouverte pour l'acte suivant. */
    healConfirm: () => {
      const ph = get().pendingHeal;
      if (!ph || ph.roll == null) return;
      set({ pendingHeal: null });
      const st = get();
      const target = actorIn(st, ph.targetId);
      if (!target) return;
      let log: string[];
      if (ph.mode === 'wounds') {
        const r = resolveWoundsHeal(target, ph.intBonus, ph.sl, ph.success, battleRng());
        log = r.log;
        if (r.healed > 0) bus.emit(EVT.ANIM_FLOAT, { to: target.id, text: `+${r.healed}`, kind: 'heal' }); // flottant de soin (R8)
      } else {
        log = ph.mode === 'bleed'
          ? resolveBleedHeal(target, ph.sl, ph.success)
          : treatTrauma(target, ph.sl, ph.success); // mode 'trauma' — l'échec consomme aussi le jet (LDB 18 l.317)
      }
      finishPlayerAction(get, set, log, 'heal'); // sortie commune combat / hors combat
    },

    /** Annule avant tout jet. Acte PAYANT d'un PNJ (infirmerie) : remboursé tant que rien n'est lancé. */
    healCancel: () => {
      const ph = get().pendingHeal;
      if (ph?.paidCost && ph.roll == null) set((s) => ({ money: moneyAdd(s.money, toMoney(ph.paidCost!)) }));
      set({ pendingHeal: null });
    },

    /** Sélectionne un sort à incanter ; le clic suivant sur une cible le lance. Un sort de ZONE
     *  ouvre la modale DIRECTEMENT (flux « jet puis pose », LDB 47 l.29) — pas de cible à désigner. */
    battleSelectSpell: (spellId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || battle.acted) return;
      set({ battle: { ...battle, action: 'cast', selectedSpellId: spellId, reachable: new Map() } });
      castZoneSpell(get, set, active, spellId); // no-op si le sort n'est pas une ZdE chiffrable
      bus.emit(EVT.SCENE_DIRTY);
    },

    battleUseItem: (uid: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero') return;
      if (battle.acted || !canTakeAction(active)) return; // boire = une Action ; Sonné = pas d'Action
      const it = (active.items ?? []).find((i) => i.uid === uid);
      if (!it) return;
      const eff = itemUse(it, active);
      if (!eff) return;
      const log = [`${active.name} utilise : ${it.name}.`, ...applyItemUse(active, eff)];
      active.items = (active.items ?? []).filter((i) => i.uid !== uid); // consommé
      active.aiming = false; // une autre action que le tir gâche la visée
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ...evLines(log, 'item', active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },


    castRoll: () => {
      const { pendingCast: pc } = get();
      if (!pc || pc.result) return;
      const caster = actorIn(get(), pc.casterId);
      const target = actorIn(get(), pc.targetId);
      const spell = effectiveSpellOf(pc); // NI ×2 si lecture au grimoire (LDB 47 l.34)
      if (!caster || !target || !spell) return;
      // ZONE non posée (flux « jet puis pose ») : pas de cible désignée au jet — pas de ward
      // individuel (« N'écoutez point » protège une CIBLE), pas de résolution Projectile (les
      // Dégâts par cible sont dérivés du même jet À LA POSE, evaluateMissile).
      const unplacedZone = !!pc.zone && !pc.zone.center;
      const sigmar = unplacedZone ? 0 : castWardPenalty(get(), target, spell); // « N'écoutez point la Sorcière »
      const aqshy = domainCastBonus(get(), caster, spell); // attribut d'Aqshy : +10/En flammes proche
      const ward = sigmar + aqshy;
      const res = pc.missile && !unplacedZone
        ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused, ward)
        : resolveCasting(caster, spell, battleRng(), 'intermediaire', pc.focused, ward);
      if (sigmar) get().log(`${caster.name} : −20 en Langue (Magick) — la cible est sous la protection de Sigmar (N'écoutez point la Sorcière).`);
      if (aqshy) get().log(`${caster.name} : +${aqshy} en Langue (Magick) — Aqshy se nourrit des flammes proches.`);
      // Lanceur ENNEMI : Surincantation automatique (LDB 47 l.28-31) — le surplus de DR alloué à
      // l'axe Cible d'un Projectile (l'IA n'a pas de modale de choix ; ZdE déjà toutes-cibles).
      const auto = aiDriven(get(), caster) && pc.missile && !pc.zone
        ? aiOvercastPlan(caster, pc.targetId, spell, res, get().battle?.combatants ?? [], pc.focused, spellSightOf(get))
        : {};
      set({ pendingCast: { ...pc, result: res, ...auto } });
      // Dissipation (LDB 46 l.201-202) : un lanceur ENNEMI éligible chante un Contre-sort contre le
      // SORT d'un héros — opposé au Test d'Incantation (déclaré pendant l'incantation : l'IA n'attend
      // pas l'issue du jet — il module les DR, donc le budget de Surincantation AVANT la pose), un
      // seul par Round. Un jet CRITIQUE n'est pas contré (« Force inéluctable », LDB 46 l.59).
      // Zone non posée : « vise un point que vous pouvez voir » n'a pas encore de point — ancre la
      // moins inventive : le LANCEUR (même clause de distance FM mètres ; le RAW est muet).
      if (caster.kind === 'hero' && isDispellableSpell(spell) && !res.isCritical) {
        const best = counterspellCandidates(get().battle, get().scene, caster, unplacedZone ? caster : target)
          .sort((a, b) => castingValue(b, 'langue', 'Magick') - castingValue(a, 'langue', 'Magick'))[0];
        if (best) applyCounterspell(get, set, best);
      }
    },
    /** Contre-sort d'un HÉROS contre l'incantation ennemie figée (Dissipation, LDB 46 l.201-202). */
    // Cycle Chance/Pacte UNIFIÉ (spec `cast`) — Résilience (forceSuccess/setForcedRoll) plus bas.
    ...rollFlowActions('cast', FLOWS.cast, get, set, ['reroll', 'bonusSL', 'darkPact']),
    castConfirm: () => {
      const { pendingCast: pc } = get();
      if (!pc || !pc.result) return;
      // ZONE non posée et lançable → la confirmation EST le passage en pose (garde anti-application
      // sur l'ancre lanceur — la vraie application se fait à la pose, castCommitZone).
      if (pc.zone && !pc.zone.center && (pc.result.cast || (pc.result.isCritical && (pc.critChoice ?? 'puissance') === 'puissance'))) {
        get().castPlaceZone(true);
        return;
      }
      const caster = actorIn(get(), pc.casterId);
      const target = actorIn(get(), pc.targetId);
      const spell = effectiveSpellOf(pc); // NI ×2 si lecture au grimoire (LDB 47 l.34)
      // Surincantation : cibles supplémentaires + multiplicateur de durée (LDB 47 l.28-31).
      // ZdE : TOUTES les cibles de la zone sont visées (pas de budget de Surincantation).
      const extras = (pc.extraTargetIds ?? [])
        .map((id) => actorIn(get(), id))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(0, pc.zone ? undefined : pc.overcast?.targets ?? 0);
      // OPPOSITION (`spec.opposed`) : un Sort réussi dont la/les cible(s) opposent leur Test (FM/Int)
      // ne s'applique PAS encore — on ouvre le multijet d'opposition DANS la modale (GARDE pendingCast).
      // `oppositionConfirm` repose `opposedOutcome` puis rappelle castConfirm (ce bloc est alors sauté).
      if (caster && target && spell && pc.result.cast && !pc.opposedOutcome && get().battle
          && openCastOpposition(get, set, pc, [target, ...extras])) {
        return;
      }
      // FOLD : on ne ferme PLUS la cascade d'incantation ici — seulement le JET (CastModal disparaît).
      // La cascade `purpose:'combat'` (étape `jet:'cast'`) reste ACTIVE pour qu'un Critique de Sort
      // (pushReveal 'critical') ou une Imparfaite/Colère (pushCombatStep) s'y APPENDENT comme l'attaque.
      // On repère l'étape `jet:'cast'` SOUS le curseur AVANT applyCast (présente seulement si l'incantation
      // a été ouverte par openCastCascade ; absente quand un test/IA pose pendingCast à la main).
      const cascBefore = get().pendingCascade;
      const castStepIdx = cascBefore && cascBefore.purpose === 'combat' && cascBefore.participants[cascBefore.cursor]?.jet === 'cast'
        ? cascBefore.cursor : -1;
      set({ pendingCast: null }); // ferme le JET ; la cascade d'incantation reste active (cursor sur 'cast')
      if (caster && target && spell) {
        applyCast(get, set, caster, target, spell, pc.result, pc.missile, pc.focused, pc.critChoice, {
          durationMult: 1 + (pc.overcast?.duration ?? 0),
          extraTargets: extras,
          conjureForm: pc.conjureForm,
          opposedOutcome: pc.opposedOutcome,
        });
      }
      // Avance la cascade au-delà de l'étape `jet:'cast'` (résolue, CastModal éteint) : des conséquences
      // appendues (Critique/Imparfaite/Colère) → la cascade les joue (cursor+1) ; aucune → ferme la situation.
      // (Si pas de cascade d'incantation hôte — test/IA direct — on laisse intacte la cascade que les
      // conséquences ont éventuellement démarrée elles-mêmes, cursor déjà sur la 1ʳᵉ conséquence.)
      if (castStepIdx >= 0) {
        const casc = get().pendingCascade;
        if (casc && casc.purpose === 'combat' && casc.cursor === castStepIdx) {
          if (casc.participants.length > castStepIdx + 1) set({ pendingCascade: { ...casc, cursor: castStepIdx + 1 } });
          else set({ pendingCascade: null });
        }
      }
      // Lanceur ENNEMI (modale témoin) : le tour de l'IA était suspendu → reprise. No-op si une autre
      // interaction bloquante s'est ouverte (Destin, révélations, OU la cascade de conséquences encore
      // ouverte) — elle reprendra elle-même (cascadeNext → resumeSuspendedAI à la clôture).
      if (caster && aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    /** Incantation CRITIQUE (LDB 46 l.52-59) : le lanceur choisit l'effet bonus dans la modale. */
    castSetCritChoice: (choice: 'critique' | 'puissance' | 'ineluctable') => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.isCritical) return;
      set({ pendingCast: { ...pc, critChoice: choice } });
    },
    /** Arme invoquée à forme libre (Arme aethyrique) : le lanceur choisit la forme/Spé de Corps à corps. */
    castSetConjureForm: (form: ConjureForm) => {
      const pc = get().pendingCast;
      if (!pc) return;
      set({ pendingCast: { ...pc, conjureForm: form } });
    },
    /** Surincantation : chaque allocation consomme +2 DR du surplus — Sorts : DR − NI (LDB 47
     *  l.28-31) ; Bénédictions/Miracles : DR entier (LDB 41/42 « Degrés de Réussite » — Durée
     *  +durée initiale, Cibles +1). */
    castAllocOvercast: (axis: 'duration' | 'targets' | 'zone') => {
      const pc = get().pendingCast;
      const spell = pc && findSpellById(pc.spellId);
      if (!pc || !pc.result?.cast || !spell) return;
      const oc = pc.overcast ?? { duration: 0, targets: 0 };
      const ni = spell.cn == null ? 0 : pc.focused ? 0 : spell.cn; // Prière : pas de NI à dépasser
      const budget = Math.floor(Math.max(0, pc.result.sl - ni) / 2);
      if (oc.duration + oc.targets + (oc.zone ?? 0) >= budget) return; // surplus épuisé
      const next = { ...oc, [axis]: (oc[axis] ?? 0) + 1 };
      // « +Zone » (LDB 47 l.29) : chaque allocation ajoute la valeur INITIALE de Zone d'Effet —
      // le rayon du gabarit est recalculé (la pose et l'aperçu lisent `zone.radius`).
      const zone = axis === 'zone' && pc.zone
        ? { ...pc.zone, radius: zoneRadiusTilesAt(pc.zone.r0m ?? 0, next.zone ?? 0) }
        : pc.zone;
      set({ pendingCast: { ...pc, overcast: next, ...(zone ? { zone } : {}) } });
    },
    castToggleExtraTarget: (id: string) => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.cast) return;
      // Garde : seules les cibles ÉLIGIBLES (portée/éveillées, LDB 47 l.28-31) sont togglables —
      // indispensable depuis le clic carte (pickingTargets), inoffensif depuis le picker en modale.
      const pool = get().battle?.combatants ?? get().party;
      const caster = pool.find((c) => c.id === pc.casterId);
      const spell = findSpellById(pc.spellId);
      if (!caster || !spell || !overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, spellSightOf(get)).some((c) => c.id === id)) return;
      const cur = pc.extraTargetIds ?? [];
      const next = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < (pc.overcast?.targets ?? 0) && id !== pc.targetId
          ? [...cur, id]
          : cur;
      set({ pendingCast: { ...pc, extraTargetIds: next } });
    },
    castPickTargets: (on: boolean) => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.cast || !get().battle) return; // hors combat : pas de carte tactique → picker en modale
      set({ pendingCast: { ...pc, pickingTargets: on } });
    },
    /** Pose de la ZONE (flux « jet puis pose ») : la modale s'efface, le gabarit FINAL suit le
     *  curseur, le clic-case dépose (castCommitZone) ; `false` = revenir à la modale. */
    castPlaceZone: (on: boolean) => {
      const pc = get().pendingCast;
      if (!pc?.zone || pc.zone.center || !pc.result || !get().battle) return;
      set({ pendingCast: { ...pc, zone: { ...pc.zone, placing: on } } });
    },
    castCancel: () => {
      const pc = get().pendingCast;
      const caster = pc && actorIn(get(), pc.casterId);
      set({ pendingCast: null, pendingCascade: null }); // TERMINAL : ferme data + cascade-hôte
      // Modale d'un lanceur ENNEMI fermée sans appliquer : reprendre le tour suspendu (anti soft-lock).
      if (caster && aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    // Contre-sort à plusieurs (flux multi) : chaque verbe cible un participant via `pid` (fabrique unique).
    ...rollFlowActionsMulti('counterspell', FLOWS.counterspell, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
    counterspellConfirm: () => {
      const pcs = get().pendingCounterspell;
      if (!pcs) return;
      const rolled = pcs.participants.filter((p): p is CounterParticipant & { result: NonNullable<CounterParticipant['result']> } => !!p.result);
      // Dissipé si UN héros gagne ; sinon le MEILLEUR DR de Contre-sort réduit l'incantation (LDB 46 l.207).
      const disp = rolled.find((p) => p.result.dispelled);
      const best = disp ?? (rolled.length ? rolled.reduce((b, p) => (p.result.counter.sl > b.result.counter.sl ? p : b)) : undefined);
      set({ pendingCounterspell: null });
      if (best) {
        const counter = actorIn(get(), best.id);
        if (counter) applyCounterspellOutcome(get, set, counter, best.result); // mute `pendingCast.result`
      }
      get().castConfirm(); // applique le Sort (dissipé ou au DR net) + reprend le tour de l'IA
    },
    counterspellCancel: () => {
      if (!get().pendingCounterspell) return;
      set({ pendingCounterspell: null });
      get().castConfirm(); // « Laisser passer » : le Sort se résout tel quel
    },
    // Test Étendu SÉQUENTIEL (LDB 12) : chaque Round est un slot du flux multi (fabrique UNIQUE).
    // « Une situation = une modale » : le Test étendu EST une cascade à une étape `jet:'extended'`,
    // rendue par `CascadeModal` (via `useExtendedTestJetProps`). `pendingExtendedTest` coexiste comme
    // porteur de données (les Rounds y vivent) ; `extendedTestNext` ferme les deux à la réussite.

    ...rollFlowActionsMulti('cascade', FLOWS.cascade, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
    cascadeChoose: (pid: string, key: string) => setCascadeChoice(get, set, pid, key),
    cascadeNext: () => {
      const done = advanceCascade(get, set);
      if (done?.purpose === 'travel' && done.travelHalt) travelFlow.continueTravelAfterNight(get, set);
      else if (done?.combatEndBoundary) finishCombatEnd(get, set); // Tests de fin de combat clos → écran de victoire/défaite
      else if (done?.roundBoundary) enterRoundStartPause(get, set); // Peur de fin de Round close → pause de début de Round (PAS resolveRoundBoundary : décomptes déjà appliqués)
      else if (done?.purpose === 'combat') resumeSuspendedAI(get, set); // séquence de conséquences close → reprendre l'IA
    },
    cascadeResolveAll: () => resolveRemainingCascade(get, set), // → BILAN (la modale reste ouverte)
    cascadeFinish: () => {
      const done = finalizeCascade(get, set);
      if (done?.purpose === 'travel' && done.travelHalt) travelFlow.continueTravelAfterNight(get, set);
      else if (done?.combatEndBoundary) finishCombatEnd(get, set); // Tests de fin de combat clos → écran de victoire/défaite
      else if (done?.roundBoundary) enterRoundStartPause(get, set); // Peur de fin de Round close → pause de début de Round (PAS resolveRoundBoundary)
      else if (done?.purpose === 'combat') resumeSuspendedAI(get, set); // bilan clos → reprendre l'IA suspendue
    },
    // Détermination (LDB 17 l.62) sur une étape de PSYCHOLOGIE (combat/rencontre) : immunité TEMPORAIRE,
    // PAS une réussite forcée. On dépense 1 point de Détermination (`spendResolveForPsychImmunity` →
    // `psychImmuneRoundsLeft = 2`) et on MARQUE l'étape `immune` ; l'applier psy lit ce flag pour NE PAS
    // cumuler le DR (Peur) ni poser le Brisé (Terreur) — la source est IGNORÉE ce Round, pas vaincue, et
    // reprend à l'expiration. Le `result` synthétique (success) ne sert qu'à faire avancer la cascade :
    // c'est `step.immune` (pas le succès) qui gouverne la conséquence côté applier. Réservé aux étapes psy.
    cascadeDetermine: (pid: string) => {
      const p = get().pendingCascade;
      if (!p) return;
      const idx = p.participants.findIndex((s) => s.id === pid);
      const step = idx >= 0 ? p.participants[idx] : undefined;
      if (!step || step.result || step.target == null || !step.actorId) return;
      if (!step.combatPsych && !step.encounterPsych) return; // Détermination = immunité PSYCHOLOGIQUE seulement
      const actor = actorIn(get(), step.actorId);
      if (!actor || (actor.resolve ?? 0) <= 0) return;
      const msg = spendResolveForPsychImmunity(actor); // dépense la Détermination + pose psychImmuneRoundsLeft
      if (!msg) return;
      const e = evaluateTest(1, step.target);
      set({
        pendingCascade: { ...p, participants: p.participants.map((s, k) => (k === idx ? { ...s, immune: true, result: { roll: 1, target: step.target!, sl: e.sl, success: true } } : s)) },
        party: [...get().party],
      });
      get().log(msg);
    },
    // Incantation OPPOSÉE (multijet `FLOWS.castOpposition`) : chaque cible oppose son Test ; cible IA
    // = rangée témoin (jet auto-roulé à l'ouverture, cf. openCastOpposition). Mêmes 6 verbes que les autres flux.
    // Préfixe store `opposition` ≠ clé de flux `castOpposition` (handler passé explicitement).
    ...rollFlowActionsMulti('opposition', FLOWS.castOpposition, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
    oppositionConfirm: () => {
      const pco = get().pendingCastOpposition;
      const pc = get().pendingCast;
      if (!pco || !pc) return;
      // Issue par cible (résisté + marge de DR) → portée par `pendingCast.opposedOutcome`, lue par applyCast.
      const outcome: Record<string, { resisted: boolean; margin: number }> = {};
      for (const part of pco.participants) if (part.result) outcome[part.id] = { resisted: part.result.resisted, margin: part.result.margin };
      set({ pendingCastOpposition: null, pendingCast: { ...pc, opposedOutcome: outcome } });
      get().castConfirm(); // applique le Sort (cibles résistantes ignorées, autres à la marge)
    },
    /** Ouvre une incantation HORS COMBAT (couture D) : un héros lanceur du groupe cible self/allié.
     *  Réservé aux sorts NON-offensifs — les Projectiles magiques exigent une cible ennemie (combat). */
    oocCastSpell: (casterId: string, spellId: string, targetId: string, fromGrimoire?: boolean) => {
      const { battle, party } = get();
      if (battle) return; // en combat : l'incantation passe par l'action de combat
      const caster = party.find((c) => c.id === casterId);
      const spell = findSpellById(spellId);
      if (!caster || !spell) return;
      if (isMagicMissile(spell)) {
        get().log(`${spell.label} est un Projectile magique — il faut une cible ennemie (en combat).`);
        return;
      }
      const target = party.find((c) => c.id === targetId) ?? caster;
      castSpell(get, set, caster, target, spellId, fromGrimoire); // pose `pendingCast` (missile:false, focused selon caster.focus)
    },

    /** Focalise un sort d'Arcane/Domaine (Test étendu de Focalisation). */
    battleFocusSpell: (spellId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || battle.acted) return;
      const spell = findSpellById(spellId);
      if (!spell || !isArcaneSpell(spell)) {
        get().log('Ce sort ne peut pas être focalisé.');
        return;
      }
      // Contrecoup bloquant la Focalisation (LDB 46/40), s'il y en a un d'actif.
      const fblocked = castBlockedBy(active, 'focalisation');
      if (fblocked) {
        get().log(`${active.name} ne peut pas focaliser : ${fblocked}.`);
        return;
      }
      // OUVRE la modale (le Test étendu se fait au clic « Lancer »)
      set({ pendingFocus: { casterId: active.id, spellId: spell.id, result: null } });
    },
    // Focalisation COMMUNE combat/hors-combat (couture D) : acteur via `actorIn`, sortie journal hors combat.
    ...rollFlowActions('focus', FLOWS.focus, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess']),
    focusConfirm: () => {
      const { pendingFocus: pf } = get();
      if (!pf || !pf.result) return;
      const caster = actorIn(get(), pf.casterId);
      const spell = findSpellById(pf.spellId);
      set({ pendingFocus: null });
      if (!caster || !spell) return;
      const res = pf.result;
      const prev = caster.focus?.spell === pf.spellId ? caster.focus.dr : 0;
      caster.focus = { spell: pf.spellId, dr: prev + res.dr };
      const ni = spell.cn ?? 0;
      const logLines = [res.log];
      // Composant d'incantation (LDB 46 l.158-163) : la Focalisation est une incantation en cours —
      // un composant adapté au Sort est consumé (si un contrecoup survient) et dégrade l'Imparfaite.
      const compUsed = (res.isCritical || res.isFumble) && useSpellComponent(caster, pf.spellId, logLines);
      // Focalisation CRITIQUE (LDB 46 l.185-186) : le sort est lançable au prochain Round
      // QUEL QUE SOIT le DR accumulé — mais tant de magie si vite concentrée provoque un
      // contrecoup : Imparfaite Mineure, sauf Talent Harmonisation aethyrique.
      if (res.isCritical) {
        caster.focus = { spell: pf.spellId, dr: Math.max(caster.focus.dr, ni) };
        logLines.push(`${caster.name} — Focalisation CRITIQUE : ${spell.label} est lançable au prochain Round (NI 0) !`);
        if (!hasTalent(caster, 'Harmonisation aethyrique')) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: compUsed }));
        else logLines.push(`Harmonisation aethyrique : le contrecoup est maîtrisé (pas d'Imparfaite).`);
      }
      logLines.push(caster.focus.dr >= ni ? `${caster.name} a focalisé assez de magie pour lancer ${spell.label} (NI 0).` : `Focalisation : ${caster.focus.dr}/${ni} DR.`);
      // Maladresse en Focalisation → Incantation Imparfaite Majeure (LDB l.190-191 :
      // tout double OU tout résultat en 0 au-delà de la Compétence).
      if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'majeure', { componentDowngrade: compUsed }));
      finishPlayerAction(get, set, logLines, 'focus'); // sortie commune combat / hors combat
    },
    focusCancel: () => set({ pendingFocus: null }),
    /** Ouvre une Focalisation HORS COMBAT (couture D) : accumule `caster.focus` pour un Sort d'Arcane/Domaine. */
    oocFocusSpell: (casterId: string, spellId: string) => {
      const { battle, party } = get();
      if (battle) return; // en combat : Focalisation = action de combat
      const caster = party.find((c) => c.id === casterId);
      const spell = findSpellById(spellId);
      if (!caster || !spell) return;
      if (!isArcaneSpell(spell)) {
        get().log('Ce sort ne peut pas être focalisé.');
        return;
      }
      const fblocked = castBlockedBy(caster, 'focalisation');
      if (fblocked) {
        get().log(`${caster.name} ne peut pas focaliser : ${fblocked}.`);
        return;
      }
      set({ pendingFocus: { casterId: caster.id, spellId: spell.id, result: null } });
    },
    // Psychologie de COMBAT (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round (Traits/Terreur au
    // DÉBUT via openRoundStartPsych ; Peur — Test étendu — à la FIN via openRoundEndPsych), applier
    // 'combatPsych', résolue par les handlers `cascade*`. La
    // Détermination (immunité, LDB 17 l.62) est offerte sur l'étape par `cascadeDetermine`.
    // Psychologie À LA RENCONTRE (couture C, LDB 21) : cascade équivalente, applier 'encounterPsych',
    // ouverte par `openEncounterPsych` à l'entrée de scène.

    // ── Entrée en Frénésie d'un héros (LDB 21 l.31-36) : Test de FM, succès → +1 BF / immunité psy / attaque obligatoire ──

    battleFrenzy: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.kind !== 'hero' || active.frenzied || !isFrenzyCapable(active)) return;
      // OUVRE la modale — le Test de FM se fait au clic « Lancer ».
      set({ pendingFrenzy: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
    },
    ...rollFlowActions('frenzy', FLOWS.frenzy, get, set, ['roll', 'reroll', 'forceSuccess', 'darkPact']),
    frenzyConfirm: () => {
      const { battle, pendingFrenzy: pf } = get();
      if (!battle || !pf || !pf.result) return;
      const c = battle.combatants.find((x) => x.id === pf.combatantId);
      set({ pendingFrenzy: null });
      if (!c) return;
      // Issue = source UNIQUE avec la popin (describeFrenzy).
      const log = [describeFrenzy(pf, c.name)];
      if (pf.result.success) c.frenzied = true;
      set({ battle: { ...get().battle!, acted: true, action: null, log: [...battle.log, ...evLines(log, 'frenzy', c.id)] } });
      checkBattleOver(get, set);
    },
    frenzyCancel: () => set({ pendingFrenzy: null }),

    // Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) du flux `cast` (forceSuccess/dé choisi) —
    // cycle UNIFIÉ par la fabrique rollFlow. (`attack`/`defense` plus haut ; `test` reste côté store.)
    ...rollFlowActions('cast', FLOWS.cast, get, set, ['forceSuccess', 'setForcedRoll']),
  };
}
