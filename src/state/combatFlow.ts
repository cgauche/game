/**
 * Flux de combat (tour par tour) extrait de store.ts pour le garder navigable.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 * Refacto pure -- comportement preserve.
 */
import type { GameState, BattleState, RevealEntry } from './store';
import { Combatant, ItemInstance, ActiveEffect, CHAR_LABELS, HitLocation, Weapon, DIFFICULTY_MODIFIERS } from '../engine/types';
import { battleRng } from './battleRng';
import { ev, evLines, type CombatEventKind } from './combatLog';
import { TEMPO } from './tempo';
import { walkMs } from '../gameIso/walkPath';
import { facingToward } from '../gameIso/rig/facing';
import type { Dir8 } from './dir8';
import { d10 } from '../engine/dice';
import {
  resolveMelee,
  resolveRanged,
  defenseValue,
  combatValue,
  rollMeleeAttacker,
  rollDisengageAttack,
  attackWeapon,
  hitLocationByShape,
  locationLabel,
  reverseRoll,
  woundsFromHit,
  rangeBandModifier,
  resolveStrayRangedHit,
  resolveTrample,
  AttackResult,
  ModLine,
  outnumberMod,
  crowdMod,
} from '../engine/combat';
import { engage, isEngaged, decayEngagement, chargeAdvantage, disengageFrom, clearEngagementOf, reachTiles, meleeReachTiles } from '../engine/engagement';
import { sizeGap } from '../engine/size';
import { footprintTiles, combatDistance, sizeFootprint, occupiesTile } from './footprint';
import { isUnbreakable, resolveQualities, hasQuality } from '../engine/qualities/dispatch';
import {
  isMagicMissile,
  parseHeal,
  parseConditionEffect,
  parseCharBuffs,
  buffDurationRounds,
  type CastResult,
  type MissileResult,
} from '../engine/magic';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { opposedTest, rollTest } from '../engine/tests';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { partyBest, isSocialTest, socialPsychMod, socialPsychLabel, testValue } from '../engine/skills';
import { recomputeLoadout, itemFromTrapping, weaponWithAmmo, compatibleAmmo, damageArmour } from '../engine/items';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, hasCondition, cannotDefend, canTakeAction, applyZeroWounds, loseWounds, tickDeath, usesSuddenDeath, inDeathCondition, stacks, recoveredStacks } from '../engine/conditions';
import { creatureAttacks, venomDifficulty, ATTACK_LABEL, type CreatureAttack } from '../engine/creatureAttacks';
import { carryOverState } from '../engine/persistence';
import { rollContraction, contractDisease } from '../engine/disease';
import { hasHealSkill } from '../engine/healing';
import { rollCritical, critLocationRoll } from '../engine/critical';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { traumaFromKind, hasSurgeryTrauma, escalateSensoryLoss, consolidateAmputations } from '../engine/trauma';
import { effectiveWeaponDamage, damageWeapon, destroyWeapon, isImprovised, solideSaveThreshold } from '../engine/weaponDamage';
import { TIME_COST } from '../engine/timeCost';
import { DAY_PHASES, minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { restRecovery } from '../engine/rest';
import { findSpell } from '../data/index';
import { Scene, Effect, isWalkable, condMet } from './scene';
import { sweepDismountDeaths, mountedAttackMods, mountedDodgePenalty, mountMovement, mountOf, mountUp, mountableNear } from './mount';
import { lineOfSightCover, coverModifier, smokeZone } from './lineOfSight';
import { fearSourceFor, resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, isPsychImmune, clearPsychOf, resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple, CIBLE_TYPES, PsychType } from '../engine/psychology';
import { groupMatch } from '../engine/groups';
import { sceneCombatModifiers } from './sceneRules';
import { reachable, pathTo, chebyshev, Pt } from './path';
import { chooseEnemyAction } from './ai';
import { bus, EVT } from './bus';


// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

export function activeCombatant(battle: BattleState): Combatant | undefined {
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]);
}

/** Empile une révélation témoin (montre le dé d'un jet subi/sur table) en queue de file FIFO. */
export function pushReveal(set: any, entry: RevealEntry): void {
  set((s: GameState) => ({ pendingReveals: [...s.pendingReveals, entry] }));
}

/**
 * Tuiles qui BLOQUENT le déplacement de `mover` : l'empreinte (LDB 15 l.55) de chaque AUTRE
 * combattant, SAUF ceux de Taille STRICTEMENT inférieure au mover — une créature plus grande
 * « dégage les combattants de taille inférieure du chemin, se déplaçant où elle veut » (LDB 85
 * l.308-309). Passer un id (legacy/tests) ⇒ aucun filtrage de Taille (toutes les empreintes bloquent).
 */
export function occupied(battle: BattleState, mover: Combatant | string): Set<string> {
  const exceptId = typeof mover === 'string' ? mover : mover.id;
  const moverSize = typeof mover === 'string' ? undefined : mover.size;
  const s = new Set<string>();
  for (const c of battle.combatants) {
    if (c.id === exceptId || isOutOfAction(c) || !c.pos) continue;
    if (moverSize !== undefined && sizeGap(c.size, moverSize) < 0) continue; // plus petit → dégagé du chemin (85 l.308-309)
    for (const t of footprintTiles(c.pos, c.size)) s.add(`${t.x},${t.y}`);
  }
  return s;
}

export function findFreeTile(scene: Scene): Pt {
  for (let y = 0; y < scene.dimensions.h; y++)
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y)) return { x, y };
  return { x: 0, y: 0 };
}

/**
 * Après qu'un combattant a bougé, « dégage de son chemin » les combattants de Taille STRICTEMENT
 * inférieure dont la case est désormais SOUS son empreinte (LDB 85 l.308-309 : un plus grand « se
 * déplace où il veut ») : chacun est poussé vers la case libre la plus proche, hors de l'empreinte.
 * Mute les `pos` en place ; l'appelant émet SCENE_DIRTY / re-set la bataille. Renvoie true si déplacé.
 */
export function displaceSmaller(get: () => GameState, mover: Combatant): boolean {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !mover.pos || sizeFootprint(mover.size) <= 1) return false;
  let moved = false;
  for (const c of battle.combatants) {
    if (c.id === mover.id || c.id === mover.riderId || isOutOfAction(c) || !c.pos) continue; // jamais éjecter SON propre cavalier (il chevauche)
    if (sizeGap(c.size, mover.size) >= 0) continue; // pas strictement plus petit → non dégagé
    if (!occupiesTile(mover.pos, mover.size, c.pos.x, c.pos.y)) continue; // pas sous l'empreinte du mover
    const free = nearestFreeOutside(scene, battle, c, mover);
    if (free) { c.pos = free; moved = true; }
  }
  return moved;
}

/** Case walkable la plus proche de `c`, non occupée (toutes empreintes) et HORS de l'empreinte de
 *  `mover` — anneaux croissants (rayon ≤ 6). `undefined` si rien (c reste, co-occupation tolérée). */
function nearestFreeOutside(scene: Scene, battle: BattleState, c: Combatant, mover: Combatant): Pt | undefined {
  const blocked = occupied(battle, c.id); // id (legacy) ⇒ TOUTES les empreintes bloquent (placement)
  for (let r = 1; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // seulement l'anneau de rayon r
        const x = c.pos!.x + dx, y = c.pos!.y + dy;
        if (occupiesTile(mover.pos!, mover.size, x, y)) continue; // garder hors empreinte du mover
        if (isWalkable(scene, x, y) && !blocked.has(`${x},${y}`)) return { x, y };
      }
  return undefined;
}

export function removeEntity(get: () => GameState, set: any, id: string) {
  const scene = get().scene;
  if (!scene) return;
  scene.entities = scene.entities.filter((e) => e.id !== id);
  set({ scene: { ...scene } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Items ramassables d'un prop interactif : un par effet « donneur » de son `interact`.
 *  `key` = `eff:<index dans interact.effects>`. Les effets non-objet (journal/document…) sont ignorés. */
export function entityPickables(ent: { interact?: { effects: Effect[] } }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.interact?.effects ?? []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `eff:${i}`, label: e.trapping });
    else if (e.type === 'giveItem') out.push({ key: `eff:${i}`, label: e.item });
    else if (e.type === 'giveMoney') out.push({ key: `eff:${i}`, label: 'Argent' });
  });
  return out;
}

export function checkTriggers(get: () => GameState, set: any) {
  const { scene, partyPos, flags } = get();
  if (!scene) return;
  for (const t of scene.triggers) {
    if (flags[`__trigger_${t.id}`]) continue;
    if (!inRect(partyPos, t.rect)) continue;
    if (t.condition && !condMet(t.condition, flags)) continue;
    if (t.once) flags[`__trigger_${t.id}`] = true;
    applyEffects(get, set, t.effects);
    set({ flags: { ...flags } });
  }
}

export function inRect(p: Pt, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}


export function applyEffects(get: () => GameState, set: any, effects: Effect[]) {
  for (const e of effects) {
    switch (e.type) {
      case 'setFlag':
        set((s: GameState) => ({ flags: { ...s.flags, [e.flag]: e.value ?? true } }));
        break;
      case 'journal':
        get().log(e.text);
        break;
      case 'giveItem':
        set((s: GameState) => ({ inventory: [...s.inventory, e.item] }));
        get().log(`Objet obtenu : ${e.item}.`);
        break;
      case 'giveMoney': {
        set((s: GameState) => ({
          money: {
            gold: s.money.gold + (e.gold ?? 0),
            silver: s.money.silver + (e.silver ?? 0),
            brass: s.money.brass + (e.brass ?? 0),
          },
        }));
        const parts = [e.gold && `${e.gold} CO`, e.silver && `${e.silver} pa`, e.brass && `${e.brass} sc`].filter(Boolean); // noms canon FR (couronne/pistole/sou)
        if (parts.length) get().log(`Bourse : ${(e.gold ?? 0) < 0 || (e.silver ?? 0) < 0 ? '' : '+'}${parts.join(' ')}.`);
        break;
      }
      case 'giveXp':
        set((s: GameState) => ({
          party: s.party.map((h) => {
            const clone: Combatant = JSON.parse(JSON.stringify(h));
            clone.xp = (clone.xp ?? 0) + e.amount;
            return clone;
          }),
        }));
        get().log(`Groupe : +${e.amount} PX.`);
        break;
      case 'restoreFortune':
        // Début de session (LDB 17 l.47) : Chance regagnée jusqu'au maximum = Destin actuel.
        set((s: GameState) => ({
          party: s.party.map((h) => (h.kind === 'hero' && h.fate != null ? { ...h, fortune: h.fate } : h)),
        }));
        get().log('Début de session : Points de Chance regagnés (maximum = Destin).');
        break;
      case 'rest':
        // Repos déclenché par l'éditeur (trigger/dialogue) : `days` journée(s) (défaut 1). Même flux que
        // l'action « Dormir » — récup Exténué/Blessures + convalescence + cauchemars (no-op en combat).
        restPartyOvernight(get, set, e.days ?? 1);
        break;
      case 'inflictNightmares': {
        // Trauma « Cauchemars » (LDB 21 l.92) posé sur un héros (défaut : le premier).
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          who = s.party[target].name;
          return { party: s.party.map((h, i) => (i === target ? { ...h, nightmares: true } : h)) };
        });
        if (who) get().log(`${who} est marqué par un trauma : des cauchemars le hanteront chaque nuit.`);
        break;
      }
      case 'inflictDisease': {
        // Maladie (LDB 20) infligée par l'auteur (nourriture avariée, contact infecté…). Incubation/durée
        // tirées à la contraction ; les symptômes se déclareront au repos. Dédoublonnée par nom.
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          return {
            party: s.party.map((h, i) => {
              if (i !== target || (h.diseases ?? []).some((d) => d.name === e.disease)) return h;
              const dz = contractDisease(e.disease, battleRng());
              if (!dz) return h;
              who = h.name;
              return { ...h, diseases: [...(h.diseases ?? []), dz] };
            }),
          };
        });
        if (who) get().log(`${who} a contracté : ${e.disease} (LDB 20 — symptômes au repos).`);
        break;
      }
      case 'giveTrapping': {
        const it = itemFromTrapping(e.trapping);
        if (!it) {
          get().log(`Objet inconnu : « ${e.trapping} ».`);
          break;
        }
        // Butin MAGIQUE (optionnel) : qualités ajoutées, objet non identifié (qualités masquées jusqu'à
        // Évaluation, #2), skin légendaire. Les qualités restent ACTIVES mécaniquement (registre).
        if (e.qualities?.length) it.qualities = [...it.qualities, ...e.qualities];
        if (e.identified === false) it.identified = false;
        if (e.skin) it.skin = e.skin;
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          who = s.party[target].name;
          return {
            party: s.party.map((h, i) => {
              if (i !== target) return h;
              const clone: Combatant = JSON.parse(JSON.stringify(h));
              clone.items = [...(clone.items ?? []), it]; // arrive NON équipé
              recomputeLoadout(clone); // met à jour l'encombrement
              return clone;
            }),
          };
        });
        get().log(`${who || 'Le groupe'} récupère : ${it.name}.`);
        break;
      }
      case 'document':
        set({ document: { title: e.title, text: e.text } });
        break;
      case 'startDialogue': {
        const dlg = get().scene?.dialogues.find((d) => d.id === e.dialogue);
        if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
        break;
      }
      case 'startCombat':
        get().startCombat(e.encounter);
        break;
      case 'transition': {
        const cur = get();
        if (cur.scene) set({ previousScene: { id: cur.scene.id, pos: { ...cur.partyPos } } });
        get().transitionTo(e.scene, e.entry);
        break;
      }
      case 'transitionBack': {
        const prev = get().previousScene;
        if (prev) {
          set({ previousScene: null });
          get().transitionTo(prev.id, undefined, prev.pos);
        }
        break;
      }
      case 'test': {
        // Test de compétence : le meilleur du groupe tente. Le jet attend « Lancer »
        // dans la modale (testRoll), puis une Chance est possible avant l'acquittement.
        // Malus psy de Sociabilité (LDB 21) : un PJ avec Animosité/Préjugé envers le groupe `vsGroups`
        // de l'interlocuteur subit −20/−10 sur un Test de Sociabilité. Intégré PAR acteur → le meilleur
        // PJ EFFECTIF (malus compris) est choisi, et le malus de l'acteur retenu est affiché dans la modale.
        const socialMod =
          e.vsGroups?.length && isSocialTest(e.skill, e.characteristic)
            ? (c: Combatant) => socialPsychMod(c, e.vsGroups!)
            : undefined;
        const best = partyBest(get().party, e.skill, e.characteristic, socialMod);
        if (!best) break;
        const psychMod = socialMod ? socialMod(best.actor) : 0;
        const psychLabel = socialMod ? socialPsychLabel(best.actor, e.vsGroups!) : undefined;
        const psychDetail = psychLabel ? `${psychLabel} envers ${e.vsGroups!.join('/')}` : undefined;
        // Outil utilisé (Phase C2a) : résolu par NOM vers l'uid de l'objet du héros qui agit.
        const tool = e.tool ? best.actor.items?.find((i) => i.name === e.tool && !i.destroyed) : undefined;
        const difficulty = e.difficulty ?? 'intermediaire';
        const label = e.label || e.skill || (e.characteristic ? `Test de ${e.characteristic}` : 'Test');
        const target = Math.max(1, Math.min(99, best.value + DIFFICULTY_MODIFIERS[difficulty]));
        set({
          pendingTest: {
            actorId: best.actor.id,
            actorName: best.actor.name,
            label,
            skillValue: best.value,
            difficulty,
            requireSL: e.requireSL ?? 0,
            target,
            psychMod: psychMod || undefined, // malus Animosité/Préjugé de l'acteur (affiché en modale)
            psychDetail, // libellé lisible (« Animosité −20 envers Elfe »)
            itemUid: tool?.uid,
            isDouble: false,
            roll: null, // pas encore lancé
            success: false,
            sl: 0,
            onSuccess: e.onSuccess,
            onFailure: e.onFailure,
          },
        });
        return; // la suite est portée par la branche (résolue à l'acquittement)
      }
      case 'setTime': {
        // Saut EN AVANT jusqu'à la prochaine occurrence de la phase/heure visée (le temps ne recule jamais).
        const target = 'phase' in e
          ? (DAY_PHASES.find((p) => p.key === e.phase)?.start ?? 0)
          : e.hour * 60 + (e.minute ?? 0);
        get().advanceTime(minutesUntilNext(get().gameTime, target));
        break;
      }
      case 'openMerchant':
        get().openMerchant(e.entityId); // ouvre la boutique de l'entité (Marchand inclus dans un dialogue, #2)
        break;
      case 'medicalAid':
        openMedicalAid(get, set, e); // soin payant d'un PNJ : ouvre la modale de Guérison avec la compétence du PNJ
        break;
      case 'endDialogue':
        if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
        set({ dialogue: null });
        break;
    }
  }
}

/**
 * Acte de soin PAYANT d'un PNJ (Effet `medicalAid`, LDB 75). Le PNJ n'est PAS dans le groupe : on
 * ouvre la modale `pendingHeal` avec SA compétence (`skill`/`intBonus`, fiche du PNJ) et le héros le
 * plus en besoin pour l'acte ; le joueur voit le jet sans pouvoir le relancer (la Chance interroge
 * `actorIn(healerId)` → introuvable pour un PNJ → boutons inertes). La résolution (`healConfirm`)
 * applique le RAW Guérison/Chirurgie existant : aucun calcul dupliqué. Le PRIX est déjà débité par
 * le choix de dialogue (`DialogueChoice.cost`). Sans patient pertinent : rien (le prix reste dû —
 * comme tout service, à ne déclencher qu'à bon escient).
 */
function openMedicalAid(get: () => GameState, set: any, e: { act: 'wounds' | 'bleed' | 'surgery'; skill: number; intBonus: number; entityId?: string }): void {
  const party = get().party;
  const needs = (h: Combatant): boolean =>
    e.act === 'wounds' ? !h.dead && !h.outOfRencontre && h.wounds.current < h.wounds.max
      : e.act === 'bleed' ? (h.conditions ?? []).some((c) => c.name === 'Hémorragique' && c.value > 0)
        : hasSurgeryTrauma(h); // chirurgie
  const cands = party.filter(needs);
  if (!cands.length) { get().log(`Le soigneur examine le groupe : personne ne requiert cet acte pour l'instant.`); return; }
  // Le PNJ soigneur : NOM et id viennent de l'entité de scène (`entityId`) — rien de codé en dur.
  const npc = e.entityId ? get().scene?.entities.find((x) => x.id === e.entityId) : undefined;
  const healerId = npc?.id ?? e.entityId ?? 'pnj-soigneur';
  const healerName = npc?.label ?? 'Soigneur';
  // Cible PAR DÉFAUT = le plus en besoin ; le joueur peut en choisir une autre (candidateIds).
  const target = e.act === 'wounds'
    ? cands.reduce((a, b) => (a.wounds.max - a.wounds.current) >= (b.wounds.max - b.wounds.current) ? a : b)
    : cands[0];
  set({
    pendingHeal: {
      healerId, healerName, targetId: target.id, targetName: target.name,
      mode: e.act, intBonus: e.intBonus, skillValue: e.skill,
      difficulty: 'intermediaire', target: e.skill, roll: null, success: false, sl: 0,
      candidateIds: cands.map((c) => c.id),
      ...(e.act === 'surgery' ? { surgeryTargetDR: 7, surgeryCumDR: 0, surgeryTraumaIdx: 0 } : {}), // cible MJ 5-10 (LDB 10)
    },
  });
}

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive
 *  (Agilité + avances, pénalité d'Encombrement incluse) — la plus haute valeur. */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

/** Sonné : tout adversaire qui frappe la cible en CORPS À CORPS gagne +1 Avantage
 *  AVANT son attaque (LDB États l.123) — ce +1 profite donc déjà au jet en cours puis
 *  persiste. À appeler une seule fois par attaque (avant le 1er jet ; pas sur une relance). */
export function applySonneMeleeAdvantage(attacker: Combatant, target: Combatant): void {
  if (attacker.weapons[0]?.type === 'melee' && target.conditions.some((c) => c.name === 'Sonné')) {
    attacker.advantage += 1;
    attacker.gainedAdvThisRound = true;
  }
}

/** Munition que le héros tirera : celle sélectionnée (`ammoUid`) si compatible, sinon la 1re compatible. */
export function selectedAmmo(attacker: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(attacker, weapon);
  return compat.find((a) => a.uid === attacker.ammoUid) ?? compat[0];
}

/** Arme effectivement tirée : mêlée au contact, distance sinon (Atout Pistolet pour tirer en Combat
 *  rapproché — LDB Armes l.297-298), AUGMENTÉE de la munition pour un héros (Dégâts + Atouts combinés).
 *  Centralisé pour que résolution / Chance / application voient la MÊME arme (munition, Empaleuse, reload). */
export function firedWeapon(attacker: Combatant, target: Combatant): Weapon {
  const adj = combatDistance(attacker, target) <= meleeReachTiles(attacker.weapons); // Allonge incluse (RAW-3)
  const w = attackWeapon(attacker.weapons, adj);
  if (w.type === 'ranged' && attacker.kind === 'hero') {
    const ammo = selectedAmmo(attacker, w);
    if (ammo) return weaponWithAmmo(w, ammo);
  }
  return w;
}

/** Résout une attaque (le JET) SANS l'appliquer — pour le flux par modale (« Lancer »
 *  puis éventuel point de Chance). Retourne null si la cible est hors de portée de mêlée. */
/** Tir dans la mêlée (LDB 14 l.136) : si la pénalité de −20 a transformé une réussite en échec, le
 *  tir touche un allié intercalé de la cible. Retourne l'allié (le 1er Engagé côté tireur, « au
 *  hasard » approximé — le cas courant n'a qu'un allié au contact), ou null si non applicable. */
export function strayShotVictim(res: AttackResult, attacker: Combatant, target: Combatant, battle: BattleState): Combatant | null {
  if (res.hit || !res.attackerDetail) return null;
  if (res.attackerRoll > res.attackerDetail.target + 20) return null; // n'aurait pas touché même sans le −20
  const allies = (target.engagedWith ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && c.kind === attacker.kind && !isOutOfAction(c));
  return allies[0] ?? null;
}

/** Cibles éligibles d'un « Tir dans le tas » (LDB 14 l.136/146) : TOUT le monde serré autour de la
 *  cible (au contact, Chebyshev — diagonale incluse), vivant et positionné, LE TIREUR EXCLU — les
 *  DEUX camps : « vous touchez l'un des adversaires de la cible au hasard » → ça peut être un de vos
 *  PROPRES alliés engagés dans la mêlée (tir fratricide), pas forcément un ennemi. Un tir réussi en
 *  touche UNE au hasard. Base partagée avec le futur surlignage des zones d'effet (Explosion / sorts). */
export function crowdEligible(battle: BattleState, attacker: Combatant, target: Combatant): Combatant[] {
  return battle.combatants.filter(
    (c) => c.id !== attacker.id && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1,
  );
}

/** Cases enfumées actives de la bataille (Souffle (Fumée)) → bloquent la Ligne de Vue. */
export const smokeOf = (battle: BattleState): Pt[] => (battle.smoke ?? []).map((s) => ({ x: s.x, y: s.y }));

/** Surprise au début du combat (LDB 13 l.52-81) : le camp pris en EMBUSCADE (`surprisedSide`) fait, pour
 *  chaque combattant, un Test opposé de Perception vs la Discrétion la plus FAIBLE des embusqueurs (l.77) ;
 *  les vaincus gagnent l'État `Surpris`. Mute les combatants, retourne le journal. */
export function applySurprise(combatants: Combatant[], surprisedSide: 'party' | 'enemies'): string[] {
  const surprisedKind = surprisedSide === 'party' ? 'hero' : 'enemy';
  const surprised = combatants.filter((c) => (surprisedKind === 'hero' ? c.kind === 'hero' : c.kind !== 'hero') && !isOutOfAction(c));
  const ambushers = combatants.filter((c) => (surprisedKind === 'hero' ? c.kind !== 'hero' : c.kind === 'hero') && !isOutOfAction(c));
  if (!surprised.length || !ambushers.length) return [];
  const ambushDiscretion = Math.min(...ambushers.map((a) => testValue(a, 'Discrétion'))); // la plus faible (l.77)
  const lines: string[] = [];
  for (const c of surprised) {
    // Embusqueur (Discrétion) vs guetteur (Perception) : si l'embusqueur l'emporte → le guetteur est Surpris.
    if (opposedTest(ambushDiscretion, testValue(c, 'Perception'), battleRng()).attackerWins) {
      addCondition(c, 'Surpris');
      lines.push(`${c.name} est pris par surprise !`);
    }
  }
  return lines;
}

const DIR8_RING: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** Flanc/dos (LDB 14 l.91) : l'attaquant frappe-t-il hors du champ de vision avant du défenseur ?
 *  Front = orientation du défenseur ±45° (3 directions avant) ; flanc/dos = les 5 autres (écart ≥ 2 sur l'anneau). */
export function isFlankOrRear(targetFacing: Dir8, dirToAttacker: Dir8): boolean {
  const a = DIR8_RING.indexOf(targetFacing);
  const b = DIR8_RING.indexOf(dirToAttacker);
  return Math.min(Math.abs(a - b), 8 - Math.abs(a - b)) >= 2;
}

export function resolveAttack(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  fromCharge?: boolean,
  intoCrowd?: boolean,
  heldGround?: boolean,
): { res: AttackResult; weapon: Weapon; victim?: Combatant } | null {
  const dist = combatDistance(attacker, target);
  const weapon = firedWeapon(attacker, target); // arme + munition combinées (héros distance)
  if (dist > reachTiles(weapon) && weapon.type === 'melee') return null; // hors de portée de mêlée (Allonge incluse, RAW-3)
  // (Sonné → +1 Avantage à l'attaquant en mêlée, LDB 16 l.123 : DÉJÀ géré par le flux d'attaque existant.)
  const scene = get().scene!;
  const battle = get().battle!;
  const sc = sceneCombatModifiers(scene, get().gameTime);
  const env: ModLine[] = [];
  if (weapon.type === 'ranged') {
    const occupants = battle.combatants
      .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
      .map((c) => c.pos!);
    const los = lineOfSightCover(scene, attacker.pos!, target.pos!, occupants, smokeOf(battle));
    if (los.blocked) return null; // pas de Ligne de Vue (mur/décor/fumée) → pas de tir (LDB 13-Combat l.123)
    if (los.cover !== 'none') env.push({ label: `Couvert (${los.cover})`, value: coverModifier(los.cover) });
    if (sc.concealed) env.push({ label: sc.label || 'Obscurité', value: -20 }); // cible dissimulée (LDB 14 l.107)
    else if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod }); // tempête/neige (l.108-116)
    // Tir en bougeant (LDB 14 l.101) : −10 si l'on bouge ET tire au même Round. Le Mouvement étant
    // DÉCOMPOSABLE (on peut bouger APRÈS le tir), un HÉROS qui garde sa mobilité encaisse le −10 par défaut ;
    // il ne l'évite qu'en décidant de tirer IMMOBILE (heldGround → consomme son Mouvement, cf. attackConfirm)
    // — ou s'il NE PEUT PAS bouger (Mouvement effectif 0 : Empêtré/Surpris…), il est immobile d'office.
    // L'IA/ennemi (pas d'option) : −10 seulement s'il a effectivement bougé ce Tour.
    const mobileShot = attacker.kind === 'hero'
      ? (battle.movementUsed > 0 || (mountMovement(battle, attacker) > 0 && !heldGround))
      : battle.movementUsed > 0;
    if (mobileShot) env.push({ label: 'Tir en bougeant', value: -10 });
    // Tir dans la mêlée (LDB 14 l.134) : la cible est Engagée avec un allié du tireur.
    const inMelee = (target.engagedWith ?? []).some((id) => {
      const ally = battle.combatants.find((c) => c.id === id);
      return !!ally && ally.kind === attacker.kind;
    });
    if (inMelee && !intoCrowd) env.push({ label: 'Tir dans la mêlée', value: -20 }); // « Tirer dans le tas » REMPLACE ce −20 par le bonus (l.136)
    env.push(...mountedAttackMods(battle, attacker, target, 'ranged')); // Combat monté : +20 cible plus petite que la monture (LDB 14 l.217)
    // « Tirer dans le tas » (LDB 14 l.136/146) : OPTION choisie par le joueur — bonus +20/+40/+60 selon
    // la taille du groupe, MAIS un ennemi AU HASARD est touché ; un succès dû au seul bonus est à 0 DR.
    if (intoCrowd) {
      const crowd = crowdEligible(battle, attacker, target);
      const cm = crowdMod(crowd.length);
      if (cm) env.push(cm);
      const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env);
      if (res.hit && crowd.length) {
        const victim = crowd[battleRng().int(0, crowd.length - 1)]; // « appliqué au hasard parmi les cibles éligibles »
        const ad = res.attackerDetail!;
        const rescued = res.attackerRoll > ad.target - (cm?.value ?? 0); // aurait échoué sans le bonus → 0 DR (l.146)
        const stray = resolveStrayRangedHit(attacker, victim, weapon, res.attackerRoll, rescued ? res.attackerRoll : ad.target);
        stray.log = `Tir dans le tas : ${victim.name} est touché au hasard${rescued ? ' (succès dû au bonus → 0 DR)' : ''}.`;
        return { res: stray, weapon, victim };
      }
      return { res, weapon };
    }
    const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env);
    // Tir dans la mêlée (LDB 14 l.136) : si le −20 a transformé une réussite en échec, le tir dévie
    // et frappe un allié intercalé (touche acquise, dégâts recalculés sur l'allié).
    if (inMelee && !res.hit) {
      const ally = strayShotVictim(res, attacker, target, battle);
      if (ally) return { res: resolveStrayRangedHit(attacker, ally, weapon, res.attackerRoll, res.attackerDetail!.target + 20), weapon, victim: ally };
    }
    return { res, weapon };
  }
  // Mêlée : la météo (tempête/neige) pénalise l'attaque ; la neige pénalise aussi l'esquive (dodgeMod).
  if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod });
  // Flanc/dos (LDB 14 l.91) : +20 pour attaquer un adversaire ENGAGÉ dans le dos ou sur les côtés —
  // orientation du défenseur AVANT cette attaque (il se retourne vers l'attaquant ENSUITE, applyAttackResult).
  const tFacing = get().facing[target.id];
  if (tFacing && isEngaged(target) && attacker.pos && target.pos && isFlankOrRear(tFacing, facingToward(target.pos, attacker.pos)))
    env.push({ label: 'Flanc/dos', value: 20 });
  // Surnombre (LDB 14 l.85/92) : attaquants du camp de l'attaquant au contact de la cible (2 → +20, 3+ → +40).
  const onm = outnumberMod(battle.combatants.filter((c) => c.kind === attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1).length);
  if (onm) env.push(onm);
  env.push(...mountedAttackMods(battle, attacker, target, 'melee')); // Combat monté : +20 cible < monture / −10 viser le cavalier (LDB 14 l.217/219)
  // Combat monté (l.225) : un défenseur à cheval subit −20 à l'Esquive (sauf Acrobaties équestres) → s'ajoute au dodgeMod météo.
  // Charge montée (LDB 14 l.223) : pour les DÉGÂTS, on substitue la Force (Bonus) et la Taille de la monture.
  const chargeMount = fromCharge ? mountOf(battle, attacker) : undefined;
  const dmgProxy = chargeMount ? { sb: bonus(effectiveChar(chargeMount, 'F')), size: chargeMount.size } : undefined;
  return { res: resolveMelee(attacker, target, weapon, battleRng(), { defense: bestDefenseMode(target), location, env, dodgeMod: sc.dodgeMod + mountedDodgePenalty(target), dmgProxy }), weapon };
}

/** Applique un résultat d'attaque déjà résolu : Blessures, États, Assommante,
 *  Avantage, animation, journal, fin de combat. */
/** Issue du Test opposé d'Esquive du Désengagement : le mover est l'« attaquant » du test ;
 *  une égalité parfaite (tie) = statu quo (ni fuite, ni avantage à l'adversaire — LDB Tests). */
export function disengageOutcome(winner: 'attacker' | 'defender' | 'tie'): 'success' | 'failure' | 'tie' {
  return winner === 'attacker' ? 'success' : winner === 'tie' ? 'tie' : 'failure';
}

/** Lance le Désengagement d'un combattant Engagé (LDB 15-Dépl l.84-89) : option A
 *  (Avantage > adversaires → résolue direct) ou option B (Test opposé d'Esquive vs le
 *  foe le plus dangereux). No-op « rouvre le mouvement » si plus aucun foe vivant. */
export function startDisengage(get: () => GameState, set: any, mover: Combatant): void {
  const battle = get().battle!;
  const foes = (mover.engagedWith ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  // Désengagement GRATUIT du plus grand (LDB 85 l.308-309) : une créature plus grande que TOUS ses
  // adversaires Engagés les écarte et se déplace librement, sans Test ni sacrifice d'Avantage.
  // Plus grand que TOUS ses Engagés (85 l.308-309) OU Nuée (ignore l'Engagement en se déplaçant, l.200) → départ libre.
  const freeDisengage = foes.length > 0 && (mover.swarm || foes.every((f) => sizeGap(mover.size, f.size) >= 1));
  if (!foes.length || freeDisengage) {
    if (freeDisengage) {
      for (const f of foes) disengageFrom(mover, f); // lève les liens Engagé avec les plus petits écartés
      battle.log.push(ev('move', `${mover.name} écarte les plus petits et se déplace librement.`, mover.id));
    }
    // Lien d'Engagement périmé (foe mort/parti) OU désengagement gratuit : rouvrir le déplacement normal.
    const blocked = occupied(battle, mover);
    set({ battle: { ...battle, action: 'move', reachable: reachable(get().scene!, mover.pos!, effectiveMovement(mover), blocked) } });
    return;
  }
  const maxFoeAdv = Math.max(...foes.map((f) => f.advantage));
  const canSacrifice = mover.advantage > maxFoeAdv; // Avantage strictement supérieur (l.87)
  // Après avoir agi, seule l'option A (Sacrifier l'Avantage) reste possible — sans Avantage supérieur
  // il n'y a RIEN à faire → no-op (pas de menu vide, et pas de relance d'Esquive : anti-boucle l.89).
  if (battle.acted && !canSacrifice) return;
  // Ouvre le MENU de choix. L'adversaire de référence (Esquive opposée + cible de la Fuite) =
  // le foe Engagé à la meilleure Compétence de Corps à corps (l.89). Son jet de CC est figé d'avance.
  const foe = foes.reduce((a, b) => (combatValue(b, 'melee') > combatValue(a, 'melee') ? b : a));
  const atk = rollDisengageAttack(foe, battleRng());
  set({
    pendingDisengage: {
      moverId: mover.id,
      foeId: foe.id,
      canSacrifice,
      canEsquive: !battle.acted, // Esquive/Fuite coûtent l'Action — indispo si déjà agi (anti-boucle)
      phase: 'choice',
      atk,
      def: null,
      result: null,
    },
  });
}

/** Case ATTEIGNABLE adjacente à `target` qui coûte le moins de Mouvement (point d'arrivée d'une Charge). */
export function bestAdjacentReachable(reach: Map<string, number>, target: Pt): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (chebyshev({ x, y }, target) !== 1) continue;
    const d = reach.get(k)!;
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}

/** Mort d'un combattant : pour un héros à Destin, suspend (pendingFateSave) au lieu de mourir
 *  (LDB ch.17 l.31-35) ; sinon finalise la mort. `restoreWounds` = PB d'avant le coup létal. */
export function finalizeHeroDeath(get: () => GameState, set: any, hero: Combatant, source: 'hit' | 'slow', restoreWounds?: number): void {
  if (hero.kind === 'hero' && (hero.fate ?? 0) > 0) {
    set({ pendingFateSave: { heroId: hero.id, source, restoreWounds } });
  } else {
    hero.dead = true;
  }
}

/** Applique une Blessure critique (Coup Critique ou overkill) à `target` : PB (ignore BE+PA,
 *  plancher 0) + États + compteur. Mort Subite pour les figurants en overkill. RETOURNE `true`
 *  si le résultat est létal (le caller finalise via finalizeHeroDeath). Pousse le journal dans `log`. */
export function applyCriticalToTarget(
  target: Combatant,
  location: HitLocation,
  isCoupCritique: boolean,
  overkill: number,
  log: string[],
  set: any,
): boolean {
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.51-54) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.name === 'Inconscient')) addCondition(target, 'Inconscient');
    log.push(`${target.name} s'effondre, hors de combat.`);
    return false;
  }
  const loc = isCoupCritique ? critLocationRoll(battleRng(), target.bodyShape) : location; // Coup Critique = localisation fraîche (l.62)
  const crit = rollCritical(target, loc, battleRng(), overkill);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  target.tookCriticalThisFight = true; // fin de combat : Résistance Très Facile (+60) ou Infection Mineure (LDB 20 l.72)
  log.push(crit.log);
  const revealLines = [crit.log];
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) {
      const line = `  ↳ ${t.label} (${t.location}).`;
      log.push(line);
      revealLines.push(line);
    }
    // Cumuls par comptage (LDB 18) : doigts (−5/doigt, 4+ → main) et dents (−1 Soc/paire) fusionnés ;
    // 2e œil/oreille → Cécité / Surdité agrégée (l.360/363).
    consolidateAmputations(target);
    for (const l of escalateSensoryLoss(target)) {
      log.push(`  ↳ ${l}`);
      revealLines.push(`  ↳ ${l}`);
    }
  }
  if (!crit.lethal) {
    target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss); // ignore BE+PA, plancher 0
    for (const c of crit.conditions) addCondition(target, c.name, c.value);
    if (crit.note) {
      log.push(`  ↳ ${crit.note}`); // effet long terme journalisé, non simulé
      revealLines.push(`  ↳ ${crit.note}`);
    }
  }
  // « Un jet = une modale » : le joueur voit le dé du Coup Critique (infligé ou subi).
  pushReveal(set, { kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: revealLines });
  return crit.lethal; // « Mort » instantané → finalisé par le caller (sauvetage par Destin possible)
}

/** Déviation Critique (LDB 63 l.63-66) : sacrifie 1 PA à `loc` pour IGNORER le Critique ; la cible
 *  subit quand même les Blessures normales recalculées avec la PA réduite (probable +1 Blessure). */
function deviateArmour(target: Combatant, weapon: Weapon, res: AttackResult, log: string[]): void {
  damageArmour(target, res.location ?? 'corps');
  const extra = Math.max(0, woundsFromHit(weapon, target, res.location ?? 'corps', res.damage ?? 0) - (res.woundsLost ?? 0));
  if (extra) target.wounds.current = Math.max(0, target.wounds.current - extra);
  log.push(`${target.name} dévie le coup sur son armure (−1 PA, Critique ignoré).`);
}

/** Une armure Bâclée frappée par un Coup Critique à sa localisation casse (LDB 60 l.82) — héros (pièces). */
function breakBacleArmour(target: Combatant, loc: HitLocation, log: string[]): void {
  const piece = (target.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && hasQuality(i, 'Bâclé') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return;
  piece.damageTaken = piece.pa ?? 0; // inutilisable
  recomputeLoadout(target);
  log.push(`L'armure Bâclée de ${target.name} (${loc}) se brise sous le Coup Critique.`);
}

export function applyAttackResult(
  get: () => GameState,
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
  deviated?: boolean,
): boolean {
  // Surpris (LDB 16 l.136) : « après la première tentative effectuée pour vous toucher, vous perdez
  // l'État Surpris ». On le retire après une attaque STANDARD (deviated===undefined) — le +20 / l'absence
  // de défense ont déjà joué pour CELLE-CI ; les suivantes n'en bénéficieront plus. Les attaques GRATUITES
  // groupées d'une créature (Morsure+Piétinement, deviated===false) forment UN assaut-surprise : on garde
  // l'État jusqu'à la fin du Round (sinon la 2ᵉ attaque gratuite rouvrirait une défense en plein milieu).
  if (deviated === undefined && hasCondition(target, 'Surpris')) removeCondition(target, 'Surpris', 1);
  // Déviation Critique (LDB 63 l.63-66) : un HÉROS subit un Coup Critique à une localisation où il
  // porte de la PA → on SUSPEND pour son choix Dévier/Subir (modale). AUCUN effet de bord ici ; la
  // résolution (deviationApply) rappelle cette fonction avec `deviated` défini (early-return sauté →
  // application UNE seule fois). Les sous-attaques (balayage/Piétinement) passent `deviated` explicite
  // pour résoudre instantanément (pas de modale imbriquée). Les sorts (applyCast) gèrent leurs Critiques
  // à part : ils n'atteignent jamais cette fonction, donc pas de garde « arme » nécessaire.
  const dloc = res.location ?? 'corps';
  if (deviated === undefined && res.hit && res.woundsLost && res.critical && target.kind === 'hero' && (target.armour[dloc] ?? 0) > 0) {
    set({ pendingDeviation: { attackerId: attacker.id, targetId: target.id, weapon, res, resumeAfter: true } });
    return true; // suspendu — le caller NE doit PAS exécuter ses post-étapes (rejouées à la résolution)
  }
  const battle = get().battle!;
  attacker.aiming = false; // l'attaque consomme la visée (tir : +20 déjà appliqué ; mêlée : visée gâchée)
  if (attacker.nextActionPenalty) attacker.nextActionPenalty = undefined; // pénalité de Maladresse consommée par ce Test

  if (weapon.type === 'melee') engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13-Combat l.174-175)
  const critLog: string[] = [];
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    const loc = res.location ?? 'corps';
    if (res.critical) breakBacleArmour(target, loc, critLog); // armure Bâclée brisée par le Critique (LDB 60 l.82)
    const autoDeviate = res.critical && target.kind === 'enemy' && (target.armour[loc] ?? 0) > 0; // ennemi : dévie toujours (auto)
    if (res.critical && (autoDeviate || deviated === true)) {
      deviateArmour(target, weapon, res, critLog); // Déviation (auto pour l'ennemi ; choix « Dévier » du héros, LDB 63 l.63-66)
    } else if (res.critical || overkill > 0) {
      const lethal = applyCriticalToTarget(target, loc, !!res.critical, Math.max(0, overkill), critLog, set);
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore); // mort directe ou pause Destin
    }
    // 0 PB → À Terre (LDB 18 l.28) : TOUJOURS quand on tombe à 0, EN PLUS du Critique éventuel (l'overkill
    // déclenche une Blessure critique mais ne dispense pas de l'État À Terre) ; sauf si déjà KO/mort.
    if (target.wounds.current <= 0 && !target.dead && !hasCondition(target, 'Inconscient')) applyZeroWounds(target);
    // Cible neutralisée → on ne reste pas Engagé avec elle (LDB 13) : on lève ses liens immédiatement
    // (sinon ils persisteraient jusqu'au franchissement de Round, bloquant Charge/déplacement libre).
    // Et ses effets PSYCHOLOGIQUES (Peur/Terreur/traits ciblés) prennent fin : on les retire des autres.
    if (isOutOfAction(target)) {
      clearEngagementOf(get().battle?.combatants ?? [], target.id);
      clearPsychOf(get().battle?.combatants ?? [], target.id);
    }
  }
  // Taille (arme) : sur une touche réussie, endommage de 1 PA l'armure frappée (LDB 63 l.8).
  if (res.hit && hasQuality(weapon, 'Taille')) damageArmour(target, res.location ?? 'corps');
  // Munition héros : consommée à l'application ; arme à Recharge → déchargée (Test étendu requis pour recharger).
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    const used = selectedAmmo(attacker, weapon);
    if (used && (used.qty ?? 0) > 0) {
      used.qty = (used.qty ?? 0) - 1;
      if (used.qty <= 0) attacker.items = (attacker.items ?? []).filter((i) => i.uid !== used.uid);
    }
    if ((weapon.reload ?? 0) > 0) {
      attacker.loaded = false; // déchargé après le tir
      attacker.reloadProgress = 0;
    }
  }
  // Interruption du rechargement (LDB 63-Armures l.29) : un héros touché en plein rechargement recommence à zéro.
  if (res.hit && res.woundsLost && target.kind === 'hero' && (target.reloadProgress ?? 0) > 0) target.reloadProgress = 0;
  // Qualités à effet « à la touche » (hook `onHit` du registre) : ex. Assommante — touche à la Tête →
  // Test opposé F vs Endurance+Résistance ; si l'attaquant l'emporte, la cible gagne l'État Sonné (LDB Armes l.268).
  let assommanteLog: string | null = null;
  if (res.hit) {
    for (const { def } of resolveQualities(weapon)) {
      const oh = def.onHit;
      if (!oh || (oh.location && res.location !== oh.location)) continue;
      const skillAdv = oh.opposed.defenderSkill
        ? target.skills.find((s) => s.name.toLowerCase().startsWith(oh.opposed.defenderSkill!.toLowerCase()))?.advances ?? 0
        : 0;
      const defVal = effectiveChar(target, oh.opposed.defender) + skillAdv;
      if (opposedTest(effectiveChar(attacker, oh.opposed.attacker), defVal, battleRng()).winner === 'attacker') {
        addCondition(target, oh.condition);
        assommanteLog = `${target.name} est ${oh.condition} (${def.key}).`;
        pushReveal(set, { kind: 'assommante', title: def.key, lines: [assommanteLog] }); // « un jet = une modale » (Test opposé)
      }
    }
  }
  // Avantage (LDB Déplacement l.30-40) : +1 au vainqueur du Test opposé / sur une
  // Blessure infligée sans Test opposé (tir) ; perte de TOUT l'Avantage en échouant
  // un Test opposé ou en perdant une Blessure.
  if (res.advantageTo === 'attacker') {
    attacker.advantage += 1;
    attacker.gainedAdvThisRound = true;
  }
  if (res.advantageTo === 'defender') {
    target.advantage += 1;
    target.gainedAdvThisRound = true;
    attacker.advantage = 0; // l'attaquant a échoué au Test opposé
  }
  if (res.hit && res.woundsLost) target.advantage = 0; // perdre une Blessure → perte de tout Avantage
  const kind = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const defense = weapon.type === 'ranged' ? 'none' : bestDefenseMode(target);
  // Orientation : l'attaquant se tourne vers la cible, le défenseur vers l'attaquant (frappe offensive).
  if (attacker.pos && target.pos) {
    set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
  }
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense, creatureAttack: creatureAttackKind(weapon.name) });
  const evKind: CombatEventKind = weapon.type === 'ranged' ? 'shoot' : 'attack';
  const log = [...battle.log, ev(evKind, res.log, attacker.id, target.id)];
  log.push(...evLines(critLog, 'crit', attacker.id, target.id));
  if (assommanteLog) log.push(ev('condition', assommanteLog, target.id));
  if (isOutOfAction(target)) log.push(ev('death', `${target.name} est mis hors de combat !`, target.id));
  set({ battle: { ...battle, acted: true, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resolveEnemyFumble(get, set, attacker, weapon, res); // Maladresse d'un ENNEMI attaquant → résolue instantanément
  // Maladresse d'un ENNEMI défenseur (Test opposé, LDB 14 l.48-51) : sa Parade/Esquive ratée sur un double.
  if (target.kind === 'enemy' && defenderFumbled(res) && !isOutOfAction(target) && target.weapons[0]) {
    applyOups(get, set, target, target.weapons[0], rollOups(target.weapons[0], battleRng()));
  }
  return false; // non suspendu : application complète terminée
}

/** Une Maladresse de l'attaquant dans un résultat d'attaque ? (jet propre raté + double, LDB 14 l.53). */
export function attackerFumbled(res: AttackResult): boolean {
  return !!res.attackerDetail && isFumble(res.attackerDetail.roll, res.attackerDetail.success);
}

/** Une Maladresse du DÉFENSEUR (Test opposé) : sa défense propre ratée sur un double (LDB 14 l.48-51). */
export function defenderFumbled(res: AttackResult): boolean {
  return !!res.defenderDetail && isFumble(res.defenderDetail.roll, res.defenderDetail.success);
}

/** Alliés (même camp) encore actifs, hors `c`, et À PORTÉE de `weapon` (LDB 14 l.42-46 : « à
 *  distance »). Tir → dans la bande de portée ; mêlée → portée d'Allonge de l'arme (`reachTiles`).
 *  Sans position connue (tests), on ne filtre pas. */
function alliesAtRange(battle: BattleState, c: Combatant, weapon: Weapon): Combatant[] {
  const allies = battle.combatants.filter((x) => x.id !== c.id && x.kind === c.kind && !isOutOfAction(x));
  if (!c.pos) return allies;
  return allies.filter((a) => {
    if (!a.pos) return true;
    const d = combatDistance(c, a);
    if (weapon.type === 'ranged' && weapon.range) return rangeBandModifier(d, weapon.range) != null;
    return d <= reachTiles(weapon);
  });
}

/** Use/détruit l'arme sur l'ItemInstance SOURCE (héros → persiste, `recomputeLoadout` re-dérive),
 *  sinon sur le Weapon actif (ennemi/figurant, transient). Respecte Incassable (LDB 62 l.310). */
function wearActiveWeapon(c: Combatant, weapon: Weapon, destroy: boolean): void {
  const it = (c.items ?? []).find((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged') && i.name === weapon.name);
  if (isUnbreakable(it ?? weapon)) return; // Incassable : ni dégât ni destruction (LDB 62 l.310)
  // Sauvegarde Solide(N) contre une cassure instantanée : 1d10 ≥ seuil → l'arme résiste (LDB 60 l.64-67).
  if (destroy) {
    const thr = solideSaveThreshold(weapon);
    if (thr != null && d10(battleRng()) >= thr) return;
  }
  if (it) {
    if (destroy) {
      it.destroyed = true;
    } else {
      // Une Arme improvisée déjà à +0 qui prend un Dégât de plus devient inutilisable (LDB 62 l.178).
      if (isImprovised({ ...weapon, damageTaken: it.damageTaken ?? 0 })) it.destroyed = true;
      it.damageTaken = (it.damageTaken ?? 0) + 1;
    }
    recomputeLoadout(c); // re-dérive c.weapons depuis l'item usé (persiste via carryOverState items)
  } else if (destroy) {
    destroyWeapon(weapon);
  } else {
    damageWeapon(weapon);
  }
}

/**
 * Applique l'effet du Tableau des Oups ! au combattant `c` (mute + journalise). LDB 14 l.14-57.
 * Le chiffre des unités du jet sert de DR pour les touches (l.44).
 */
export function applyOups(get: () => GameState, set: any, c: Combatant, weapon: Weapon, r: OupsResolved): void {
  const battle = get().battle!;
  const log: string[] = [`${c.name} — Maladresse ! ${r.label}`];
  // Bâclé : l'arme casse sur toute Maladresse (Test raté + double, LDB 60 l.82) — sauvegarde Solide possible.
  if (hasQuality(weapon, 'Bâclé')) wearActiveWeapon(c, weapon, true);
  const sb = bonus(effectiveChar(c, 'F'));
  const units = r.roll % 10;
  switch (r.kind) {
    case 'selfWound':
      c.wounds.current = Math.max(0, c.wounds.current - 1); // ignore BE+PA (l.18)
      if (c.wounds.current <= 0) applyZeroWounds(c);
      break;
    case 'weaponDamageActLast':
      wearActiveWeapon(c, weapon, false); // 1 Dégât d'arme, persisté sur l'ItemInstance source
      c.actLastNextRound = true;
      break;
    case 'actionPenalty':
      c.nextActionPenalty = 10;
      break;
    case 'loseMovement':
      c.loseNextMovement = true;
      break;
    case 'loseAction':
      c.loseNextAction = true;
      break;
    case 'trauma': {
      c.criticalWounds = (c.criticalWounds ?? 0) + 1; // « compte comme une Blessure critique » (l.41)
      const leg: HitLocation = battleRng().int(0, 1) === 0 ? 'jambeG' : 'jambeD'; // « se tord la cheville »
      c.traumas = [...(c.traumas ?? []), traumaFromKind('dechirure', 'mineur', leg, { be: bonus(effectiveChar(c, 'E')) })];
      log.push(`  ↳ Déchirure musculaire (Mineure) à la ${leg === 'jambeG' ? 'jambe gauche' : 'jambe droite'}.`);
      break;
    }
    case 'hitAlly': {
      const allies = alliesAtRange(battle, c, weapon);
      if (allies.length) {
        const ally = allies[battleRng().int(0, allies.length - 1)];
        const loc = hitLocationByShape(reverseRoll(r.roll), ally.bodyShape);
        const lost = woundsFromHit(weapon, ally, loc, effectiveWeaponDamage(weapon, sb) + units); // plancher 1 (l.165)
        ally.wounds.current = Math.max(0, ally.wounds.current - lost);
        if (ally.wounds.current <= 0) applyZeroWounds(ally);
        log.push(`  ↳ Touche ${ally.name} (${locationLabel(loc, ally.bodyShape)}) : ${lost} Blessure(s).`);
      } else {
        addCondition(c, 'Sonné'); // « Si personne n'est à distance, vous vous frappez tout seul → Sonné » (l.45-46)
        log.push(`  ↳ Personne à portée : se frappe seul → Sonné.`);
      }
      break;
    }
    case 'misfire': {
      const lost = woundsFromHit(weapon, c, 'brasD', effectiveWeaponDamage(weapon, sb) + units); // plancher 1
      c.wounds.current = Math.max(0, c.wounds.current - lost);
      if (c.wounds.current <= 0) applyZeroWounds(c);
      wearActiveWeapon(c, weapon, true); // arme détruite, persistée sur l'ItemInstance source
      log.push(`  ↳ Incident de Tir : ${lost} Blessure(s) au Bras principal, arme détruite.`);
      break;
    }
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'info', c.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Maladresse d'un ENNEMI : résolue instantanément (IA abstraite). No-op si pas un ennemi/pas de fumble. */
export function resolveEnemyFumble(get: () => GameState, set: any, enemy: Combatant, weapon: Weapon, res: AttackResult): void {
  if (enemy.kind !== 'enemy' || !attackerFumbled(res)) return;
  applyOups(get, set, enemy, weapon, rollOups(weapon, battleRng()));
}

/** Ouvre la modale de défense réactive si l'attaque est : ennemi → héros, en mêlée,
 *  à portée, cible CAPABLE de se défendre (pas Surpris). Fige le jet d'attaque et
 *  suspend le tour de l'IA. Retourne true si la modale s'est ouverte. */
export function maybeOpenDefense(
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon = attacker.weapons[0],
  free?: { kind: string; prevActed: boolean },
): boolean {
  if (attacker.kind !== 'enemy' || target.kind !== 'hero') return false;
  if (weapon?.type !== 'melee') return false;
  if (combatDistance(attacker, target) > reachTiles(weapon)) return false; // Allonge incluse (RAW-3)
  if (cannotDefend(target)) return false; // Surpris → résolution instantanée (LDB États l.132)
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée, AVANT le jet (une seule fois)
  const atk = rollMeleeAttacker(attacker, target, weapon, battleRng()); // jet d'attaque figé
  set({
    pendingDefense: {
      attackerId: attacker.id,
      defenderId: target.id,
      weapon,
      location: null, // l'IA ne vise pas de localisation
      atk,
      mode: bestDefenseMode(target),
      def: null,
      result: null,
      // Attaque GRATUITE de créature (Morsure/Caudale/Piétinement) : portée au resolve pour
      // restaurer l'Action (gratuite), appliquer ses effets RAW et enchaîner la file.
      ...(free ? { free: true, freeKind: free.kind, prevActed: free.prevActed } : {}),
    },
  });
  return true;
}

/** Attaque de l'IA : ouvre la modale de défense (→ true, tour SUSPENDU) si la cible
 *  est un héros qui peut se défendre en mêlée ; sinon résout instantanément (→ false). */
export function doAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant): boolean {
  if (maybeOpenDefense(set, attacker, target)) return true; // suspendu : reprise via defenseConfirm/Cancel
  // Tir ennemi : annoncer la cible dans le journal (« jamais su sur qui il tirait », Lot 1 tranche 3).
  if (firedWeapon(attacker, target).type === 'ranged') get().log(`${attacker.name} tire sur ${target.name}.`);
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
  // Charge montée (LDB 14 l.223) : si l'attaquant a chargé ce tour, ses dégâts utilisent la Force + la
  // Taille de sa monture — PARITÉ avec le joueur (le proxy ne s'applique que s'il chevauche réellement).
  const r = resolveAttack(get, attacker, target, undefined, attacker.chargedThisTurn);
  if (!r) {
    get().log(firedWeapon(attacker, target).type === 'ranged' ? 'Pas de ligne de vue (cible masquée).' : 'Cible hors de portée de mêlée.');
    return false;
  }
  const suspended = applyAttackResult(get, set, attacker, r.victim ?? target, r.weapon, r.res); // r.victim = allié touché par un tir dévié (LDB 14 l.136)
  if (suspended) return true; // Déviation Critique du héros : la modale reprendra (autoCleave/Piétinement/advance rejoués au resolve)
  autoCleave(get, set, attacker, r.victim ?? target, r.res); // Frappe Mortelle : balayage auto si l'ennemi est plus grand
  return false;
}

// ---------------------------------------------------------------------------
// Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299)
// ---------------------------------------------------------------------------

/** Cibles de balayage : adversaires encore actifs, ADJACENTS (Chebyshev ≤ 1 — « à portée de ses
 *  attaques » = adjacence tant que l'Allonge n'est pas modélisée) et non déjà frappés dans ce
 *  balayage. Sans position connue (tests purs), on ne filtre pas sur la distance. */
export function cleaveTargets(battle: BattleState, attacker: Combatant, hitIds: string[]): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c) || hitIds.includes(c.id)) return false;
    if (!attacker.pos || !c.pos) return true;
    return combatDistance(attacker, c) <= 1;
  });
}

/** Balayage AUTOMATIQUE d'un ennemi (IA) après une touche de mêlée d'un plus grand (`res.cleave`,
 *  LDB 85 l.299) : enchaîne jusqu'à BCC attaques sur des adversaires adjacents non encore frappés,
 *  se déplaçant sur la case d'une cible tuée (l.10). Résolution instantanée — les enchaînements
 *  n'ouvrent pas de modale de défense interactive (simplification documentée pour l'IA). */
export function autoCleave(get: () => GameState, set: any, attacker: Combatant, primaryTarget: Combatant, res: AttackResult): void {
  if (attacker.kind !== 'enemy' || !res.cleave) return;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  if (bcc < 1) return;
  const hitIds = [primaryTarget.id];
  // Cible primaire tuée → l'attaquant se déplace sur sa case avant d'enchaîner (l.10).
  if (isOutOfAction(primaryTarget) && primaryTarget.pos) attacker.pos = { ...primaryTarget.pos };
  for (let n = 0; n < bcc; n++) {
    const battle = get().battle;
    if (!battle || battle.over) break;
    const next = cleaveTargets(battle, attacker, hitIds)[0];
    if (!next) break;
    hitIds.push(next.id);
    const r = resolveAttack(get, attacker, next);
    if (!r) continue; // hors de portée (ne devrait pas : déjà filtré adjacent) — borne consommée tout de même
    applyAttackResult(get, set, attacker, r.victim ?? next, r.weapon, r.res, false); // enchaînement : résolution instantanée (pas de modale de déviation imbriquée)
    if (isOutOfAction(next) && next.pos) attacker.pos = { ...next.pos }; // se déplace sur la case libérée
  }
  set({ battle: { ...get().battle! } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Balayage d'un HÉROS (interactif) : appelé après l'application d'une attaque. Démarre le balayage
 *  sur une touche d'un plus grand (`res.cleave`), ou le poursuit si `wasChain` (un enchaînement vient
 *  d'être résolu). Ouvre/maintient `pendingCleave` tant qu'il reste des cibles adjacentes ET que le
 *  nombre d'enchaînements reste < BCC (LDB 14 l.12) ; sinon le ferme. Déplacement sur la case d'une
 *  cible tuée (l.10). */
export function maybeHeroCleave(get: () => GameState, set: any, attacker: Combatant, target: Combatant, res: AttackResult, wasChain: boolean): void {
  if (attacker.kind !== 'hero') return;
  const pc = get().pendingCleave;
  if (!pc && !res.cleave) return; // ni balayage en cours, ni déclenché par cette touche
  const count = wasChain ? (pc?.count ?? 0) + 1 : pc?.count ?? 0; // un enchaînement résolu consomme une attaque
  const hitIds = pc ? [...new Set([...pc.hitIds, target.id])] : [target.id];
  if (isOutOfAction(target) && target.pos) attacker.pos = { ...target.pos }; // case libérée (l.10)
  const battle = get().battle!;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  const remaining = cleaveTargets(battle, attacker, hitIds);
  if (!battle.over && count < bcc && remaining.length) {
    set({ pendingCleave: { attackerId: attacker.id, hitIds, count }, battle: { ...battle } });
  } else {
    set({ pendingCleave: null, battle: { ...battle } });
  }
}

// ---------------------------------------------------------------------------
// Piétinement — action gratuite à 1 Avantage (LDB 85 - Traits de créature.md l.320-321)
// ---------------------------------------------------------------------------

/** Arme abstraite du Piétinement : Corps à corps (Bagarre), Dégâts = Bonus de Force (+0). */
export const TRAMPLE_WEAPON: Weapon = { name: 'Piétinement', type: 'melee', damage: '+BF', qualities: [] };

/** Cible de Piétinement valide pour `c` (LDB 85 l.320-321) : adversaire ADJACENT, encore actif et
 *  PLUS PETIT (`sizeGap >= 1`). `targetId` borne la recherche à une cible précise (clic du joueur). */
export function trampleTarget(battle: BattleState, c: Combatant, targetId?: string): Combatant | undefined {
  return battle.combatants.find(
    (t) =>
      (targetId ? t.id === targetId : true) &&
      t.kind !== c.kind &&
      !isOutOfAction(t) &&
      !!t.pos &&
      !!c.pos &&
      combatDistance(c, t) <= 1 &&
      sizeGap(c.size, t.size) >= 1,
  );
}

/** Résout un Piétinement : dépense 1 Avantage (coût de l'action gratuite) puis applique
 *  `resolveTrample` (BF +0, Corps à corps). Ne consomme PAS l'Action (« action gratuite »). */
export function applyTrample(get: () => GameState, set: any, attacker: Combatant, target: Combatant): void {
  const prevActed = get().battle?.acted ?? false; // « action gratuite » : ne doit pas consommer l'Action
  attacker.advantage = Math.max(0, attacker.advantage - 1); // coût : 1 Avantage (LDB 85 l.320)
  const res = resolveTrample(attacker, target, battleRng());
  applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, res, false); // pose acted=true (attaque standard)… ; Piétinement = résolution instantanée (pas de modale)
  set({ battle: { ...get().battle!, acted: prevActed } }); // …qu'on restaure : le Piétinement est gratuit
}

/** L'IA piétine (faible priorité, après l'attaque principale) : action gratuite si l'ennemi a ≥1
 *  Avantage et qu'un adversaire adjacent plus petit est à portée. Instantané (pas de modale IA). */
export function aiMaybeTrample(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy) || enemy.advantage < 1) return;
  const battle = get().battle;
  if (!battle || battle.over) return;
  const target = trampleTarget(battle, enemy);
  if (!target) return;
  applyTrample(get, set, enemy, target);
}

/** Attaque LIBRE de Frénésie (LDB 21 l.34 : « un Test de Capacité de Combat gratuit chaque Round ») :
 *  un ennemi frenzied porte une attaque de mêlée supplémentaire avec son arme contre un adversaire
 *  adjacent. Elle NE consomme ni Avantage ni Action. Résolution instantanée — comme autoCleave /
 *  aiMaybeTrample, l'IA ne déclenche pas de modale de défense (simplification documentée). */
export function aiFrenzyAttack(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || !enemy.frenzied || isOutOfAction(enemy)) return;
  const battle = get().battle;
  if (!battle || battle.over || !enemy.pos) return;
  if ((enemy.weapons[0]?.type ?? 'melee') !== 'melee') return; // CC Test = corps à corps
  const target = battle.combatants.find(
    (t) => t.kind !== enemy.kind && !isOutOfAction(t) && !!t.pos && combatDistance(enemy, t) <= 1,
  );
  if (!target) return;
  const prevActed = get().battle?.acted ?? false; // gratuite : on restaure l'état d'Action après coup
  const r = resolveAttack(get, enemy, target);
  if (!r) return;
  applyAttackResult(get, set, enemy, r.victim ?? target, r.weapon, r.res, false); // instantané (pas de modale)
  set({ battle: { ...get().battle!, acted: prevActed } });
}

// ---------------------------------------------------------------------------
// Attaques GRATUITES de créature (Taille & traits) — chacune au prix de 1 Avantage, OPPOSÉE
// (la cible se défend Parade/Esquive, comme une attaque normale) et NE consomme PAS l'Action.
// RAW : Piétinement (LDB 85 l.320-321, BF+0), Morsure/Attaque caudale (l.338/340, Indice) ; priorité
// Morsure/Caudale (Indice) avant Piétinement (BF+0) — cf. exemple Aventures à Ubersreik.
// ---------------------------------------------------------------------------

/** Arme abstraite d'une attaque gratuite : Piétinement = BF+0 ; Morsure/Caudale = +Indice (BF inclus). */
function freeAttackWeapon(kind: string, bonus: number): Weapon {
  if (kind === 'pietinement') return TRAMPLE_WEAPON;
  const name = kind === 'caudale' ? 'Attaque caudale' : kind === 'cornes' ? 'Cornes' : 'Morsure';
  return { name, type: 'melee', damage: `+${bonus}`, qualities: [] };
}

/** Type de pose d'attaque (rendu créature) déduit du NOM de l'arme naturelle, ou undefined (arme
 *  manufacturée → pose générique du gabarit). Sert au tintage de l'animation d'attaque (AnimatedPlanToken). */
export function creatureAttackKind(weaponName: string): string | undefined {
  const n = weaponName.toLowerCase();
  if (n.includes('morsure')) return 'morsure';
  if (n.includes('caudale') || n.includes('queue')) return 'caudale';
  if (n.includes('piétin') || n.includes('pietin')) return 'pietinement';
  if (n.includes('corne')) return 'cornes';
  if (n.includes('griffe') || n === 'arme') return 'arme';
  return undefined;
}

/** Difficulté de Test (clé) depuis le libellé FR de la Difficulté du Venin (défaut Intermédiaire). */
function venomDiffKey(label: string): import('../engine/types').Difficulty {
  const l = label.toLowerCase();
  if (l.includes('très facile')) return 'tresFacile';
  if (l.includes('facile')) return 'facile';
  if (l.includes('accessible')) return 'accessible';
  if (l.includes('très difficile')) return 'tresDifficile';
  if (l.includes('difficile')) return 'difficile';
  if (l.includes('complexe')) return 'complexe';
  return 'intermediaire';
}

/** Effets RAW post-touche d'une attaque gratuite (sur PB infligés) :
 *  - Attaque caudale → cible de Taille INFÉRIEURE → À Terre (LDB 85 l.338) ;
 *  - Atout Venin de la créature → Test de Résistance (Endurance) à la Difficulté du Venin ;
 *    sur un échec, la cible subit l'État Empoisonné (LDB 85 l.326, voir p.168). */
export function applyFreeAttackEffects(get: () => GameState, attacker: Combatant, target: Combatant, kind: string, res: AttackResult): void {
  if (!res.hit) return; // les effets se déclenchent sur une touche réussie
  const traits = attacker.traits ?? [];
  // Constricteur (Hydre/Pieuvre, LDB 85) : toute touche → Empêtré (+ Empoignade possible).
  if (traits.some((t) => /^constricteur/i.test(t)) && !hasCondition(target, 'Empêtré')) {
    addCondition(target, 'Empêtré');
    const cond = target.conditions.find((c) => c.name === 'Empêtré'); if (cond) cond.sourceId = attacker.id; // source du Test opposé de Force (LDB 16 l.61)
    get().log(`${target.name} est Empêtré (Constricteur).`);
  }
  if (!res.woundsLost) return; // les effets suivants exigent des Points de Blessure perdus
  // Vampirique (Vampire/Varghulf, LDB 85) : Morsure infligeant des PB → l'attaquant récupère autant.
  if (kind === 'morsure' && traits.some((t) => /^vampirique/i.test(t))) {
    attacker.wounds.current = Math.min(attacker.wounds.max, attacker.wounds.current + res.woundsLost);
    get().log(`${attacker.name} draine ${res.woundsLost} Blessure(s) (Vampirique).`);
  }
  if (kind === 'caudale' && sizeGap(attacker.size, target.size) >= 1 && !hasCondition(target, 'À Terre')) {
    addCondition(target, 'À Terre');
    get().log(`${target.name} est mis À Terre (Attaque caudale).`);
  }
  const vd = venomDifficulty(attacker.traits ?? []);
  if (vd && !hasCondition(target, 'Empoisonné')) {
    const resAdv = target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0;
    const t = rollTest(effectiveChar(target, 'E') + resAdv, venomDiffKey(vd), battleRng());
    if (!t.success) {
      addCondition(target, 'Empoisonné');
      get().log(`${target.name} échoue à résister au Venin et est Empoisonné.`);
    } else get().log(`${target.name} résiste au Venin.`);
  }
}

/** Cible d'une attaque gratuite : adversaire adjacent actif (Piétinement exige une Taille inférieure). */
function freeAttackTarget(battle: BattleState, c: Combatant, kind: string): Combatant | undefined {
  if (kind === 'pietinement') return trampleTarget(battle, c);
  return battle.combatants.find((t) => t.kind !== c.kind && !isOutOfAction(t) && !!t.pos && !!c.pos && combatDistance(c, t) <= 1);
}

/** Résout UNE attaque gratuite de `kind` contre `target`, OPPOSÉE et GRATUITE : ouvre la modale de
 *  défense (héros) → suspendu (true) ; sinon résout instantanément (opposé auto, ou passif si Surpris),
 *  restaure l'Action et applique les effets. Dépense 1 Avantage. */
function applyFreeAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant, kind: string, bonus: number): boolean {
  const prevActed = get().battle?.acted ?? false;
  attacker.advantage = Math.max(0, attacker.advantage - (kind === 'cornes' ? 0 : 1)); // 1 Avantage ; Cornes = gratuite SUR CHARGE (sans coût)
  const weapon = freeAttackWeapon(kind, bonus);
  if (maybeOpenDefense(set, attacker, target, weapon, { kind, prevActed })) return true; // suspendu : resolve via défense
  const res = resolveMelee(attacker, target, weapon, battleRng(), { defense: cannotDefend(target) ? 'none' : bestDefenseMode(target) });
  applyAttackResult(get, set, attacker, target, weapon, res, false);
  set({ battle: { ...get().battle!, acted: prevActed } }); // gratuite : ne consomme pas l'Action
  applyFreeAttackEffects(get, attacker, target, kind, res);
  return false;
}

/** Émet l'animation d'attaque d'une attaque SPÉCIALE de créature → AnimatedPlanToken joue la pose
 *  dédiée (creatureAttackPoses) ; les biped/spectraux jouent leur clip d'attaque générique. */
function emitCreatureAttackAnim(attacker: Combatant, kind: string): void {
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: attacker.id, kind: 'creature', defense: 'none', result: { hit: true }, creatureAttack: kind });
}

/** Attaque de ZONE gratuite : Souffle (LDB 85, 2 Av) ou Vomissement (Troll, 3 Av). Cible visible la
 *  plus proche dans la portée (Souffle BE+20 m ; Vomi BE m), puis tous les ennemis dans la zone
 *  (Souffle : BF de la cible ; Vomi : 2 m). Test opposé CT/Esquive PAR cible ; sur un échec de la
 *  cible : Dégâts (mitigés BE+PA, sauf ignore-PA des Types Feu/Électricité/Poison) + effet de Type
 *  (Enflammé/Sonné/Empoisonné) ou Sonné (Vomi) + corrosion (Armure/Arme −1). Instantané (pas de modale
 *  IA), résolution opposée auto. Ne consomme pas l'Action. RAW : LDB 85 Souffle / Vomissement. */
export function applyAreaAttack(get: () => GameState, set: any, attacker: Combatant, a: CreatureAttack): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - a.avantage);
  const isVomi = a.kind === 'vomi';
  const be = bonus(effectiveChar(attacker, 'E'));
  const rangeTiles = Math.max(1, Math.ceil((isVomi ? be : be + 20) / 2)); // 1 case = 2 m
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= rangeTiles);
  if (!foes.length) return;
  const center = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const blast = isVomi ? 1 : Math.max(1, Math.ceil(bonus(effectiveChar(center, 'F')) / 2)); // Souffle : BF de la cible ; Vomi : 2 m
  const affected = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(center.pos!, c.pos) <= blast);
  const type = (a.type ?? '').toLowerCase();
  const ignorePA = !isVomi && /feu|électric|electric|poison/.test(type);
  const corrosif = isVomi || /corros/.test(type);
  const damage = isVomi ? be + 4 : a.bonus; // Vomi = BE+4 ; Souffle = Indice
  const lines: string[] = [`${attacker.name} déclenche ${ATTACK_LABEL[a.kind]}${a.type ? ` (${a.type})` : ''} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  for (const tgt of affected) {
    // Test opposé CT/Esquive (Vomi : Facile +40 pour l'attaquant à courte distance).
    const r = opposedTest(combatValue(attacker, 'ranged'), defenseValue(tgt, 'esquive'), battleRng(), isVomi ? 'facile' : 'intermediaire', 'intermediaire');
    if (!r.attackerWins) { lines.push(`${tgt.name} esquive.`); continue; }
    const tb = bonus(effectiveChar(tgt, 'E'));
    const pa = ignorePA ? 0 : Math.max(0, tgt.armour.corps ?? 0);
    const wl = Math.max(0, damage - tb - pa);
    if (wl > 0) { loseWounds(tgt, wl); lines.push(`${tgt.name} subit ${wl} Blessure(s)${ignorePA ? ' (ignore PA)' : ''}.`); }
    if (isVomi || /électric|electric/.test(type)) addCondition(tgt, 'Sonné');
    else if (/froid/.test(type) && wl > 0) for (let i = 0; i < Math.max(1, Math.floor(wl / 5)); i++) addCondition(tgt, 'Sonné'); // 1 Sonné / 5 Blessures
    if (/feu/.test(type)) addCondition(tgt, 'En flammes');
    if (/poison/.test(type)) addCondition(tgt, 'Empoisonné');
    if (corrosif) { // Armure & Arme portées subissent 1 Dégât
      tgt.armour.corps = Math.max(0, (tgt.armour.corps ?? 0) - 1);
      if (tgt.weapons[0]) tgt.weapons[0].damageTaken = (tgt.weapons[0].damageTaken ?? 0) + 1;
    }
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  }
  // Type Fumée : la zone se remplit de fumée et bloque les Lignes de vue pendant BE Rounds (RAW Souffle).
  let smoke = get().battle!.smoke;
  if (/fum/.test(type)) {
    const dur = Math.max(1, be); // Rounds = Bonus d'Endurance de la créature
    const zone = smokeZone(attacker.pos!, center.pos!, blast);
    smoke = [...(smoke ?? []), ...zone.map((t) => ({ x: t.x, y: t.y, rounds: dur }))];
    lines.push(`La zone se remplit de fumée — Lignes de vue bloquées ${dur} Round(s).`);
  }
  set({ battle: { ...get().battle!, smoke, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Langue préhensile (Jabberslythe, LDB 85) : Attaque gratuite à 1 Avantage, À DISTANCE. Cible
 *  visible la plus proche, Test opposé CT/Esquive ; sur une touche : Dégâts = Indice + État Empêtré
 *  (et traction/Empoignade — non modélisées). Instantané. Ne consomme pas l'Action. */
export function applyTongue(get: () => GameState, set: any, attacker: Combatant, a: CreatureAttack): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - a.avantage);
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return;
  const tgt = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const r = opposedTest(combatValue(attacker, 'ranged'), defenseValue(tgt, 'esquive'), battleRng());
  const lines = [`${attacker.name} projette sa Langue préhensile sur ${tgt.name} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  if (r.attackerWins) {
    const wl = Math.max(0, a.bonus - bonus(effectiveChar(tgt, 'E')) - Math.max(0, tgt.armour.corps ?? 0));
    if (wl > 0) { loseWounds(tgt, wl); lines.push(`${tgt.name} subit ${wl} Blessure(s).`); }
    if (!hasCondition(tgt, 'Empêtré')) addCondition(tgt, 'Empêtré');
    const cond = tgt.conditions.find((c) => c.name === 'Empêtré'); if (cond) cond.sourceId = attacker.id; // source du Test opposé de Force (LDB 16 l.61)
    lines.push(`${tgt.name} est Empêtré (Langue préhensile).`);
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  } else lines.push(`${tgt.name} esquive la langue.`);
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Hurlement fantomatique (Banshee, LDB 85) : Attaque gratuite (ne consomme pas l'Action), dépense
 *  TOUS les Avantages (min 2). Toutes les créatures VIVANTES (non Mort-vivant) à Initiative mètres
 *  subissent 1d10 Blessures (ignore BE et PA), un Test de Résistance Accessible (+20) ou l'État Brisé,
 *  et 3 États Assourdi. Instantané. Renvoie true si poussé. */
export function applyWail(get: () => GameState, set: any, attacker: Combatant): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos || attacker.advantage < 2) return false;
  attacker.advantage = 0; // dépense TOUS les Avantages
  const radius = Math.max(1, Math.ceil(effectiveChar(attacker, 'I') / 2)); // Initiative mètres → cases (2 m)
  const living = battle.combatants.filter(
    (c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= radius && !(c.traits ?? []).some((t) => /mort-vivant/i.test(t)),
  );
  const lines = [`${attacker.name} pousse un Hurlement fantomatique !`];
  emitCreatureAttackAnim(attacker, 'hurlement');
  for (const tgt of living) {
    const wl = d10(battleRng()); // 1d10, ignore Endurance et PA
    loseWounds(tgt, wl);
    lines.push(`${tgt.name} subit ${wl} Blessure(s) (ignore Endurance et PA).`);
    const resAdv = tgt.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0;
    if (!rollTest(effectiveChar(tgt, 'E') + resAdv, 'accessible', battleRng()).success) addCondition(tgt, 'Brisé');
    for (let i = 0; i < 3; i++) addCondition(tgt, 'Assourdi'); // 3 États Assourdi
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** Regard pétrifiant (Basilic, LDB 85) : pour son ACTION, la créature dépense ≥1 Avantage (l'IA
 *  dépense tout ce qu'elle a, min 1) → Test opposé CT/Initiative avec +1 DR par Avantage dépensé.
 *  La cible reçoit 1 État Sonné par tranche de 2 DR de marge ; pétrifiée si la marge atteint 6 DR.
 *  Cible visible la plus proche. Instantané. Consomme l'Action. Renvoie true si résolu. */
export function applyGaze(get: () => GameState, set: any, attacker: Combatant): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos || attacker.advantage < 1) return false;
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return false;
  const tgt = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const spent = attacker.advantage; // l'IA met tout (min 1) — +1 DR par Avantage
  attacker.advantage = 0;
  const atk = rollTest(combatValue(attacker, 'ranged'), 'intermediaire', battleRng());
  const initVal = effectiveChar(tgt, 'I') + (tgt.skills.find((s) => s.name.toLowerCase().startsWith('initiative'))?.advances ?? 0);
  const def = rollTest(initVal, 'intermediaire', battleRng());
  const margin = atk.sl + spent - def.sl; // DR de l'attaquant (+Avantage) − DR du défenseur
  const lines = [`${attacker.name} fixe ${tgt.name} de son Regard pétrifiant (${spent} Avantage) !`];
  emitCreatureAttackAnim(attacker, 'regard');
  if (margin > 0) {
    if (margin >= 6) { addCondition(tgt, 'Pétrifié'); tgt.wounds.current = 0; applyZeroWounds(tgt); lines.push(`${tgt.name} est définitivement changé en PIERRE !`); }
    else { const n = Math.floor(margin / 2); for (let i = 0; i < n; i++) addCondition(tgt, 'Sonné'); lines.push(`${tgt.name} reçoit ${n} État(s) Sonné.`); }
  } else lines.push(`${tgt.name} soutient le regard.`);
  set({ battle: { ...get().battle!, acted: true, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** Étreinte glaciale (Spectre de cairn, LDB 85) : ACTION + 2 Avantages. Test opposé CC vs Corps à
 *  corps/Esquive de la cible ; sur un succès, la cible perd 1d10 + DR Blessures ignorant le Bonus
 *  d'Endurance ET les PA. Attaque magique. Cible adjacente. Instantané. Consomme l'Action. */
export function applyChillGrasp(get: () => GameState, set: any, attacker: Combatant): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos || attacker.advantage < 2) return false;
  const tgt = battle.combatants.find((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(attacker, c) <= 1);
  if (!tgt) return false;
  attacker.advantage = Math.max(0, attacker.advantage - 2);
  const r = opposedTest(combatValue(attacker, 'melee'), defenseValue(tgt, bestDefenseMode(tgt)), battleRng());
  const lines = [`${attacker.name} étreint ${tgt.name} de son toucher glacial !`];
  emitCreatureAttackAnim(attacker, 'etreinte');
  if (r.attackerWins) {
    const wl = d10(battleRng()) + r.netSL; // 1d10 + DR, ignore BE et PA
    loseWounds(tgt, wl);
    lines.push(`${tgt.name} perd ${wl} Blessure(s) (ignore Endurance et PA).`);
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  } else lines.push(`${tgt.name} résiste à l'étreinte.`);
  set({ battle: { ...get().battle!, acted: true, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** Attaque-ACTION spéciale de l'IA (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
 *  normale, si la créature en a le trait et l'Avantage requis. Renvoie true si elle a agi. */
export function aiMaybeSpecialAction(get: () => GameState, set: any, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return false;
  const atks = creatureAttacks(enemy.traits ?? []);
  if (atks.some((a) => a.kind === 'regard') && enemy.advantage >= 1) return applyGaze(get, set, enemy);
  if (atks.some((a) => a.kind === 'etreinte') && enemy.advantage >= 2) return applyChillGrasp(get, set, enemy);
  return false;
}

/** L'IA enchaîne ses attaques gratuites de créature après l'attaque principale (chacune 1 Avantage,
 *  OPPOSÉE). File initialisée au 1er appel (Morsure/Attaque caudale des traits, PUIS Piétinement de
 *  Taille — les Indices d'abord), puis poursuivie après chaque modale de défense résolue. Retourne
 *  true si une modale s'est ouverte (tour SUSPENDU). */
export function aiCreatureFreeAttacks(get: () => GameState, set: any, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) { enemy.pendingFreeAttacks = undefined; return false; }
  const battle = get().battle;
  if (!battle || battle.over) { enemy.pendingFreeAttacks = undefined; return false; }
  if (enemy.pendingFreeAttacks === undefined) {
    const atks = creatureAttacks(enemy.traits ?? []);
    // Attaques de ZONE (gratuites, instantanées) : Souffle (2 Av) puis Vomissement (3 Av) si abordables.
    const souffle = atks.find((a) => a.kind === 'souffle');
    if (souffle && enemy.advantage >= souffle.avantage) applyAreaAttack(get, set, enemy, souffle);
    const vomi = atks.find((a) => a.kind === 'vomi');
    if (vomi && enemy.advantage >= vomi.avantage) applyAreaAttack(get, set, enemy, vomi);
    const langue = atks.find((a) => a.kind === 'langue');
    if (langue && enemy.advantage >= langue.avantage) applyTongue(get, set, enemy, langue); // Jabberslythe : langue à distance
    if (atks.some((a) => a.kind === 'hurlement') && enemy.advantage >= 2) applyWail(get, set, enemy); // Banshee : cri (tous les Av)
    const traitKinds = atks
      .filter((a) => a.trigger === 'free' && a.avantage === 1 && (a.kind === 'morsure' || a.kind === 'caudale'))
      .map((a) => a.kind);
    // Cornes : Attaque gratuite gagnée EN CHARGEANT (LDB 85), sans coût d'Avantage → en tête.
    const cornes = enemy.chargedThisTurn && atks.some((a) => a.kind === 'cornes') ? ['cornes'] : [];
    enemy.chargedThisTurn = false; // consommée
    enemy.pendingFreeAttacks = [...cornes, ...traitKinds, 'pietinement']; // Piétinement (Taille) en dernier
  }
  while (enemy.pendingFreeAttacks.length) {
    const kind = enemy.pendingFreeAttacks[0];
    if (kind !== 'cornes' && enemy.advantage < 1) break; // Cornes (Charge) ne coûte pas d'Avantage
    const b2 = get().battle; if (!b2 || b2.over) break;
    const target = freeAttackTarget(b2, enemy, kind);
    if (!target) { enemy.pendingFreeAttacks.shift(); continue; }
    const bonus = kind === 'pietinement' ? 0 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.bonus ?? 0;
    enemy.pendingFreeAttacks.shift();
    if (applyFreeAttack(get, set, enemy, target, kind, bonus)) return true; // modale ouverte → reprise via defenseConfirm
  }
  enemy.pendingFreeAttacks = undefined; // file épuisée
  return false;
}

/** Applique un effet actif sans cumul : un seul bonus (le meilleur) ET une seule
 *  pénalité (la pire) coexistent par caractéristique (Livre de base l.168). */
export function applyActiveEffect(target: Combatant, effect: ActiveEffect) {
  target.activeEffects = target.activeEffects ?? [];
  // On ne dédoublonne qu'entre effets de MÊME signe (bonus vs pénalité séparés) :
  // un bonus et une pénalité sur la même caractéristique s'additionnent (effectiveChar).
  const sameSign = (b: number) => b >= 0 === effect.bonus >= 0;
  const idx = target.activeEffects.findIndex((e) => e.char === effect.char && effect.char != null && sameSign(e.bonus));
  if (idx >= 0) {
    const cur = target.activeEffects[idx].bonus;
    const better = effect.bonus >= 0 ? effect.bonus >= cur : effect.bonus <= cur;
    if (better) target.activeEffects[idx] = effect;
  } else {
    target.activeEffects.push(effect);
  }
  // Les Blessures dérivent de F/E/FM (LDB 85) → un buff de ces caractéristiques recale les PB max + courants.
  if (effect.char === 'F' || effect.char === 'E' || effect.char === 'FM') refreshWounds(target);
}

/** Rounds attribués à un buff dont la durée (minutes/heures/jours) dépasse le combat. */
export const COMBAT_PERSIST = 9999;

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(get: () => GameState, set: any, caster: Combatant, severity: MiscastSeverity, sinPoints = 0): string[] {
  const m = rollMiscast(severity, battleRng(), sinPoints);
  const lines = [m.log];
  for (const op of m.ops) {
    if (op.reduceToZero) {
      caster.wounds.current = 0;
      addCondition(caster, 'Inconscient');
      lines.push(`${caster.name} : Blessures réduites à 0 (Inconscient).`);
    } else if (op.wounds != null) {
      loseWounds(caster, op.wounds); // miscast : perte de PB centralisée (−Avantage + À Terre à 0)
      lines.push(`${caster.name} subit ${op.wounds} Blessure(s) (ignorant BE et PA).`);
    } else if (op.condition) {
      addCondition(caster, op.condition.name, op.condition.value);
      lines.push(`${caster.name} reçoit ${op.condition.value} État ${op.condition.name}.`);
    }
  }
  // « Un jet = une modale » : le héros voit le dé de la table (Colère/Imparfaite) en révélation témoin.
  if (caster.kind === 'hero')
    pushReveal(set, { kind: 'miscast', title: severity === 'colere' ? 'Colère des dieux' : 'Incantation Imparfaite', dice: m.rolls[0], lines });
  return lines;
}

/**
 * Clôt une action JOUEUR résolue (soin / incantation / Focalisation, et futures actions hors combat) :
 * EN COMBAT consomme l'Action (`acted`/`action:null`/`selectedSpell:null`), journalise dans `battle.log`
 * et vérifie la fin de combat ; HORS COMBAT trace le `journal`. C'est la SORTIE commune — `combatOrParty`
 * fournit la RÉSOLUTION des acteurs (`actorIn`/`touchActors`), ce helper la finalisation.
 * `selectedSpell:null` est neutre pour une action non-incantation (déjà null).
 */
export function finishPlayerAction(get: () => GameState, set: any, lines: string[], kind: CombatEventKind = 'info'): void {
  const battle = get().battle;
  if (battle) {
    set({ battle: { ...battle, acted: true, action: null, selectedSpell: null, log: [...battle.log, ...evLines(lines, kind)] } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  } else {
    set({ party: [...get().party], journal: [...get().journal.slice(-40), ...lines] });
    bus.emit(EVT.SCENE_DIRTY);
  }
}

/**
 * « Dormir » — sommeil d'une nuit hors combat (LDB 16 l.91/102, 18 l.380, 21 l.92). Avance l'horloge
 * jusqu'à la prochaine aube (un cycle complet si on y est déjà), laisse `advanceTime` faire les ticks
 * d'États, puis applique `restRecovery` à chaque héros (retrait Exténué + soin de Blessures + cauchemars).
 * Résolution NON interactive (journal, pas de Chance) — cohérent avec l'entretien hors combat existant.
 */
export function restPartyOvernight(get: () => GameState, set: any, days = 1): void {
  if (get().battle) return; // pas de repos en plein combat
  const n = Math.max(1, Math.floor(days));
  const before = get().gameTime;
  const toDawn = minutesUntilNext(before, DAWN_MINUTE);
  const firstNight = toDawn === 0 ? MINUTES_PER_DAY : toDawn; // déjà à l'aube → un cycle entier
  const minutes = firstNight + (n - 1) * MINUTES_PER_DAY; // chaque journée de repos se termine à l'aube
  // Un sommeil N'EST PAS une suite de Rounds de combat : on avance l'horloge SANS rejouer l'entretien
  // périodique (`advanceTime` ferait ~1 Round/min → des centaines de jets de mort par hémorragie/poison/
  // feu, qui TUERAIENT le dormeur avant tout soin). RAW 16-États l.105 : le repos suppose des États
  // stabilisés ; restRecovery refuse d'ailleurs le repos d'un héros encore Hémorragique/En flammes/Empoisonné.
  set({ gameTime: before + minutes });
  bus.emit(EVT.TIME_ADVANCED, { minutes });
  const party = get().party;
  // Soin des maladies (LDB 09-Compétences) : si un soignant apte (Guérison) veille le groupe, la durée
  // des maladies des patients est réduite plus vite (−1 j/jour de soins, min 1). Test de Guérison supposé
  // réussi sur des soins prolongés (abstraction, comme le soin de Blessures hors combat).
  const caredFor = party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
  const lines: string[] = [];
  for (const h of party) lines.push(...restRecovery(h, battleRng(), n, caredFor));
  const title = n > 1 ? `— Le groupe se repose ${n} jours —` : '— Le groupe dort jusqu’à l’aube —';
  set({ party: [...party], journal: [...get().journal.slice(-40), title, ...lines] });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Incante un sort/prière sur une cible (résolution via src/engine/magic). */
/** Ouvre la modale d'incantation (jet différé, façon attaque) : pose `pendingCast` sans lancer. */
export function castSpell(
  get: () => GameState,
  set: any,
  caster: Combatant,
  target: Combatant,
  label: string,
) {
  const spell = findSpell(label);
  if (!spell) {
    get().log(`Sort « ${label} » introuvable.`);
    return;
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: { casterId: caster.id, targetId: target.id, spellLabel: label, missile: isMagicMissile(spell), focused: focusedNI0, result: null },
  });
}

/** Applique un résultat d'incantation DÉJÀ obtenu (mute caster/cible, consomme l'Action). */
export function applyCast(
  get: () => GameState,
  set: any,
  caster: Combatant,
  target: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  res: CastResult & Partial<MissileResult>,
  missile: boolean,
  focusedNI0: boolean,
) {
  const battle = get().battle; // null = incantation HORS COMBAT (couture D) : même applyCast, sortie journal
  const logLines: string[] = [res.log];

  if (missile) {
    if (res.hit && res.woundsLost) {
      const currentBefore = target.wounds.current;
      const overkill = res.woundsLost - currentBefore;
      target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
      if (res.isCritical || overkill > 0) {
        const lethal = applyCriticalToTarget(target, res.location ?? 'corps', !!res.isCritical, Math.max(0, overkill), logLines, set);
        if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore);
      } else if (target.wounds.current <= 0) {
        applyZeroWounds(target);
      }
    }
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    else if (focusedNI0 && !res.cast) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    // Sort offensif : lanceur vers la cible, cible vers le lanceur.
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!), [target.id]: facingToward(target.pos!, caster.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
    if (isOutOfAction(target)) logLines.push(`${target.name} est mis hors de combat !`);
  } else {
    if (res.cast) {
      const heal = parseHeal(spell.desc, caster);
      const buffs = parseCharBuffs(spell.desc);
      const condEff = parseConditionEffect(spell.desc);
      if (heal != null) {
        target.wounds.current = Math.min(target.wounds.max, target.wounds.current + heal);
        logLines.push(`${target.name} regagne ${heal} Blessure(s).`);
      } else if (buffs.length) {
        const rounds = buffDurationRounds(spell.duration, caster);
        // Durée hors-rounds (minutes/heures/jours) : elle dépasse l'échelle tactique
        // → l'effet persiste pour ce combat. On n'invente PAS un nombre de rounds.
        const roundsLeft = rounds ?? COMBAT_PERSIST;
        for (const b of buffs) {
          applyActiveEffect(target, { label: spell.label, char: b.char, bonus: b.bonus, roundsLeft });
        }
        const parts = buffs.map((b) => `${b.bonus >= 0 ? '+' : ''}${b.bonus} ${CHAR_LABELS[b.char]}`).join(', ');
        logLines.push(
          `${target.name} : ${spell.label} (${parts}, ${rounds != null ? rounds + ' rounds' : 'durée hors combat'}).`,
        );
      } else if (condEff) {
        if (condEff.op === 'remove') {
          const name = condEff.name ?? target.conditions[0]?.name;
          if (name) {
            removeCondition(target, name, condEff.value);
            logLines.push(`${target.name} retire ${condEff.value} État ${name}.`);
          } else {
            logLines.push(`${target.name} n'a aucun État à retirer.`);
          }
        } else {
          addCondition(target, condEff.name!, condEff.value);
          logLines.push(`${target.name} reçoit ${condEff.value} État ${condEff.name}.`);
        }
      }
      // Sinon : l'effet du sort est purement narratif (déjà journalisé).
    } else if (res.isFumble) {
      // Prière → Colère des dieux ; Sort → Incantation Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, castInfoIsPrayer(spell.type) ? 'colere' : 'mineure'));
    } else if (focusedNI0) {
      // Sort focalisé dont l'incantation échoue (sans Maladresse) → Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    }
    // Sort de SOUTIEN (bénédiction/soin/buff) ou prière non-projectile : émet aussi l'event
    // d'incantation → geste de canalisation (RigToken) + halo/aura tinté à l'école (IsoStage).
    // Soutien : le lanceur se tourne vers la cible ; pas de réaction de la cible (ce n'est pas une frappe).
    // Hors combat (pas de file/token tactique), on n'anime pas le geste iso.
    if (battle && caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!) } }));
    }
    if (battle) bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  }

  // Le sort focalisé est consommé après le lancement.
  if (focusedNI0) caster.focus = undefined;
  finishPlayerAction(get, set, logLines, 'cast'); // sortie commune combat (log+conso Action) / hors combat (journal)
}

/** Renvoie vrai si le type de sort relève d'une Prière (Béni/Invocation). */
export function castInfoIsPrayer(type: string): boolean {
  return type === 'Béni' || type === 'Invocation';
}

/** Fin de combat : réécrit l'état persistant de chaque héros (Blessures, critiques, mort, États
 *  persistants) vers `party`. Idempotent ; les champs non persistants du membre party sont conservés. */
export function finalizeBattle(get: () => GameState, set: any): void {
  const { battle, party } = get();
  if (!battle) return;
  // « Après un combat où vous avez subi une Blessure critique » (LDB 20 l.72) : Test de Résistance Très
  // Facile (+60) ou Infection Mineure. Auto-résolu (comme le Test de Résistance interne d'un critique) sur
  // les héros survivants ; mute le combattant AVANT le report d'état (carryOverState copie `diseases`).
  const infectLog: string[] = [];
  for (const c of battle.combatants) {
    if (c.kind !== 'hero' || !c.tookCriticalThisFight) continue;
    const dressed = c.woundDressed; // pansement/Guérison pendant le combat → pas d'Infection (LDB 18 l.382)
    c.tookCriticalThisFight = false; // consommé (idempotent même si finalizeBattle est rappelé)
    c.woundDressed = false;
    if (c.dead || dressed) continue;
    const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    infectLog.push(...rollContraction(c, 'Infection Mineure', resVal, 'tresFacile', battleRng()));
  }
  const newParty = party.map((h) => {
    const c = battle.combatants.find((x) => x.id === h.id && x.kind === 'hero');
    return c ? { ...h, ...carryOverState(c) } : h;
  });
  set({ party: newParty, ...(infectLog.length ? { journal: [...get().journal.slice(-40), ...infectLog] } : {}) });
}

export function checkBattleOver(get: () => GameState, set: any): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return true;
  // Combat monté (LDB 14 l.212-225) : une monture mise hors de combat désarçonne son cavalier (strict
  // RAW : à pied, pas de chute). Balayage centralisé ici car checkBattleOver suit chaque résolution de combat.
  const scene = get().scene;
  if (scene) {
    const dismounted = sweepDismountDeaths(battle, scene);
    if (dismounted.length) {
      set({ battle: { ...battle, log: [...battle.log, ...evLines(dismounted, 'detail')] } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  if (!enemiesAlive) {
    finalizeBattle(get, set); // writeback AVANT onVictory (qui ajoute XP/butin au groupe)
    set({ battle: { ...get().battle!, over: 'victory', log: [...battle.log, ev('info', 'Victoire !')] } });
    if (battle.onVictory) applyEffects(get, set, battle.onVictory);
    return true;
  }
  if (!heroesAlive) {
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, ev('info', 'Défaite…')] } });
    return true;
  }
  return false;
}

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
export function resumeEnemyTurn(get: () => GameState, set: any): void {
  const b = get().battle;
  if (!b || b.over || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingReveals.length) return;
  setTimeout(() => advanceTurn(get, set), TEMPO.enemyAdvance);
}

export function advanceTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingReveals.length) return;
  let turn = battle.turn;
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      // Franchissement de Round : upkeep (dégâts périodiques + 0 PB→Inconscient), puis la résolution
      // (morts lentes avec sauvetage par Destin) est déléguée à resolveRoundBoundary — résumable,
      // car elle peut suspendre (pendingFateSave / pendingRoundStart).
      const round = battle.round + 1;
      get().advanceTime(TIME_COST.combatRound); // « tout est horodaté » : 1 Round franchi = +combatRound min
      battle.log.push(ev('round', `— Round ${round} —`));
      // Ordre du Round : on REPART de l'ordre canonique (baseOrder) — donc tout réordonnancement
      // (Maladresse « agir en dernier » Oups! 21-40, pré-emption Chance) ne dure qu'UN Round (l.22-25).
      const base = battle.baseOrder ?? battle.order;
      const lastIds = battle.combatants.filter((c) => c.actLastNextRound).map((c) => c.id);
      battle.order = [...base.filter((id) => !lastIds.includes(id)), ...base.filter((id) => lastIds.includes(id))];
      for (const c of battle.combatants) if (c.actLastNextRound) { c.actLastNextRound = false; battle.log.push(ev('detail', `${c.name} agira en dernier ce Round (Maladresse).`, c.id)); }
      const roundLines: string[] = []; // entretien groupé en UNE révélation (pas une modale par tic)
      for (const c of battle.combatants) endOfRound(c, battleRng()).forEach((l) => { battle.log.push(ev('condition', l, c.id)); roundLines.push(l); });
      for (const c of battle.combatants) refreshWounds(c); // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
      // Surnombre (LDB 14 l.149) : un combattant surpassé en nombre (≥2 ennemis Engagés avec lui) perd 1 Avantage en fin de Round.
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || (c.advantage ?? 0) <= 0) continue;
        const foes = (c.engagedWith ?? []).filter((id) => {
          const e = battle.combatants.find((x) => x.id === id);
          return !!e && e.kind !== c.kind && !isOutOfAction(e);
        }).length;
        if (foes >= 2) { c.advantage = Math.max(0, c.advantage - 1); roundLines.push(`${c.name} est surpassé en nombre (${foes} c.1) : −1 Avantage.`); }
      }
      for (const c of battle.combatants) if (c.frenzied) c.frenzyFreeUsed = false; // Frénésie : nouvelle attaque CC gratuite chaque Round (LDB 21 l.34)
      for (const c of battle.combatants) if (c.ignoreCritMods) c.ignoreCritMods = false; // Détermination : « ignorer modifs de critique » expire au début du prochain Round (LDB 17 l.64)
      for (const c of battle.combatants) if (c.psychImmuneRoundsLeft) c.psychImmuneRoundsLeft -= 1; // Détermination : l'immunité psy décompte 1 Round (LDB 17 l.62)
      brokenRecovery(get, roundLines); // récupération du Brisé en fin de Round (LDB 16 l.57-59)
      for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => { battle.log.push(ev('condition', l, c.id)); roundLines.push(l); }); // 0 PB→Inconscient (LDB 18 l.28)
      for (const c of battle.combatants) if (isOutOfAction(c)) clearPsychOf(battle.combatants, c.id); // effets psy d'une créature morte → fin (catch-all toutes causes de mort)
      if (roundLines.length) pushReveal(set, { kind: 'round', title: `Fin du Round ${round - 1}`, lines: roundLines }); // « un jet = une modale » (entretien)
      set({ battle: { ...battle, turn: 0, round } });
      resolveRoundBoundary(get, set);
      return;
    }
    const next = battle.combatants.find((c) => c.id === battle.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  // Tour suivant dans le MÊME Round. La posture « Sur la défensive » expire (LDB Combat l.118).
  const newActive = battle.combatants.find((c) => c.id === battle.order[turn]);
  let movementUsed = 0;
  let acted = false;
  if (newActive) {
    newActive.defensiveStance = false;
    // Maladresse (Oups! 61-80) : perte du Mouvement / de l'Action ce tour-ci.
    if (newActive.loseNextMovement) { movementUsed = mountMovement(battle, newActive); newActive.loseNextMovement = false; battle.log.push(ev('detail', `${newActive.name} perd son Mouvement (Maladresse).`, newActive.id)); }
    if (newActive.loseNextAction) { acted = true; newActive.loseNextAction = false; battle.log.push(ev('detail', `${newActive.name} perd son Action (Maladresse).`, newActive.id)); }
  }
  set({ battle: { ...battle, turn, action: null, movementUsed, movedPreAction: false, acted, reachable: new Map() } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeOpenHeroPsych(get, set); // Test de Calme du héros actif (Peur/Terreur, LDB 21) avant qu'il agisse
  maybeRunEnemyTurn(get, set);
}

/**
 * Fin de Round, RÉSUMABLE : (1) résout les morts lentes une par une — pour un héros à Destin,
 * suspend (pendingFateSave 'slow') ; (2) finalise les morts restantes ; (3) décrément d'Avantage
 * + Engagement (une seule fois, après toutes les morts) ; (4) pré-emption d'initiative (Chance,
 * 3e usage) sinon sélection de l'acteur + IA. Rappelée par fate* après résolution d'une mort lente.
 */
export function resolveRoundBoundary(get: () => GameState, set: any): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  // (1) Un héros mourant à Destin non résolu → suspend (LDB ch.17 l.31-35).
  const dying = battle.combatants.find((c) => c.kind === 'hero' && (c.fate ?? 0) > 0 && inDeathCondition(c));
  if (dying) {
    set({ pendingFateSave: { heroId: dying.id, source: 'slow' } });
    return;
  }
  // (2) Finaliser les morts lentes restantes (héros sans Destin).
  for (const c of battle.combatants) if (inDeathCondition(c)) c.dead = true;
  // (3) Avantage : -1 si aucun gagné ce Round (LDB Dépl. l.40) ; Engagé périmé (LDB 13-Combat l.175).
  for (const c of battle.combatants) {
    if (!isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
    c.gainedAdvThisRound = false;
  }
  // Nuée (LDB 85 l.200) : tout opposant ENGAGÉ avec une nuée perd 1 PB en fin de Round (submergé).
  const swarms = battle.combatants.filter((s) => s.swarm && !isOutOfAction(s));
  if (swarms.length)
    for (const c of battle.combatants) {
      if (c.swarm || isOutOfAction(c) || !(c.engagedWith ?? []).some((id) => swarms.some((s) => s.id === id))) continue;
      c.wounds.current = Math.max(0, c.wounds.current - 1);
      if (c.wounds.current <= 0) applyZeroWounds(c);
    }
  decayEngagement(battle.combatants);
  // Fumée (Souffle (Fumée)) : un Round de blocage en moins ; les nuages épuisés se dissipent.
  if (battle.smoke?.length) battle.smoke = battle.smoke.map((s) => ({ ...s, rounds: s.rounds - 1 })).filter((s) => s.rounds > 0);
  // (4) Pré-emption d'initiative (Chance, 3e usage, LDB ch.17 l.27) sinon sélection de l'acteur.
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  const heroCanPreempt = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c) && (c.fortune ?? 0) > 0);
  if (enemiesAlive && heroCanPreempt) {
    set({ battle: { ...battle, action: null, movementUsed: 0, movedPreAction: false, acted: false, reachable: new Map() }, pendingRoundStart: { round: battle.round } });
    return;
  }
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
  set({ battle: { ...battle, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false, reachable: new Map() } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeOpenHeroPsych(get, set); // Test de Calme du héros actif (Peur/Terreur, LDB 21) avant qu'il agisse
  maybeRunEnemyTurn(get, set);
}

/** IA simple : si le combattant actif est un ennemi, il agit puis passe la main. */
export function maybeRunEnemyTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingReveals.length) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'enemy' || isOutOfAction(active)) return;
  setTimeout(() => runEnemyAI(get, set, active.id), TEMPO.turnHandoff);
}

/** LDB 21 l.29 : « Si la source de votre Peur se rapproche de vous, vous devez réussir un Test de Calme
 *  Intermédiaire (+0) ou gagner un État Brisé. » Appelé APRÈS le déplacement de `mover` (IA) : tout héros
 *  qui le craint (Peur active non vaincue) ET dont il s'est rapproché fait un Test de Calme ; échec → Brisé.
 *  Jet montré en révélation témoin (comme la Fuite). */
export function approachFearTrigger(get: () => GameState, set: any, mover: Combatant, fromPos: Pt): void {
  const battle = get().battle;
  if (!battle || !mover.pos) return;
  for (const c of battle.combatants) {
    if (c.kind === mover.kind || isOutOfAction(c) || !c.pos) continue;
    const peur = (c.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === mover.id && (p.calmeDR ?? 0) < (p.indice ?? 0));
    if (!peur) continue;
    if (chebyshev(mover.pos, c.pos) >= chebyshev(fromPos, c.pos)) continue; // ne s'est pas rapproché
    const t = rollTest(calmeValue(c), 'intermediaire', battleRng());
    const line = t.success ? `${c.name} garde son sang-froid alors que ${mover.name} s'approche.` : `${c.name} panique alors que ${mover.name} s'approche : 1 État Brisé.`;
    if (!t.success) addCondition(c, 'Brisé', 1);
    battle.log.push(ev('fear', line, c.id, mover.id));
    if (c.kind === 'hero') pushReveal(set, { kind: 'calme', title: 'Approche menaçante', dice: t.roll, lines: [line] });
  }
}

/** Récupération du Brisé en fin de Round (LDB 16 l.57-59) — combattant par combattant :
 *  - pas de Test si Engagé (l.57) ; sinon Test de Calme dont la Difficulté suit les circonstances
 *    (caché hors de vue → Accessible +20 ; ennemi à ≤ 3 cases → Très difficile −30 ; sinon Intermédiaire +0),
 *    retirant 1 + DR États Brisé sur un succès ;
 *  - +1 État Brisé retiré si l'on est resté caché hors de vue de TOUT ennemi ce Round (l.59).
 *  Pousse les jets dans `roundLines` (révélation d'entretien — pas de Chance, comme la Fuite/l'Initiative). */
export function brokenRecovery(get: () => GameState, roundLines: string[]): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return;
  for (const c of battle.combatants) {
    if (!stacks(c, 'Brisé') || isOutOfAction(c) || !c.pos) continue;
    const enemies = battle.combatants.filter((e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos);
    const hidden = !!scene && enemies.length > 0 && enemies.every((e) => lineOfSightCover(scene, e.pos!, c.pos!, [], smokeOf(battle)).blocked);
    if (hidden) { removeCondition(c, 'Brisé', 1); roundLines.push(`${c.name} est resté caché hors de vue : retire 1 État Brisé.`); }
    // Récupération par Test de Calme : seulement si pas Engagé (l.57) et qu'il reste du Brisé.
    if (!isEngaged(c) && stacks(c, 'Brisé')) {
      const nearest = enemies.length ? Math.min(...enemies.map((e) => chebyshev(c.pos!, e.pos!))) : Infinity;
      const diff: import('../engine/types').Difficulty = hidden ? 'accessible' : nearest <= 3 ? 'tresDifficile' : 'intermediaire';
      const t = rollTest(calmeValue(c), diff, battleRng());
      if (t.success) {
        const removed = Math.min(stacks(c, 'Brisé'), 1 + Math.max(0, t.sl));
        removeCondition(c, 'Brisé', removed);
        roundLines.push(`${c.name} se ressaisit : retire ${removed} État(s) Brisé (Test de Calme réussi).`);
      } else {
        roundLines.push(`${c.name} reste Brisé (Test de Calme raté).`);
      }
    }
    // « Une fois que vous n'avez plus d'États Brisé, vous gagnez 1 État Exténué » (LDB 16 l.80).
    if (!stacks(c, 'Brisé')) { addCondition(c, 'Exténué'); roundLines.push(`${c.name} est Exténué (après s'être ressaisi).`); }
  }
}

/** Psychologie d'un ENNEMI (IA) au début de son tour (LDB 21) : teste Peur/Terreur des sources
 *  adverses en Ligne de Vue. Terreur ratée → Brisé ; Peur → Test étendu de Calme (cumul). Instantané
 *  et JOURNALISÉ (pas de modale/révélation pour l'IA — le joueur voit l'État Brisé). */
export function resolvePsychAI(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  if (isPsychImmune(enemy)) return; // Immunité (Psychologie) / Frénésie / Détermination temp
  enemy.psychState ??= [];
  const log: string[] = [];
  // Nouvelles sources de peur/terreur en Ligne de Vue (non encore rencontrées).
  for (const foe of battle.combatants) {
    if (foe.kind === enemy.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (lineOfSightCover(scene, enemy.pos, foe.pos, [], smokeOf(battle)).blocked) continue;
    const src = fearSourceFor(enemy, foe);
    if (!src || enemy.psychState.some((p) => p.sourceId === foe.id)) continue;
    if (src.kind === 'terreur') {
      const r = resolveTerreurTest(calmeValue(enemy), src.indice, battleRng());
      if (!r.success) {
        addCondition(enemy, 'Brisé', r.brise);
        log.push(`${enemy.name} est terrifié par ${foe.name} : ${r.brise} Brisé.`);
      }
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: r.success ? 0 : r.devientPeur, calmeDR: 0, lastTestRound: battle.round }); // Terreur → Peur
    } else {
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: 0, lastTestRound: battle.round });
      log.push(`${enemy.name} a peur de ${foe.name}.`);
    }
  }
  // Test ÉTENDU de Calme des Peur actives (calmeDR < indice) — UNE fois par Round.
  for (const p of enemy.psychState) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 0) || p.lastTestRound === battle.round) continue;
    const r = resolvePeurTest(calmeValue(enemy), p.indice ?? 1, p.calmeDR ?? 0, battleRng());
    p.calmeDR = r.calmeDR;
    p.lastTestRound = battle.round;
    if (r.vaincue) log.push(`${enemy.name} surmonte sa peur.`);
  }
  // ── Traits psy CIBLÉS (Animosité/Haine/… — LDB 21), instantané pour l'IA ──
  const visible = battle.combatants.filter((v) => v.id !== enemy.id && v.pos && !isOutOfAction(v) && !lineOfSightCover(scene, enemy.pos!, v.pos, [], smokeOf(battle)).blocked);
  for (const p of enemy.psychState) {
    // Re-test (fin de Round) des afflictions ciblées actives, tant qu'un membre du groupe est visible.
    if (!p.active || !CIBLE_TYPES.has(p.type) || !p.cible || p.lastTestRound === battle.round) continue;
    if (!visible.some((v) => groupMatch(p.cible!, v.groups ?? []))) continue;
    p.lastTestRound = battle.round;
    if (resolveCalmeSimple(calmeValue(enemy), battleRng()).success) { p.active = false; log.push(`${enemy.name} se ressaisit (${p.type}).`); }
  }
  const tt = targetedTrigger(enemy, visible); // nouveau Trait ciblé déclenché par un membre du groupe visible
  if (tt) {
    const r = resolveCalmeSimple(calmeValue(enemy), battleRng());
    enemy.psychState.push({ type: tt.type, cible: tt.cible, sourceId: tt.sourceId, active: !r.success, lastTestRound: battle.round });
    if (!r.success) log.push(`${enemy.name} est en proie à son ${tt.type} (${tt.cible}).`);
  }
  if (log.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'fear', enemy.id)] } });
}

/** Premier Test de Psychologie DÛ pour un combattant (héros) ce Round : nouvelle source de Peur/Terreur
 *  en Ligne de Vue, ou Peur active non encore testée ce Round. Pur de lecture (ne mute pas). */
export function collectHeroPsych(get: () => GameState, c: Combatant): { kind: PsychType; sourceId: string; indice: number; prevDR: number; cible?: string } | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos || isPsychImmune(c)) return null; // Immunité psy (trait/Frénésie/Détermination temp)
  const state = c.psychState ?? [];
  for (const foe of battle.combatants) {
    if (foe.kind === c.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (lineOfSightCover(scene, c.pos, foe.pos, [], smokeOf(battle)).blocked) continue;
    const src = fearSourceFor(c, foe);
    if (!src || state.some((p) => p.sourceId === foe.id)) continue;
    return { kind: src.kind, sourceId: foe.id, indice: src.indice, prevDR: 0 }; // nouvelle source
  }
  for (const p of state) {
    if (p.type === 'peur' && (p.calmeDR ?? 0) < (p.indice ?? 0) && p.lastTestRound !== battle.round)
      return { kind: 'peur', sourceId: p.sourceId!, indice: p.indice ?? 1, prevDR: p.calmeDR ?? 0 }; // Peur active à re-tester
  }
  // ── Traits psy CIBLÉS (Animosité/Haine/… — LDB 21) : re-test des actifs, puis nouveaux déclenchements ──
  const visible = battle.combatants.filter((v) => v.id !== c.id && v.pos && !isOutOfAction(v) && !lineOfSightCover(scene, c.pos!, v.pos, [], smokeOf(battle)).blocked);
  for (const p of state) {
    if (p.active && CIBLE_TYPES.has(p.type) && p.cible && p.lastTestRound !== battle.round && visible.some((v) => groupMatch(p.cible!, v.groups ?? [])))
      return { kind: p.type, sourceId: p.sourceId ?? '', indice: 0, prevDR: 0, cible: p.cible }; // affliction active à re-tester (fin de Round)
  }
  const tt = targetedTrigger(c, visible);
  if (tt) return { kind: tt.type, sourceId: tt.sourceId, indice: 0, prevDR: 0, cible: tt.cible };
  return null;
}

/** Ouvre la modale de Test de Calme/Psychologie si le combattant ACTIF est un héros qui doit tester
 *  (LDB 21). No-op si une autre modale/révélation est en cours. */
export function maybeOpenHeroPsych(get: () => GameState, set: any): void {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingPsych || get().pendingReveals.length || get().pendingFateSave || get().pendingFumble) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || isOutOfAction(active)) return;
  endFrenzyIfDone(get, set, active); // une Frénésie finie (plus d'ennemi / Sonné) sort le héros (Exténué) avant tout test
  const t = collectHeroPsych(get, active);
  if (t) set({ pendingPsych: { combatantId: active.id, kind: t.kind, sourceId: t.sourceId, indice: t.indice, prevDR: t.prevDR, cible: t.cible, result: null } });
}

/** Fin de Frénésie (LDB 21 l.36) : si plus aucun adversaire vivant en Ligne de Vue, ou si Sonné /
 *  Inconscient → quitte la Frénésie et gagne **Exténué**. À appeler au début du tour du combattant. */
export function endFrenzyIfDone(get: () => GameState, set: any, c: Combatant): void {
  if (!c.frenzied) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos) return;
  const stunned = c.conditions.some((x) => x.name === 'Sonné' || x.name === 'Inconscient');
  const foeInLoS = battle.combatants.some(
    (f) => f.kind !== c.kind && !isOutOfAction(f) && f.pos && !lineOfSightCover(scene, c.pos!, f.pos, [], smokeOf(battle)).blocked,
  );
  if (stunned || !foeInLoS) {
    c.frenzied = false;
    addCondition(c, 'Exténué');
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenzy', `${c.name} sort de Frénésie (Exténué).`, c.id)] } });
  }
}

/** L'IA tente d'entrer en Frénésie au début de son tour (LDB 21 l.32) : combattant capable, pas déjà
 *  frenzied ni immunisé à la Psychologie, avec un adversaire vivant en Ligne de Vue → Test de Force
 *  Mentale ; sur un succès, il entre en Frénésie (gérée ensuite par les drapeaux). Instantané, journalisé. */
export function aiMaybeFrenzy(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || enemy.frenzied || enemy.psychImmune || isOutOfAction(enemy) || !isFrenzyCapable(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  const foeInLoS = battle.combatants.some(
    (f) => f.kind !== enemy.kind && !isOutOfAction(f) && f.pos && !lineOfSightCover(scene, enemy.pos!, f.pos, [], smokeOf(battle)).blocked,
  );
  if (!foeInLoS) return;
  if (resolveFrenzyEntry(effectiveChar(enemy, 'FM'), battleRng()).success) {
    enemy.frenzied = true;
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenzy', `${enemy.name} entre en Frénésie !`, enemy.id)] } });
  }
}

export function runEnemyAI(get: () => GameState, set: any, enemyId: string) {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return;
  const enemy = battle.combatants.find((c) => c.id === enemyId);
  if (!enemy || isOutOfAction(enemy)) return advanceTurn(get, set);
  endFrenzyIfDone(get, set, enemy); // Frénésie finie → Exténué, avant de tester la psychologie
  aiMaybeFrenzy(get, set, enemy); // l'IA tente d'entrer en Frénésie (LDB 21 l.32) AVANT le test psy (la Frénésie en rend immunisé) et le choix de cible
  resolvePsychAI(get, set, enemy); // Peur/Terreur de l'IA au début de son tour (instantané, journalisé)

  const heroes = battle.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
  if (heroes.length === 0) {
    checkBattleOver(get, set);
    return;
  }

  // Combat monté (LDB 14) : un PNJ à pied, non Engagé, adjacent à une monture LIBRE de son camp décide
  // de l'enfourcher (aucun jet → simple Mouvement ; il pourra ensuite ATTAQUER, mais pas se déplacer en plus).
  let justMounted = false;
  if (!enemy.mountId && !isEngaged(enemy) && canTakeAction(enemy)) {
    const freeMount = mountableNear(battle, enemy);
    if (freeMount) {
      mountUp(enemy, freeMount);
      justMounted = true;
      battle.log.push(ev('move', `${enemy.name} enfourche ${freeMount.name}.`, enemy.id));
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  // Combat monté (LDB 14 l.215) : un cavalier ENNEMI se déplace selon la géométrie de sa MONTURE
  // (empreinte + Mouvement) ; le couple est solidaire (positions synchronisées à l'exécution du « move »).
  const geom = mountOf(battle, enemy) ?? enemy;
  const blocked = occupied(battle, geom);
  // Premier Projectile magique connu et prêt : la détection a besoin des données
  // de sort, donc elle reste ici (couche impure), pas dans la décision pure (ai.ts).
  const offensiveSpell = enemy.spells?.find((label) => {
    const sp = findSpell(label);
    return !!sp && isMagicMissile(sp);
  });
  // Charge de cavalerie (LDB 15-Dépl l.74-77 / 14 l.223) : un cavalier ennemi non Engagé fonce à la portée
  // de COURSE (2× le Mouvement de sa monture) — PARITÉ avec le joueur ; à pied, l'IA reste en Marche (M).
  const cavalryCharge = !!enemy.mountId && !isEngaged(enemy);
  const moveBudget = justMounted ? 0 : effectiveMovement(geom) * (cavalryCharge ? 2 : 1);
  const action = chooseEnemyAction({
    enemy,
    heroes,
    scene,
    blocked,
    movement: moveBudget,
    offensiveSpell,
    smoke: smokeOf(battle),
  });
  const targetOf = (id: string) => battle.combatants.find((c) => c.id === id)!;
  const canAct = canTakeAction(enemy); // Sonné : pas d'Action — déplacement seul (LDB États l.123)

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant, delay: number = TEMPO.preAttack) => {
    setTimeout(() => {
      const b = get().battle;
      if (!b || b.over) return;
      // Attaque-ACTION spéciale (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
      // normale si la créature en a le trait + l'Avantage ; sinon attaque normale (opposée).
      const suspended = aiMaybeSpecialAction(get, set, enemy) ? false : doAttack(get, set, enemy, target);
      // Si la modale de défense s'ouvre, ne PAS armer advanceTurn ici : la reprise
      // est portée par defenseConfirm/defenseCancel → resumeEnemyTurn (anti double-advance).
      if (!suspended) {
        aiFrenzyAttack(get, set, enemy); // Frénésie : Test de CC gratuit après l'attaque principale (instantané, LDB 21 l.34)
        // Attaques gratuites de créature (Morsure/Caudale/Piétinement, OPPOSÉES) après l'attaque
        // principale ; si une modale de défense s'ouvre, ne PAS avancer (reprise via defenseConfirm).
        if (!aiCreatureFreeAttacks(get, set, enemy)) setTimeout(() => advanceTurn(get, set), TEMPO.postAttack);
      }
    }, delay);
  };

  // Combat monté (LDB 14 l.221) : une monture MONTÉE est dirigée par son cavalier — elle ne se déplace
  // pas seule (le couple bouge au tour du cavalier). Sans le Trait Nerveux, elle peut consacrer SA propre
  // Action à attaquer un adversaire au contact ; sinon elle passe son tour.
  if (enemy.riderId) {
    const nerveux = (enemy.traits ?? []).some((t) => /nerveux/i.test(t));
    const foe = nerveux || !canAct ? undefined
      : battle.combatants.find((c) => c.kind !== enemy.kind && !isOutOfAction(c) && !!c.pos && combatDistance(enemy, c) <= meleeReachTiles(enemy.weapons));
    if (foe) { attackThenAdvance(foe); return; }
    return advanceTurn(get, set);
  }

  // Sonné : l'ennemi ne peut pas agir → il renonce à son Action (l'éventuel déplacement
  // a déjà été réduit de moitié via effectiveMovement). Le « move » plus bas garde son
  // déplacement mais n'attaque pas en arrivant.
  switch (action.kind) {
    case 'end':
      return advanceTurn(get, set);
    case 'cast':
      if (!canAct) return advanceTurn(get, set);
      castSpell(get, set, enemy, targetOf(action.targetId), action.spell);
      setTimeout(() => advanceTurn(get, set), TEMPO.enemyAdvance);
      return;
    case 'shoot': {
      if (!canAct) return advanceTurn(get, set);
      const tgt = targetOf(action.targetId);
      // Télégraphe de tir : on montre QUI le tireur vise (réticule + cadrage) ~0,7 s AVANT de tirer
      // (retour playtest « jamais su sur qui il tirait »). doAttack journalise « X tire sur Y ».
      set({ enemyAim: { fromId: enemy.id, toId: tgt.id } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => { set({ enemyAim: null }); attackThenAdvance(tgt); }, TEMPO.aimTelegraph);
      return;
    }
    case 'melee':
      if (!canAct) return advanceTurn(get, set);
      attackThenAdvance(targetOf(action.targetId));
      return;
    case 'recover': {
      // Se libérer (Empêtré, Test opposé de Force, l.61) / se rouler (En flammes, Athlétisme, l.77).
      // IA = résolution INSTANTANÉE (pas de modale ni de Chance). Coûte l'Action.
      if (!canAct) return advanceTurn(get, set);
      let success: boolean, netSL: number;
      if (action.state === 'Empêtré') {
        const srcId = enemy.conditions.find((c) => c.name === 'Empêtré')?.sourceId;
        const src = srcId ? battle.combatants.find((c) => c.id === srcId && !isOutOfAction(c)) : undefined;
        if (src) { const opp = opposedTest(testValue(enemy, undefined, 'F'), testValue(src, undefined, 'F'), battleRng()); success = opp.attackerWins; netSL = opp.netSL; }
        else { const t = rollTest(testValue(enemy, undefined, 'F'), 'intermediaire', battleRng()); success = t.success; netSL = Math.max(0, t.sl); }
      } else {
        const t = rollTest(testValue(enemy, 'Athlétisme'), 'intermediaire', battleRng()); success = t.success; netSL = Math.max(0, t.sl);
      }
      const removed = recoveredStacks(netSL, stacks(enemy, action.state), success);
      if (removed > 0) removeCondition(enemy, action.state, removed);
      const line = removed > 0
        ? (action.state === 'Empêtré' ? `${enemy.name} se libère (${removed} État Empêtré retiré).` : `${enemy.name} étouffe les flammes (${removed} État En flammes retiré).`)
        : (action.state === 'Empêtré' ? `${enemy.name} reste Empêtré.` : `${enemy.name} reste En flammes.`);
      set({ battle: { ...battle, log: [...battle.log, ev('condition', line, enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => advanceTurn(get, set), TEMPO.afterMove);
      return;
    }
    case 'move': {
      // Simplifications IA assumées (sévérité mineure, relevées par la revue de fidélité) :
      //  • l'IA ne fait JAMAIS de Désengagement (option joueur, LDB 15-Dépl l.84-89) : un
      //    ennemi Engagé qui se repositionne ne paie pas l'Esquive/le sacrifice d'Avantage.
      //  • l'IA charge dans la portée de MARCHE (chooseEnemyAction borne le déplacement à M),
      //    pas la portée de Course (2M) ouverte au héros — l'IA charge donc moins loin.
      const wasEngaged = isEngaged(enemy);
      const distBefore = combatDistance(enemy, targetOf(action.thenTargetId)); // distance de combat AVANT le déplacement
      const fromPos = { ...enemy.pos! }; // position AVANT déplacement (déclenchement de Peur à l'approche)
      const path = pathTo(scene, enemy.pos!, action.to, blocked, sizeFootprint(geom.size));
      enemy.pos = action.to;
      if (geom !== enemy) geom.pos = { ...action.to }; // Combat monté : la monture suit le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.308-309)
      get().faceFromPath(enemy.id, path);
      if (geom !== enemy) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
      if (geom !== enemy) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      approachFearTrigger(get, set, enemy, fromPos); // LDB 21 l.29 : source de Peur qui s'approche → Test de Calme ou Brisé
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
      const tgt = targetOf(action.thenTargetId);
      if (canAct && combatDistance(enemy, tgt) <= meleeReachTiles(enemy.weapons)) {
        // Charge de l'IA : se ruer au contact depuis une position non-Engagée donne l'Avantage (LDB 15-Dépl l.74-77).
        if (!wasEngaged) {
          const adv = chargeAdvantage(effectiveMovement(geom), distBefore);
          if (adv) {
            enemy.advantage += adv;
            enemy.gainedAdvThisRound = true;
            enemy.chargedThisTurn = true; // Charge → Attaque gratuite de Cornes (LDB 85), résolue par aiCreatureFreeAttacks
          }
        }
        attackThenAdvance(tgt, Math.max(TEMPO.preAttack, walkMs(path ?? []) + TEMPO.afterMove));
      } else setTimeout(() => advanceTurn(get, set), walkMs(path ?? []) + TEMPO.afterMove);
      return;
    }
  }
}

