/**
 * Les vérités du STORE qu'une surbrillance de combat demande (portées, cibles éligibles, candidats du
 * mode de ciblage, bandes de portée du tireur survolé), assemblées UNE fois en `HighlightsView` — ce
 * que le builder pur (`builders/highlights`) consomme, et par lui le monde volumique
 * (`stage/VolumetricWorld` → `backends/webgl/highlightMeshes`).
 * Aucune projection ici : cette couche ne connaît ni caméra ni couleur.
 */
import type { GameState, BattleState, PendingAttack, PendingCleave, PendingDualStrike, PendingCast } from '../../state/store';
import { Combatant } from '../../engine/types';
import { crowdEligible, eligibleAttackTargetIds, displayedReach, computeRunReach, hasFreeWeaponAttack } from '../../state/combatFlow';
import { currentTargetingMode } from '../../state/targetingModes';
import { armedIntentPortee, intentReach, PORTEE_ARME } from '../../state/localIntent';
import { controlsCombatant } from '../../state/netOwnership';
import { inBattleId } from '../../state/combatants';
import { attackWeapon } from '../../engine/combat';
import { effectiveWeaponRange } from '../../engine/weaponDamage';
import { loadedAmmo } from '../../engine/items';
import { bonus, effectiveChar } from '../../engine/characteristics';
import type { HighlightsView } from '../builders/highlights';

export interface HighlightOpts {
  myTurn: boolean;
  pendingAttack: PendingAttack | null;
  pendingCleave: PendingCleave | null;
  pendingDualStrike: PendingDualStrike | null;
  pendingCast: PendingCast | null;
}

export function combatHighlightsView(get: () => GameState, battle: BattleState, opts: HighlightOpts): HighlightsView {
  const { myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast } = opts;
  const activeC = inBattleId(battle, battle.order[battle.turn]);
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — aucune affordance
  // (ni grille de déplacement, ni anneaux de cible, ni aperçu) ; teintes d'équipe/zones restent.
  // (Plus AUCUN indicateur de distance au sol — la portée se lit au survol : réticule = cible valide.)
  const view: HighlightsView = {
    myTurn,
    walkReach: myTurn ? displayedReach(get) : new Map<string, number>(),
    runReach: myTurn ? computeRunReach(get) : new Map<string, number>(),
    // INTENTION armée depuis l'interface : sa portée est LOCALE au client (hors `battle`) et ne
    // s'affiche qu'à son tour, comme toute affordance (spec HUD zone 4).
    intentReach: myTurn ? intentReach(get) : new Map<string, number>(),
    activeId: activeC?.id ?? null,
    // Anneaux d'attaque (R4) : en mode neutre (attaque implicite), tant que l'Action est disponible
    // (ou attaque libre de Frénésie).
    eligibleIds:
      myTurn && battle.action === null && !!activeC && controlsCombatant(get(), activeC) && !pendingAttack && (!battle.acted || hasFreeWeaponAttack(activeC))
        ? eligibleAttackTargetIds(get)
        : null,
    crowdIds: (() => {
      if (!pendingAttack?.intoCrowd) return null;
      const atk = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
      const tgt = battle.combatants.find((c) => c.id === pendingAttack.targetId);
      return atk && tgt ? new Set(crowdEligible(battle, atk, tgt).map((v) => v.id)) : null;
    })(),
    // Cibles cliquables du MODE de ciblage courant (targetingModes → MÊME source que réticule/clic) :
    // Soin (alliés → anneau AMI) ; flux différés (ennemis → anneau hostile, déjà cochés en vert).
    candidates: (() => {
      if (!myTurn || pendingAttack || !(pendingCleave || pendingDualStrike || pendingCast?.pickingTargets || battle.action === 'heal')) return null;
      const tmode = currentTargetingMode(get);
      const cands = activeC ? tmode.candidates?.(get, activeC) ?? [] : [];
      return {
        ids: cands.map((c: Combatant) => c.id),
        friendly: tmode.id === 'heal', // soin = anneau ami (vert)
        checkedIds: pendingCast?.pickingTargets ? new Set(pendingCast.extraTargetIds ?? []) : null, // surincantation : déjà coché
      };
    })(),
    // Bandes de portée du tireur SURVOLÉ (frise ou token, `store.hovered` — même source que le halo de
    // survol) : arme à DISTANCE équipée en main → cases à colorer autour de sa position.
    rangeBandSource: (() => {
      // L'INTENTION d'attaque (spec HUD zone 4, G1) montre la PORTÉE DE L'ARME du set : elle n'ouvre
      // pas un 2ᵉ dessin de cette vérité — elle allume les bandes de tir existantes autour de l'ACTIF,
      // sans attendre un survol. Le survol garde la priorité (il désigne un autre tireur).
      const armedAttack = myTurn && armedIntentPortee(get) === PORTEE_ARME ? activeC ?? null : null;
      const c = battle.combatants.find((x) => x.id === get().hovered) ?? armedAttack;
      if (!c?.pos) return null;
      const weapon = attackWeapon(c.weapons, false);
      if (!weapon || weapon.type !== 'ranged') return null; // structure/décor sans arme (porte…) — pas de bande (#203 régression)
      const rangeM = effectiveWeaponRange(weapon, loadedAmmo(c, weapon)?.ammoRangeMod, () => bonus(effectiveChar(c, 'force')));
      return rangeM != null ? { pos: c.pos, rangeM } : null;
    })(),
  };
  return view;
}
