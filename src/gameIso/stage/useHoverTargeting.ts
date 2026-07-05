/**
 * Ciblage au SURVOL du stage (memoïsé — previewAttack/LdV/pathTo ne tournent pas à 60 Hz pendant les
 * glissements de token) : réticule + infobulle (`hoverAim`, mêmes prédicats que le clic), combattant
 * SOUS le focus (`hoveredId`, miroir frise), aperçus de déplacement (combat `hoverMove` / exploration
 * `explorePath`), grisage hors-LdV (`ghostIds`) et jauges EN DIRECT (hoverDelta).
 * Le curseur clavier/manette (combatCursor) PRIME sur la souris locale (hover) ET sur le survol de
 * frise (hoverCombatantId) — un seul réticule/aperçu à la fois.
 */
import { useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Scene } from '../../state/scene';
import { pathTo, type Pt } from '../../state/path';
import { exploreMoveDest } from '../../state/exploreNav';
import { maxJumpTiles } from '../../engine/movement';
import { effectiveMovement } from '../../engine/encumbrance';
import { isOutOfAction, canTakeAction, hasCondition } from '../../engine/conditions';
import { isFrenzied } from '../../engine/psychology';
import { combatantAtTile } from '../../state/combatGeometry';
import { controlsCombatant } from '../../state/netOwnership';
import { outOfSightTargetIds, castOutOfSightTargetIds, movePreviewAt, previewResourceDelta, frenzyTarget, hasFreeWeaponAttack } from '../../state/combatFlow';
import { hoverTargeting } from '../../state/targeting';

export interface HoverAim {
  fromId: string | null; // départ de la ligne (résolu en pixels au rendu — suit le glissement)
  toId: string;
  line: 'dashed' | 'solid' | null;
  /** Chemin RÉEL d'un déplacement combiné (Charge / rejoindre) — tracé à la place de la ligne droite. */
  path?: { x: number; y: number }[];
  /** Carte d'infobulle : nom / compétence + valeur / dégâts / manœuvre — ou erreur ⛔ courte. */
  tip: { kind: 'info'; title: string; skill: string; base: number; mod: number; dmg: number | null; note?: string } | { kind: 'err'; text: string } | null;
  /** Aperçu synthétisé (forme battle.preview) pour le clignotant des jauges (previewResourceDelta). */
  preview?: { kind: 'attack' | 'charge' | 'moveAttack'; targetId: string; path?: { x: number; y: number }[]; dest?: { x: number; y: number }; cost?: number; adv?: 0 | 1 };
  reticle: boolean;
}

export function useHoverTargeting(scene: Scene | null, hover: Pt | null, myTurn: boolean) {
  const mode = useGame((s) => s.mode);
  const battle = useGame((s) => s.battle);
  const dialogue = useGame((s) => s.dialogue);
  const partyPos = useGame((s) => s.partyPos);
  const party = useGame((s) => s.party);
  const combatCursor = useGame((s) => s.combatCursor);
  const hoverCombatantId = useGame((s) => s.hoverCombatantId);
  const setHovered = useGame((s) => s.setHovered);
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingCleave = useGame((s) => s.pendingCleave);
  const pendingDualStrike = useGame((s) => s.pendingDualStrike);
  const pendingTrample = useGame((s) => s.pendingTrample);
  const pendingHeal = useGame((s) => s.pendingHeal);
  const pendingDefense = useGame((s) => s.pendingDefense);

  // Signaux de survol EFFECTIFS : le curseur clavier/manette PRIME sur la souris locale (hover) ET sur
  // le survol de frise — la souris reprend la main dès qu'elle bouge (onPointerMove → clearCursor()).
  const effHover = combatCursor?.tile ?? hover;
  const effFocusId = combatCursor?.snappedId ?? hoverCombatantId;

  // Grisage hors-LdV : ennemis que le héros actif ne peut PAS viser au tir faute de Ligne de Vue
  // (LDB 13 l.123) → pion fantomatique. Distingue « hors LdV » de « hors de portée ». Actif pendant la
  // visée — mode neutre ou catégorie Tir ouverte — tant que l'Action n'est pas consommée.
  const ghostIds = useMemo<Set<string>>(() => {
    if (mode !== 'battle' || !battle || battle.over) return new Set();
    // Mode incantation : grisage hors-LdV du SORT (LDB 46 l.170), indépendant de l'arme portée.
    if (battle.action === 'cast' && battle.selectedSpellId) return castOutOfSightTargetIds(useGame.getState);
    if (battle.acted || battle.action !== null) return new Set();
    return outOfSightTargetIds(useGame.getState);
  }, [scene, mode, battle]);

  // Ciblage du JOUEUR au survol — rejoue les MÊMES prédicats que le clic : réticule présent = clic valide.
  const hoverAim = useMemo<HoverAim | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || (!effHover && !effFocusId) || !myTurn) return null;
    // Un jet à cible est déjà en cours (modale) : le réticule PERSISTANT prend le relais au rendu.
    if (pendingAttack || pendingDefense || pendingTrample || pendingHeal || (pendingCast && !pendingCast.pickingTargets)) return null;
    // Source du survol EFFECTIF : la cible aimantée du curseur (effFocusId) ou un PORTRAIT de frise
    // priment sur la tuile sous la souris (effHover) → réticule + infobulle identiques.
    const occ = effFocusId
      ? battle.combatants.find((c) => c.id === effFocusId && c.pos && !isOutOfAction(c))
      : effHover ? combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0) : null;
    if (!occ) return null;
    const st = useGame.getState;
    // Flux différés (bandeau TargetPrompt — Frappe Mortelle / 2ᵉ frappe / Surincantation +Cible) : le
    // réticule vient du MODE courant (targetingModes via hoverTargeting), AVANT les verrous acted/
    // Frénésie (ces ciblages surviennent APRÈS l'attaque-Action).
    if (pendingCleave || pendingDualStrike || pendingCast?.pickingTargets) {
      const actor = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
      if (!actor) return null;
      const ht = hoverTargeting(st, actor, occ);
      return ht.kind === 'ok' ? { fromId: actor.id, toId: occ.id, line: ht.line, tip: null, reticle: true } : null;
    }
    const activeH = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    if (!activeH || !controlsCombatant(st(), activeH) || !activeH.pos) return null;
    // Mêmes verrous que battleClickEntity : Action consommée (sauf attaque libre de Frénésie),
    // Sonné/Brisé, cible de Frénésie IMPOSÉE (le plus proche en LdV).
    const freeFrenzy = battle.action === null && hasFreeWeaponAttack(activeH);
    if (battle.acted && !freeFrenzy) return null;
    if (battle.action === null && (!canTakeAction(activeH) || hasCondition(activeH, 'brise'))) return null;
    if (battle.action === null && isFrenzied(activeH)) {
      const ft = frenzyTarget(st, activeH);
      if (ft && ft.id !== occ.id) return null;
    }
    // Piétinement / zone / mêlée : tout l'aperçu (réticule + chemin + tip) passe par hoverTargeting,
    // qui lit l'`AttackOption` armée (selectedAttack) — plus de branche par mode.
    const ht = hoverTargeting(st, activeH, occ);
    if (ht.kind === 'none') return null;
    if (ht.kind === 'invalid') {
      const text =
        ht.reason === 'los' ? '⛔ pas de ligne de vue'
        : ht.reason === 'engaged' ? '⛔ Engagé — se désengager'
        : ht.reason === 'unloaded' ? '⛔ Arme déchargée — recharger'
        : ht.reason === 'noammo' ? '⛔ Plus de munitions'
        : '⛔ hors de portée';
      return { fromId: null, toId: occ.id, line: null, tip: { kind: 'err', text }, reticle: false };
    }
    return { fromId: activeH.id, toId: occ.id, line: ht.line, path: ht.path, tip: { kind: 'info', title: ht.title, skill: ht.skill, base: ht.base, mod: ht.mod, dmg: ht.dmg, note: ht.note }, preview: ht.preview, reticle: true };
  }, [combatCursor, hover, hoverCombatantId, mode, battle, scene, myTurn, pendingAttack, pendingDefense, pendingCast, pendingCleave, pendingDualStrike, pendingTrample, pendingHeal]);

  // Combattant SOUS le focus (tuile survolée OU portrait de frise/Tab) — INDÉPENDANT du ciblage
  // (hoverAim exige Mon Tour + cible valide). Pilote le halo de focus du token ET, synchronisé au
  // store (`hovered`), le miroir réciproque sur la frise. Source unique du « qui est mis en évidence ».
  const hoveredId = useMemo<string | null>(() => {
    if (mode !== 'battle' || !battle) return null;
    const occ = effFocusId
      ? battle.combatants.find((c) => c.id === effFocusId && c.pos && !isOutOfAction(c))
      : effHover ? combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0) : null;
    return occ?.id ?? null;
  }, [combatCursor, mode, battle, hover, hoverCombatantId]);
  useEffect(() => { setHovered(hoveredId); }, [hoveredId, setHovered]);

  // Aperçu de DÉPLACEMENT au SURVOL (desktop) : le chemin + le coût se matérialisent sous la souris,
  // le clic UNIQUE commet — le tap-1 (battle.preview) reste le flux tactile. Mêmes sources que le clic.
  const hoverMove = useMemo<{ kind: 'move' | 'run'; path: { x: number; y: number }[]; cost: number } | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || !effHover || battle.preview || !myTurn) return null;
    if (pendingAttack || pendingDefense || pendingTrample || pendingHeal || pendingCast || pendingCleave || pendingDualStrike) return null;
    const occ = combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0);
    if (occ) return null; // une cible a sa propre visée (hoverAim)
    return movePreviewAt(useGame.getState, effHover);
  }, [combatCursor, hover, mode, battle, myTurn, pendingAttack, pendingDefense, pendingCast, pendingCleave, pendingDualStrike, pendingTrample, pendingHeal]);

  // Aperçu de DÉPLACEMENT au SURVOL hors combat : même calcul que le clic (moveAlong) — pathTo avec la
  // portée de saut du GROUPE. Memoïsé sur (hover, partyPos, scene) → le BFS ne tourne PAS à la frame.
  const explorePath = useMemo<Pt[] | null>(() => {
    if (mode !== 'exploration' || dialogue || !scene || !hover) return null;
    if (hover.x === partyPos.x && hover.y === partyPos.y && (hover.z ?? 0) === (partyPos.z ?? 0)) return null;
    // Même cible que le clic : un objet/PNJ interactif route vers une case adjacente (sa case est
    // souvent bloquée) — c'est ce qui rend l'aperçu visible au survol d'un objet.
    const dest = exploreMoveDest(scene, partyPos, hover);
    if (!dest) return null;
    const heroes = party.filter((h) => !h.dead && h.wounds.current > 0);
    const partyM = heroes.length ? Math.min(...heroes.map((h) => effectiveMovement(h))) : 0;
    const path = pathTo(scene, partyPos, dest, { blocked: new Set(), jump: maxJumpTiles(partyM) });
    return path && path.length >= 2 ? path : null;
  }, [hover, mode, dialogue, scene, partyPos, party]);

  // Jauges EN DIRECT (clignotant de l'ActiveFrame) : le coût/gain (Action/Mouvement/Avantage) de
  // l'intention SOUS LA SOURIS — un aperçu de la forme tap-1 est synthétisé du survol et passe par la
  // MÊME source (`previewResourceDelta`). Écrit au store seulement quand le delta CHANGE.
  useEffect(() => {
    const pvLike = hoverAim?.preview ?? (hoverMove && hover ? { kind: hoverMove.kind, tile: { ...hover }, path: hoverMove.path, cost: hoverMove.cost } : null);
    const delta = pvLike && battle ? previewResourceDelta({ ...battle, preview: pvLike as never }) : null;
    const cur = useGame.getState().hoverDelta;
    const same = (!delta && !cur) || (!!delta && !!cur && delta.action === cur.action && delta.move === cur.move && delta.adv === cur.adv);
    if (!same) useGame.setState({ hoverDelta: delta });
  }, [hoverAim, hoverMove, battle, hover]);

  return { hoverAim, hoveredId, hoverMove, explorePath, ghostIds, effHover };
}
