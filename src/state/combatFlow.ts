/**
 * Flux de combat (tour par tour) extrait de store.ts pour le garder navigable.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 * Refacto pure -- comportement preserve.
 */
import type { GameState, BattleState, RevealEntry } from './store';
import { Combatant, ItemInstance, HitLocation, Weapon, DIFFICULTY_MODIFIERS, HIT_LOCATION_LABELS } from '../engine/types';
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
  attackModifiers,
  combineMods,
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
  resolveMeleePassive,
  finishMelee,
  rollMeleeDefender,
  AttackResult,
  ModLine,
  outnumberMod,
  crowdMod,
  defenseModifiers,
  DEFENSE_LABEL,
} from '../engine/combat';
import { engage, isEngaged, decayEngagement, chargeAdvantage, disengageFrom, clearEngagementOf, reachTiles, meleeReachTiles } from '../engine/engagement';
import { gainAdvantage } from '../engine/advantage';
import { sizeGap } from '../engine/size';
import { footprintTiles, combatDistance, sizeFootprint, occupiesTile } from './footprint';
import { isUnbreakable, resolveQualities, hasQuality, dangerousNine, entanglesOnHit, magazineSize, hasBladeTrap, canPushback, strikesLast, isFirearmQuality } from '../engine/qualities/dispatch';
import { hasStealAdvantage, shieldAdvantageLevel, hasRiposte, talentCritExtraWounds, hasSurpriseSave, talentMagicResistance, hasBraveheart, outnumberCountBonus, hasStunSave, reloadDRBonus, talentFearIndice, fleeMovementBonus, hasFocusHarmony } from '../engine/combatFeatures/dispatch';
import { canStrikeFirst } from '../engine/qualities/dispatch';
import {
  wardSaves, hasChampionDefense, webForce, hasCorrosiveBlood, banishedAtZero, gorgesOnKill,
  isStupid, hasRage, regenerates, isUnstable, isBestial, isTerritorial, hasPerturbingAura,
  traitSeesInDark, isColdBlooded, bellicosePsychImmune, magicResistanceOf, isNervous, immunityTypes, hasStealthAgBonus, flyMeters, runMultiplier,
} from '../engine/traits/dispatch';
import {
  isMagicMissile,
  prayerWrathTriggered,
  castBlockedBy,
  hasTalent,
  evaluateMissile,
  spellRangeTiles,
  durationClockMinutes,
  castInfo,
  castingValue,
  castPenaltyMod,
  castTestTalentDR,
  knowsCastingSkill,
  isDispellableSpell,
  resolveCounterspell,
  rederiveCastSL,
  parseSpellDamage,
  zdeDiameterMeters,
  type CastResult,
  type MissileResult,
} from '../engine/magic';
import { applyOps, resolveFormula, COMBAT_PERSIST } from '../engine/ops';
import { spellSpecFor } from '../data/spellspecs';
import { gainCorruption, corruptionTarget } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import { eligibleTalent, canCastFromGrimoire } from '../engine/grimoire';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { opposedTest, rollTest, evaluateTest, resolveOpposed, isDoubleRoll } from '../engine/tests';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { partyBest, isSocialTest, socialPsychMod, socialPsychLabel, testValue } from '../engine/skills';
import { recomputeLoadout, itemFromTrapping, customTrapping, weaponWithAmmo, compatibleAmmo, damageArmour } from '../engine/items';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, hasCondition, cannotDefend, canTakeAction, applyZeroWounds, loseWounds, tickDeath, usesSuddenDeath, inDeathCondition, stacks, recoveredStacks } from '../engine/conditions';
import { creatureAttacks, venomDifficulty, ATTACK_LABEL, type CreatureAttack } from '../engine/creatureAttacks';
import { hasActiveFlag } from '../engine/activeFlags';
import { suffocationTick } from '../engine/suffocation';
import { domainOf, domainOnHitRiders, domainMissileMods, ghurFearAfterCast, hasArcaneTalent } from '../engine/domainAttributes';
import { losBlockingTiles, decayZones, zonesRoundTick, crossZones, discTiles, wallTiles, metersToTiles, resolveZoneMeters, type BattleZone } from './zones';
import { carryOverState } from '../engine/persistence';
import { rollContraction, contractDisease, hasActiveSymptom, contagiousDiseases, DISEASE_DEFS } from '../engine/disease';
import { hasHealSkill, type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { openRest, placesOfKind } from './restFlow';
import { rollCritical, critLocationRoll, permanentAmputations, type CriticalResolved } from '../engine/critical';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { traumaFromKind, escalateSensoryLoss, consolidateAmputations } from '../engine/trauma';
import { effectiveWeaponDamage, damageWeapon, destroyWeapon, isImprovised, solideSaveThreshold, enchantOnHitConditions } from '../engine/weaponDamage';
import { TIME_COST } from '../engine/timeCost';
import { DAY_PHASES, minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { restRecovery } from '../engine/rest';
import { feedFromMeal } from '../engine/provisions';
import { runDailyUpkeep } from './upkeep';
import { findSpell } from '../data/index';
import { toBrass, fromBrass } from '../engine/money';
import { Scene, Effect, isWalkable, condMet } from './scene';
import { sweepDismountDeaths, mountedAttackMods, mountedDodgePenalty, mountMovement, mountOf, mountUp, mountableNear, movementRemaining, canMove } from './mount';
import { lineOfSightCover, coverModifier, smokeZone, tilesBetween } from './lineOfSight';
import { fearSourceFor, resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, isPsychImmune, clearPsychOf, resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple, CIBLE_TYPES, PsychType } from '../engine/psychology';
import { groupMatch } from '../engine/groups';
import { sceneCombatModifiers } from './sceneRules';
import { reachable, moveReachFor, flyReachable, pushAway, pathTo, chebyshev, Pt } from './path';
import { chooseEnemyAction, type EnemyAction, type EnemyTurnInput } from './ai';
import { resolveRun } from '../engine/movement';
import type { RNG } from '../engine/dice';
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

/** Perturbante (LDB 62 l.275-276) : repousse `target` d'au plus `tiles` cases dans la direction
 *  opposée à l'attaquant (cases praticables et libres seulement). Renvoie les cases reculées. */
export function pushBackTiles(get: () => GameState, attacker: Combatant, target: Combatant, tiles: number): number {
  const { scene, battle } = get();
  if (!scene || !battle || !attacker.pos || !target.pos || tiles <= 0) return 0;
  let pos = target.pos;
  const dx = Math.sign(pos.x - attacker.pos.x);
  const dy = Math.sign(pos.y - attacker.pos.y);
  if (!dx && !dy) return 0;
  const blocked = occupied(battle, target);
  let moved = 0;
  for (let i = 0; i < tiles; i++) {
    const next = { x: pos.x + dx, y: pos.y + dy };
    const foot = footprintTiles(next, target.size);
    if (!foot.every((t) => isWalkable(scene, t.x, t.y) && !blocked.has(`${t.x},${t.y}`))) break;
    pos = next;
    moved++;
  }
  target.pos = pos;
  if (moved) bus.emit(EVT.ANIM_MOVE, { id: target.id, path: [{ ...target.pos }] });
  return moved;
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
      case 'interlude':
        // « Entre deux aventures » (LDB 22-23) — via l'action store (pas d'import direct : cycle).
        get().startInterlude(e.weeks ?? 1);
        break;
      case 'openWorldMap':
        // « Partir en voyage » depuis une porte/route de la scène (#T2) — l'action est déjà gardée
        // (no-op sans carte ou en combat).
        get().openWorldMap();
        break;
      case 'rest':
        // Repos déclenché par l'éditeur (trigger/dialogue) : ouvre la MODALE DE NUIT (couchage +
        // pitance par héros, prix RAW, bilan globalisé). LEGACY sans `lodging` : contexte maison.
        openRest(get, set, { places: placesOfKind(e.lodging ?? 'maison'), quality: e.quality, days: e.days ?? 1 });
        break;
      case 'mealParty': {
        // Repas (#T2) : tout le groupe est nourri pour la journée sans consommer de ration —
        // compteurs/malus de Faim remis à zéro (LDB 18 l.417-422 ; prix éventuel porté par le choix).
        const diners = get().party;
        for (const h of diners) if (!h.dead) feedFromMeal(h);
        set({ party: [...diners] });
        get().log('Le groupe prend un vrai repas — chacun mange à sa faim.');
        break;
      }
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
      case 'giveSin': {
        // Points de Péché (LDB 40 l.36) : sanction d'auteur, 1 à 3 selon la gravité.
        // Cible : héros désigné, sinon le premier sachant Prier (le Péché vise un Bienheureux).
        const amount = Math.max(1, e.amount ?? 1);
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          let idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : -1;
          if (idx < 0) idx = s.party.findIndex((h) => h.skills.some((sk) => sk.name === 'Prière' && sk.advances >= 1));
          if (idx < 0) idx = 0;
          who = s.party[idx].name;
          return { party: s.party.map((h, i) => (i === idx ? { ...h, sinPoints: (h.sinPoints ?? 0) + amount } : h)) };
        });
        if (who) get().log(`${who} a péché contre son dieu : +${amount} Point(s) de Péché.`);
        break;
      }
      case 'corruptionExposure': {
        // Influence corruptrice (LDB 19 l.23-75) : ouvre le Test différé par modale
        // (Lancer → Chance → Appliquer) ; le gain dépendra du niveau et du DR.
        const hero = corruptionTarget(get(), e.heroId);
        if (hero) set({ pendingCorruption: { heroId: hero.id, level: e.level, skill: e.skill } });
        break;
      }
      case 'giveCorruption': {
        // Gain direct (artefact maudit, Pacte scénarisé…) — applique aussi seuil → mutation.
        const hero = corruptionTarget(get(), e.heroId);
        if (hero) {
          const lines = gainCorruption(get, set, hero, Math.max(1, e.amount ?? 1));
          for (const l of lines) get().log(l);
          set({ party: [...get().party] });
        }
        break;
      }
      case 'learnSpell': {
        // Trouvaille de campagne : le sort est appris SANS PX (l'auteur l'octroie — le coût
        // en PX ne vaut que pour la mémorisation volontaire, LDB 46 l.44-47).
        const sp = findSpell(e.spell);
        if (!sp) break;
        let who = '';
        set((s: GameState) => {
          let idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : -1;
          if (idx < 0) idx = s.party.findIndex((h) => !!eligibleTalent(h, sp) && !(h.spells ?? []).includes(sp.label));
          if (idx < 0) return {};
          who = s.party[idx].name;
          return { party: s.party.map((h, i) => (i === idx && !(h.spells ?? []).includes(sp.label) ? { ...h, spells: [...(h.spells ?? []), sp.label] } : h)) };
        });
        if (who) get().log(`${who} apprend ${sp.label}.`);
        break;
      }
      case 'inflictTrauma': {
        // Blessure Critique posée rétroactivement par l'éditeur (LDB 18) : déchirure/fracture via la
        // factory partagée (traumaFromKind, effets en-combat + convalescence), amputation via les
        // séquelles permanentes (permanentAmputations). criticalWounds suit (compteur LDB 18).
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          return {
            party: s.party.map((h, i) => {
              if (i !== target) return h;
              who = h.name;
              const be = Math.floor(effectiveChar(h, 'E') / 10);
              // Amputation : permanentAmputations lit la PARTIE dans le texte → on synthétise un libellé
              // par localisation (bras → main/bras ; jambe → membre inférieur ; tête → œil, choix d'éditeur).
              const ampNote = e.location === 'tete' ? 'Perte de l’œil — Amputation (Intermédiaire)' : 'Main/bras inutilisable — Amputation (Intermédiaire)';
              const traumas = e.kind === 'amputation'
                ? permanentAmputations('Amputation', ampNote, e.location, battleRng())
                : [traumaFromKind(e.kind, e.severity ?? 'mineur', e.location, { be, d10: d10(battleRng()) })];
              return { ...h, traumas: [...(h.traumas ?? []), ...traumas], criticalWounds: (h.criticalWounds ?? 0) + 1 };
            }),
          };
        });
        if (who) get().log(`${who} subit une Blessure Critique (${e.kind}, ${e.location}).`);
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
        if (who) get().log(`${who} a contracté : ${e.disease} (symptômes au repos).`);
        break;
      }
      case 'giveTrapping': {
        // Trapping RÉEL (base) sinon objet CUSTOM (misc) — « donner un objet = un trapping custom ou réel ».
        const it = itemFromTrapping(e.trapping) ?? customTrapping(e.trapping);
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
        openMedicalAidEffect(get, set, e); // soins payants d'un PNJ : ouvre son infirmerie (actes tarifés)
        break;
      case 'endDialogue':
        if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
        set({ dialogue: null });
        break;
    }
  }
}

/**
 * Soins PAYANTS d'un PNJ (Effet `medicalAid`, LDB 75) : ouvre l'INFIRMERIE (state/medicFlow) avec
 * la compétence du PNJ et ses actes tarifés — le débit a lieu à l'acte, dans la modale. Le joueur
 * choisit les patients ; le PNJ effectue les jets (la Chance interroge `actorIn(healerId)` →
 * introuvable pour un PNJ → boutons inertes). LEGACY : `act` simple ≡ `acts: [{ act }]`, le prix
 * restant porté par le choix de dialogue.
 */
function openMedicalAidEffect(get: () => GameState, set: any, e: { acts?: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[]; act?: 'wounds' | 'bleed' | 'surgery'; skill: number; intBonus: number; entityId?: string }): void {
  const acts = e.acts ?? (e.act ? [{ act: e.act }] : []);
  if (!acts.length) return;
  const npc = e.entityId ? get().scene?.entities.find((x) => x.id === e.entityId) : undefined;
  openMedic(get, set, {
    npc: {
      id: npc?.id ?? e.entityId ?? 'pnj-soigneur',
      name: npc?.label ?? 'Soigneur',
      skill: e.skill,
      intBonus: e.intBonus,
      acts,
    },
  });
}

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive
 *  (Agilité + avances, pénalité d'Encombrement incluse) — la plus haute valeur. */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  // Bestial (LDB 85 p.338) : « En défense, elle peut seulement utiliser la Compétence Esquive. »
  if (isBestial(defender.traits)) return 'esquive';
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

/** Sonné : tout adversaire qui frappe la cible en CORPS À CORPS gagne +1 Avantage
 *  AVANT son attaque (LDB États l.123) — ce +1 profite donc déjà au jet en cours puis
 *  persiste. À appeler une seule fois par attaque (avant le 1er jet ; pas sur une relance). */
export function applySonneMeleeAdvantage(attacker: Combatant, target: Combatant): void {
  if (attacker.weapons[0]?.type === 'melee' && target.conditions.some((c) => c.name === 'Sonné')) {
    gainAdvantage(attacker);
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
export function firedWeapon(attacker: Combatant, target: Combatant, weaponUid?: string): Weapon {
  const adj = combatDistance(attacker, target) <= meleeReachTiles(attacker.weapons); // Allonge incluse (RAW-3)
  // Choix explicite du joueur : l'arme du loadout actif portant cet uid (si présente) ; sinon auto-choix.
  const chosen = weaponUid ? attacker.weapons.find((w) => w.uid === weaponUid) : undefined;
  const w = chosen ?? attackWeapon(attacker.weapons, adj);
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

/** Cases bloquant la Ligne de Vue (zones opaques : Fumée du Souffle…) — L11 : lues de `battle.zones`. */
export const smokeOf = (battle: BattleState): Pt[] => losBlockingTiles(battle.zones);

/** Bénédiction de Protection (LDB 41 — L13) : si la cible est bénie, l'attaquant doit réussir un
 *  Test de FM Accessible (+20) pour OSER attaquer — joué à la DÉCLARATION ; sur un échec, « ils
 *  doivent choisir une cible ou une Action différente » (rien n'est consommé). */
export function attackWardGate(attacker: Combatant, target: Combatant, rng: RNG = battleRng()): { allowed: boolean; lines: string[] } {
  if (!hasActiveFlag(target, 'attackWardFM')) return { allowed: true, lines: [] };
  const t = rollTest(effectiveChar(attacker, 'FM'), 'accessible', rng);
  if (t.success) {
    return { allowed: true, lines: [`${attacker.name} surmonte sa honte (FM 🎲 ${t.roll}/${t.target}) et attaque ${target.name} malgré la Bénédiction de Protection.`] };
  }
  return {
    allowed: false,
    lines: [
      `${attacker.name} — Test de Force Mentale Accessible (+20) : 🎲 ${t.roll}/${t.target} → échec.`,
      `${attacker.name} ne peut se résoudre à frapper ${target.name} (Bénédiction de Protection) — il doit choisir une autre cible ou une autre Action.`,
    ],
  };
}

/** Martyr (LDB 42 — L13) : le prêtre (vivant, présent) qui encaisse à la place de `target`, ou null. */
export function martyrGuardOf(battle: BattleState, target: Combatant): Combatant | null {
  const id = (target.activeEffects ?? []).find((e) => e.martyrGuard)?.martyrGuard;
  if (!id || id === target.id) return null;
  const priest = battle.combatants.find((c) => c.id === id);
  return priest && !isOutOfAction(priest) && !priest.dead ? priest : null;
}

/** Aura portée (L11 — Bouclier anti-flèches / Dôme) : vrai si la CIBLE est dans le rayon d'un
 *  porteur vivant de l'aura `field` ET l'attaquant HORS de ce rayon (« provenant de l'extérieur » /
 *  « s'ils entrent dans la Zone d'Effet »). */
export function wardedAgainst(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  field: 'arrowWard' | 'domeWard',
): boolean {
  return combatants.some((w) => !isOutOfAction(w) && w.pos && (w.activeEffects ?? []).some((e) => {
    const ward = e[field];
    if (!ward) return false;
    const r = Math.max(1, Math.ceil(ward.radiusMeters / 2));
    return combatDistance(w, target) <= r && combatDistance(w, attacker) > r;
  }));
}

/** Projectile « constitué de matière organique » (Bouclier anti-flèches, LDB 47 : « comme des
 *  flèches en bois ») : flèches (arcs), carreaux (arbalètes), javelots. Balles de poudre,
 *  pierres de fronde et couteaux de lancer ne le sont pas (« matière non organique »). */
export function organicProjectile(w: Weapon): boolean {
  return /\barc\b|arbal|javelot|fl[èe]che|carreau/i.test(`${w.name} ${w.subType ?? ''}`);
}

/** Traversée de zones persistantes (Mur de feu, LDB 47 — L11) au terme d'un déplacement :
 *  applique l'`onCross` des zones croisées par `path` et journalise. (La Téléportation ne
 *  « traverse » pas — apparition — et n'appelle pas ce helper.) */
export function applyZoneCrossings(get: () => GameState, mover: Combatant, path: Pt[]): void {
  const battle = get().battle;
  if (!battle?.zones?.length || !path.length) return;
  const lines = crossZones(battle.zones, mover, path, (id) => (id ? battle.combatants.find((c) => c.id === id) : undefined), battleRng());
  for (const l of lines) battle.log.push(ev('condition', l, mover.id));
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
}

/** Surprise au début du combat (LDB 13 l.52-81) : le camp pris en EMBUSCADE (`surprisedSide`) fait, pour
 *  chaque combattant, un Test opposé de Perception vs la Discrétion la plus FAIBLE des embusqueurs (l.77) ;
 *  les vaincus gagnent l'État `Surpris`. Mute les combatants, retourne le journal. */
export function applySurprise(combatants: Combatant[], surprisedSide: 'party' | 'enemies'): string[] {
  const surprisedKind = surprisedSide === 'party' ? 'hero' : 'enemy';
  const surprised = combatants.filter((c) => (surprisedKind === 'hero' ? c.kind === 'hero' : c.kind !== 'hero') && !isOutOfAction(c));
  const ambushers = combatants.filter((c) => (surprisedKind === 'hero' ? c.kind !== 'hero' : c.kind === 'hero') && !isOutOfAction(c));
  if (!surprised.length || !ambushers.length) return [];
  // L'embusqueur de référence = la Discrétion la plus FAIBLE du groupe (l.77). Furtif (LDB 85
  // p.339) : « Ajoutez son bonus d'Agilité au DR de tous ses Tests de Discrétion ».
  const sneak = ambushers.reduce((a, b) => (testValue(b, 'Discrétion') < testValue(a, 'Discrétion') ? b : a));
  const sneakVal = testValue(sneak, 'Discrétion');
  const sneakDR = hasStealthAgBonus(sneak.traits) ? bonus(effectiveChar(sneak, 'Ag')) : 0;
  const lines: string[] = [];
  for (const c of surprised) {
    // Embusqueur (Discrétion) vs guetteur (Perception) : si l'embusqueur l'emporte → le guetteur est Surpris.
    const aT = rollTest(sneakVal, 'intermediaire', battleRng());
    const dT = rollTest(testValue(c, 'Perception'), 'intermediaire', battleRng());
    if (resolveOpposed({ ...aT, sl: aT.sl + sneakDR }, dT).winner === 'attacker') {
      // Vigilance (LDB 10) : Test de Perception Intermédiaire (+0) pour ignorer la Surprise.
      if (hasSurpriseSave(c) && rollTest(testValue(c, 'Perception'), 'intermediaire', battleRng()).success) {
        lines.push(`${c.name} flaire l'embuscade (Vigilance) : pas de Surprise.`);
        continue;
      }
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

/** Environnement d'attaque (LdV/couvert/météo/mouvement/tir-mêlée/surnombre/monture) — SOURCE UNIQUE
 *  des modificateurs positionnels/scéniques, partagée par la RÉSOLUTION (`resolveAttack`) ET l'APERÇU
 *  (`previewAttack`), pour que l'aperçu affiche EXACTEMENT ce que le jet appliquera (R4). Pur (lit l'état).
 *  `blocked` = tir sans Ligne de Vue ; `inMelee`/`crowd`/`cm`/`sc` servent à la résolution (tir dévié,
 *  « Tirer dans le tas », dodge météo) — l'aperçu n'utilise que `env`/`blocked`. */
/** Voit dans l'obscurité : Trait Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne (LDB 10). */
function seesInDark(c: Combatant): boolean {
  return traitSeesInDark(c.traits) || (c.talents ?? []).some((t) => /^vision nocturne/i.test(t.name));
}

export interface AttackEnv { env: ModLine[]; blocked: boolean; inMelee: boolean; crowd: Combatant[]; cm: ModLine | null; sc: ReturnType<typeof sceneCombatModifiers>; }
export function attackEnv(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  opts?: { intoCrowd?: boolean; heldGround?: boolean },
): AttackEnv {
  const scene = get().scene!;
  const battle = get().battle!;
  const sc = sceneCombatModifiers(scene, get().gameTime);
  const env: ModLine[] = [];
  if (weapon.type === 'ranged') {
    const occupants = battle.combatants
      .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
      .map((c) => c.pos!);
    const los = lineOfSightCover(scene, attacker.pos!, target.pos!, occupants, smokeOf(battle));
    if (los.blocked) return { env, blocked: true, inMelee: false, crowd: [], cm: null, sc }; // pas de LdV (LDB 13 l.123)
    if (los.cover !== 'none') env.push({ label: `Couvert (${los.cover})`, value: coverModifier(los.cover) });
    // Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne : annule la pénalité d'obscurité.
    if (sc.concealed && !seesInDark(attacker)) env.push({ label: sc.label || 'Obscurité', value: -20 }); // cible dissimulée (LDB 14 l.107)
    else if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod }); // tempête/neige (l.108-116)
    // Tir en bougeant (LDB 14 l.101) : −10 si l'on bouge ET tire au même Round. Le Mouvement étant
    // DÉCOMPOSABLE (on peut bouger APRÈS le tir), un HÉROS qui garde sa mobilité encaisse le −10 par défaut ;
    // il ne l'évite qu'en décidant de tirer IMMOBILE (heldGround → consomme son Mouvement, cf. attackConfirm)
    // — ou s'il NE PEUT PAS bouger (Mouvement effectif 0 : Empêtré/Surpris…), il est immobile d'office.
    // L'IA/ennemi (pas d'option) : −10 seulement s'il a effectivement bougé ce Tour.
    const mobileShot = attacker.kind === 'hero'
      ? (battle.movementUsed > 0 || (mountMovement(battle, attacker) > 0 && !opts?.heldGround))
      : battle.movementUsed > 0;
    if (mobileShot) env.push({ label: 'Tir en bougeant', value: -10 });
    // Tir dans la mêlée (LDB 14 l.134) : la cible est Engagée avec un allié du tireur.
    const inMelee = (target.engagedWith ?? []).some((id) => {
      const ally = battle.combatants.find((c) => c.id === id);
      return !!ally && ally.kind === attacker.kind;
    });
    if (inMelee && !opts?.intoCrowd) env.push({ label: 'Tir dans la mêlée', value: -20 }); // « Tirer dans le tas » REMPLACE ce −20 par le bonus (l.136)
    env.push(...mountedAttackMods(battle, attacker, target, 'ranged')); // Combat monté : +20 cible plus petite que la monture (LDB 14 l.217)
    // « Tirer dans le tas » (LDB 14 l.136/146) : bonus +20/+40/+60 selon la taille du groupe serré.
    const crowd = opts?.intoCrowd ? crowdEligible(battle, attacker, target) : [];
    const cm = opts?.intoCrowd ? crowdMod(crowd.length) : null;
    if (cm) env.push(cm);
    return { env, blocked: false, inMelee, crowd, cm, sc };
  }
  // Mêlée : la météo (tempête/neige) pénalise l'attaque ; la neige pénalise aussi l'esquive (dodgeMod).
  if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod });
  // Flanc/dos (LDB 14 l.91) : +20 pour attaquer un adversaire ENGAGÉ dans le dos ou sur les côtés —
  // orientation du défenseur AVANT cette attaque (il se retourne vers l'attaquant ENSUITE, applyAttackResult).
  const tFacing = get().facing?.[target.id]; // `facing` peut être absent (état épars / contexte sans orientation)
  if (tFacing && isEngaged(target) && attacker.pos && target.pos && isFlankOrRear(tFacing, facingToward(target.pos, attacker.pos)))
    env.push({ label: 'Flanc/dos', value: 20 });
  // Surnombre (LDB 14 l.85/92) : attaquants du camp de l'attaquant au contact de la cible (2 → +20, 3+ → +40).
  const onm = outnumberMod(battle.combatants.filter((c) => c.kind === attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1).length);
  if (onm) env.push(onm);
  env.push(...mountedAttackMods(battle, attacker, target, 'melee')); // Combat monté : +20 cible < monture / −10 viser le cavalier (LDB 14 l.217/219)
  return { env, blocked: false, inMelee: false, crowd: [], cm: null, sc };
}

export function resolveAttack(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  fromCharge?: boolean,
  intoCrowd?: boolean,
  heldGround?: boolean,
  weaponUid?: string,
): { res: AttackResult; weapon: Weapon; victim?: Combatant } | null {
  const dist = combatDistance(attacker, target);
  const weapon = firedWeapon(attacker, target, weaponUid); // arme choisie (ou auto) + munition combinées (héros distance)
  if (dist > reachTiles(weapon) && weapon.type === 'melee') return null; // hors de portée de mêlée (Allonge incluse, RAW-3)
  // (Sonné → +1 Avantage à l'attaquant en mêlée, LDB 16 l.123 : DÉJÀ géré par le flux d'attaque existant.)
  const battle = get().battle!;
  const { env, blocked, inMelee, crowd, cm, sc } = attackEnv(get, attacker, target, weapon, { intoCrowd, heldGround });
  if (blocked) return null; // pas de Ligne de Vue (mur/décor/fumée) → pas de tir (LDB 13-Combat l.123)
  if (weapon.type === 'ranged') {
    // « Tirer dans le tas » (LDB 14 l.136/146) : un ennemi AU HASARD est touché ; succès dû au seul bonus = 0 DR.
    if (intoCrowd) {
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
  // Charge montée (LDB 14 l.223) : pour les DÉGÂTS, on substitue la Force (Bonus) et la Taille de la monture.
  // Combat monté (l.225) : un défenseur à cheval subit −20 à l'Esquive (sauf Acrobaties équestres) → dodgeMod.
  const chargeMount = fromCharge ? mountOf(battle, attacker) : undefined;
  const dmgProxy = chargeMount ? { sb: bonus(effectiveChar(chargeMount, 'F')), size: chargeMount.size } : undefined;
  return { res: resolveMelee(attacker, target, weapon, battleRng(), { defense: bestDefenseMode(target), location, env, dodgeMod: sc.dodgeMod + mountedDodgePenalty(target), dmgProxy }), weapon };
}

/** 2ᵉ attaque du Maniement de deux armes (LDB 10 l.638). Jet d'attaquant IMPOSÉ : `reverseRoll(mainRoll)`,
 *  ou `critValue` (valeur du tableau des Critiques) si la 1ʳᵉ frappe était un Critique. Le `target` (valeur à
 *  toucher) inclut déjà la pénalité de main secondaire (l'arme `off` porte `hand:'off'`, cf. plan #1). Le
 *  défenseur fait un NOUVEAU jet de défense (l.638 « opposée à un nouveau lancer de défense »). */
export function resolveDualSecond(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  offWeapon: Weapon,
  mainRoll: number,
  opts?: { critValue?: number; location?: HitLocation },
): AttackResult {
  const { env } = attackEnv(get, attacker, target, offWeapon, {});
  const mods = attackModifiers(attacker, target, offWeapon, { kind: 'melee', location: opts?.location, env });
  const toHit = combatValue(attacker, 'melee', offWeapon) + combineMods(mods);
  const atkRoll = opts?.critValue != null ? opts.critValue : reverseRoll(mainRoll);
  const atk = evaluateTest(atkRoll, toHit); // { roll, target, success, sl, isDouble }
  const mode = cannotDefend(target) ? 'none' : bestDefenseMode(target);
  if (mode === 'none') return resolveMeleePassive(attacker, target, offWeapon, atk, opts?.location, env);
  const def = rollMeleeDefender(target, mode, battleRng(), 0, target.weapons[0], offWeapon); // NOUVEAU jet de défense (LDB 10 l.638)
  return finishMelee(attacker, target, offWeapon, atk, def, mode, opts?.location, env);
}

/** Cibles VALIDES de la 2ᵉ frappe du Maniement de deux armes (LDB 10 l.638 : « un adversaire disponible de
 *  votre choix ») : adversaires encore actifs, à portée de l'arme secondaire (Allonge). Sans position connue
 *  (tests purs) → non filtré sur la distance. */
export function dualStrikeTargets(battle: BattleState, attacker: Combatant, offWeapon: Weapon): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c)) return false;
    if (!attacker.pos || !c.pos) return true;
    return combatDistance(attacker, c) <= reachTiles(offWeapon);
  });
}

/** Aperçu d'attaque (R4) : la valeur de toucher (cible du d100) et sa décomposition de modificateurs, SANS
 *  tirer le dé. Rejoue le MÊME `attackEnv` + `attackModifiers` que la résolution → l'aperçu ne ment jamais.
 *  `inRange` = cible atteignable (mêlée : Allonge ; tir : dans une bande de portée) ; `blocked` = tir sans LdV. */
export interface AttackPreview {
  weapon: Weapon; kind: 'melee' | 'ranged'; inRange: boolean; blocked: boolean; target: number; mods: ModLine[];
  /** Valeur de compétence NUE (combatValue) — décomposition `target = base + Σmods` pour l'affichage. */
  base: number;
  /** Dégâts d'arme (Force incluse) AVANT le DR du jet. La Blessure réelle = `dmg` + DR − `soak` (plancher 1). */
  dmg: number;
  /** Encaissé par la cible à la localisation visée (Bonus d'Endurance + PA, réduction d'armure des Atouts déduite). */
  soak: number;
}
export function previewAttack(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  opts?: { intoCrowd?: boolean; heldGround?: boolean; weaponUid?: string },
): AttackPreview {
  const dist = combatDistance(attacker, target);
  const weapon = firedWeapon(attacker, target, opts?.weaponUid);
  const kind: 'melee' | 'ranged' = weapon.type === 'ranged' ? 'ranged' : 'melee';
  // Estimation de dégâts (R4) : dégâts d'arme (Force incluse) et encaissé de la cible. Le `soak` est dérivé
  // de `woundsFromHit` (oracle) avec un dégât large → capture exactement PA + réduction d'armure (Perforante…).
  const dmg = effectiveWeaponDamage(weapon, bonus(effectiveChar(attacker, 'F')));
  const base = combatValue(attacker, kind, weapon);
  const loc = location ?? 'corps';
  const soak = (dmg + 20) - woundsFromHit(weapon, target, loc, dmg + 20);
  if (kind === 'melee' && dist > reachTiles(weapon)) return { weapon, kind, inRange: false, blocked: false, target: 0, base, mods: [], dmg, soak };
  const { env, blocked } = attackEnv(get, attacker, target, weapon, opts);
  if (blocked) return { weapon, kind, inRange: true, blocked: true, target: 0, base, mods: [], dmg, soak };
  const distanceTiles = kind === 'ranged' ? dist : undefined;
  const mods = attackModifiers(attacker, target, weapon, { kind, location, distanceTiles, env });
  const target0 = base + combineMods(mods);
  const inRange = kind === 'ranged' ? rangeBandModifier(dist, weapon.range ?? 0) != null : dist <= reachTiles(weapon);
  return { weapon, kind, inRange, blocked: false, target: target0, base, mods, dmg, soak };
}

/** Ligne ADVERSE du panneau de jet pré-rempli (modale d'attaque) : ce que le joueur est en droit
 *  de savoir de la défense à venir — la compétence probable (« défendra : Parade ») et ses
 *  bonus/malus visibles (Avantage, États, Sur la défensive…), SANS la valeur de compétence ni
 *  l'encaissé. Compétence = meilleure défense (`bestDefenseMode`) ; Bestial → Esquive seule. */
export function previewDefense(defender: Combatant): { label: string; mods: ModLine[] } {
  const mode = bestDefenseMode(defender);
  return { label: `défendra : ${DEFENSE_LABEL[mode]}`, mods: defenseModifiers(defender, mode, 0, defender.weapons[0]) };
}

/** Pré-jet d'INCANTATION pour le panneau de jet (même rôle que previewAttack/previewDefense) : valeur
 *  du Test = compétence nue + Avantage (LDB 46 l.176) / Contrecoup actif en chips = cible. La CastModal
 *  ne fait que poser cette ligne `pending` dans le RollPanel partagé (pas de calcul inline). */
export function previewCast(
  caster: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  opts?: { missile?: boolean; focused?: boolean },
): { label: string; base: number; target: number; mods: ModLine[] } {
  const ci = castInfo(spell);
  const target = castingValue(caster, ci.skill, ci.spec);
  const advMod = 10 * (caster.advantage ?? 0); // l'Avantage s'applique aux Tests d'Incantation
  const penMod = castPenaltyMod(caster, ci.skill); // contrecoups actifs (Imparfaite/Colère)
  const isPrayer = spell.cn == null;
  const ni = opts?.focused ? 0 : spell.cn ?? 0;
  const mods: ModLine[] = [
    ...(advMod ? [{ label: 'Avantage', value: advMod }] : []),
    ...(penMod ? [{ label: 'Contrecoup', value: penMod }] : []),
  ];
  return {
    label: opts?.missile ? 'Projectile' : isPrayer ? 'Prière' : `Incantation / NI ${ni}`,
    base: target - advMod - penMod,
    target,
    mods,
  };
}

/** Delta de RESSOURCES de l'aperçu de clic (tap 1, `battle.preview`) — pour le retour « clignotant »
 *  de l'ActiveFrame : ce qu'une opération en attente va COÛTER (Action / Mouvement en cases) et
 *  RAPPORTER (Avantage) AVANT le commit du 2ᵉ clic. Tout à 0 si aucun aperçu en cours. */
export function previewResourceDelta(battle: BattleState | null): { action: number; move: number; adv: number } {
  const p = battle?.preview;
  if (!p) return { action: 0, move: 0, adv: 0 };
  // AUCUNE valeur de coût/gain n'est codée ici (anti-duplication — Action comme Mouvement comme Avantage) :
  //  - Mouvement : lu sur `p.cost`, le MÊME coût que le commit consomme (`movementUsed += cost`).
  //  - Avantage  : lu sur `p.adv`, SOURCE UNIQUE `chargeAdvantage()` partagée par preview / commit / IA.
  //  - Action    : DÉRIVÉE de la structure — une opération qui VISE un ennemi (`targetId`) est une
  //                attaque → consomme l'unique Action (binaire `battle.acted`) ; Marche/Course non.
  // Le Mouvement d'une Charge (portée de Course) est montré par le tracé sur la carte, pas la jauge.
  const action = 'targetId' in p ? 1 : 0;
  const move = p.kind === 'move' || p.kind === 'run' || p.kind === 'moveAttack' ? p.cost : 0;
  const adv = p.kind === 'charge' ? p.adv : 0;
  return { action, move, adv };
}

/** Cibles VALIDES de l'attaque du héros actif (R4) : ennemis en vie atteignables (mêlée à l'Allonge / tir
 *  dans une bande de portée AVEC Ligne de Vue) — MÊMES prédicats que la résolution (via `previewAttack`),
 *  pour surligner les cibles cliquables et griser les inéligibles. Pur. Vide hors tour de héros. */
export function eligibleAttackTargetIds(get: () => GameState): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === 'hero' || isOutOfAction(c) || !c.pos) continue;
    const p = previewAttack(get, active, c);
    if (p.inRange && !p.blocked) ids.add(c.id);
  }
  return ids;
}

/** Ennemis SANS Ligne de Vue depuis le héros actif (LDB 13 l.123 — le tir est impossible) :
 *  l'UI les GRISE pour distinguer « hors LdV » de « hors de portée » (pas d'anneau dans les
 *  deux cas). Même vérité que l'attaque réelle (`previewAttack.blocked`, arme à distance
 *  seulement — la mêlée n'est jamais bloquée par la LdV). */
export function outOfSightTargetIds(get: () => GameState): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === 'hero' || isOutOfAction(c) || !c.pos) continue;
    if (previewAttack(get, active, c).blocked) ids.add(c.id);
  }
  return ids;
}

/** Ligne de Vue d'un SORT (LDB 46 l.170 : « sauf indication contraire, vous devez toujours être
 *  capable de voir – par exemple, avoir en Ligne de vue – votre cible ») : BINAIRE — un Sort n'est
 *  pas un tir, aucune règle ne lui applique de malus de couvert → seul `.blocked` compte.
 *  Occupants ignorés (une créature ne bloque pas la vue, elle ne donne que du couvert — hors sorts). */
export function castSightBlocked(get: () => GameState, from: Pt, to: Pt): boolean {
  const { scene, battle } = get();
  if (!scene) return false;
  return lineOfSightCover(scene, from, to, [], battle ? smokeOf(battle) : []).blocked;
}

/** Aperçu de DÉPLACEMENT vers `pt` (Marche ou Course) au SURVOL — composé des MÊMES sources que
 *  le clic-sol (`displayedReach`/`computeRunReach`/`pathTo`, géométrie de la monture incluse) :
 *  l'aperçu ne ment pas. Les gates de COMMIT (Peur à l'approche, Frénésie) restent au clic,
 *  comme pour le tap-1 tactile. null = case non atteignable / pas en mode neutre. */
export function movePreviewAt(get: () => GameState, pt: Pt): { kind: 'move' | 'run'; path: Pt[]; cost: number } | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || battle.over || battle.action !== null) return null;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return null;
  if (isEngaged(active) || !canMove(battle, active)) return null; // Engagé : le clic route vers le Désengagement
  const k = `${pt.x},${pt.y}`;
  const reach = displayedReach(get);
  const inWalk = reach.has(k);
  const runReach = inWalk ? null : computeRunReach(get);
  if (!inWalk && !runReach?.has(k)) return null;
  const geom = mountOf(battle, active) ?? active;
  const path = pathTo(scene, active.pos, pt, occupied(battle, geom), sizeFootprint(geom.size)) ?? [];
  if (path.length < 2) return null;
  return { kind: inWalk ? 'move' : 'run', path, cost: (inWalk ? reach.get(k) : runReach!.get(k)) ?? 0 };
}

/** Ennemis SANS Ligne de Vue depuis le héros actif pour un SORT (LDB 46 l.170) — même grisage
 *  que le tir, mais indépendant de l'arme portée (mode incantation). */
export function castOutOfSightTargetIds(get: () => GameState): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === 'hero' || isOutOfAction(c) || !c.pos) continue;
    if (castSightBlocked(get, active.pos, c.pos)) ids.add(c.id);
  }
  return ids;
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
    set({ battle: { ...battle, action: null, reachable: moveReachFor(mover, get().scene!, mover.pos!, effectiveMovement(mover), blocked) } });
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

/** Cases de Mouvement LIBRE cliquables MAINTENANT (héros actif, mode neutre) : Marche restante
 *  (mouvement décomposable), géométrie de la monture, règle M-A-M, filtre Brisé. Vide si Engagé
 *  (le déplacement passe par le Désengagement — LDB 15 l.84). Reprend la logique de l'ex-mode
 *  « Déplacer » (battleSelectAction) ; source unique pour l'affichage ET la validation des clics. */
export function computeMoveReach(get: () => GameState): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return new Map();
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return new Map();
  if (isEngaged(active) || !canMove(battle, active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  const reach = moveReachFor(geom, scene, active.pos, movementRemaining(battle, active), blocked, sizeFootprint(geom.size));
  return briseFleeFilter(battle, active, reach);
}

/** Brisé (LDB 16 l.55) : fuir seulement — retire toute case qui RAPPROCHE d'un ennemi. */
function briseFleeFilter(battle: BattleState, active: Combatant, reach: Map<string, number>): Map<string, number> {
  if (!hasCondition(active, 'Brisé')) return reach;
  const foes = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return reach;
  const distNow = Math.min(...foes.map((e) => chebyshev(active.pos!, e.pos!)));
  return new Map([...reach].filter(([k]) => {
    const [x, y] = k.split(',').map(Number);
    return Math.min(...foes.map((e) => chebyshev({ x, y }, e.pos!))) >= distNow;
  }));
}

/** Zone NOMINALE de Course (LDB 15 l.79-82) : Marche + Course (3M cases, avant DR) — affichée dans une
 *  autre couleur ; un clic dedans demande le Test d'Athlétisme (+20), le déplacement réel dépendant du
 *  jet. Mêmes conditions que la Course : plein Mouvement, Action libre, non Engagé, pas À Terre. */
export function computeRunReach(get: () => GameState): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over || battle.acted || battle.movementUsed > 0) return new Map();
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return new Map();
  if (isEngaged(active) || hasCondition(active, 'À Terre') || !canTakeAction(active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  const M = mountMovement(battle, active);
  if (M <= 0) return new Map();
  const reach = moveReachFor(geom, scene, active.pos, M * 3, blocked, sizeFootprint(geom.size));
  return briseFleeFilter(battle, active, reach);
}

/** Cases cliquables affichées/validées : budget SPÉCIAL stocké (Course, post-Désengagement)
 *  prioritaire, sinon Marche restante dérivée. */
export function displayedReach(get: () => GameState): Map<string, number> {
  const battle = get().battle;
  if (!battle) return new Map();
  return battle.reachable.size > 0 ? battle.reachable : computeMoveReach(get);
}

/**
 * PARITÉ héros/IA sur l'approche (LDB 15 l.74-82) : si le plan de MARCHE n'amène pas l'ennemi au
 * contact, un combattant de mêlée non Engagé tente une CHARGE à portée de Course (2M × Bond/Foulée) ;
 * si même la Course ne suffit pas, il COURT (Action + Test d'Athlétisme — Chevaucher à cheval —,
 * résolution instantanée IA) : budget = Marche + Course + DR, et il n'attaque PAS ce tour.
 * Pure (rng injecté) — renvoie le plan retenu et le jet de Course éventuel.
 */
export function aiApproachPlan(
  input: EnemyTurnInput,
  geom: Combatant,
  action: EnemyAction,
  rng: RNG,
): { plan: EnemyAction; ran: { roll: number; budget: number } | null } {
  const enemy = input.enemy;
  const none = { plan: action, ran: null };
  if (action.kind !== 'move') return none;
  if (isEngaged(enemy) || hasCondition(enemy, 'À Terre') || !canTakeAction(enemy)) return none;
  if (!enemy.weapons.some((w) => w.type === 'melee')) return none;
  const M = effectiveMovement(geom);
  if (M <= 0) return none;
  const atContact = (a: EnemyAction): boolean =>
    a.kind === 'move' && combatDistance({ ...enemy, pos: a.to } as Combatant, input.heroes.find((h) => h.id === a.thenTargetId) ?? input.heroes[0]) <= meleeReachTiles(enemy.weapons);
  if (atContact(action)) return none; // la Marche suffit déjà
  // Charge (portée de Course, sans Test — LDB 15 l.74-77).
  const courseBudget = Math.floor(M * 2 * runMultiplier(geom.traits));
  if (courseBudget <= input.movement) return none;
  const charge = chooseEnemyAction({ ...input, movement: courseBudget });
  if (charge.kind === 'move' && atContact(charge)) return { plan: charge, ran: null };
  // Course (LDB 15 l.79-82) : Test d'Athlétisme/Chevaucher, budget = Marche + Course + DR ; pas d'attaque.
  const r = resolveRun(testValue(enemy, enemy.mountId ? 'Chevaucher' : 'Athlétisme'), M, rng);
  const runBudget = M + r.bonusCases;
  const run = runBudget > input.movement ? chooseEnemyAction({ ...input, movement: runBudget }) : action;
  if (run.kind === 'move' && (run.to.x !== action.to.x || run.to.y !== action.to.y))
    return { plan: run, ran: { roll: r.roll, budget: runBudget } };
  // La Course ne porte pas plus loin que le plan de Marche : marcher normalement (pas d'Action gâchée).
  return none;
}

/** Cible IMPOSÉE d'un combattant en Frénésie (LDB 21 l.34) : l'ennemi le plus proche dans sa Ligne
 *  de Vue (à distance égale, le plus blessé — même critère que l'IA). Null si pas frénétique ou
 *  aucun ennemi visible (alors pas de contrainte). */
export function frenzyTarget(get: () => GameState, c: Combatant): Combatant | null {
  const { battle, scene } = get();
  if (!battle || !scene || !c.frenzied || !c.pos) return null;
  const visible = battle.combatants.filter(
    (e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos && !lineOfSightCover(scene, c.pos!, e.pos!, [], smokeOf(battle)).blocked,
  );
  if (!visible.length) return null;
  return visible.sort((a, b) => {
    const da = combatDistance(c, a), db = combatDistance(c, b);
    if (da !== db) return da - db;
    return a.wounds.current - b.wounds.current;
  })[0];
}

/** Source de PEUR active dont `dest` RAPPROCHE l'acteur (LDB 21 l.29) — null si aucune, ou si
 *  immunisé à la Psychologie. « Sous l'emprise » ⟺ Test étendu de Calme pas encore au niveau
 *  de l'Indice (calmeDR < indice). Pure. */
export function fearedSourceTowards(battle: BattleState, active: Combatant, dest: Pt): Combatant | null {
  if (!active.pos || isPsychImmune(active)) return null;
  for (const p of active.psychState ?? []) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 1)) continue;
    const src = battle.combatants.find((c) => c.id === p.sourceId);
    if (src?.pos && !isOutOfAction(src) && chebyshev(dest, src.pos) < chebyshev(active.pos, src.pos)) return src;
  }
  return null;
}

export type AttackPlan =
  | { kind: 'attack' }
  | { kind: 'charge'; dest: Pt; path: Pt[]; adv: 0 | 1 }
  | { kind: 'moveAttack'; dest: Pt; path: Pt[]; cost: number }
  | { kind: 'blocked'; reason: string };

/** Ce qu'un clic sur CET ennemi ferait : attaque directe (Allonge / tir), Charge implicite
 *  (non Engagé + Mouvement intact + mêlée, portée de Course — LDB 15 l.74-77), ou
 *  rejoindre-et-attaquer dans la Marche restante (pas une Charge → pas de bonus). Pure-store. */
export function attackPlan(get: () => GameState, active: Combatant, target: Combatant): AttackPlan {
  const battle = get().battle!;
  const scene = get().scene!;
  if (combatDistance(active, target) <= meleeReachTiles(active.weapons)) return { kind: 'attack' };
  // L'arme du SET ACTIF décide : une arme à distance présente → tir. Gate PRÉ-clic (parité sort) :
  // sans Ligne de Vue (LDB 13 l.123) ou au-delà de la bande Extrême (Portée ×3), refuser AVANT la
  // modale — sinon « Lancer » fabrique un raté garanti qui consomme l'Action. Les gates de la
  // résolution restent (défense en profondeur) ; rechargement/munitions restent gérés au commit.
  if (attackWeapon(active.weapons, false).type === 'ranged') {
    const p = previewAttack(get, active, target);
    if (p.blocked) return { kind: 'blocked', reason: 'Pas de ligne de vue (cible masquée).' };
    if (!p.inRange) return { kind: 'blocked', reason: 'Cible hors de portée.' };
    return { kind: 'attack' };
  }
  // Mêlée hors d'Allonge :
  if (isEngaged(active)) return { kind: 'blocked', reason: 'Engagé : se désengager avant de rejoindre une autre cible.' };
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  if (battle.movementUsed === 0 && !hasCondition(active, 'À Terre')) {
    // Charge (LDB 15 l.74-77) : manœuvre PLEINE, portée de Course (2M × Bond/Foulée), arrivée
    // adjacente la moins chère.
    const M = mountMovement(battle, active);
    const reach = moveReachFor(geom, scene, active.pos!, Math.floor(M * 2 * runMultiplier(geom.traits)), blocked, sizeFootprint(geom.size));
    const dest = bestAdjacentReachable(reach, target.pos!);
    if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de Charge.' };
    return { kind: 'charge', dest, path: pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size)) ?? [], adv: chargeAdvantage(M, chebyshev(active.pos!, target.pos!)) };
  }
  // Mouvement entamé (ou À Terre) : rejoindre dans la Marche restante.
  const reach = displayedReach(get);
  const dest = bestAdjacentReachable(reach, target.pos!);
  if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de mêlée.' };
  return { kind: 'moveAttack', dest, path: pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size)) ?? [], cost: reach.get(`${dest.x},${dest.y}`)! };
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
  chosenCritLocation?: HitLocation, // RAW-2 : localisation CHOISIE (« Je ne faillirai pas ! », LDB 17 l.73)
  ctx?: { attackerId?: string; attackerKind?: Combatant['kind']; weapon?: string; critTwice?: boolean }, // qui inflige le coup + l'arme (→ modale enrichie) ; critTwice = B. de Sauvagerie de l'attaquant
  prerolled?: CriticalResolved, // Critique déjà tiré (déviation : on a montré CE Critique → on l'applique tel quel, sans re-tirer)
  suppressReveal?: boolean, // la modale de déviation a DÉJÀ affiché le Critique → ne pas re-pousser une révélation
): boolean {
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.51-54) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.name === 'Inconscient')) addCondition(target, 'Inconscient');
    log.push(`${target.name} s'effondre, hors de combat.`);
    return false;
  }
  // Coup Critique : localisation fraîche (1d100) SAUF si le joueur l'a choisie via « Je ne faillirai pas ! »
  // (RAW-2, LDB 17 l.73). Hors Coup Critique (overkill), on garde la localisation de la touche.
  const loc = prerolled ? prerolled.location : isCoupCritique ? (chosenCritLocation ?? critLocationRoll(battleRng(), target.bodyShape)) : location;
  const crit = prerolled ?? rollCritical(target, loc, battleRng(), overkill, ctx?.critTwice);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  target.tookCriticalThisFight = true; // fin de combat : Résistance Très Facile (+60) ou Infection Mineure (LDB 20 l.72)
  log.push(crit.log);
  const revealLines = [crit.log];
  // Effets DÉTAILLÉS pour la modale enrichie : chaque trauma (Amputation, Fracture…) AVEC son explication
  // RAW (note) — « à quoi ça correspond » (#critique). Localisation FR, et pas de « (Jambe droite) (jambeD) ».
  const details: { text: string; note?: string }[] = [];
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) {
      const locLbl = HIT_LOCATION_LABELS[t.location];
      const text = t.label.includes(locLbl) ? t.label : `${t.label} (${locLbl})`;
      log.push(`  ↳ ${text}.`);
      revealLines.push(`  ↳ ${text}.`);
      details.push({ text, note: t.note });
    }
    // Cumuls par comptage (LDB 18) : doigts (−5/doigt, 4+ → main) et dents (−1 Soc/paire) fusionnés ;
    // 2e œil/oreille → Cécité / Surdité agrégée (l.360/363).
    consolidateAmputations(target);
    for (const l of escalateSensoryLoss(target)) {
      log.push(`  ↳ ${l}`);
      revealLines.push(`  ↳ ${l}`);
      details.push({ text: l });
    }
  }
  if (!crit.lethal) {
    target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss); // ignore BE+PA, plancher 0
    for (const c of crit.conditions) addCondition(target, c.name, c.value);
    if (crit.note) {
      log.push(`  ↳ ${crit.note}`); // effet long terme journalisé, non simulé
      revealLines.push(`  ↳ ${crit.note}`);
      details.push({ text: crit.note });
    }
  }
  // « Un jet = une modale » : modale de Coup Critique COMPLÈTE (qui inflige + arme + dé + localisation +
  // Blessures + États + effets expliqués), au niveau de la modale d'attaque. (Sautée si la modale de
  // déviation l'a déjà affichée — la déviation fusionne choix ET révélation sur une seule modale.)
  // SEULEMENT si un héros est concerné — il le SUBIT ou l'INFLIGE (arbitrage 2026-06-11, spec coop
  // §4bis) ; un critique purement ennemi↔ennemi reste au journal/bandeau (les lignes sont déjà dans `log`).
  const heroConcerned = target.kind === 'hero' || ctx?.attackerKind === 'hero';
  if (!suppressReveal && heroConcerned) {
    pushReveal(set, {
      kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: revealLines, subjectId: target.id,
      severity: 'grave',
      actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
      crit: { location: HIT_LOCATION_LABELS[crit.location], woundsLost: crit.woundsLoss, conditions: crit.conditions.length ? crit.conditions : undefined },
    });
  }
  return crit.lethal; // « Mort » instantané → finalisé par le caller (sauvetage par Destin possible)
}

/** Construit la révélation d'affichage d'un Coup Critique PRÉ-TIRÉ, SANS muter la cible (pour la modale
 *  de déviation : on montre le Critique qui menace avant le choix Dévier/Subir). Détails de base (sans la
 *  consolidation des amputations multiples, calculée seulement à l'application). */
export function previewCritEntry(target: Combatant, crit: CriticalResolved, ctx?: { attackerId?: string; weapon?: string }): RevealEntry {
  const lines = [crit.log];
  const details: { text: string; note?: string }[] = [];
  for (const t of crit.traumas) {
    const locLbl = HIT_LOCATION_LABELS[t.location];
    const text = t.label.includes(locLbl) ? t.label : `${t.label} (${locLbl})`;
    lines.push(`  ↳ ${text}.`);
    details.push({ text, note: t.note });
  }
  if (!crit.lethal && crit.note) {
    lines.push(`  ↳ ${crit.note}`);
    details.push({ text: crit.note });
  }
  return {
    kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines, subjectId: target.id,
    actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
    crit: { location: HIT_LOCATION_LABELS[crit.location], woundsLost: crit.woundsLoss, conditions: crit.conditions.length ? crit.conditions : undefined },
  };
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

/** « Arme possédant une lame » (Piège-lame, LDB 62 l.292) — la source ne liste pas les armes :
 *  approximation par mots-clés du nom (épées/dagues/haches/armes d'hast à fer tranchant). */
export function weaponHasBlade(w: Weapon | undefined): boolean {
  if (!w || w.type !== 'melee') return false;
  return /épée|epee|dague|lame|rapière|rapiere|cimeterre|couteau|sabre|fauchon|hache|hallebarde|glaive|estoc|faux|coutille|vouge/i.test(w.name);
}

/** Blessure critique « sèche » d'un Test opposé (LDB 14 l.7) : un double réussi inflige une Blessure
 *  critique à l'adversaire indépendamment du vainqueur de l'échange. Localisation dérivée du jet
 *  critique inversé (comme une touche). Un ENNEMI avec de la PA à la zone dévie toujours (−1 PA,
 *  Critique ignoré — parité avec la Déviation auto de l'IA, LDB 63 l.63-66) ; un HÉROS victime le
 *  subit directement (pas de modale de déviation sur ce chemin secondaire — limitation documentée). */
function applyOpposedCritical(
  get: () => GameState,
  set: any,
  victim: Combatant,
  roll: number,
  ctx: { attackerId?: string; weapon?: string },
  log: string[],
): void {
  const loc = hitLocationByShape(reverseRoll(roll), victim.bodyShape);
  if (victim.kind === 'enemy' && (victim.armour[loc] ?? 0) > 0) {
    damageArmour(victim, loc);
    log.push(`${victim.name} dévie le Critique sur son armure (−1 PA, Critique ignoré).`);
    return;
  }
  const currentBefore = victim.wounds.current;
  // B. de Sauvagerie (LDB 41) : l'attaquant à l'origine du double tire deux lancers de Critique.
  const attacker = ctx.attackerId ? get().battle?.combatants.find((c) => c.id === ctx.attackerId) : undefined;
  const lethal = applyCriticalToTarget(victim, loc, true, 0, log, set, undefined,
    { ...ctx, attackerKind: attacker?.kind, critTwice: attacker ? hasActiveFlag(attacker, 'critRollTwice') : undefined });
  if (lethal) finalizeHeroDeath(get, set, victim, 'hit', currentBefore);
}

export function applyAttackResult(
  get: () => GameState,
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
  deviated?: boolean,
  prerolledCrit?: CriticalResolved, // « Subir » après déviation : applique CE Critique (déjà montré) sans re-tirer
  deferAttackerAdvantage?: boolean, // Maniement de deux armes (LDB 10 l.638) : l'Avantage de l'attaquant est accordé à part (si les deux touchent)
): boolean {
  // Surpris (LDB 16 l.136) : « après la première tentative effectuée pour vous toucher, vous perdez
  // l'État Surpris ». On le retire après une attaque STANDARD (deviated===undefined) — le +20 / l'absence
  // de défense ont déjà joué pour CELLE-CI ; les suivantes n'en bénéficieront plus. Les attaques GRATUITES
  // groupées d'une créature (Morsure+Piétinement, deviated===false) forment UN assaut-surprise : on garde
  // l'État jusqu'à la fin du Round (sinon la 2ᵉ attaque gratuite rouvrirait une défense en plein milieu).
  if (deviated === undefined && hasCondition(target, 'Surpris')) removeCondition(target, 'Surpris', 1);
  // Démoniaque (Indice+) / Protection (Indice) — LDB 85 p.339/341 : « Lancez 1d10 après chaque coup
  // reçu ; si la créature obtient le nombre de l'Indice ou plus, le coup est ignoré, même critique. »
  // (Les héros n'ont pas ces traits → pas de double-jet sur les reprises de déviation.)
  if (res.hit && res.woundsLost) {
    for (const thr of wardSaves(target.traits)) {
      const d = d10(battleRng());
      if (d >= thr) {
        res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `${target.name} ignore le coup — sauvegarde ${d} ≥ ${thr} (Démoniaque/Protection).` };
        break;
      }
    }
  }
  // Bouclier anti-flèches (LDB 47 — L11) : projectile ORGANIQUE entrant dans la zone → détruit,
  // « n'infligeant aucun Dégât à leur cible ». Le tir et la munition sont consommés normalement.
  if (res.hit && weapon.type === 'ranged' && organicProjectile(weapon)
    && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'arrowWard')) {
    res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `Le projectile se désagrège en entrant dans la zone — ${target.name} est indemne (Bouclier anti-flèches).` };
  }
  // Dôme (LDB 47 — L11) : Protection (6+) contre une attaque À DISTANCE venant de l'extérieur.
  else if (res.hit && res.woundsLost && weapon.type === 'ranged'
    && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'domeWard')) {
    const d = d10(battleRng());
    if (d >= 6) res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `${target.name} est couvert par le Dôme — sauvegarde ${d} ≥ 6, le tir est dévié.` };
  }
  // Martyr (LDB 42 — L13) : « Vous recevez tous les Dégâts subis en principe par vos cibles » —
  // le prêtre encaisse les Dégâts BRUTS de la frappe, mitigés par 2×SON BE + ses PA à la
  // localisation touchée ; la cible ne perd rien (les États de la touche restent sur elle).
  if (res.hit && res.woundsLost) {
    const priest = martyrGuardOf(get().battle!, target);
    if (priest) {
      const loc = res.location ?? 'corps';
      const raw = res.damage ?? res.woundsLost;
      const taken = Math.max(0, raw - 2 * bonus(effectiveChar(priest, 'E')) - Math.max(0, priest.armour[loc] ?? 0));
      if (taken > 0) {
        loseWounds(priest, taken);
        if (priest.wounds.current <= 0) applyZeroWounds(priest);
      }
      res = { ...res, woundsLost: 0, log: `${res.log} Martyr : ${priest.name} reçoit les Dégâts à la place de ${target.name}${taken > 0 ? ` (${taken} PB, BE doublé)` : ' (encaissés sans dommage, BE doublé)'}.` };
    }
  }
  // Perturbante (LDB 62 l.275-276) : mode « Repousser » armé → l'attaque réussie ne cause PAS de
  // Dégâts, l'adversaire recule d'1 m par DR du Test opposé (1 case = 2 m, LDB Déplacement l.55).
  if (attacker.pushbackMode && weapon.type === 'melee' && canPushback(weapon)) {
    attacker.pushbackMode = false; // consommé par cette attaque (réussie ou non)
    if (res.hit) {
      const meters = Math.max(0, res.netSL);
      const wanted = Math.floor(meters / 2);
      const moved = pushBackTiles(get, attacker, target, wanted);
      res = {
        ...res, woundsLost: 0, damage: 0, critical: false,
        log: `${attacker.name} repousse ${target.name} de ${meters} m (Perturbante${moved < wanted ? ' — recul bloqué' : ''}).`,
      };
    }
  }
  // Déviation Critique (LDB 63 l.63-66) : un HÉROS subit un Coup Critique à une localisation où il
  // porte de la PA → on SUSPEND pour son choix Dévier/Subir (modale). AUCUN effet de bord ici ; la
  // résolution (deviationApply) rappelle cette fonction avec `deviated` défini (early-return sauté →
  // application UNE seule fois). Les sous-attaques (balayage/Piétinement) passent `deviated` explicite
  // pour résoudre instantanément (pas de modale imbriquée). Les sorts (applyCast) gèrent leurs Critiques
  // à part : ils n'atteignent jamais cette fonction, donc pas de garde « arme » nécessaire.
  const dloc = res.location ?? 'corps';
  if (deviated === undefined && res.hit && res.woundsLost && res.critical && target.kind === 'hero') {
    // Pré-tire le Coup Critique (graine figée) pour l'AFFICHER sur la modale de déviation — choix éclairé
    // Dévier/Subir, une seule modale. Aucune mutation de la cible ici ; « Subir » l'appliquera tel quel.
    const overkill = Math.max(0, res.woundsLost - target.wounds.current);
    const cloc = res.critLocation ?? critLocationRoll(battleRng(), target.bodyShape);
    const crit = rollCritical(target, cloc, battleRng(), overkill, hasActiveFlag(attacker, 'critRollTwice'));
    const reveal = previewCritEntry(target, crit, { attackerId: attacker.id, weapon: weapon?.name });
    set({ pendingDeviation: { attackerId: attacker.id, targetId: target.id, weapon, res, crit, reveal, resumeAfter: true } });
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
      // « Subir » après déviation proposée : applique LE Critique déjà montré (prerolledCrit), sans re-tirer
      // ni re-révéler (la modale de déviation l'a affiché). Sinon : tirage + révélation normaux.
      const lethal = applyCriticalToTarget(target, loc, !!res.critical, Math.max(0, overkill), critLog, set, res.critLocation, { attackerId: attacker.id, attackerKind: attacker.kind, weapon: weapon?.name, critTwice: hasActiveFlag(attacker, 'critRollTwice') }, prerolledCrit, !!prerolledCrit);
      // Frappe blessante (LDB 10) : +niveau Blessures quand on inflige une Blessure Critique.
      const fb = talentCritExtraWounds(attacker);
      if (fb > 0 && !lethal) {
        target.wounds.current = Math.max(0, target.wounds.current - fb);
        critLog.push(`Frappe blessante : ${target.name} perd ${fb} Blessure(s) de plus.`);
      }
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
  // Critiques du Test opposé (LDB 14 l.7) : « Si vous obtenez un Critique, votre adversaire reçoit
  // immédiatement une Blessure critique […] le DR est calculé comme d'habitude, tout comme la
  // détermination du vainqueur. » Un double RÉUSSI inflige donc un Critique même sans gagner l'échange.
  // (Pas de garde `deviated` : une 1ʳᵉ entrée qui SUSPEND (déviation) fait son early-return AVANT ce
  // bloc — la reprise « Dévier »/« Subir » l'exécute donc UNE seule fois, comme les sous-attaques.)
  if (weapon.type === 'melee' && res.defenderDetail) {
    const ad = res.attackerDetail;
    const dd = res.defenderDetail;
    // (a) Attaquant : Critique au jet mais échange PERDU (pas de touche) → le défenseur subit un Critique sec.
    if (ad && ad.success && isDoubleRoll(ad.roll) && !res.hit && !isOutOfAction(target)) {
      critLog.push(`${attacker.name} place un Critique malgré l'échange perdu.`);
      applyOpposedCritical(get, set, target, ad.roll, { attackerId: attacker.id, weapon: weapon?.name }, critLog);
    }
    // (b) Défenseur : Critique sur sa défense → l'attaquant subit un Critique sec. Un HÉROS qui PARE
    // avec une arme Piège-lame face à une lame peut choisir de PIÉGER à la place (LDB 62 l.292-294) → modale.
    if (dd.success && isDoubleRoll(dd.roll) && !isOutOfAction(attacker)) {
      if (target.kind === 'hero' && res.parryWeapon && hasBladeTrap(res.parryWeapon) && weaponHasBlade(weapon)) {
        set({ pendingBladeTrap: { defenderId: target.id, attackerId: attacker.id, weapon, parryWeaponName: res.parryWeapon.name, defSL: dd.sl, roll: dd.roll } });
      } else {
        critLog.push(`${target.name} place un Critique sur sa défense.`);
        applyOpposedCritical(get, set, attacker, dd.roll, { attackerId: target.id, weapon: res.parryWeapon?.name }, critLog);
      }
    }
  }
  // Champion (LDB 85 p.338) : « Si elle gagne un Test opposé en se défendant dans un Combat au
  // Corps à corps, elle cause autant de Dégâts que si elle était l'attaquant. »
  if (weapon.type === 'melee' && res.advantageTo === 'defender' && res.netSL > 0
      && (hasChampionDefense(target.traits) || (hasRiposte(target) && canStrikeFirst(res.parryWeapon ? [res.parryWeapon] : [])))
      && !isOutOfAction(target) && target.weapons[0]) {
    const riposte = resolveMeleePassive(target, attacker, target.weapons[0],
      { roll: res.defenderRoll ?? 1, target: res.defenderDetail?.target ?? 1, success: true, sl: res.netSL, isDouble: false });
    if (riposte.hit && riposte.woundsLost) {
      const before = attacker.wounds.current;
      attacker.wounds.current = Math.max(0, before - riposte.woundsLost);
      critLog.push(`${target.name} ${hasChampionDefense(target.traits) ? '(Champion)' : '(Riposte)'} inflige ${riposte.woundsLost} Blessure(s) en défendant.`);
      if (attacker.wounds.current <= 0 && !attacker.dead && !hasCondition(attacker, 'Inconscient')) applyZeroWounds(attacker);
      if (isOutOfAction(attacker)) {
        clearEngagementOf(get().battle?.combatants ?? [], attacker.id);
        clearPsychOf(get().battle?.combatants ?? [], attacker.id);
      }
    }
  }
  // Toile (Indice) (LDB 85 p.343) : toute touche réussie → État Empêtré (le Test de libération oppose
  // la Force de la SOURCE — approximation de la « Force Indice » de la toile, documentée).
  if (res.hit && webForce(attacker.traits) != null && !hasCondition(target, 'Empêtré')) {
    addCondition(target, 'Empêtré');
    const cond = target.conditions.find((c) => c.name === 'Empêtré'); if (cond) cond.sourceId = attacker.id;
    critLog.push(`${target.name} est Empêtré (Toile).`);
  }
  // Infecté / Maladie (Type) (LDB 85 p.340) : un héros BLESSÉ par la créature porteuse est exposé →
  // Tests de Contraction post-combat (finalizeBattle, LDB 20 l.32/49). Rongeur Infecté → Fièvre du Rongeur.
  if (res.hit && res.woundsLost && target.kind === 'hero') {
    const atkTraits = attacker.traits ?? [];
    if (atkTraits.some((t) => /^infecté/i.test(t))) {
      target.woundedByInfected = true;
      if (/rat|skaven|rongeur/i.test(attacker.name)) target.woundedByRodent = true;
    }
    for (const t of atkTraits) {
      const m = t.match(/^Maladie\s*\(([^)]+)\)/i);
      if (m && !(target.diseaseExposure ?? []).includes(m[1].trim())) target.diseaseExposure = [...(target.diseaseExposure ?? []), m[1].trim()];
    }
  }
  // Nausée (LDB 20 l.170) : un Test de DÉPLACEMENT raté (Esquive) fait vomir → État Sonné.
  if (res.defenderDetail?.label === 'Esquive' && !res.defenderDetail.success
      && hasActiveSymptom(target, 'nausee') && !hasCondition(target, 'Sonné')) {
    addCondition(target, 'Sonné');
    critLog.push(`${target.name} vomit (Nausée) : Sonné.`);
  }
  // Sang corrosif (LDB 85 p.341) : Blessures subies en mêlée → tous les Engagés avec la créature
  // reçoivent 1d10 PB modifiés par le BE et les PA (min 1).
  if (res.hit && res.woundsLost && weapon.type === 'melee' && hasCorrosiveBlood(target.traits)) {
    for (const id of target.engagedWith ?? []) {
      const e = battle.combatants.find((c) => c.id === id);
      if (!e || isOutOfAction(e)) continue;
      const lost = Math.max(1, d10(battleRng()) - bonus(effectiveChar(e, 'E')) - (e.armour.corps ?? 0));
      loseWounds(e, lost);
      critLog.push(`${e.name} est éclaboussé de sang corrosif : ${lost} Blessure(s).`);
    }
  }
  // Démoniaque (LDB 85 p.339) : à 0 PB, « son âme retourne immédiatement dans les Royaumes du
  // Chaos, ce qui la retire du jeu » — pas de corps, pas d'Inconscient.
  if (res.hit && target.wounds.current <= 0 && banishedAtZero(target.traits) && !target.dead) {
    target.dead = true;
    critLog.push(`${target.name} est bannie — son essence retourne aux Royaumes du Chaos !`);
  }
  // Affamé (LDB 85 p.338) : adversaire mis hors de combat → Test de FM Accessible (+20) ou la
  // créature festoie, perdant sa prochaine Action et son prochain Mouvement.
  if (res.hit && isOutOfAction(target) && gorgesOnKill(attacker.traits) && !isOutOfAction(attacker)) {
    const t = rollTest(effectiveChar(attacker, 'FM'), 'accessible', battleRng());
    if (!t.success) {
      attacker.loseNextAction = true;
      attacker.loseNextMovement = true;
      critLog.push(`${attacker.name} (Affamé) se jette sur sa proie et festoie — prochaine Action et Mouvement perdus.`);
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
      // À Répétition (Indice) (LDB 62 l.264-265) : Indice munitions auto-rechargées entre les coups ;
      // le rechargement complet (Test étendu) n'est exigé qu'une fois le chargeur vide.
      const mag = magazineSize(weapon);
      if (mag != null) attacker.chambered = (attacker.chambered ?? mag) - 1;
      if (mag == null || (attacker.chambered ?? 0) <= 0) {
        attacker.chambered = undefined;
        attacker.loaded = false; // déchargé après le tir
        attacker.reloadProgress = 0;
      }
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
        // Modale seulement si un héros subit OU inflige (spec coop §4bis) ; sinon journal/bandeau.
        if (target.kind === 'hero' || attacker.kind === 'hero')
          pushReveal(set, { kind: 'assommante', title: def.key, lines: [assommanteLog], subjectId: target.id, severity: 'minor' }); // « un jet = une modale » (Test opposé)
      }
    }
    // États « à la touche » des ENCHANTEMENTS d'arme actifs du porteur (Jalon 2.6 — Marteau
    // ardent : « toute cible frappée reçoit En flammes et À Terre » ; Épée ardente de Rhuin :
    // « quiconque est frappé gagne +1 En flammes »). RAW : sans Test, à la touche.
    if (weapon.type === 'melee') {
      for (const cond of enchantOnHitConditions(attacker)) {
        addCondition(target, cond.name, cond.value ?? 1);
        assommanteLog = `${target.name} reçoit ${cond.value ?? 1} État ${cond.name} (arme enchantée).`;
      }
    }
  }
  // Avantage (LDB Déplacement l.30-40) : +1 au vainqueur du Test opposé / sur une
  // Blessure infligée sans Test opposé (tir) ; perte de TOUT l'Avantage en échouant
  // un Test opposé ou en perdant une Blessure.
  if (res.advantageTo === 'attacker' && !deferAttackerAdvantage) {
    // Renversement (LDB 10) : « au lieu de gagner +1 Avantage, vous prenez tous les Avantages
    // actuels de votre adversaire » — appliqué quand c'est mieux que +1.
    if (weapon.type === 'melee' && hasStealAdvantage(attacker) && (target.advantage ?? 0) > 1) {
      gainAdvantage(attacker, target.advantage);
      target.advantage = 0;
      critLog.push(`${attacker.name} renverse l'échange et vole tous les Avantages (Renversement).`);
    } else gainAdvantage(attacker);
    attacker.gainedAdvThisRound = true;
  }
  if (res.advantageTo === 'defender') {
    // Renversement côté défenseur (même règle) ; Porte-Bouclier (LDB 10) : +niveau Avantage en
    // défense gagnée au Bouclier.
    if (weapon.type === 'melee' && hasStealAdvantage(target) && (attacker.advantage ?? 0) > 1) {
      gainAdvantage(target, attacker.advantage);
      critLog.push(`${target.name} renverse l'échange et vole tous les Avantages (Renversement).`);
    } else gainAdvantage(target);
    gainAdvantage(target, shieldAdvantageLevel(target, res.parryWeapon));
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
  // `weapon`/`parryWeapon` voyagent dans l'événement : le rig joue le geste de l'arme EMPLOYÉE
  // (2e frappe de dague gauche, tentacule…) et la parade de l'arme QUI A PARÉ (main-gauche,
  // bouclier) — pas ceux de l'arme principale.
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense, weapon, parryWeapon: res.parryWeapon, creatureAttack: creatureAttackKind(weapon.name) });
  const evKind: CombatEventKind = weapon.type === 'ranged' ? 'shoot' : 'attack';
  const log = [...battle.log, ev(evKind, res.log, attacker.id, target.id)];
  log.push(...evLines(critLog, 'crit', attacker.id, target.id));
  if (assommanteLog) log.push(ev('condition', assommanteLog, target.id));
  // Nerveux (LDB 85 p.340) : « facilement effrayée par […] les bruits forts » — un coup d'arme à
  // feu (Poudre noire/Explosion) terrifie les créatures Nerveuses présentes : +3 État Brisé.
  if (weapon.type === 'ranged' && isFirearmQuality(weapon)) {
    for (const c of battle.combatants) {
      if (!isOutOfAction(c) && isNervous(c.traits) && !hasCondition(c, 'Brisé')) {
        addCondition(c, 'Brisé', 3);
        log.push(ev('condition', `${c.name} (Nerveux) est terrifié par la détonation : +3 Brisé.`, c.id));
      }
    }
  }
  // Immobilisante (LDB 62 l.289-290) : toute touche réussie → État Empêtré, source = l'attaquant
  // (le Test opposé de Force pour se libérer vise sa Force — LDB 16 l.61, comme Constricteur).
  if (res.hit && entanglesOnHit(weapon) && !hasCondition(target, 'Empêtré')) {
    addCondition(target, 'Empêtré');
    const cond = target.conditions.find((c) => c.name === 'Empêtré'); if (cond) cond.sourceId = attacker.id;
    log.push(ev('condition', `${target.name} est Empêtré (${weapon.name} — Immobilisante).`, target.id));
  }
  // Interruption de Focalisation (LDB 46 l.193-194) : Dégâts subis pendant qu'on focalise
  // → Test de Calme Difficile (−20) ou perte des DR accumulés + Imparfaite Mineure.
  if (res.hit && res.woundsLost) log.push(...evLines(checkFocusInterruption(get, set, target), 'detail', target.id));
  if (isOutOfAction(target)) log.push(ev('death', `${target.name} est mis hors de combat !`, target.id));
  set({ battle: { ...battle, acted: true, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resolveEnemyFumble(get, set, attacker, weapon, res); // Maladresse d'un ENNEMI attaquant → résolue instantanément
  // Maladresse d'un ENNEMI défenseur (Test opposé, LDB 14 l.48-51) : sa Parade/Esquive ratée sur un double.
  if (target.kind === 'enemy' && defenderFumbled(res, target.weapons[0]) && !isOutOfAction(target) && target.weapons[0]) {
    applyOups(get, set, target, target.weapons[0], rollOups(target.weapons[0], battleRng()));
  }
  return false; // non suspendu : application complète terminée
}

/**
 * Interruption de Focalisation (LDB 46 l.193-194) : « Si vous êtes perturbé par
 * quelque chose — bruits forts, Dégâts subis… — vous devrez réussir un Test de
 * Calme Difficile (−20) ou subir une Incantation Imparfaite Mineure et perdre
 * tous les DR accumulés au Test étendu de Focalisation. » Jet SUBI auto-résolu,
 * révélé au joueur pour un héros (kind 'calme' — précédent : Calme de Fuite).
 */
export function checkFocusInterruption(get: () => GameState, set: any, target: Combatant): string[] {
  if (!target.focus || target.focus.dr <= 0) return [];
  const t = rollTest(testValue(target, 'Calme'), 'difficile', battleRng());
  const lines = [
    `${target.name}, frappé en pleine Focalisation — Test de Calme Difficile (−20) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'concentration maintenue' : 'concentration BRISÉE'}.`,
  ];
  if (!t.success) {
    lines.push(`${target.name} perd les ${target.focus.dr} DR focalisés sur ${target.focus.spell}.`);
    target.focus = undefined;
    lines.push(...applyMiscast(get, set, target, 'mineure'));
  }
  if (target.kind === 'hero')
    pushReveal(set, { kind: 'calme', title: 'Focalisation interrompue', dice: t.roll, lines: [...lines], subjectId: target.id, severity: 'minor' });
  return lines;
}

/** Une Maladresse de l'attaquant dans un résultat d'attaque ? (jet propre raté + double, LDB 14 l.53 ;
 *  arme Dangereuse : aussi tout jet raté incluant un 9, LDB 63 l.13-14). */
export function attackerFumbled(res: AttackResult, weapon?: Weapon): boolean {
  if (!res.attackerDetail) return false;
  const { roll, success } = res.attackerDetail;
  return isFumble(roll, success) || dangerousNine(weapon, roll, success);
}

/** Une Maladresse du DÉFENSEUR (Test opposé) : sa défense propre ratée sur un double (LDB 14 l.48-51 ;
 *  parade avec une arme Dangereuse : aussi tout jet raté incluant un 9, LDB 63 l.13-14). */
export function defenderFumbled(res: AttackResult, parryWeapon?: Weapon): boolean {
  if (!res.defenderDetail) return false;
  const { roll, success } = res.defenderDetail;
  return isFumble(roll, success) || dangerousNine(parryWeapon, roll, success);
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
  // L'ItemInstance source de l'arme tenue : match par `uid` (posé par recomputeLoadout sur le Weapon dérivé).
  // Mains nues / Crochet n'ont pas d'uid → pas d'item source (usure transient via le `else` ci-dessous).
  const it = weapon.uid ? (c.items ?? []).find((i) => i.uid === weapon.uid) : undefined;
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
  if (enemy.kind !== 'enemy' || !attackerFumbled(res, weapon)) return;
  applyOups(get, set, enemy, weapon, rollOups(weapon, battleRng()));
}

/** Ouvre la modale de défense réactive si l'attaque est : ennemi → héros, en mêlée,
 *  à portée, cible CAPABLE de se défendre (pas Surpris). Fige le jet d'attaque et
 *  suspend le tour de l'IA. Retourne true si la modale s'est ouverte. */
export function maybeOpenDefense(
  get: () => GameState,
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
  // Le MÊME env que resolveAttack (météo, Flanc/dos, Surnombre, Combat monté) : le jet figé de la
  // défense réactive l'omettait — un cavalier IA attaquait un héros sans son +20 (LDB 14 l.217).
  const { env } = attackEnv(get, attacker, target, weapon);
  const atk = rollMeleeAttacker(attacker, target, weapon, battleRng(), undefined, env); // jet d'attaque figé
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
  // Bénédiction de Protection (LDB 41 — L13) : Test de FM Accessible (+20) pour oser attaquer le
  // béni ; échec → l'IA renonce à CE coup (simplification : pas de re-ciblage, documentée).
  const ward = attackWardGate(attacker, target);
  const b0 = get().battle;
  if (ward.lines.length && b0) set({ battle: { ...b0, log: [...b0.log, ...evLines(ward.lines, 'info', attacker.id)] } });
  if (!ward.allowed) return false;
  if (maybeOpenDefense(get, set, attacker, target)) return true; // suspendu : reprise via defenseConfirm/Cancel
  // Tir ennemi : l'annoncer dans le journal de COMBAT (battle.log → fil + tiroir) DÈS la décision — un tir
  // n'ouvre pas de modale de défense, donc « on ne savait jamais sur qui il tirait » (#12d). Avant, l'annonce
  // partait dans le journal du GROUPE (invisible en combat).
  if (firedWeapon(attacker, target).type === 'ranged') {
    const b0 = get().battle;
    if (b0) set({ battle: { ...b0, log: [...b0.log, ev('shoot', `${attacker.name} vise ${target.name}.`, attacker.id, target.id)] } });
  }
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
  if (isOutOfAction(primaryTarget) && primaryTarget.pos) {
    attacker.pos = { ...primaryTarget.pos };
    displaceSmaller(get, attacker); // en se recalant, un grand dégage les plus petits sous son empreinte (85 l.308-309)
  }
  for (let n = 0; n < bcc; n++) {
    const battle = get().battle;
    if (!battle || battle.over) break;
    const next = cleaveTargets(battle, attacker, hitIds)[0];
    if (!next) break;
    hitIds.push(next.id);
    const r = resolveAttack(get, attacker, next);
    if (!r) continue; // hors de portée (ne devrait pas : déjà filtré adjacent) — borne consommée tout de même
    applyAttackResult(get, set, attacker, r.victim ?? next, r.weapon, r.res, false); // enchaînement : résolution instantanée (pas de modale de déviation imbriquée)
    if (isOutOfAction(next) && next.pos) {
      attacker.pos = { ...next.pos }; // se déplace sur la case libérée
      displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.308-309)
    }
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
  if (isOutOfAction(target) && target.pos) {
    attacker.pos = { ...target.pos }; // case libérée (l.10)
    displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.308-309)
  }
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

/** Arme abstraite d'une attaque gratuite : Piétinement = BF+0 ; Morsure/Caudale/Tentacules = +Indice (BF inclus). */
function freeAttackWeapon(kind: string, bonus: number): Weapon {
  if (kind === 'pietinement') return TRAMPLE_WEAPON;
  const name = kind === 'caudale' ? 'Attaque caudale' : kind === 'cornes' ? 'Cornes' : kind === 'tentacules' ? 'Tentacules' : 'Morsure';
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
  if (n.includes('tentacule')) return 'tentacules';
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
  // Tentacules (LDB 85 l.355) : « Si elle cause des Dégâts, elle peut aussi infliger à son adversaire
  // l'État Empêtré, bien que cela entame une Empoignade avec ce tentacule. » Un Constricteur (toute
  // touche, ci-dessus) a pu le poser déjà — le garde-fou évite le double-comptage.
  if (kind === 'tentacules' && !hasCondition(target, 'Empêtré')) {
    addCondition(target, 'Empêtré');
    const cond = target.conditions.find((c) => c.name === 'Empêtré'); if (cond) cond.sourceId = attacker.id;
    get().log(`${target.name} est Empêtré (Tentacules).`);
  }
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
  // Immunité (Type) (LDB 85 p.339) : un type « Poison » ignore totalement le Venin.
  if (vd && immunityTypes(target.traits).some((ty) => ty.includes('poison'))) {
    get().log(`${target.name} est immunisé au poison (Immunité).`);
  } else if (vd && !hasCondition(target, 'Empoisonné')) {
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
 *  restaure l'Action et applique les effets. Dépense `cost` Avantage (coût RAW par type :
 *  Cornes/Tentacules 0, Morsure/Caudale/Piétinement 1). */
function applyFreeAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant, kind: string, bonus: number, cost = 1): boolean {
  const prevActed = get().battle?.acted ?? false;
  attacker.advantage = Math.max(0, attacker.advantage - cost);
  const weapon = freeAttackWeapon(kind, bonus);
  if (maybeOpenDefense(get, set, attacker, target, weapon, { kind, prevActed })) return true; // suspendu : resolve via défense
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
export function applyAreaAttack(get: () => GameState, set: any, attacker: Combatant, a: CreatureAttack, centerOverride?: Combatant): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - a.avantage);
  const isVomi = a.kind === 'vomi';
  const be = bonus(effectiveChar(attacker, 'E'));
  const rangeTiles = Math.max(1, Math.ceil((isVomi ? be : be + 20) / 2)); // 1 case = 2 m
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= rangeTiles);
  // Centre IMPOSÉ (sort « Souffle », LDB 47 : la cible du sort est le point d'impact) si valide ;
  // sinon comportement trait : cible visible la plus proche.
  const center = centerOverride && centerOverride.pos && !isOutOfAction(centerOverride) && chebyshev(attacker.pos, centerOverride.pos) <= rangeTiles
    ? centerOverride
    : foes.length
      ? foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c))
      : null;
  if (!center) return;
  const blast = isVomi ? 1 : Math.max(1, Math.ceil(bonus(effectiveChar(center, 'F')) / 2)); // Souffle : BF de la cible ; Vomi : 2 m
  const affected = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(center.pos!, c.pos) <= blast);
  const type = (a.type ?? '').toLowerCase();
  const ignorePA = !isVomi && /feu|électric|electric|poison/.test(type);
  const corrosif = isVomi || /corros/.test(type);
  const damage = isVomi ? be + 4 : a.bonus; // Vomi = BE+4 ; Souffle = Indice
  const lines: string[] = [`${attacker.name} déclenche ${ATTACK_LABEL[a.kind]}${a.type ? ` (${a.type})` : ''} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  // Flash de la ZONE touchée à l'exécution (R7) : on montre l'empreinte (centre ± blast, clippée à la scène)
  // → on comprend pourquoi plusieurs combattants sont affectés. Émis pour TOUTE attaque de zone (ennemi/joueur).
  const sc2 = get().scene;
  const zone: Pt[] = [];
  for (let dx = -blast; dx <= blast; dx++)
    for (let dy = -blast; dy <= blast; dy++) {
      const x = center.pos!.x + dx, y = center.pos!.y + dy;
      if (sc2 && x >= 0 && y >= 0 && x < sc2.dimensions.w && y < sc2.dimensions.h) zone.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles: zone, kind: a.kind, type: a.type });
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
  let zones = get().battle!.zones;
  if (/fum/.test(type)) {
    const dur = Math.max(1, be); // Rounds = Bonus d'Endurance de la créature
    const tiles = smokeZone(attacker.pos!, center.pos!, blast);
    zones = [...(zones ?? []), { label: 'Fumée', tiles, rounds: dur, blocksLoS: true }];
    lines.push(`La zone se remplit de fumée — Lignes de vue bloquées ${dur} Round(s).`);
  }
  set({ battle: { ...get().battle!, zones, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
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
  // Flash de la zone du Hurlement (R7) : rayon autour du crieur, clippé à la scène.
  const scW = get().scene;
  const zoneW: Pt[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const x = attacker.pos!.x + dx, y = attacker.pos!.y + dy;
      if (scW && x >= 0 && y >= 0 && x < scW.dimensions.w && y < scW.dimensions.h) zoneW.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles: zoneW, kind: 'hurlement', type: '' });
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
    const traitKinds: string[] = [];
    for (const a of atks) {
      if (a.trigger !== 'free') continue;
      if (a.kind === 'morsure' || a.kind === 'caudale') traitKinds.push(a.kind);
      // Tentacules (LDB 85 l.354-355 : « Gagnez une Action d'Attaque gratuite PAR tentacule ») :
      // count× entrées (« 8 Tentacules +9 » → 8), coût d'Avantage 0.
      if (a.kind === 'tentacules') for (let i = 0; i < (a.count ?? 1); i++) traitKinds.push('tentacules');
    }
    // Cornes : Attaque gratuite gagnée EN CHARGEANT (LDB 85), sans coût d'Avantage → en tête.
    const cornes = enemy.chargedThisTurn && atks.some((a) => a.kind === 'cornes') ? ['cornes'] : [];
    enemy.chargedThisTurn = false; // consommée
    enemy.pendingFreeAttacks = [...cornes, ...traitKinds, 'pietinement']; // Piétinement (Taille) en dernier
  }
  while (enemy.pendingFreeAttacks.length) {
    const kind = enemy.pendingFreeAttacks[0];
    // Coût en Avantage PAR TYPE (RAW, lu de creatureAttacks) : Cornes (Charge) et Tentacules = 0 ;
    // Morsure/Caudale = 1 ; Piétinement (Taille) = 1. Une entrée inabordable est SAUTÉE (pas de
    // break : des Tentacules à coût 0 restent jouables derrière une Morsure inabordable).
    const cost = kind === 'pietinement' ? 1 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.avantage ?? 1;
    if (enemy.advantage < cost) { enemy.pendingFreeAttacks.shift(); continue; }
    const b2 = get().battle; if (!b2 || b2.over) break;
    const target = freeAttackTarget(b2, enemy, kind);
    if (!target) { enemy.pendingFreeAttacks.shift(); continue; }
    const bonus = kind === 'pietinement' ? 0 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.bonus ?? 0;
    enemy.pendingFreeAttacks.shift();
    if (applyFreeAttack(get, set, enemy, target, kind, bonus, cost)) return true; // modale ouverte → reprise via defenseConfirm
  }
  enemy.pendingFreeAttacks = undefined; // file épuisée
  return false;
}

// applyActiveEffect / COMBAT_PERSIST vivent désormais dans le moteur (engine/ops) —
// partagés par l'applicateur d'ops (sorts, tables de contrecoup, mutations).

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(get: () => GameState, set: any, caster: Combatant, severity: MiscastSeverity): string[] {
  // Colère des dieux : +10 au jet par Point de Péché du lanceur (LDB 40 l.53).
  const sinPoints = severity === 'colere' ? caster.sinPoints ?? 0 : 0;
  const m = rollMiscast(severity, battleRng(), sinPoints);
  const lines = [m.log];
  // « Après le lancer et avoir appliqué le résultat, réduisez vos Points de Péché
  // de 1, jusqu'à un minimum de 0 » (LDB 40 l.53).
  if (severity === 'colere' && sinPoints > 0) {
    caster.sinPoints = sinPoints - 1;
    lines.push(`${caster.name} : 1 Point de Péché expié (reste ${caster.sinPoints}).`);
  }
  // Ops de la table (États, Blessures ignorant BE+PA, Tests imbriqués, Corruption,
  // pénalités/blocages d'incantation temporisés, réduction à 0) — applicateur unique.
  lines.push(
    ...applyOps(caster, m.ops, {
      rng: battleRng(),
      label: m.name,
      now: get().gameTime,
      onCorruption: caster.kind === 'hero' ? (n) => gainCorruption(get, set, caster, n) : undefined,
    }),
  );
  // « Un jet = une modale » : le héros voit le dé de la table (Colère/Imparfaite) en révélation témoin.
  if (caster.kind === 'hero')
    pushReveal(set, { kind: 'miscast', title: severity === 'colere' ? 'Colère des dieux' : 'Incantation Imparfaite', dice: m.rolls[0], lines, subjectId: caster.id, severity: 'grave' });
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

// (Le sommeil de groupe vit dans state/restFlow — `sleepParty`, source unique de la nuit.)

/** Incante un sort/prière sur une cible (résolution via src/engine/magic). */
/** Ouvre la modale d'incantation (jet différé, façon attaque) : pose `pendingCast` sans lancer. */
export function castSpell(
  get: () => GameState,
  set: any,
  caster: Combatant,
  target: Combatant,
  label: string,
  fromGrimoire = false,
) {
  const spell = findSpell(label);
  if (!spell) {
    get().log(`Sort « ${label} » introuvable.`);
    return;
  }
  // Contrecoups bloquants (LDB 46/40) : « Propos ésotériques », « Vous abusez de ma patience »…
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell.type) ? 'Prière' : 'Langue');
  if (blocked) {
    get().log(`${caster.name} ne peut pas ${castInfoIsPrayer(spell.type) ? 'prier' : 'incanter'} : ${blocked}.`);
    return;
  }
  // Lecture au grimoire (LDB 47 l.34) : sort NON mémorisé de son Domaine, NI doublé.
  if (fromGrimoire && !canCastFromGrimoire(caster, spell)) {
    get().log(`${caster.name} ne peut pas lancer ${label} depuis un grimoire (mémorisé, hors Domaine ou pas de grimoire porté).`);
    return;
  }
  // Sort « Souffle » (LDB 47 p.244) : délégué à l'attaque de ZONE du Trait — la portée suit le
  // TRAIT (BE+20 m, LDB 85), pas le champ Portée du sort ; résolu comme zone, pas comme Projectile.
  const breathSpell = !!spellSpecFor(spell).breathAttack;
  // Portée (LDB 47) : cible directe hors de portée du sort → refus AVANT la modale (parité ZdE/tir).
  // `range` null = portée non chiffrable (« le lanceur », « au toucher », spécial) → pas de gate.
  if (get().battle && caster.pos && target.pos && caster.id !== target.id) {
    const range = breathSpell
      ? Math.max(1, Math.ceil((bonus(effectiveChar(caster, 'E')) + 20) / 2))
      : spellRangeTiles(spell.range, caster);
    if (range != null && combatDistance(caster, target) > range) {
      get().log(`${spell.label} : cible hors de portée (${range} cases).`);
      return;
    }
    // Ligne de Vue (LDB 46 l.170 : « vous devez toujours être capable de voir […] votre cible ») —
    // buff sur allié compris ; binaire, pas de malus de couvert pour un Sort. Couvre héros ET IA.
    if (castSightBlocked(get, caster.pos, target.pos)) {
      get().log(`${spell.label} : pas de ligne de vue.`);
      return;
    }
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: target.id, spellLabel: label, missile: breathSpell ? false : isMagicMissile(spell),
      focused: focusedNI0, result: null, ...(fromGrimoire ? { grimoire: true } : {}),
    },
  });
}

/** Rayon INITIAL d'un sort de ZONE en mètres (spec curée prioritaire sur le champ Cible —
 *  même précédence que l'application). `null` = pas un sort de ZdE chiffrable. */
export function zoneRadiusMeters(spell: NonNullable<ReturnType<typeof findSpell>>, caster: Combatant): number | null {
  const specRadius = spellSpecFor(spell).zdeRadiusMeters;
  if (specRadius != null) return Math.max(0, resolveFormula(specRadius, caster));
  const d = zdeDiameterMeters(spell.target, caster);
  return d == null ? null : d / 2;
}

/** Rayon en CASES après `alloc` Surincantations « +Zone » (LDB 47 l.29 : chaque allocation
 *  ajoute la valeur INITIALE de Zone d'Effet — Ø ×(1+n)). 1 case = 2 m. */
export const zoneRadiusTilesAt = (r0m: number, alloc: number): number =>
  Math.max(0, Math.floor((r0m * (1 + alloc)) / 2));

/** Ouvre la modale d'un sort de ZONE — flux « jet PUIS pose » (LDB 47 l.29/44) : pas de cible à
 *  désigner, le centre se choisit APRÈS le jet et la Surincantation (+Zone agrandit le gabarit).
 *  `targetId` = ancre lanceur (aucun effet ne lui est appliqué — les cibles réelles sont
 *  recensées à la pose). Retourne false si le sort n'est PAS une zone chiffrable. */
export function castZoneSpell(get: () => GameState, set: any, caster: Combatant, label: string): boolean {
  const spell = findSpell(label);
  if (!spell) return false;
  const r0m = zoneRadiusMeters(spell, caster);
  if (r0m == null) return false;
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell.type) ? 'Prière' : 'Langue');
  if (blocked) {
    get().log(`${caster.name} ne peut pas ${castInfoIsPrayer(spell.type) ? 'prier' : 'incanter'} : ${blocked}.`);
    return true; // c'était bien une zone — l'entrée est consommée (refus journalisé)
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: caster.id, spellLabel: label, missile: isMagicMissile(spell),
      focused: focusedNI0, result: null,
      zone: { center: null, radius: zoneRadiusTilesAt(r0m, 0), r0m },
    },
  });
  return true;
}

/** Source UNIQUE de la « pose de zone » en cours — le gabarit qui suit le curseur. Couvre TOUT
 *  ce qui se pose librement : sorts ET miracles à ZdE (les prières passent par pendingCast).
 *  Le Souffle/Vomissement ne se posent PAS (LDB 85 : centre imposé — cible visible la plus
 *  proche, ou la cible du sort Souffle — cf. applyAreaAttack). Toute nouvelle source = une
 *  entrée ICI + un bras à `commitPlacedZone` ; l'UI (gabarit animé, survol, clic) est commune. */
export type PlacingZone = { source: 'cast'; label: string; casterId: string; radius: number; rangeTiles: number | null };
export function placingZoneOf(s: Pick<GameState, 'pendingCast' | 'battle'>): PlacingZone | null {
  const pc = s.pendingCast;
  if (pc?.zone?.placing && !pc.zone.center) {
    const caster = s.battle?.combatants.find((c) => c.id === pc.casterId);
    const spell = effectiveSpellOf(pc);
    return {
      source: 'cast', label: pc.spellLabel, casterId: pc.casterId, radius: pc.zone.radius,
      rangeTiles: spell && caster ? spellRangeTiles(spell.range, caster) : null,
    };
  }
  return null;
}

/** La case `pt` est-elle une POSE valide pour la zone en cours ? Portée depuis l'ancre + Ligne
 *  de Vue vers le point (LDB 46 l.170/202) — partagé par le gabarit (couleur) et le clic. */
export function placedZoneValidAt(get: () => GameState, pz: PlacingZone, pt: Pt): boolean {
  const caster = get().battle?.combatants.find((c) => c.id === pz.casterId);
  if (!caster?.pos) return false;
  if (pz.rangeTiles != null && chebyshev(caster.pos, pt) > pz.rangeTiles) return false;
  return !castSightBlocked(get, caster.pos, pt);
}

/** Dépose la zone en cours sur `pt` — dispatch par source (chaque consommateur garde ses gates). */
export function commitPlacedZone(get: () => GameState, set: any, pt: Pt): void {
  const pz = placingZoneOf(get());
  if (!pz) return;
  if (pz.source === 'cast') castCommitZone(get, set, pt);
}

/** POSE de la zone d'un SORT (après le jet et la Surincantation) : gates portée (LDB 47) + Ligne
 *  de Vue vers le point (LDB 46 l.170/202), puis applique le MÊME jet à tous les combattants du
 *  rayon FINAL — parité avec l'ancien flux (premier = target, reste = extraTargets,
 *  evaluateMissile par cible). Zone posée dans le vide : Sort lancé, Action consommée. */
export function castCommitZone(get: () => GameState, set: any, pt: Pt): void {
  const pc = get().pendingCast;
  const battle = get().battle;
  if (!pc?.zone || !pc.result || !battle) return;
  const caster = battle.combatants.find((c) => c.id === pc.casterId);
  const spell = effectiveSpellOf(pc);
  if (!caster?.pos || !spell) return;
  const res = pc.result;
  // « Puissance totale » (LDB 46 l.57) repêche un DR insuffisant — la pose reste permise (le
  // repêchage est appliqué par applyCast) ; tout autre échec ne se pose pas.
  const castable = res.cast || (!!res.isCritical && (pc.critChoice ?? 'puissance') === 'puissance');
  if (!castable) return;
  const range = spellRangeTiles(spell.range, caster);
  if (range != null && chebyshev(caster.pos, pt) > range) {
    get().log(`${spell.label} : zone hors de portée (${range} cases).`);
    return;
  }
  if (castSightBlocked(get, caster.pos, pt)) {
    get().log(`${spell.label} : pas de ligne de vue.`);
    return;
  }
  const radius = pc.zone.radius;
  const inZone = battle.combatants.filter((c) => !isOutOfAction(c) && c.pos && chebyshev(c.pos, pt) <= radius);
  set({ pendingCast: { ...pc, zone: { ...pc.zone, center: { ...pt }, placing: false } } });
  if (!inZone.length) {
    set({ pendingCast: null });
    if (pc.focused) caster.focus = undefined; // le sort focalisé est consommé même à vide
    finishPlayerAction(get, set, [`${spell.label} : la zone ne touche personne.`], 'cast');
    return;
  }
  const first = inZone[0];
  const r1 = pc.missile && res.cast ? evaluateMissile(caster, first, spell, res) : res;
  set({ pendingCast: null });
  applyCast(get, set, caster, first, spell, r1, pc.missile, pc.focused, pc.critChoice, {
    durationMult: 1 + (pc.overcast?.duration ?? 0),
    extraTargets: inZone.slice(1),
  });
}

/** Contexte de visibilité OPTIONNEL pour filtrer des cibles de sort par Ligne de Vue (LDB 46
 *  l.170). Absent/null (hors combat, tests purs) : pas de filtre — comportement historique. */
export type SpellSight = { scene: Scene; smoke?: Pt[] } | null;
const spellSightBlocked = (sight: SpellSight | undefined, caster: Combatant, t: Combatant): boolean =>
  !!sight && !!caster.pos && !!t.pos && lineOfSightCover(sight.scene, caster.pos, t.pos, [], sight.smoke ?? []).blocked;
/** SpellSight depuis l'état courant (scène + fumée du combat), null hors combat. */
export const spellSightOf = (get: () => GameState): SpellSight =>
  get().scene && get().battle ? { scene: get().scene!, smoke: smokeOf(get().battle!) } : null;

/** Meilleur Projectile magique CONNU et jouable d'un ennemi (IA). Un Sort n'aboutit que si
 *  DR ≥ NI (LDB 46) : le SL maximal d'un Test = valeur/10 (Avantage compris, LDB 46 l.176) →
 *  on écarte les NI hors d'atteinte, puis on prend les Dégâts écrits les plus hauts (« Dégâts +N »,
 *  les DR du Test s'y ajoutent), à égalité le NI le plus bas (plus fiable). Repli : aucun NI
 *  atteignable → le moins exigeant (les Sorts mineurs NI 0 y pourvoient en pratique). */
export function aiBestMissile(enemy: Combatant): string | undefined {
  const known = (enemy.spells ?? [])
    .map((label) => findSpell(label))
    .filter((sp): sp is NonNullable<ReturnType<typeof findSpell>> => !!sp && isMagicMissile(sp));
  if (!known.length) return undefined;
  const dmg = (sp: { desc: string }) => parseSpellDamage(sp.desc)?.damage ?? 0;
  const maxSL = (sp: { type: string }) => {
    const info = castInfo(sp as any);
    // SL max d'un jet = valeur/10, + les DR de Talent lié au Test réussi (LDB 10 l.20 —
    // Diction instinctive ×N) : c'est ce qui détermine les NI passables SANS Focalisation.
    const tal = castTestTalentDR(enemy, info.skill === 'Prière' ? 'Prière' : 'Langue (Magick)');
    return Math.floor(castingValue(enemy, info.skill, info.spec) / 10) + tal;
  };
  const feasible = known.filter((sp) => (sp.cn ?? 0) <= maxSL(sp));
  const pool = feasible.length ? feasible : known;
  pool.sort((a, b) => dmg(b) - dmg(a) || (a.cn ?? 0) - (b.cn ?? 0));
  return pool[0].label;
}

/** Surincantation AUTOMATIQUE d'un lanceur ENNEMI (LDB 47 l.28-31 : « Pour chaque +2 DR […]
 *  vous pouvez ajouter une valeur de […] Cible égale à la valeur initiale ») : le surplus
 *  (DR − NI) est alloué à l'axe CIBLE d'un Projectile — adversaires actifs les plus proches,
 *  à PORTÉE du Sort, hors cible principale. Retourne le patch de pendingCast ({} si rien). */
export function aiOvercastPlan(
  caster: Combatant,
  targetId: string,
  spell: { cn: number | null; range: string | null },
  res: { cast: boolean; sl: number },
  combatants: Combatant[],
  focusedNI0 = false,
  sight?: SpellSight,
): { overcast?: { duration: number; targets: number }; extraTargetIds?: string[] } {
  if (!res.cast || !caster.pos) return {};
  const ni = focusedNI0 ? 0 : spell.cn ?? 0;
  const budget = Math.floor(Math.max(0, res.sl - ni) / 2);
  if (budget <= 0) return {};
  const range = spellRangeTiles(spell.range, caster) ?? Infinity;
  const extras = combatants
    .filter((t) => t.kind !== caster.kind && t.id !== targetId && !isOutOfAction(t) && t.pos && combatDistance(caster, t) <= range && !spellSightBlocked(sight, caster, t))
    .sort((a, b) => combatDistance(caster, a) - combatDistance(caster, b))
    .slice(0, budget)
    .map((t) => t.id);
  if (!extras.length) return {};
  return { overcast: { duration: 0, targets: extras.length }, extraTargetIds: extras };
}

/** Cibles SUPPLÉMENTAIRES proposables pour la Surincantation « Cible » (LDB 47 l.28-31), côté
 *  modale : hors cible principale, À PORTÉE du Sort (quand les positions existent — hors combat
 *  le groupe n'est pas sur un plateau), et surtout EN ÉTAT D'ÊTRE CIBLÉES — un Projectile vise un
 *  adversaire encore en combat (un figurant à 0 PB est mort, LDB 18 l.51-54) ; un sort bénéfique
 *  vise un allié non mort/évacué (l'Inconscient reste soignable). Aligné sur aiOvercastPlan/ZdE. */
export function overcastTargetCandidates(
  pool: Combatant[],
  caster: Combatant,
  targetId: string,
  spell: { range: string | null },
  missile: boolean,
  sight?: SpellSight,
): Combatant[] {
  const range = spellRangeTiles(spell.range, caster);
  return pool.filter((m) => {
    if (m.id === targetId) return false;
    if (missile ? m.kind === caster.kind || isOutOfAction(m) : m.kind !== caster.kind || m.dead || m.outOfRencontre) return false;
    if (range != null && caster.pos && m.pos && combatDistance(caster, m) > range) return false;
    // Ligne de Vue (LDB 46 l.170) : une cible supplémentaire doit aussi être visible du lanceur.
    return !spellSightBlocked(sight, caster, m);
  });
}

/** Sort effectif d'un pendingCast : NI DOUBLÉ pour une lecture au grimoire (LDB 47 l.34). */
export function effectiveSpellOf(pc: { spellLabel: string; grimoire?: boolean }): ReturnType<typeof findSpell> {
  const spell = findSpell(pc.spellLabel);
  if (!spell || !pc.grimoire || spell.cn == null) return spell;
  return { ...spell, cn: spell.cn * 2 };
}

/** Contre-lanceurs ÉLIGIBLES à la Dissipation (LDB 46 l.201-202) contre un Sort de `caster` visant
 *  `target` : camp opposé, actif, lanceur (Compétence Langue (Magick) ou Trait Lanceur de Sorts),
 *  pas encore de Contre-sort ce Round (« un seul Sort chaque Round »), et le Sort le CIBLE
 *  (« Si un Sort vous cible ») ou vise un point QU'IL PEUT VOIR « à une distance en mètres égale à
 *  votre Force Mentale » (1 case = 2 m ; Ligne de Vue scène + fumée). */
export function counterspellCandidates(
  battle: BattleState | null,
  scene: Scene | null | undefined,
  caster: Combatant,
  target: Combatant,
): Combatant[] {
  if (!battle || battle.over) return [];
  return battle.combatants.filter((c) => {
    if (c.kind === caster.kind || c.id === caster.id || isOutOfAction(c) || c.dispelledThisRound) return false;
    if (!knowsCastingSkill(c, 'Langue', 'Magick')) return false;
    if (c.id === target.id) return true;
    if (!c.pos || !target.pos) return false;
    if (combatDistance(c, target) > Math.max(1, Math.floor(effectiveChar(c, 'FM') / 2))) return false;
    return !scene || !lineOfSightCover(scene, c.pos, target.pos, [], smokeOf(battle)).blocked;
  });
}

/** Applique un Contre-sort de `counter` au `pendingCast` FIGÉ (résultat déjà jeté) : Test opposé de
 *  Langue (Magick) (LDB 46 l.201-202) — dissipé si le contre-lanceur gagne, sinon l'incantation se
 *  re-détermine au DR NET. Marque l'essai du Round et re-dérive le résultat (Projectile compris) ;
 *  la Surincantation est re-planifiée (IA) ou remise à zéro (héros — le budget a changé). */
export function applyCounterspell(get: () => GameState, set: any, counter: Combatant): boolean {
  const pc = get().pendingCast;
  if (!pc?.result || pc.result.dispelled) return false;
  const caster = get().battle?.combatants.find((c) => c.id === pc.casterId);
  const target = get().battle?.combatants.find((c) => c.id === pc.targetId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !target || !spell || !isDispellableSpell(spell)) return false;
  if (counter.kind === caster.kind || counter.dispelledThisRound) return false;
  counter.dispelledThisRound = true; // l'essai est consommé même s'il échoue (LDB 46 l.202)
  const res = pc.result;
  // Le Test d'Incantation du lanceur, reconstruit tel que figé (même convention que rederiveCastSL).
  const castT = { roll: res.roll, target: res.target, success: res.roll <= res.target, sl: res.sl, isDouble: res.roll === 100 || res.roll % 11 === 0 };
  const out = resolveCounterspell(counter, castT, battleRng());
  // Zone NON POSÉE (flux « jet puis pose ») : pas de cible désignée — re-dériver le jet PUR (les
  // Dégâts par cible seront dérivés du DR net à la pose), jamais un Projectile contre l'ancre.
  const unplacedZone = !!pc.zone && !pc.zone.center;
  let next: typeof pc.result;
  if (out.dispelled) {
    next = { ...res, cast: false, dispelled: true, hit: false, damage: undefined, woundsLost: undefined, defenderDefeated: false, log: `${out.log}` };
  } else {
    next = rederiveCastSL(caster, target, spell, res, pc.missile && !unplacedZone, pc.focused, out.casterNetSL - res.sl);
    next.log = `${out.log} ${next.log}`;
  }
  // Surincantation : le surplus a changé — re-plan IA (lanceur ennemi), remise à zéro sinon.
  const oc = caster.kind === 'enemy' && pc.missile && !pc.zone
    ? aiOvercastPlan(caster, pc.targetId, spell, next, get().battle?.combatants ?? [], pc.focused, spellSightOf(get))
    : {};
  set({ pendingCast: { ...pc, result: next, overcast: undefined, extraTargetIds: undefined, ...oc } });
  const b = get().battle;
  if (b) set({ battle: { ...b, log: [...b.log, ev('info', out.log, counter.id, caster.id)] } });
  return true;
}

/** Choix du lanceur sur une Incantation CRITIQUE (LDB 46 l.52-59). */
export type CastCritChoice = 'critique' | 'puissance' | 'ineluctable';

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
  critChoice?: CastCritChoice,
  extras?: { durationMult?: number; extraTargets?: Combatant[] },
) {
  const battle = get().battle; // null = incantation HORS COMBAT (couture D) : même applyCast, sortie journal
  const durationMult = Math.max(1, extras?.durationMult ?? 1);
  let teleportReach: Map<string, number> | null = null; // Téléportation (Jalon 2.6) : posé APRÈS finishPlayerAction
  const extraTargets = extras?.extraTargets ?? [];

  // Incantation CRITIQUE (LDB 46 l.52-59) — SORTS seulement (Test de Langue (Magick)) :
  // les Vents octroient une puissance supplémentaire (choix du lanceur), mais cela a un
  // prix — Imparfaite Mineure, sauf Talent Diction instinctive.
  const isSort = !castInfoIsPrayer(spell.type);
  // Un Sort DISSIPÉ (Contre-sort gagnant, LDB 46 l.201-202) n'est pas lancé : pas d'effet Critique
  // — « Puissance totale » (l.57) repêche un DR insuffisant, pas une Dissipation.
  const crit = !!res.isCritical && isSort && !res.dispelled;
  let choice = critChoice;
  if (crit) {
    // Défaut (IA / non choisi) : repêcher un DR insuffisant (Puissance totale), sinon
    // Blessure Critique pour un Projectile, sinon Force inéluctable.
    choice ??= !res.cast ? 'puissance' : missile ? 'critique' : 'ineluctable';
    if (choice === 'puissance' && !res.cast) {
      res = missile
        ? evaluateMissile(caster, target, spell, { ...res, cast: true })
        : { ...res, cast: true, log: `${caster.name} lance ${spell.label} (Puissance totale — Critique).` };
    }
  }
  const logLines: string[] = [res.log];
  if (crit) {
    logLines.push(
      choice === 'critique'
        ? 'Incantation Critique : le Projectile inflige une Blessure Critique.'
        : choice === 'puissance'
          ? 'Puissance totale : le sort est lancé quels que soient NI et DR (mais peut être Dissipé).'
          : 'Force inéluctable : le sort ne peut pas être Dissipé.',
    );
    if (!hasTalent(caster, 'Diction instinctive')) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    else logLines.push('Diction instinctive : aucune Imparfaite sur le double réussi.');
  }
  // « Avantages et Magie » (LDB 46 l.176) : si la cible a déjà été visée par un Sort du
  // MÊME Domaine ce Round, le lanceur gagne +1 Avantage (le Vent converge). Sorts seulement.
  if (battle && isSort && spell.subType && res.cast) {
    const marks = battle.domainCasts ?? [];
    if (marks.some((m) => m.targetId === target.id && m.domain === spell.subType)) {
      gainAdvantage(caster);
      caster.gainedAdvThisRound = true;
      logLines.push(`${caster.name} : +1 Avantage — le Vent de ${spell.subType} converge sur ${target.name}.`);
    }
    battle.domainCasts = [...marks, ...[target, ...extraTargets].map((t) => ({ targetId: t.id, domain: spell.subType! }))];
  }

  if (missile) {
    // Touche d'un Projectile : application des Blessures + Critique (choix/overkill).
    const missileSpec = spellSpecFor(spell);
    const applyMissileHit = (t: Combatant, mres: CastResult & Partial<MissileResult>) => {
      // Résistance à la Magie (Indice) (LDB 85 p.341) : « Le DR de tous les Sorts l'affectant est
      // réduit du nombre indiqué » → autant de Blessures en moins (dégâts du Projectile = dérivés du DR).
      const mr = magicResistanceOf(t.traits) + talentMagicResistance(t); // Trait (LDB 85) + Talent (LDB 10, 2×niveau)
      if (mr > 0 && mres.hit && mres.woundsLost) {
        mres = { ...mres, woundsLost: Math.max(0, mres.woundsLost - mr) };
        logLines.push(`${t.name} résiste à la magie (−${mr} DR de Sort).`);
      }
      // Dôme (LDB 47 — L11) : Protection (6+) contre une Attaque MAGIQUE venant de l'extérieur.
      if (mres.hit && mres.woundsLost && battle && wardedAgainst(battle.combatants, caster, t, 'domeWard')) {
        const d = d10(battleRng());
        if (d >= 6) {
          logLines.push(`${t.name} est couvert par le Dôme — sauvegarde ${d} ≥ 6, le Sort se brise sur la voûte.`);
          return;
        }
      }
      // Martyr (LDB 42 — L13) : les Dégâts du Projectile vont au prêtre (BE doublé pour ces Dégâts).
      if (mres.hit && mres.woundsLost && battle) {
        const priest = martyrGuardOf(battle, t);
        if (priest) {
          const raw = mres.damage ?? mres.woundsLost;
          const taken = Math.max(0, raw - 2 * bonus(effectiveChar(priest, 'E')) - Math.max(0, priest.armour[mres.location ?? 'corps'] ?? 0));
          if (taken > 0) {
            loseWounds(priest, taken);
            if (priest.wounds.current <= 0) applyZeroWounds(priest);
          }
          logLines.push(`Martyr : ${priest.name} reçoit les Dégâts à la place de ${t.name}${taken > 0 ? ` (${taken} PB, BE doublé)` : ' (encaissés sans dommage, BE doublé)'}.`);
          logLines.push(...checkFocusInterruption(get, set, priest));
          return;
        }
      }
      if (!mres.hit || !mres.woundsLost) return;
      const currentBefore = t.wounds.current;
      const overkill = mres.woundsLost - currentBefore;
      t.wounds.current = Math.max(0, currentBefore - mres.woundsLost);
      // Blessure Critique : choix « Incantation Critique » du lanceur (LDB 46 l.55), ou overkill.
      const critWound = crit && choice === 'critique';
      if (critWound || overkill > 0) {
        const lethal = applyCriticalToTarget(t, mres.location ?? 'corps', critWound, Math.max(0, overkill), logLines, set, undefined, { attackerId: caster.id, attackerKind: caster.kind, weapon: spell.label, critTwice: hasActiveFlag(caster, 'critRollTwice') });
        if (lethal) finalizeHeroDeath(get, set, t, 'hit', currentBefore);
      } else if (t.wounds.current <= 0) {
        applyZeroWounds(t);
      }
      // Ops d'une spec CURÉE de Projectile (« Grands feux d'U'Zhul » : +2 En flammes, À Terre ;
      // « Drain » : soigne le lanceur) — le repli regex n'en émet jamais ici (iso-POC : la
      // branche missile du POC n'appliquait aucun effet parsé).
      if (missileSpec.curated && missileSpec.ops.length) {
        const rounds = missileSpec.durationRounds != null ? resolveFormula(missileSpec.durationRounds, caster, battleRng()) : null;
        const clockMin = rounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
        logLines.push(...applyOps(t, missileSpec.ops, {
          rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: res.sl,
          defaultDurationRounds: rounds ?? COMBAT_PERSIST,
          ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
          onCorruption: t.kind === 'hero' ? (n) => gainCorruption(get, set, t, n) : undefined,
        }));
      }
      // Interruption de Focalisation : un Projectile magique blesse aussi un focaliseur (LDB 46 l.193).
      logLines.push(...checkFocusInterruption(get, set, t));
      if (isOutOfAction(t)) logLines.push(`${t.name} est mis hors de combat !`);
    };
    applyMissileHit(target, res);
    // Nerveux (LDB 85 p.340) : « facilement effrayée par la magie […] elle gagne +3 État Brisé. »
    for (const t of [target, ...extraTargets]) {
      if (res.cast && isNervous(t.traits) && !hasCondition(t, 'Brisé') && !isOutOfAction(t)) {
        addCondition(t, 'Brisé', 3);
        logLines.push(`${t.name} (Nerveux) est terrifié par la magie : +3 Brisé.`);
      }
    }
    // Surincantation « Cible » (LDB 47 l.28-31) : le MÊME jet frappe les cibles supplémentaires.
    for (const t2 of extraTargets) {
      if (!res.cast) break;
      const r2 = evaluateMissile(caster, t2, spell, res);
      logLines.push(r2.log);
      applyMissileHit(t2, r2);
      if (battle) bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: t2.id, result: r2, kind: 'spell', spell: spell.label, defense: 'none' });
    }
    // Attaques en chaîne (LDB 47 — L13) : « Si [le Projectile] réduit la cible à 0 Blessure, il
    // rebondit sur une autre cible » — ennemi du lanceur le plus proche de la cible précédente
    // (≤ BFM m), dans la portée INITIALE du sort, jamais re-touché ; mêmes Dégâts (même jet) ;
    // max BFM rebonds. S'arrête dès qu'une cible survit.
    if (missileSpec.chainOnKill && res.cast && battle && caster.pos) {
      const maxBounces = Math.max(0, resolveFormula(missileSpec.chainOnKill.maxBounces, caster, battleRng()));
      const hopTiles = Math.max(1, Math.ceil(Math.max(0, resolveFormula(missileSpec.chainOnKill.hopMeters, caster, battleRng())) / 2));
      const initialRange = spellRangeTiles(spell.range, caster);
      const hitIds = new Set([target.id, ...extraTargets.map((t) => t.id)]);
      let prev = target;
      for (let bounce = 0; bounce < maxBounces; bounce++) {
        if (!(prev.wounds.current <= 0 || prev.dead)) break; // « réduit la cible à 0 Blessure »
        const next = battle.combatants
          .filter((c) => c.kind !== caster.kind && !hitIds.has(c.id) && !isOutOfAction(c) && c.pos
            && combatDistance(prev, c) <= hopTiles
            && (initialRange == null || combatDistance(caster, c) <= initialRange))
          .sort((a, b) => combatDistance(prev, a) - combatDistance(prev, b))[0];
        if (!next) break;
        const r2 = evaluateMissile(caster, next, spell, res);
        logLines.push(`${spell.label} rebondit sur ${next.name} !`, r2.log);
        applyMissileHit(next, r2);
        bus.emit(EVT.ANIM_ATTACK, { from: prev.id, to: next.id, result: r2, kind: 'spell', spell: spell.label, defense: 'none' });
        hitIds.add(next.id);
        prev = next;
      }
    }
    // Zone persistante d'un Projectile (Grands feux d'U'Zhul : « le feu continue de brûler
    // dans la Zone d'Effet pour la durée du Sort ») — posée autour de la cible touchée.
    if (res.cast) placeSpellZone(get, caster, target, spell, missileSpec, res.sl, durationMult, logLines);
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    else if (focusedNI0 && !res.cast) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    // Sort offensif : lanceur vers la cible, cible vers le lanceur.
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!), [target.id]: facingToward(target.pos!, caster.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  } else {
    if (res.cast) {
      // Effets structurés du sort (spec curée du registre, sinon repli regex sur la
      // desc — iso-POC). Durée hors-rounds (minutes/heures/jours, LDB 47) : l'effet est posé à
      // COMBAT_PERSIST (échelle tactique) AVEC son échéance d'HORLOGE `untilTime` (cascade #T3 —
      // « 1 heure » expire en 60 min de gameTime, plus au bout de 9999 Rounds) ; on n'invente
      // PAS un nombre de rounds. Surincantation « Durée » : ×(1+n) (LDB 47).
      const spec = spellSpecFor(spell);
      const baseRounds = spec.durationRounds != null ? resolveFormula(spec.durationRounds, caster, battleRng()) : null;
      const rounds = baseRounds != null ? baseRounds * durationMult : null;
      const baseClockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      const clockMin = baseClockMin != null ? baseClockMin * durationMult : null;
      if (durationMult > 1 && baseRounds != null) logLines.push(`Surincantation : durée ×${durationMult} (${rounds} Rounds).`);
      if (durationMult > 1 && baseClockMin != null) logLines.push(`Surincantation : durée ×${durationMult}.`);
      for (const t of [target, ...extraTargets]) {
        if (t !== target) logLines.push(`${spell.label} s'étend aussi à ${t.name} (Surincantation).`);
        logLines.push(
          ...applyOps(t, spec.ops, {
            rng: battleRng(),
            caster,
            label: spell.label,
            now: get().gameTime,
            sl: res.sl,
            defaultDurationRounds: rounds ?? COMBAT_PERSIST,
            ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
            onCorruption: t.kind === 'hero' ? (n) => gainCorruption(get, set, t, n) : undefined,
          }),
        );
      }
      // POUSSÉE (Jalon 2.6 — « Toutes les créatures à BFM mètres sont repoussées de BFM
      // mètres », LDB 47 p.244) : recul en ligne (direction lanceur→cible) jusqu'à
      // l'obstacle ; la collision est journalisée (Dégâts = distance restante, MJ).
      if (spec.pushMeters != null && battle && caster.pos) {
        const pushTiles = Math.max(1, Math.floor(resolveFormula(spec.pushMeters, caster, battleRng()) / 2));
        for (const t of [target, ...extraTargets]) {
          if (t.id === caster.id || !t.pos || isOutOfAction(t)) continue;
          const r = pushAway(get().scene!, caster.pos, t.pos, pushTiles, occupied(battle, t));
          if (r.pushed > 0) {
            const fromPos = { ...t.pos };
            t.pos = { ...r.dest };
            bus.emit(EVT.ANIM_MOVE, { id: t.id, path: [{ ...r.dest }] });
            logLines.push(`${t.name} est repoussé de ${r.pushed * 2} m.`);
            applyZoneCrossings(get, t, [...tilesBetween(fromPos, r.dest), { ...r.dest }]); // une poussée TRAVERSE (Mur de feu, L11)
          }
          if (r.collided) logLines.push(`${t.name} percute un obstacle (Dégâts = distance restante — arbitrage MJ).`);
        }
      }
      // Sort « Souffle » (LDB 47 p.244) : « comme si vous aviez dépensé 2 Avantages pour activer
      // le Trait Souffle » — délégué à l'attaque de ZONE du Trait, centrée sur la CIBLE du sort,
      // Dégâts = Bonus d'Endurance du lanceur, Type mappé du Domaine. Sans coût d'Avantage (le
      // sort EST l'activation). Hors combat : pas de grille → journalisé.
      if (spec.breathAttack) {
        if (battle && caster.pos) {
          const type = domainBreathType(caster);
          applyAreaAttack(get, set, caster, {
            kind: 'souffle', label: 'Souffle', bonus: bonus(effectiveChar(caster, 'E')),
            trigger: 'free', avantage: 0, aoe: true, magic: true, ...(type ? { type } : {}),
          }, target);
          if (!type) logLines.push('Souffle : Domaine sans Type évident — Dégâts purs (« Le MJ détermine quel type… »).');
        } else {
          logLines.push(`${caster.name} crache un Souffle — hors combat, effet narratif (arbitrage MJ).`);
        }
      }
      // Zone persistante d'un sort de soutien/zone (Mur de feu : « Quiconque traverse… »).
      if (res.cast) placeSpellZone(get, caster, target, spell, spec, res.sl, durationMult, logLines);
      // TÉLÉPORTATION (Jalon 2.6 — « vous vous téléportez de BFM mètres (+BFM par +2 DR) »,
      // LDB 47 p.245) : le choix de la case d'arrivée suit l'Appliquer (mode 'teleport',
      // cases = survol des obstacles, atterrissage libre — battleClickTile).
      if (spec.teleportMeters != null && res.cast) {
        let meters = Math.max(0, resolveFormula(spec.teleportMeters, caster, battleRng()));
        if (spec.teleportPerSL) {
          meters += Math.floor(Math.max(0, res.sl) / Math.max(1, spec.teleportPerSL.every))
            * Math.max(0, resolveFormula(spec.teleportPerSL.metersFormula, caster, battleRng()));
        }
        if (battle && caster.pos) {
          const tpTiles = Math.max(1, Math.floor(meters / 2));
          teleportReach = flyReachable(get().scene!, caster.pos, tpTiles, occupied(battle, caster), sizeFootprint(caster.size));
          logLines.push(`${caster.name} peut se téléporter (${meters} m) — choisir la case d'arrivée.`);
        } else {
          logLines.push(`${caster.name} se téléporte (${meters} m) — repositionnement libre hors combat.`);
        }
      }
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

  // Attributs de Domaine (LDB 48 — L14) : riders post-lancement d'un Sort « issu du Domaine ».
  if (res.cast) {
    for (const t of [target, ...extraTargets]) {
      logLines.push(...domainOnHitRiders(caster, t, spell, t.kind !== caster.kind));
    }
    // Cieux (l.87) : le Sort « se dirige vers toutes les autres cibles dans les 2 mètres » de la
    // cible (sauf Magie des Arcanes (Cieux)) — BFM Dégâts, mitigés BE + PA (PA métal ignorées).
    if (domainOf(spell) === 'Cieux' && battle && target.pos) {
      const bfm = bonus(effectiveChar(caster, 'FM'));
      const splashed = battle.combatants.filter((c) =>
        c.id !== target.id && c.id !== caster.id && !isOutOfAction(c) && c.pos
        && combatDistance(target, c) <= 1 && !hasArcaneTalent(c, 'Cieux'));
      for (const s of splashed) {
        const totalAP = Math.max(0, s.armour.corps ?? 0);
        const dom = domainMissileMods(s, spell, 'corps', totalAP);
        const wl = Math.max(0, bfm - bonus(effectiveChar(s, 'E')) - Math.max(0, totalAP - dom.apIgnored));
        if (wl > 0) {
          loseWounds(s, wl);
          if (s.wounds.current <= 0) applyZeroWounds(s);
        }
        logLines.push(`L'arc d'Azyr saute sur ${s.name} : ${wl} Blessure(s) (attribut des Cieux).`);
      }
    }
    // Bête (l.9) : le lanceur gagne Peur 1 pour 1d10 Rounds après un Sort de la Bête réussi.
    logLines.push(...ghurFearAfterCast(caster, spell, battleRng()));
  }

  // Péché et Colère Divine (LDB 40 l.44-45) : à CHAQUE Test de Prière, si le dé des
  // unités ≤ Points de Péché → Colère des dieux, MÊME si le Test est réussi (la
  // Maladresse, elle, a déjà déclenché la sienne ci-dessus).
  if (castInfoIsPrayer(spell.type) && !res.isFumble && res.roll > 0 && prayerWrathTriggered(res.roll, caster.sinPoints ?? 0)) {
    logLines.push(`Le dé des unités (${res.roll % 10}) trahit les Péchés de ${caster.name} (${caster.sinPoints}) — Colère des dieux !`);
    logLines.push(...applyMiscast(get, set, caster, 'colere'));
  }

  // Le sort focalisé est consommé après le lancement.
  if (focusedNI0) caster.focus = undefined;
  finishPlayerAction(get, set, logLines, 'cast'); // sortie commune combat (log+conso Action) / hors combat (journal)
  // Téléportation (Jalon 2.6) : le choix de case suit la clôture du cast (qui remet action: null).
  if (teleportReach && get().battle) {
    set({ battle: { ...get().battle!, action: 'teleport', reachable: teleportReach } });
    bus.emit(EVT.SCENE_DIRTY);
  }
}

/** Renvoie vrai si le type de sort relève d'une Prière (Béni/Invocation). */
export function castInfoIsPrayer(type: string): boolean {
  return type === 'Béni' || type === 'Invocation';
}

/** Pose la ZONE PERSISTANTE d'un sort (L11 — Mur de feu : mur perpendiculaire à l'axe
 *  lanceur→cible centré sur la cible ; Grands feux : disque autour de la cible). Durée = celle
 *  du sort (× Surincantation), formules résolues contre le LANCEUR. Hors combat : narratif. */
function placeSpellZone(
  get: () => GameState,
  caster: Combatant,
  target: Combatant,
  spell: { label: string },
  spec: ReturnType<typeof spellSpecFor>,
  sl: number,
  durationMult: number,
  logLines: string[],
): void {
  const pz = spec.persistentZone;
  if (!pz) return;
  const battle = get().battle;
  if (!battle || !target.pos || !caster.pos) {
    logLines.push(`${spell.label} : la zone persiste — hors grille de combat, arbitrage MJ.`);
    return;
  }
  const baseRounds = spec.durationRounds != null ? resolveFormula(spec.durationRounds, caster, battleRng()) : 1;
  const rounds = Math.max(1, baseRounds * Math.max(1, durationMult));
  const tiles = pz.shape === 'wall'
    ? wallTiles(caster.pos, target.pos, metersToTiles(resolveZoneMeters(pz.lengthMeters ?? 2, pz.lengthPerSL, caster, sl, battleRng())))
    : discTiles(target.pos, metersToTiles(Math.max(0, resolveFormula(pz.radiusMeters ?? 2, caster, battleRng()))));
  const zone: BattleZone = {
    label: spell.label, tiles, rounds, casterId: caster.id,
    ...(pz.blocksLoS ? { blocksLoS: true } : {}),
    ...(pz.onCross ? { onCross: pz.onCross } : {}),
    ...(pz.perRound ? { perRound: pz.perRound } : {}),
  };
  battle.zones = [...(battle.zones ?? []), zone];
  logLines.push(`${spell.label} : la zone persiste ${rounds} Round(s).`);
  bus.emit(EVT.ANIM_AOE, { tiles, kind: 'spell' });
}

/** Type de Souffle « correspondant le mieux » au Domaine du lanceur (sort Souffle, LDB 47 p.244 :
 *  « Le MJ détermine quel type d'attaque de Souffle correspond le mieux à votre Talent Magie des
 *  Arcanes ») — jeu sans MJ : seuls les Domaines au Type canonique évident sont mappés
 *  (Feu→Feu, Cieux→Électricité, Métal→Corrosif, Ombres→Fumée) ; les autres soufflent des Dégâts purs. */
function domainBreathType(caster: Combatant): string | undefined {
  const m = caster.talents.map((t) => t.name.match(/^Magie des Arcanes \(([^)]+)\)$/)).find(Boolean);
  const domain = (m?.[1] ?? '').toLowerCase();
  if (/feu/.test(domain)) return 'Feu';
  if (/cieux/.test(domain)) return 'Électricité';
  if (/m[ée]tal/.test(domain)) return 'Corrosif';
  if (/ombre/.test(domain)) return 'Fumée';
  return undefined;
}

/** Attribut d'Aqshy (LDB 48 l.157 — L14) : « Chaque État Enflammé situé à une distance en mètres
 *  égale à votre Bonus de Force Mentale ajoute +10 aux tentatives de Focalisation ou d'Incantation
 *  avec Aqshy. » — +10 par PION En flammes porté par un combattant à portée du LANCEUR.
 *  (Volet Focalisation : non câblé — différé documenté.) */
export function domainCastBonus(s: GameState, caster: Combatant, spell: { type?: string; subType?: string | null }): number {
  if (domainOf(spell) !== 'Feu' || !caster.pos) return 0;
  const radius = Math.max(1, Math.ceil(bonus(effectiveChar(caster, 'FM')) / 2));
  let pions = 0;
  for (const c of s.battle?.combatants ?? []) {
    if (!c.pos || isOutOfAction(c)) continue;
    if (combatDistance(caster, c) <= radius) pions += stacks(c, 'En flammes');
  }
  return 10 * pions;
}

/** « N'écoutez point la Sorcière » (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou
 *  quelqu'un dans les (BSoc) mètres subissent une pénalité de -20 aux Tests de Langue (Magick),
 *  en plus de toute autre pénalité. » — −20 si la CIBLE du Sort est dans le rayon d'un porteur
 *  de l'aura (`ActiveEffect.castWard`) encore en état de combattre. Sorts seulement (les Prières
 *  passent par Prière, pas Langue). Une fois, même sous plusieurs auras (toutes à −20). Hors
 *  combat (pas de géométrie), l'aura ne s'applique pas — limitation documentée. */
export function castWardPenalty(s: GameState, target: Combatant, spell: { type: string }): number {
  if (castInfoIsPrayer(spell.type)) return 0;
  if (!target.pos) return 0;
  const warded = (s.battle?.combatants ?? []).some(
    (w) => !isOutOfAction(w) && w.pos && (w.activeEffects ?? []).some(
      (e) => e.castWard && combatDistance(w, target) <= Math.max(1, Math.ceil(e.castWard.radiusMeters / 2)),
    ),
  );
  return warded ? -20 : 0;
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
  // Trait Infecté (LDB 20 l.32/49) : blessé par une créature Infectée → Résistance Facile (+40) ou
  // Blessure Purulente ; blessé par un RONGEUR Infecté → aussi Résistance Accessible (+20) ou Fièvre
  // du Rongeur. Trait Maladie (Type) (LDB 85 p.340) : Test de Contraction de la maladie portée.
  for (const c of battle.combatants) {
    if (c.kind !== 'hero' || c.dead) continue;
    const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    if (c.woundedByInfected) infectLog.push(...rollContraction(c, 'Blessure Purulente', resVal, 'facile', battleRng()));
    if (c.woundedByRodent) infectLog.push(...rollContraction(c, 'Fièvre du Rongeur', resVal, 'accessible', battleRng()));
    for (const name of c.diseaseExposure ?? []) {
      const def = DISEASE_DEFS[name] ?? Object.values(DISEASE_DEFS).find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (def) infectLog.push(...rollContraction(c, def.name, resVal, def.contractDifficulty, battleRng()));
      else infectLog.push(`${c.name} a été exposé à : ${name} (maladie non répertoriée — arbitrage MJ).`);
    }
    c.woundedByInfected = false;
    c.woundedByRodent = false;
    c.diseaseExposure = undefined;
  }
  // Trait Corruption (Degré) (LDB 85 p.338 → LDB 19) : avoir AFFRONTÉ une créature corrompue est une
  // EXPOSITION du Degré indiqué — Test de Résistance Intermédiaire auto-résolu en fin de combat,
  // gain de Points selon le niveau et le DR (corruptionGain), puis seuil/mutation via gainCorruption.
  const degrees = battle.combatants
    .filter((c) => c.kind !== 'hero')
    .flatMap((c) => (c.traits ?? []).map((t) => t.match(/^Corruption\s*\((Mineure|Modérée|Majeure)\)/i)?.[1]).filter(Boolean));
  if (degrees.length) {
    const rank = { mineure: 0, modérée: 1, majeure: 2 } as Record<string, number>;
    const worst = degrees.reduce((a, b) => (rank[b!.toLowerCase()] > rank[a!.toLowerCase()] ? b : a))!;
    const level = worst.toLowerCase() === 'majeure' ? 'majeure' : worst.toLowerCase() === 'modérée' ? 'moderee' : 'mineure';
    for (const c of battle.combatants) {
      if (c.kind !== 'hero' || c.dead) continue;
      const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
      const gain = corruptionGain(level, t.success, Math.max(0, t.sl));
      infectLog.push(`${c.name} — exposition à la Corruption (${worst}) : Résistance ${t.roll}/${t.target}${gain ? '' : ', résiste'}.`);
      if (gain > 0) infectLog.push(...gainCorruption(get, set, c, gain));
    }
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
    bus.emit(EVT.BATTLE_OVER, { victory: true }); // gong audio + hooks futurs
    // Capture des récompenses pour l'écran de victoire : on mesure ce que onVictory octroie (XP/or/butin)
    // par diff avant/après, + la liste des vaincus (groupée par nom). L'écran (VictoryScreen) lit `pendingVictory`.
    const xpBefore = get().party[0]?.xp ?? 0;
    const brassBefore = toBrass(get().money);
    // #9 : on sépare les effets onVictory. Récompenses/flags/journal s'appliquent MAINTENANT (pour peupler
    // l'écran) ; ceux qui CHANGENT le contexte (téléport/dialogue/combat) sont DIFFÉRÉS au clic « Continuer »
    // (dismissVictory) — sinon le téléport masque l'écran de victoire (cas de l'arène).
    const CONTEXT = new Set(['transition', 'transitionBack', 'startDialogue', 'startCombat']);
    const all = battle.onVictory ?? [];
    const deferred = all.filter((e) => CONTEXT.has(e.type));
    // L'ÉQUIPEMENT (giveTrapping) devient du butin ATTRIBUABLE sur l'écran (qualités conservées) au lieu
    // d'aller d'office au 1er héros : on le retire des effets immédiats et on le pose dans `gear`.
    const gear = all
      .filter((e): e is Extract<Effect, { type: 'giveTrapping' }> => e.type === 'giveTrapping')
      .map((e) => ({ label: e.trapping, magic: !!e.qualities?.length || e.identified === false, effect: e }));
    const immediate = all.filter((e) => !CONTEXT.has(e.type) && e.type !== 'giveTrapping');
    const messages = immediate.filter((e) => e.type === 'journal').map((e) => (e as { text: string }).text);
    if (immediate.length) applyEffects(get, set, immediate);
    const after = get();
    const counts = new Map<string, number>();
    for (const c of battle.combatants) if (c.kind === 'enemy') counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    set({
      pendingVictory: {
        xp: Math.max(0, (after.party[0]?.xp ?? 0) - xpBefore),
        gold: fromBrass(Math.max(0, toBrass(after.money) - brassBefore)),
        gear: gear.length ? gear : undefined,
        defeated: [...counts].map(([name, count]) => ({ name, count })),
        messages: messages.length ? messages : undefined,
        onContinue: deferred.length ? deferred : undefined,
      },
    });
    return true;
  }
  if (!heroesAlive) {
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, ev('info', 'Défaite…')] } });
    return true;
  }
  return false;
}

/** Résolution du choix Piège-lame (LDB 62 l.292-294). `trap=false` → Coup Critique normal (LDB 14 l.7) ;
 *  `trap=true` → Test opposé de Force (+DR de la défense) : victoire = désarme, Succès Stupéfiant (DR
 *  net ≥ 6) = brise la lame sauf Incassable (sauvegarde Solide), échec = l'adversaire se libère. */
export function resolveBladeTrap(get: () => GameState, set: any, trap: boolean): void {
  const { battle, pendingBladeTrap: pbt } = get();
  if (!battle || !pbt) return;
  set({ pendingBladeTrap: null });
  const defender = battle.combatants.find((c) => c.id === pbt.defenderId);
  const attacker = battle.combatants.find((c) => c.id === pbt.attackerId);
  if (!defender || !attacker) return;
  const lines: string[] = [];
  if (!trap) {
    lines.push(`${defender.name} place un Critique sur sa défense.`);
    applyOpposedCritical(get, set, attacker, pbt.roll, { attackerId: defender.id, weapon: pbt.parryWeaponName }, lines);
  } else if (!isOutOfAction(attacker)) {
    // Test opposé de Force, le piégeur ajoutant son DR du Test de Corps à corps précédent (l.293).
    const dT = rollTest(effectiveChar(defender, 'F'), 'intermediaire', battleRng());
    const aT = rollTest(effectiveChar(attacker, 'F'), 'intermediaire', battleRng());
    const opp = resolveOpposed({ ...dT, sl: dT.sl + pbt.defSL }, aT);
    lines.push(`Test opposé de Force : ${defender.name} 🎲 ${dT.roll}/${dT.target} (DR ${dT.sl}+${pbt.defSL}) contre ${attacker.name} 🎲 ${aT.roll}/${aT.target} (DR ${aT.sl}).`);
    if (opp.winner === 'attacker') {
      const drop = attacker.weapons.find((w) => (pbt.weapon.uid && w.uid === pbt.weapon.uid) || w.name === pbt.weapon.name);
      if (drop && opp.netSL >= 6) {
        // Succès Stupéfiant : la lame est BRISÉE, à moins qu'elle ne possède l'Atout Incassable (l.294).
        wearActiveWeapon(attacker, drop, true);
        lines.push(drop.destroyed
          ? `La lame de ${attacker.name} (${drop.name}) est BRISÉE par la manœuvre !`
          : `${drop.name} résiste à la casse (Incassable/Solide) mais est arrachée des mains de ${attacker.name}.`);
        attacker.weapons = attacker.weapons.filter((w) => w !== drop);
      } else if (drop) {
        attacker.weapons = attacker.weapons.filter((w) => w !== drop);
        lines.push(`${attacker.name} laisse tomber ${drop.name}, arrachée de ses mains !`);
      }
    } else {
      lines.push(`${attacker.name} libère sa lame et peut combattre normalement.`);
    }
  }
  const b = get().battle!;
  set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', defender.id, attacker.id)] } });
  // Modale seulement si un héros est d'un côté du piège (spec coop §4bis) — déjà journalisé ci-dessus.
  if (attacker.kind === 'hero' || defender.kind === 'hero')
    pushReveal(set, { kind: 'assommante', title: 'Piège-lame', lines: [...lines], subjectId: attacker.id, actorId: defender.id, weapon: pbt.parryWeaponName, severity: 'minor' });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resumeEnemyTurn(get, set);
}

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
export function resumeEnemyTurn(get: () => GameState, set: any): void {
  const b = get().battle;
  if (!b || b.over || get().pendingCast || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingBladeTrap || get().pendingReveals.length) return;
  setTimeout(() => advanceTurn(get, set), TEMPO.enemyAdvance);
}

export function advanceTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  // Pause de début de Round (PERSONNE n'est actif, turn -1) : un advanceTurn retardataire (timer
  // d'IA en vol) ne doit pas ré-incrémenter le tour SOUS la pause — confirmRoundStart le posera.
  if (get().pendingRoundStart) return;
  if (!battle || battle.over || get().pendingCast || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingBladeTrap || get().pendingReveals.length) return;
  // La Charge ne vaut que pour le tour où elle a lieu (Cornes LDB 85, Épuisante LDB 63 l.16-17) :
  // consommée au passage au combattant suivant (filet de sécurité, l'IA la consomme aussi en chemin).
  const prevActive = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  if (prevActive?.chargedThisTurn) prevActive.chargedThisTurn = false;
  if (prevActive?.tentacleUsedThisTurn) prevActive.tentacleUsedThisTurn = false; // Attaque gratuite de Tentacule : 1/tour

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
      // Agir en dernier : Maladresse (Oups! 21-40, 1 Round) OU arme Lente active (LDB 63 l.25, permanent).
      const lastIds = battle.combatants.filter((c) => c.actLastNextRound || strikesLast(c.weapons)).map((c) => c.id);
      battle.order = [...base.filter((id) => !lastIds.includes(id)), ...base.filter((id) => lastIds.includes(id))];
      for (const c of battle.combatants) if (c.actLastNextRound) { c.actLastNextRound = false; battle.log.push(ev('detail', `${c.name} agira en dernier ce Round (Maladresse).`, c.id)); }
      // Entretien de Round PARTITIONNÉ (spec coop §4bis) : TOUT va au journal de combat (bandeau) ;
      // seules les lignes CONCERNANT UN HÉROS alimentent la révélation (les ennemis : journal seul).
      const heroRoundLines: string[] = [];
      const tickLine = (line: string, c?: Combatant) => {
        battle.log.push(ev('condition', line, c?.id));
        if (c?.kind === 'hero') heroRoundLines.push(line);
      };
      for (const c of battle.combatants) endOfRound(c, battleRng()).forEach((l) => tickLine(l, c));
      for (const c of battle.combatants) refreshWounds(c); // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
      // Régénération (LDB 85 p.341) : début de Round — PB > 0 → +1d10 PB ; à 0 PB → 1d10, 8+ → 1 PB
      // (la créature reprend conscience) ; un 10 soigne aussi une Blessure Critique. (Exception du
      // Feu non suivie — la provenance des Blessures n'est pas tracée ; limitation documentée.)
      for (const c of battle.combatants) {
        if (c.dead || c.outOfRencontre || !regenerates(c.traits)) continue;
        const r = d10(battleRng());
        if (c.wounds.current > 0) {
          const healed = Math.min(c.wounds.max - c.wounds.current, r);
          if (healed > 0) { c.wounds.current += healed; tickLine(`${c.name} régénère ${healed} Blessure(s).`, c); }
        } else if (r >= 8) {
          c.wounds.current = 1;
          while (hasCondition(c, 'Inconscient')) removeCondition(c, 'Inconscient', 99);
          tickLine(`${c.name} régénère et se relève (1 PB) !`, c);
        }
        if (r === 10 && (c.criticalWounds ?? 0) > 0) {
          c.criticalWounds = (c.criticalWounds ?? 0) - 1;
          if (c.traumas?.length) c.traumas = c.traumas.slice(0, -1);
          tickLine(`${c.name} régénère une Blessure Critique.`, c);
        }
      }
      // Instable (LDB 85 p.340) : fin de Round Engagé avec un adversaire d'Avantage SUPÉRIEUR →
      // perd la différence en PB ; à 0 PB, elle « meurt » (les magies qui la maintiennent cèdent).
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || !isUnstable(c.traits)) continue;
        const foesAdv = (c.engagedWith ?? [])
          .map((id) => battle.combatants.find((x) => x.id === id))
          .filter((e): e is Combatant => !!e && e.kind !== c.kind && !isOutOfAction(e))
          .map((e) => e.advantage ?? 0);
        const diff = (foesAdv.length ? Math.max(...foesAdv) : 0) - (c.advantage ?? 0);
        if (diff > 0) {
          loseWounds(c, diff);
          tickLine(`${c.name} (Instable) est repoussée : −${diff} PB.`, c);
          if (c.wounds.current <= 0) { c.dead = true; tickLine(`${c.name} se délite — les magies qui la maintenaient s'effondrent.`, c); }
        }
      }
      // Bestial (LDB 85 p.338) : « Elle a peur du feu et gagne l'État Brisé si elle est touchée par
      // ce dernier » — approximé sur l'État En flammes (granularité Round, documenté).
      for (const c of battle.combatants) {
        if (!isOutOfAction(c) && isBestial(c.traits) && hasCondition(c, 'En flammes') && !hasCondition(c, 'Brisé')) {
          addCondition(c, 'Brisé');
          tickLine(`${c.name} (Bestial) est terrifié par les flammes : Brisé.`, c);
        }
      }
      // Perturbant (LDB 85 p.341) : −20 à tous les Tests à Bonus d'Endurance mètres d'une créature
      // Perturbante (non cumulable). Aura recalculée à chaque franchissement de Round (granularité assumée).
      for (const c of battle.combatants) {
        c.perturbed = !isOutOfAction(c) && !!c.pos && battle.combatants.some(
          (p) => p.id !== c.id && p.kind !== c.kind && !isOutOfAction(p) && p.pos
            && hasPerturbingAura(p.traits) && chebyshev(p.pos, c.pos!) * 2 <= bonus(effectiveChar(p, 'E')),
        );
      }
      // Surnombre (LDB 14 l.149) : un combattant surpassé en nombre (≥2 ennemis Engagés avec lui) perd 1 Avantage en fin de Round.
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || (c.advantage ?? 0) <= 0) continue;
        const foes = (c.engagedWith ?? []).filter((id) => {
          const e = battle.combatants.find((x) => x.id === id);
          return !!e && e.kind !== c.kind && !isOutOfAction(e);
        }).length;
        // Maîtrise du combat (LDB 10) : on compte pour 1+niveau personnes au calcul du surnombre.
        if (foes >= 2 + outnumberCountBonus(c)) { c.advantage = Math.max(0, c.advantage - 1); tickLine(`${c.name} est surpassé en nombre (${foes} c.1) : −1 Avantage.`, c); }
      }
      // Mâchoires d'acier (LDB 10) : Test de Résistance (+0) — retire 1 + DR États Sonné (résolu au
      // franchissement de Round, approximation de « chaque fois que vous gagnez un État Sonné »).
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || !hasStunSave(c) || !stacks(c, 'Sonné')) continue;
        const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
        if (t.success) {
          const n = Math.min(stacks(c, 'Sonné'), 1 + Math.max(0, t.sl));
          removeCondition(c, 'Sonné', n);
          tickLine(`${c.name} secoue la tête (Mâchoires d'acier) : ${n} État(s) Sonné retiré(s).`, c);
        }
      }
      for (const c of battle.combatants) if (c.frenzied) c.frenzyFreeUsed = false; // Frénésie : nouvelle attaque CC gratuite chaque Round (LDB 21 l.34)
      for (const c of battle.combatants) if (c.ignoreCritMods) c.ignoreCritMods = false; // Détermination : « ignorer modifs de critique » expire au début du prochain Round (LDB 17 l.64)
      for (const c of battle.combatants) if (c.psychImmuneRoundsLeft) c.psychImmuneRoundsLeft -= 1; // Détermination : l'immunité psy décompte 1 Round (LDB 17 l.62)
      brokenRecovery(get, tickLine); // récupération du Brisé en fin de Round (LDB 16 l.57-59)
      for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => tickLine(l, c)); // 0 PB→Inconscient (LDB 18 l.28)
      for (const c of battle.combatants) suffocationTick(c).forEach((l) => tickLine(l, c)); // Noyade et Suffocation (LDB 18 l.424-425) ; la mort passe par inDeathCondition (Destin inclus)
      zonesRoundTick(battle.zones, battle.combatants, battleRng()).forEach((t) => tickLine(t.line, t.combatant)); // zones perRound (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »)
      for (const c of battle.combatants) if (isOutOfAction(c)) clearPsychOf(battle.combatants, c.id); // effets psy d'une créature morte → fin (catch-all toutes causes de mort)
      if (heroRoundLines.length) pushReveal(set, { kind: 'round', title: `Fin du Round ${round - 1}`, lines: heroRoundLines, severity: 'minor' }); // « un jet = une modale » (entretien HÉROS — auto-fermée)
      // Maniement de deux armes : le −10 défensif expire au DÉBUT du prochain Tour de son porteur. Si ce
      // porteur est order[0] (il rejoue en premier), c'est ICI (le franchissement de Round) que son Tour démarre.
      const firstNext = battle.combatants.find((c) => c.id === battle.order[0]);
      if (firstNext) firstNext.dualStrikeDefensePenalty = false;
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
    newActive.dualStrikeDefensePenalty = false; // Maniement de deux armes : expire au début de son Tour (LDB 10 l.638)
    // Maladresse (Oups! 61-80) : perte du Mouvement / de l'Action ce tour-ci.
    if (newActive.loseNextMovement) { movementUsed = mountMovement(battle, newActive); newActive.loseNextMovement = false; battle.log.push(ev('detail', `${newActive.name} perd son Mouvement (Maladresse).`, newActive.id)); }
    if (newActive.loseNextAction) { acted = true; newActive.loseNextAction = false; battle.log.push(ev('detail', `${newActive.name} perd son Action (Maladresse).`, newActive.id)); }
  }
  set({ battle: { ...battle, turn, action: null, movementUsed, movedPreAction: false, acted, loadoutSwapped: false, reachable: new Map(), preview: null, runBudget: null, fearGate: null } });
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
    c.dispelledThisRound = undefined; // Dissipation : « un seul Sort chaque Round » (LDB 46 l.202)
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
  // Zones persistantes (L11) : un Round de moins ; les zones épuisées se dissipent (fumée, Mur de feu…).
  if (battle.zones?.length) {
    const d = decayZones(battle.zones);
    battle.zones = d.zones;
    for (const l of d.log) battle.log.push(ev('info', l));
  }
  // « Avantages et Magie » : la convergence de Domaine ne vaut que DANS le Round (LDB 46 l.176).
  if (battle.domainCasts?.length) battle.domainCasts = undefined;
  // (4) Le combat est-il terminé à ce franchissement ? (morts lentes finalisées ci-dessus → victoire/défaite,
  //     capture des récompenses incluse). On tranche AVANT de proposer la fenêtre d'initiative.
  if (checkBattleOver(get, set)) return;
  // (5) Pause de DÉBUT DE ROUND (LDB ch.17 l.27) : on s'arrête à CHAQUE début de Round pour montrer
  //     l'initiative (frise d'initiative (InitiativeStrip)) et permettre la pré-emption (Chance, 3e usage ; futurs Atouts/talents).
  //     L'IA reste gelée jusqu'à « Commencer le round » (confirmRoundStart) — cf. garde de maybeRunEnemyTurn.
  //     EN COOP (arbitrage 2026-06-11) : seul le round 1 est gaté (ready-check de tous) — les rounds
  //     suivants S'ENCHAÎNENT sans pause (le ✋ « ouvrir la fenêtre Chance » volontaire = P3).
  const b = get().battle!;
  const reset = { ...b, action: null, movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, reachable: new Map(), preview: null, runBudget: null, fearGate: null };
  if (get().net.mode !== 'local' && b.round > 1 && !b.handRaised) {
    set({ battle: reset, pendingRoundStart: null });
    get().confirmRoundStart();
    return;
  }
  // Pause de début de Round : PERSONNE n'est actif (turn -1) — confirmRoundStart posera le tour.
  set({ battle: { ...reset, turn: -1, handRaised: false }, pendingRoundStart: { round: b.round } });
}

/** IA simple : si le combattant actif est un ennemi, il agit puis passe la main. */
export function maybeRunEnemyTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingRoundStart || get().pendingCast || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingBladeTrap || get().pendingReveals.length) return;
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
  const approachKey = `${battle.round}:${battle.turn}`; // UN Test par Tour de la source (l.29) —
  // un déplacement DÉCOMPOSÉ en segments (ou move-then-attack) ne re-déclenche pas la modale.
  for (const c of battle.combatants) {
    if (c.kind === mover.kind || isOutOfAction(c) || !c.pos) continue;
    const peur = (c.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === mover.id && (p.calmeDR ?? 0) < (p.indice ?? 0));
    if (!peur || peur.lastApproachKey === approachKey) continue;
    if (chebyshev(mover.pos, c.pos) >= chebyshev(fromPos, c.pos)) continue; // ne s'est pas rapproché
    peur.lastApproachKey = approachKey;
    const t = rollTest(calmeValue(c), 'intermediaire', battleRng());
    const line = t.success ? `${c.name} garde son sang-froid alors que ${mover.name} s'approche.` : `${c.name} panique alors que ${mover.name} s'approche : 1 État Brisé.`;
    if (!t.success) addCondition(c, 'Brisé', 1);
    battle.log.push(ev('fear', line, c.id, mover.id));
    if (c.kind === 'hero') pushReveal(set, { kind: 'calme', title: 'Approche menaçante', dice: t.roll, lines: [line], subjectId: c.id, severity: 'minor' });
  }
}

/** Récupération du Brisé en fin de Round (LDB 16 l.57-59) — combattant par combattant :
 *  - pas de Test si Engagé (l.57) ; sinon Test de Calme dont la Difficulté suit les circonstances
 *    (caché hors de vue → Accessible +20 ; ennemi à ≤ 3 cases → Très difficile −30 ; sinon Intermédiaire +0),
 *    retirant 1 + DR États Brisé sur un succès ;
 *  - +1 État Brisé retiré si l'on est resté caché hors de vue de TOUT ennemi ce Round (l.59).
 *  Émet chaque ligne via `sink(line, combattant)` — l'entretien de Round partitionne héros/ennemis. */
export function brokenRecovery(get: () => GameState, sink: (line: string, c: Combatant) => void): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return;
  for (const c of battle.combatants) {
    if (!stacks(c, 'Brisé') || isOutOfAction(c) || !c.pos) continue;
    const enemies = battle.combatants.filter((e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos);
    const hidden = !!scene && enemies.length > 0 && enemies.every((e) => lineOfSightCover(scene, e.pos!, c.pos!, [], smokeOf(battle)).blocked);
    if (hidden) { removeCondition(c, 'Brisé', 1); sink(`${c.name} est resté caché hors de vue : retire 1 État Brisé.`, c); }
    // Récupération par Test de Calme : seulement si pas Engagé (l.57) — sauf Cœur vaillant
    // (LDB 10 : Test de Calme en fin de Round, sans restriction d'Engagement) — et qu'il reste du Brisé.
    if ((!isEngaged(c) || hasBraveheart(c)) && stacks(c, 'Brisé')) {
      const nearest = enemies.length ? Math.min(...enemies.map((e) => chebyshev(c.pos!, e.pos!))) : Infinity;
      const diff: import('../engine/types').Difficulty = hidden ? 'accessible' : nearest <= 3 ? 'tresDifficile' : 'intermediaire';
      const t = rollTest(calmeValue(c), diff, battleRng());
      if (t.success) {
        const removed = Math.min(stacks(c, 'Brisé'), 1 + Math.max(0, t.sl));
        removeCondition(c, 'Brisé', removed);
        sink(`${c.name} se ressaisit : retire ${removed} État(s) Brisé (Test de Calme réussi).`, c);
      } else {
        sink(`${c.name} reste Brisé (Test de Calme raté).`, c);
      }
    }
    // « Une fois que vous n'avez plus d'États Brisé, vous gagnez 1 État Exténué » (LDB 16 l.80).
    if (!stacks(c, 'Brisé')) { addCondition(c, 'Exténué'); sink(`${c.name} est Exténué (après s'être ressaisi).`, c); }
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
  // Belliqueux (LDB 85 p.338) : immunité psy tant qu'il a plus d'Avantages que son adversaire ENGAGÉ.
  const engagedFoesAdv = (enemy.engagedWith ?? [])
    .map((id) => battle.combatants.find((x) => x.id === id))
    .filter((e): e is Combatant => !!e && e.kind !== enemy.kind && !isOutOfAction(e))
    .map((e) => e.advantage ?? 0);
  if (isPsychImmune(enemy, engagedFoesAdv.length ? Math.max(...engagedFoesAdv) : undefined)) return; // Immunité (Psychologie) / Frénésie / Détermination temp / Belliqueux
  enemy.psychState ??= [];
  const log: string[] = [];
  // Nouvelles sources de peur/terreur en Ligne de Vue (non encore rencontrées).
  for (const foe of battle.combatants) {
    if (foe.kind === enemy.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (lineOfSightCover(scene, enemy.pos, foe.pos, [], smokeOf(battle)).blocked) continue;
    const src = fearSourceFor(enemy, foe);
    if (!src || enemy.psychState.some((p) => p.sourceId === foe.id)) continue;
    if (src.kind === 'terreur') {
      const r = resolveTerreurTest(calmeValue(enemy), src.indice, battleRng(), isColdBlooded(enemy.traits)); // À sang-froid : inverse un raté (LDB 85)
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
    const r = resolvePeurTest(calmeValue(enemy), p.indice ?? 1, p.calmeDR ?? 0, battleRng(), isColdBlooded(enemy.traits)); // À sang-froid (LDB 85)
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
  // Rage (LDB 85 p.341) : « dépenser tous ses Avantages (minimum 3) pour entrer en Frénésie ».
  if (hasRage(enemy.traits) && !enemy.frenzied && (enemy.advantage ?? 0) >= 3) {
    enemy.advantage = 0;
    enemy.frenzied = true;
    battle.log.push(ev('frenzy', `${enemy.name} entre dans une rage dévorante (Frénésie) !`, enemy.id));
    set({ battle: { ...battle } });
  }
  aiMaybeFrenzy(get, set, enemy); // l'IA tente d'entrer en Frénésie (LDB 21 l.32) AVANT le test psy (la Frénésie en rend immunisé) et le choix de cible
  resolvePsychAI(get, set, enemy); // Peur/Terreur de l'IA au début de son tour (instantané, journalisé)
  // Stupide (LDB 85 p.341) : sans allié non-Stupide à ses côtés (adjacent), Test d'Intelligence
  // Facile (+40) au début du Round ; sur un échec, elle perd son Mouvement ET son Action.
  if (isStupid(enemy.traits) && enemy.pos) {
    const guided = battle.combatants.some(
      (a) => a.kind === enemy.kind && a.id !== enemy.id && !isOutOfAction(a) && !isStupid(a.traits) && a.pos && chebyshev(a.pos, enemy.pos!) <= 1,
    );
    if (!guided && !rollTest(effectiveChar(enemy, 'Int'), 'facile', battleRng()).success) {
      battle.log.push(ev('detail', `${enemy.name} (Stupide) bave et regarde dans le vide — Mouvement et Action perdus.`, enemy.id));
      set({ battle: { ...battle } });
      return advanceTurn(get, set);
    }
  }

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
  // Meilleur Projectile magique connu et JOUABLE (NI atteignable, Dégâts max — cf. aiBestMissile) :
  // la détection a besoin des données de sort, donc elle reste ici (couche impure), pas dans ai.ts.
  const offensiveSpell = aiBestMissile(enemy);
  // Portée du sort en CASES, résolue ici (ai.ts est pur, sans données de sort) — gate de ciblage IA.
  const offensiveSpellData = offensiveSpell ? findSpell(offensiveSpell) : undefined;
  const spellRange = offensiveSpellData ? spellRangeTiles(offensiveSpellData.range, enemy) : undefined;
  // Charge de cavalerie (LDB 15-Dépl l.74-77 / 14 l.223) : un cavalier ennemi non Engagé fonce à la portée
  // de COURSE (2× le Mouvement de sa monture) — PARITÉ avec le joueur ; à pied, l'IA reste en Marche (M).
  const cavalryCharge = !!enemy.mountId && !isEngaged(enemy);
  // Bond ×2 / Foulée ×1,5 (LDB 85) sur la portée de COURSE/CHARGE (cavalerie) de la géométrie porteuse.
  let moveBudget = justMounted ? 0 : Math.floor(effectiveMovement(geom) * (cavalryCharge ? 2 * runMultiplier(geom.traits) : 1));
  // Vol (Indice) (LDB 85 p.343) : « elle peut voler jusqu'à Indice mètres » (1 case = 2 m) — le vol
  // remplace la Marche s'il porte plus loin. (Les obstacles traversés sont ignorés via `flying`.)
  const flyM = flyMeters(enemy.traits);
  if (!justMounted && flyM != null) moveBudget = Math.max(moveBudget, Math.floor(flyM / 2));
  const action = chooseEnemyAction({
    enemy,
    heroes,
    scene,
    blocked,
    movement: moveBudget,
    offensiveSpell,
    spellRange,
    smoke: smokeOf(battle),
    flying: flyM != null, // Vol : ignore terrains/obstacles/personnages traversés (LDB 85 p.343)
  });
  const targetOf = (id: string) => battle.combatants.find((c) => c.id === id)!;
  const canAct = canTakeAction(enemy); // Sonné : pas d'Action — déplacement seul (LDB États l.123)

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant, delay: number = TEMPO.preAttack) => {
    // Télégraphe (réticule + ligne — PLEINE en mêlée, pointillée au tir) pendant la pré-attaque :
    // même affordance que la visée du joueur, des deux côtés.
    set({ enemyAim: { fromId: enemy.id, toId: target.id, melee: firedWeapon(enemy, target).type !== 'ranged' } });
    bus.emit(EVT.SCENE_DIRTY);
    setTimeout(() => {
      set({ enemyAim: null });
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
    case 'cast': {
      if (!canAct) return advanceTurn(get, set);
      const ctgt = targetOf(action.targetId);
      // Télégraphe d'incantation (parité tir) : ligne pointillée + réticule ~0,7 s avant le jet.
      set({ enemyAim: { fromId: enemy.id, toId: ctgt.id } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => {
        set({ enemyAim: null });
        const b = get().battle;
        if (!b || b.over) return;
        castSpell(get, set, enemy, ctgt, action.spell);
        // La modale d'incantation témoin (Lancer → Contre-sort → Appliquer) SUSPEND le tour de
        // l'IA : la reprise est portée par castConfirm/castCancel → resumeEnemyTurn (anti
        // double-advance, même pattern que la défense). castSpell peut refuser (contrecoup
        // bloquant, hors de portée…) → pas de modale → l'ennemi passe.
        if (!get().pendingCast) setTimeout(() => advanceTurn(get, set), TEMPO.enemyAdvance);
      }, TEMPO.aimTelegraph);
      return;
    }
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
      // Simplification IA assumée (sévérité mineure, relevée par la revue de fidélité) :
      //  • l'IA ne fait JAMAIS de Désengagement (option joueur, LDB 15-Dépl l.84-89) : un
      //    ennemi Engagé qui se repositionne ne paie pas l'Esquive/le sacrifice d'Avantage.
      // PARITÉ d'approche (LDB 15 l.74-82) : Charge à portée de Course si la Marche ne suffit pas,
      // sinon Course (Test d'Athlétisme instantané, pas d'attaque ce tour) — cf. aiApproachPlan.
      const { plan, ran } = aiApproachPlan(
        { enemy, heroes, scene, blocked, movement: moveBudget, offensiveSpell, spellRange, smoke: smokeOf(battle), flying: flyM != null },
        geom, action, battleRng(),
      );
      const mv = plan.kind === 'move' ? plan : action;
      if (ran) battle.log.push(ev('move', `${enemy.name} prend sa Course (${enemy.mountId ? 'Chevaucher' : 'Athlétisme'} ${ran.roll === 100 ? '00' : ran.roll}) : jusqu'à ${ran.budget} cases.`, enemy.id));
      const wasEngaged = isEngaged(enemy);
      const distBefore = combatDistance(enemy, targetOf(mv.thenTargetId)); // distance de combat AVANT le déplacement
      const fromPos = { ...enemy.pos! }; // position AVANT déplacement (déclenchement de Peur à l'approche)
      const path = pathTo(scene, enemy.pos!, mv.to, blocked, sizeFootprint(geom.size));
      enemy.pos = mv.to;
      if (geom !== enemy) geom.pos = { ...mv.to }; // Combat monté : la monture suit le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.308-309)
      get().faceFromPath(enemy.id, path);
      if (geom !== enemy) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
      if (geom !== enemy) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      applyZoneCrossings(get, enemy, path ?? [{ ...mv.to }]); // Mur de feu & co (L11) : traverser coûte
      approachFearTrigger(get, set, enemy, fromPos); // LDB 21 l.29 : source de Peur qui s'approche → Test de Calme ou Brisé
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
      const tgt = targetOf(mv.thenTargetId);
      // La Course a consommé l'Action (LDB 15 l.79) → pas d'attaque en arrivant.
      if (!ran && canAct && combatDistance(enemy, tgt) <= meleeReachTiles(enemy.weapons)) {
        // Charge de l'IA : se ruer au contact depuis une position non-Engagée donne l'Avantage (LDB 15-Dépl l.74-77).
        if (!wasEngaged) {
          const adv = chargeAdvantage(effectiveMovement(geom), distBefore);
          if (adv) {
            gainAdvantage(enemy, adv);
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

