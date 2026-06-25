import { useState, useEffect, type ReactNode } from 'react';
import { hotbar } from '../state/hotbarBridge';
import { useGame, activeCombatant, entityPickables, movementRemaining, canMove } from '../state/store';
import { hasMeaningfulOption } from '../state/turnEconomy';
import { findSpellById } from '../data/index';
import { isArcaneSpell } from '../engine/magic';
import { actorHasSkill } from '../engine/skills';
import { dispellableSpellsOn } from '../engine/dispel';
import { formatSpellRange, formatSpellTarget, formatSpellDuration } from '../engine/spellRangeFormat';
import { canTakeAction, hasCondition, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzyCapable, isFrenzied } from '../engine/psychology';
import { isConsumable } from '../engine/consumables';
import { compatibleAmmo } from '../engine/items';
import { mdToText } from './Prose';
import { canPushback } from '../engine/qualities/dispatch';
import { hasHealSkill, healableTargets, availableHealModes } from '../engine/healing';
import { mountableNear } from '../state/mount';
import { shipOfCrew } from '../state/shipPostes';
import { isVehicle } from '../engine/vehicle';
import { controlsActive } from '../state/netOwnership';
import { aiDriven } from '../state/combatGate';
import type { Combatant } from '../engine/types';
import { HERO_RING, ENEMY_RING } from '../gameIso/teamColors';
import { TeamPortrait } from './TeamPortrait';
import { CharFrame } from './CharFrame';
import { previewResourceDelta, cleaveTargets, dualStrikeTargets, placingZoneOf, availableAttacks, hasFreeWeaponAttack } from '../state/combatFlow';
import { bonus, effectiveChar } from '../engine/characteristics';
import { ActiveFrame } from './ActiveFrame';
import { CodexRef } from './compendium/CodexRef';
import { ItemIcon } from './ItemIcon';

const bleedStacks = (c: Combatant) => c.conditions.find((x) => x.name === 'hemorragique')?.value ?? 0;

/** Descripteur d'une capacité de la barre : source du rendu ET du clavier (1-9 = n-ième slot). */
type HotbarSlot = { id: string; icon: ReactNode; label: ReactNode; title: string; cls?: string; disabled?: boolean; run: () => void };

/**
 * Barre d'action (hotbar) du combattant ACTIF, façon Baldur's Gate / NWN. Désencombrée :
 * le déplacement et l'attaque sont IMPLICITES au clic (case/ennemi) ; primaires directs
 * (Incanter/Soigner/Défensive) ; manœuvres situationnelles
 * repliées sous des catégories (Mouvement/Tir/Objets, idiome `ab-spells`, n'apparaissent que si
 * ≥1 enfant est dispo) ; la Détermination reste une ALERTE visible (États surgis à ne pas rater) ;
 * Piétiner/Frénésie = contextuels rares. Conçue pour s'étendre.
 */
export function ActionBar() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const selectAction = useGame((s) => s.battleSelectAction);
  const selectSpell = useGame((s) => s.battleSelectSpell);
  const focusSpell = useGame((s) => s.battleFocusSpell);
  const endTurn = useGame((s) => s.battleEndTurn);
  const defendTotal = useGame((s) => s.battleDefendTotal);
  const disengage = useGame((s) => s.battleDisengage);
  const mountUp = useGame((s) => s.battleMount);
  const dismount = useGame((s) => s.battleDismount);
  const useItem = useGame((s) => s.battleUseItem);
  const spendResolve = useGame((s) => s.battleSpendResolve);
  const resolvePsychImmune = useGame((s) => s.battleResolvePsychImmune);
  const resolveIgnoreCrit = useGame((s) => s.battleResolveIgnoreCrit);
  const frenzy = useGame((s) => s.battleFrenzy);
  const standUp = useGame((s) => s.battleStandUp);
  const pickup = useGame((s) => s.battlePickup);
  const reload = useGame((s) => s.battleReload);
  const battleShipManeuver = useGame((s) => s.battleShipManeuver);
  const recoverState = useGame((s) => s.battleRecoverState);
  const selectAmmo = useGame((s) => s.battleSelectAmmo);
  const aim = useGame((s) => s.battleAim);
  const togglePushback = useGame((s) => s.battleTogglePushback);
  const heal = useGame((s) => s.battleHeal);
  const dispelSpell = useGame((s) => s.battleDispelSpell);
  const selectAttack = useGame((s) => s.battleSelectAttack);
  const maneuverArea = useGame((s) => s.battleManeuverArea);
  const cancelMove = useGame((s) => s.cancelMove);
  const switchLoadout = useGame((s) => s.battleSwitchLoadout);
  const scene = useGame((s) => s.scene);
  const flags = useGame((s) => s.flags);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  const confirmRoundStart = useGame((s) => s.confirmRoundStart);
  const net = useGame((s) => s.net);
  // Interludes de ciblage par carte : la barre SE TRANSFORME (cf. plus bas) au lieu de rester cliquable.
  const pendingCleave = useGame((s) => s.pendingCleave);
  const pendingDualStrike = useGame((s) => s.pendingDualStrike);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingAttack = useGame((s) => s.pendingAttack);
  const cleaveEnd = useGame((s) => s.cleaveEnd);
  const dualStrikeSkip = useGame((s) => s.dualStrikeSkip);
  const pickTargets = useGame((s) => s.castPickTargets);
  const placeZone = useGame((s) => s.castPlaceZone);
  // Coût/gain de l'intention SOUS LA SOURIS (desktop) — posé par IsoStage, même source que le tap-1.
  const hoverDelta = useGame((s) => s.hoverDelta);
  const roundStartReady = useGame((s) => s.roundStartReady);
  // Garde-fou « tour gâché » (R6) : confirmation à 2 clics avant de finir avec une Action non dépensée.
  // Réinitialisé à chaque changement de tour/Round.
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Repli du menu « Manœuvre ▾ » (état UI local, comme l'ouverture d'un sous-menu) ; refermé au tour/round.
  const [showManeuvers, setShowManeuvers] = useState(false);
  useEffect(() => { setConfirmEnd(false); setShowManeuvers(false); }, [battle?.turn, battle?.round]);
  if (!battle || battle.over) return null;
  // Début de Round (LDB ch.17 l.27) : pause d'initiative à CHAQUE Round — la barre d'action est remplacée par
  // un seul bouton. On voit l'ordre (frise) et le champ, et on peut dépenser sa Chance pour agir en premier
  // (canActFirst) avant de lancer. Au Round 1 c'est l'ouverture du combat (« Commencer le combat »).
  if (pendingRoundStart) {
    const first = pendingRoundStart.round <= 1;
    // COOP : ready-check d'ouverture — chaque joueur valide ; portraits + ✓ au-dessus de la barre
    // (spec §4bis). L'hôte lance automatiquement quand tous les sièges requis ont validé.
    if (net.mode !== 'local') {
      const ready = pendingRoundStart.readyBySeat ?? {};
      const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
      const firstHeroOf = (seat: number) => party.find((h) => !h.dead && (net.ownership[h.id] ?? 0) === seat);
      return (
        <div className="action-bar establishing-bar coop-ready">
          <div className="ready-row">
            {seats.map(({ seat, name }) => {
              const h = firstHeroOf(seat);
              return (
                <span key={seat} className={`ready-chip${ready[seat] ? ' ok' : ''}`} title={name}>
                  {h ? <TeamPortrait combatant={h} size={28} /> : <span className="ready-noportrait">👤</span>}
                  {ready[seat] ? '✓' : '…'}
                </span>
              );
            })}
          </div>
          <button className="btn btn-primary commencer-btn" disabled={!!ready[net.mySeat]} onClick={() => roundStartReady(net.mySeat)}>
            {ready[net.mySeat] ? '⏳ En attente des autres…' : '⚔️ Prêt'}
          </button>
        </div>
      );
    }
    return (
      <div className="action-bar establishing-bar">
        <button className="btn btn-primary commencer-btn" onClick={confirmRoundStart}>
          {first ? '⚔️ Commencer le combat' : `▶️ Commencer le round ${pendingRoundStart.round}`}
        </button>
      </div>
    );
  }
  const active = activeCombatant(battle);
  if (!active) return null;

  // COOP : le combattant actif appartient à un AUTRE joueur → barre spectateur (pas de contrôles).
  if (active.kind === 'hero' && !controlsActive(useGame.getState())) {
    const seat = net.ownership[active.id] ?? 0;
    return (
      <div className="action-bar establishing-bar">
        <span className="ready-chip">⏳ {net.seatNames[seat] ?? 'L’hôte'} joue {active.name}…</span>
      </div>
    );
  }

  // INTERLUDE de ciblage par carte (Frappe Mortelle / 2ᵉ frappe / Surincantation +Cible / pose de
  // zone) : la barre SE TRANSFORME — même dock que « Commencer le combat » — au lieu de laisser
  // les contrôles cliquables (changer d'intention au milieu d'un flux différé corromprait l'état,
  // garde-fou store `combatBusy` en profondeur). La sortie du flux vit ici, à droite.
  const interlude = (() => {
    if (pendingCleave && !pendingAttack) {
      const atk = battle.combatants.find((c) => c.id === pendingCleave.attackerId);
      if (!atk) return null;
      const left = cleaveTargets(battle, atk, pendingCleave.hitIds).length;
      return {
        icon: '⚔️', title: 'Frappe Mortelle',
        badge: left ? `enchaînement ${pendingCleave.count + 1}/${bonus(effectiveChar(atk, 'CC'))}` : 'plus d’adversaire à portée',
        exit: { label: 'Terminer', onClick: cleaveEnd, primary: !left },
      };
    }
    if (pendingDualStrike && !pendingAttack) {
      const atk = battle.combatants.find((c) => c.id === pendingDualStrike.attackerId);
      const off = atk?.weapons.find((w) => w.uid === pendingDualStrike.offWeaponUid);
      if (!atk || !off) return null;
      const left = dualStrikeTargets(battle, atk, off).length;
      return {
        icon: '⚔️', title: 'Des deux armes',
        badge: left ? `2ᵉ frappe — ${off.name}` : 'plus d’adversaire à portée',
        exit: { label: 'Renoncer', onClick: dualStrikeSkip, primary: !left },
      };
    }
    if (pendingCast?.pickingTargets) {
      return {
        icon: '🎯', title: 'Surincantation',
        badge: `${pendingCast.extraTargetIds?.length ?? 0}/${pendingCast.overcast?.targets ?? 0} cibles`,
        exit: { label: 'Valider', onClick: () => pickTargets(false), primary: true },
      };
    }
    const pz = placingZoneOf({ pendingCast, battle });
    if (pz) {
      const d = pz.radius * 2 + 1;
      return {
        icon: '🌀', title: pz.label, badge: `gabarit ${d}×${d}`,
        exit: { label: '↩ Modale', onClick: () => placeZone(false), primary: false },
      };
    }
    // Ciblage de BORDÉE (navire) : la barre se transforme — on désigne le navire à canonner (le bord est auto).
    if (battle.action === 'battery') {
      return {
        icon: '🎯', title: 'Bordée',
        badge: 'Désignez le navire à canonner — bord auto',
        exit: { label: '↩ Annuler', onClick: () => selectAction(null), primary: false },
      };
    }
    return null;
  })();
  if (interlude) {
    return (
      <div className="action-bar targeting-interlude">
        <span className="ti-icon">{interlude.icon}</span>
        <span className="ti-title">{interlude.title}</span>
        <span className="ti-badge">{interlude.badge}</span>
        <button className={`btn small ${interlude.exit.primary ? 'btn-primary' : 'btn-ghost'}`} onClick={interlude.exit.onClick}>
          {interlude.exit.label}
        </button>
      </div>
    );
  }

  // Un héros PILOTÉ PAR L'IA (Auto-combat) n'est pas contrôlable par le joueur → on rend la MÊME barre
  // que pour un ennemi (aucun contrôle : le joueur regarde). En Rapide, le héros reste contrôlable (seuls
  // les jets s'auto-résolvent) ; en Auto, l'IA joue → barre « ennemie ». `isHero` gate TOUS les contrôles.
  const playerControlled = active.kind === 'hero' && !aiDriven(useGame.getState(), active);
  // Un NAVIRE-coque contrôlé par le joueur (échelle Mer) n'est PAS un fantassin : il a ses propres Actions
  // (Tests d'équipage : Manœuvrer / Bordée / Éperonner), pas marche/sort/mêlée. On sépare les deux barres.
  const isShip = playerControlled && isVehicle(active);
  const isHero = playerControlled && !isVehicle(active);
  const loadouts = active.loadouts ?? []; // sets d'armes basculables en combat (≥2 → commutateur)
  // Mouvement DÉCOMPOSABLE (mais non entrelacé avec l'Action) : cases encore disponibles ce Tour (0 = épuisé).
  // `canMoveNow` applique aussi la règle M-A-M (pas de Mouvement après une Action déjà précédée de Mouvement).
  // Les manœuvres « plein Mouvement » (Charge/Course/Monter/Descendre/Se relever) exigent `movementUsed === 0`.
  const moveLeft = isHero ? movementRemaining(battle, active) : 0;
  const moveStarted = battle.movementUsed > 0; // au moins un segment de Mouvement déjà parcouru
  const moveMax = isHero ? moveLeft + battle.movementUsed : 0; // budget total de cases ce Tour (barre à crans)
  const canMoveNow = isHero && canMove(battle, active); // respecte aussi la règle M-A-M
  const hasSpells = isHero && (active.spells?.length ?? 0) > 0;
  const stunned = !canTakeAction(active); // Sonné : aucune Action ce tour, seul le déplacement (à demi-Mouvement)
  const engaged = isHero && isEngaged(active); // Engagé : pas de déplacement libre ni de Charge (LDB 15-Dépl)
  // Désengagement GRATUIT (option A, LDB 15 l.87) : Avantage strictement supérieur à tous les foes
  // Engagés → possible MÊME après avoir agi (ne coûte pas l'Action) ; rouvre le mouvement.
  const engagedFoes = engaged ? (active.engagedWith ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c && !isOutOfAction(c)) : [];
  const canFreeDisengage = engagedFoes.length > 0 && active.advantage > Math.max(0, ...engagedFoes.map((f) => f.advantage));
  // Combat monté (LDB 14) : descendre si à cheval ; enfourcher une monture libre adjacente (coûte l'Action).
  const mounted = isHero && !!active.mountId;
  const mountCandidate = isHero && !active.mountId && !moveStarted ? mountableNear(battle, active) : undefined; // enfourcher = plein Mouvement (pas de jet → pas une Action)
  const prone = isHero && hasCondition(active, 'a-terre'); // À Terre (LDB 16 l.37) : ni Charge ni Course
  const broken = isHero && hasCondition(active, 'brise'); // Brisé (LDB 16 l.55) : fuir/se cacher uniquement, aucune action offensive
  const entangled = isHero && hasCondition(active, 'empetre'); // Empêtré (LDB 16 l.61) : se libérer (Action, Test opposé de Force)
  const onFire = isHero && hasCondition(active, 'en-flammes'); // En flammes (LDB 16 l.77) : se rouler (Action, Test d'Athlétisme)
  // Déplacement, Attaque, Charge et Course n'ont PLUS de bouton : implicites au clic (sol/ennemi).
  // La Charge se déclenche d'elle-même (mêlée + non Engagé + Mouvement intact — LDB 15 l.74-77) ;
  // la Course est la zone violette au-delà de la Marche (clic → Test d'Athlétisme, LDB 15 l.79-82).
  // Se relever (LDB 16 l.37) : possible si À Terre, ≥1 PB (LDB 18 l.28) et Mouvement non entamé.
  const canStandUp = prone && active.wounds.current > 0 && !moveStarted;
  // Liste d'ATTAQUES activables (« Attaque ▾ ») : l'Arme du Set actif + les attaques gratuites/zone d'un
  // trait de créature (Morsure/Caudale/Tentacule/Souffle…) + Piétinement (Taille) + mutation Tentacule.
  // Source UNIQUE : availableAttacks (combatFlow). Sélectionner arme `selectedAttack` ; le clic-ennemi
  // résout l'attaque armée (approche-puis-frappe). La hotbar ne fait que rendre ces descripteurs.
  const attacks = isHero ? availableAttacks(active, battle) : [];
  // Frénésie (LDB 21 l.31-32) : un héros capable peut tenter d'entrer en Frénésie (Test de FM, coûte l'Action).
  const canFrenzy = isHero && isFrenzyCapable(active) && !isFrenzied(active) && !battle.acted && !stunned;
  // Frénésie : l'attaque d'Arme gratuite (talent, LDB 21 l.34) reste possible même l'Action dépensée (donnée).
  const freeFrenzy = isHero && hasFreeWeaponAttack(active);
  // Frénésie (LDB 21 l.34) : « La seule Action possible est un Test de Capacité de Combat ou un Test
  // d'Athlétisme » + « sous aucun prétexte vous ne fuirez, ni ne battrez en retraite » → en Frénésie,
  // la hotbar masque Incanter/Soigner/Défensive/Tir/Objets/Se désengager (restent : attaque au clic,
  // Course vers la cible, Se relever, Piétiner, Détermination — qui ne coûte pas l'Action).
  const frenzied = isHero && isFrenzied(active);
  // Jauge d'Action : 1 Action de base (+1 attaque gratuite si frénétique). Pleins = encore disponibles.
  const actMax = 1 + (isFrenzied(active) ? 1 : 0);
  const actAvail = (battle.acted ? 0 : 1) + (freeFrenzy ? 1 : 0);
  // Coût/gain de l'INTENTION en cours : aperçu tap-1 (tactile) prioritaire, sinon SURVOL (desktop,
  // hoverDelta posé par IsoStage) — même source previewResourceDelta, les jauges clignotent pareil.
  const tapDelta = previewResourceDelta(battle);
  const previewDelta = tapDelta.action || tapDelta.move || tapDelta.adv ? tapDelta : hoverDelta ?? tapDelta;
  const heroIdx = party.findIndex((h) => h.id === active.id);
  const ring = heroIdx >= 0 ? HERO_RING[heroIdx % HERO_RING.length] : ENEMY_RING;
  // « Assailli ×N » : ennemis (en vie) au contact du héros actif — indice visuel, pas un modificateur.
  const assailliN = isHero && active.pos
    ? battle.combatants.filter((c) => c.kind !== 'hero' && !isOutOfAction(c) && c.pos && Math.max(Math.abs(c.pos.x - active.pos!.x), Math.abs(c.pos.y - active.pos!.y)) <= 1).length
    : 0;

  // Consommables utilisables du combattant actif, groupés par nom (plusieurs potions → ×N).
  const usable = isHero ? (active.items ?? []).filter(isConsumable) : [];
  const usableGroups = Object.values(
    usable.reduce<Record<string, { name: string; uids: string[]; desc?: string }>>((acc, it) => {
      (acc[it.name] ??= { name: it.name, uids: [], desc: it.desc ?? undefined }).uids.push(it.uid);
      return acc;
    }, {}),
  );

  // Détermination (Resolve) : États retirables de l'actif (LDB ch.17 l.62-66).
  const resolve = isHero ? active.resolve ?? 0 : 0;
  const removableConditions = isHero && resolve > 0 ? active.conditions : [];
  // Économie du tour (R6) : reste-t-il une option utile ? sinon « Fin du tour » pulse (nudge). Finir avec
  // l'Action non dépensée = gros gâchis → confirmation à 2 clics.
  const meaningfulLeft = isHero && hasMeaningfulOption(active, battle);
  const wastingAction = isHero && !battle.acted && canTakeAction(active);
  const onEndTurn = () => {
    if (wastingAction && !confirmEnd) { setConfirmEnd(true); return; }
    setConfirmEnd(false);
    endTurn();
  };
  // Objets au sol ramassables sur/adjacents à la case du combattant actif (décor `prop` interactif).
  const groundItems =
    isHero && active.pos
      ? (scene?.entities ?? [])
          .filter(
            (e) =>
              e.kind === 'prop' && !!e.interact &&
              Math.max(Math.abs(e.pos.x - active.pos!.x), Math.abs(e.pos.y - active.pos!.y)) <= 1 &&
              !flags[`__fouille_${e.id}`],
          )
          .flatMap((e) => entityPickables(e).map((p) => ({ entityId: e.id, ...p })))
      : [];

  // Tir : arme à distance active, son rechargement (défaut Recharge uniquement) et ses munitions compatibles.
  const rangedW = isHero ? active.weapons.find((w) => w.type === 'ranged') : undefined;
  const needsReload = !!rangedW && (rangedW.reload ?? 0) > 0 && !active.loaded; // l'Arc (reload 0) ne recharge jamais
  const ammoChoices = isHero && rangedW ? compatibleAmmo(active, rangedW) : [];
  // Perturbante (LDB 62 l.275-276) : mode « Repousser » disponible avec une arme de mêlée Perturbante.
  const canPush = isHero && active.weapons.some((w) => w.type === 'melee' && canPushback(w));

  // Guérison (LDB 09-Compétences) : soi + alliés (héros) adjacents soignables, si le héros a la Compétence.
  const canHeal = isHero && hasHealSkill(active) && !battle.acted && !stunned && !frenzied;
  const healTargets = canHeal ? healableTargets(active, battle.combatants.filter((c) => c.kind === 'hero'), { adjacency: true }) : [];
  // Dissipation (LDB 46 l.204-207) : le héros actif possède Langue (Magick) ET ≥ 1 sort permanent est actif.
  const canDispel = isHero && actorHasSkill(active, 'langue', 'Magick');
  const dispellable = canDispel ? dispellableSpellsOn(battle.combatants) : [];

  // ── Capacités de la barre, DATA-DRIVEN : UNE liste de descripteurs, source du rendu ET des
  // raccourcis clavier 1-9 (positionnels, rien en dur). Construite au tour d'un héros, publiée au pont. ──
  // Manœuvre navale (MDG ch.13) : un héros membre de l'équipage d'un navire peut prendre la barre (Test de Navigation).
  const shipSupport = isHero ? shipOfCrew(battle.combatants, active.id) : undefined;
  const slots: HotbarSlot[] = [];
  if (isHero) {
    if (moveStarted && !battle.acted) slots.push({ id: 'undo-move', cls: 'ab-undo', icon: '↩️', label: 'Annuler dépl.', title: "Annuler tout le déplacement de ce tour et revenir au point de départ (possible tant qu'aucune Action n'est prise)", run: cancelMove });
    if (hasSpells && !frenzied) slots.push({ id: 'cast', cls: battle.action === 'cast' ? 'on' : '', disabled: battle.acted || stunned || broken, icon: '✨', label: `Incanter${battle.acted ? ' ✓' : ''}`, title: "Incanter un sort (Test de Langage mystique) — coûte l'Action", run: () => selectAction(battle.action === 'cast' ? null : 'cast') });
    if (canHeal && healTargets.length > 0) slots.push({ id: 'heal', cls: battle.action === 'heal' ? 'on' : '', disabled: battle.acted || stunned || broken, icon: '🩹', label: 'Soigner', title: "Soigner (Compétence Guérison) : rend des PB ou stoppe une hémorragie — coûte l'Action", run: () => selectAction(battle.action === 'heal' ? null : 'heal') });
    if (canDispel && dispellable.length > 0 && !frenzied) slots.push({ id: 'dispel', cls: battle.action === 'dispel' ? 'on' : '', disabled: battle.acted || stunned || broken, icon: '🌀', label: `Dissiper${battle.acted ? ' ✓' : ''}`, title: "Dissiper un sort permanent (Test étendu de Langue (Magick) → NI) — coûte l'Action chaque Round", run: () => selectAction(battle.action === 'dispel' ? null : 'dispel') });
    if (!frenzied) slots.push({ id: 'defend', disabled: battle.acted || stunned || broken, icon: '🛡️', label: `Défensive${battle.acted ? ' ✓' : ''}`, title: '+20 à tous vos Tests de défense jusqu’à votre prochain tour', run: defendTotal });
    if (onFire) slots.push({ id: 'roll-fire', disabled: battle.acted || stunned, icon: '🔥', label: `Se rouler${battle.acted ? ' ✓' : ''}`, title: "Se rouler au sol pour éteindre les flammes (Test d'Athlétisme — coûte l'Action)", run: () => recoverState('en-flammes') });
    if (entangled) slots.push({ id: 'free-entangle', disabled: battle.acted || stunned, icon: '🪢', label: `Se libérer${battle.acted ? ' ✓' : ''}`, title: "Se libérer de l'entrave (Test opposé de Force contre la source — coûte l'Action)", run: () => recoverState('empetre') });
    if (canStandUp) slots.push({ id: 'stand', icon: '🧍', label: 'Se relever', title: "Se relever de l'État À Terre — utilise le Mouvement", run: standUp });
    if (engaged && !frenzied) slots.push({ id: 'disengage', disabled: battle.acted && !canFreeDisengage, icon: '🚪', label: 'Se désengager', title: "Quitter le corps à corps (Esquive si Action dispo, sinon sacrifice d'Avantage)", run: disengage });
    if (mountCandidate) slots.push({ id: 'mount', disabled: moveStarted || broken, icon: '🐎', label: 'Monter', title: `Enfourcher ${mountCandidate.name} (combat monté) — coûte le Mouvement`, run: mountUp });
    if (mounted) slots.push({ id: 'dismount', disabled: moveStarted || broken, icon: '🥾', label: 'Descendre', title: 'Descendre de sa monture — coûte le Mouvement', run: dismount });
    if (shipSupport) slots.push({ id: 'maneuver-ship', disabled: battle.acted || stunned || broken, icon: '🧭', label: `Manœuvrer${battle.acted ? ' ✓' : ''}`, title: `Prendre la barre de ${shipSupport.name} : virer le cap (Test de Navigation — coûte l'Action)`, run: () => battleShipManeuver(active.id) });
    if (rangedW && !frenzied) slots.push({ id: 'aim', disabled: battle.acted || stunned || active.aiming, icon: '🎯', label: active.aiming ? 'En joue ✓' : 'Viser', title: "Viser : +20 (Accessible) au prochain tir — coûte l'Action", run: aim });
    if (canPush) slots.push({ id: 'pushback', icon: '↩️', label: active.pushbackMode ? 'Repousser ✓' : 'Repousser', title: "Perturbante : la prochaine attaque réussie repousse d'1 m par DR au lieu de causer des Dégâts", run: togglePushback });
    if (needsReload && !frenzied) slots.push({ id: 'reload', cls: `ab-alert${!battle.acted && !stunned && !broken ? ' pulse' : ''}`, disabled: battle.acted || stunned || broken, icon: '🔄', label: `Recharger${active.reloadProgress ? ` (${active.reloadProgress}/${rangedW.reload})` : ''}`, title: "Arme déchargée : recharger (Test étendu de Projectiles — coûte l'Action)", run: reload });
    if (ammoChoices.length > 1 && !frenzied) slots.push({ id: 'ammo', cls: battle.action === 'ammo' ? 'on' : '', icon: '🏹', label: 'Munition ▾', title: 'Choisir la munition à tirer', run: () => selectAction(battle.action === 'ammo' ? null : 'ammo') });
    if (canFrenzy) slots.push({ id: 'frenzy', icon: '🐗', label: 'Frénésie', title: "Entrer en Frénésie : Test de Force Mentale — coûte l'Action", run: frenzy });
    if (attacks.length > 1) slots.push({ id: 'attacks', cls: showManeuvers || (battle.action === null && (battle.selectedAttack ?? 'arme') !== 'arme') ? 'on' : '', icon: '⚔️', label: 'Attaque ▾', title: "Choisir l'attaque (arme ou attaque spéciale d'un trait de créature)", run: () => setShowManeuvers((v) => !v) });
    if (!frenzied) for (const g of usableGroups) {
      const it = active.items?.find((i) => i.uid === g.uids[0]);
      slots.push({ id: `item-${g.name}`, disabled: battle.acted || stunned || broken, icon: it ? <ItemIcon item={it} size={22} /> : '🧪', label: `${g.name}${g.uids.length > 1 ? ` ×${g.uids.length}` : ''}`, title: (g.desc ? mdToText(g.desc) : '') || `Utiliser ${g.name}`, run: () => useItem(g.uids[0]) });
    }
    if (!frenzied) for (const g of groundItems) slots.push({ id: `pickup-${g.entityId}:${g.key}`, disabled: battle.acted || stunned || broken, icon: '✋', label: g.label, title: "Ramasser cet objet au sol (coûte l'Action)", run: () => pickup(g.entityId, g.key) });
    if (removableConditions.length > 0) slots.push({ id: 'resolve', cls: `ab-alert ${battle.action === 'resolve' ? 'on' : ''}`, icon: '✊', label: `Détermination (${resolve})`, title: "Détermination : retirer un État (ne coûte pas l'Action)", run: () => selectAction(battle.action === 'resolve' ? null : 'resolve') });
    if (net.mode !== 'local') slots.push({ id: 'raise-hand', cls: battle.handRaised ? 'on' : '', disabled: !!battle.handRaised, icon: '✋', label: battle.handRaised ? 'Pause demandée' : 'Pause Round', title: 'Demander la pause au prochain début de Round (fenêtre Chance « agir en premier »)', run: () => useGame.getState().raiseHand() });
    slots.push({ id: 'end-turn', cls: `ab-end ${!meaningfulLeft ? 'pulse' : ''} ${confirmEnd ? 'warn' : ''}`, icon: confirmEnd ? '⚠️' : '⏭️', label: confirmEnd ? 'Finir quand même ?' : 'Fin du tour', title: confirmEnd ? 'Tu n’as pas encore agi ce tour — clique encore pour finir quand même' : !meaningfulLeft ? 'Plus rien à faire ce tour' : 'Finir le tour', run: onEndTurn });
  }
  if (isShip) {
    // Tour du NAVIRE (couche Mer) : Action = Test d'ÉQUIPAGE. Manœuvrer = le barreur vire le cap (Test de
    // Navigation) puis le navire avance le long du cap (l'éperonnage se résout si une coque est devant).
    // Bordée = Test d'équipage des Artilleurs : on désigne un navire ennemi, le bord qui porte est dérivé de la
    // cible (`targetArc`) et toutes ses pièces font feu au DR partagé (MDG ch.14 l.128). (IA navire → `shipAI`.)
    slots.push({ id: 'maneuver-ship', disabled: battle.acted, icon: '🧭', label: `Manœuvrer${battle.acted ? ' ✓' : ''}`, title: `Manœuvrer ${active.name} : le barreur vire le cap (Test de Navigation) ; la coque avance — coûte l'Action du navire`, run: () => battleShipManeuver(active.id) });
    if ((active.postes ?? []).length > 0)
      slots.push({ id: 'battery', cls: battle.action === 'battery' ? 'on' : '', icon: '🎯', label: 'Bordée', title: `Lâcher une bordée : désignez un navire ennemi — le DR du Test d'équipage des Artilleurs s'applique à toutes les pièces du bord qui porte (MDG ch.14)`, run: () => selectAction(battle.action === 'battery' ? null : 'battery') });
    slots.push({ id: 'end-turn', cls: 'ab-end', icon: '⏭️', label: 'Fin du tour', title: `Finir le tour de ${active.name}`, run: onEndTurn });
  }
  hotbar.slots = slots.map((s) => ({ run: s.run, disabled: s.disabled })); // pont clavier (1-9 = n-ième slot) — cf. hotbarBridge

  return (
    <div className="action-bar">
      {hasSpells && battle.action === 'cast' && !pendingCast && (
        <div className="ab-spells">
          {active.spells!.map((spellId) => {
            const spell = findSpellById(spellId);
            if (!spell) return null;
            const label = spell.label; // libellé pour l'affichage (boutons, Codex) — l'identité passe par l'id
            const selected = battle.selectedSpellId === spell.id;
            const ni = spell.cn != null ? `NI ${spell.cn}` : 'Prière';
            const canFocus = isArcaneSpell(spell) && (spell.cn ?? 0) > 0;
            const focusDr = active.focus?.spell === spell.id ? active.focus.dr : null;
            // Découvrabilité (R4) : portée / durée / cibles d'un sort, AVANT de l'incanter — prose DÉRIVÉE
            // de la donnée structurée (spellRangeFormat, source unique de l'affichage).
            const rangeLabel = spell.range ? formatSpellRange(spell.range) : '—';
            const tgtLabel = spell.target ? formatSpellTarget(spell.target) : '—';
            const durLabel = spell.duration ? formatSpellDuration(spell.duration) : '—';
            const meta = `📏 ${rangeLabel} · ⏳ ${durLabel} · 🎯 ${tgtLabel}`;
            return (
              <div key={spellId} className="ab-spell-row">
                <button className={`btn btn-sm ${selected ? 'btn-primary' : ''}`} onClick={() => selectSpell(spell.id)}>
                  {spell.label} <span className="bp-spell-ni">({ni})</span>
                  <span className="ab-spell-meta">{meta}</span>
                </button>
                <CodexRef category="spells" label={label} className="ab-codex-info">ℹ️</CodexRef>
                {canFocus && (
                  <button className="btn btn-sm" onClick={() => focusSpell(spell.id)} title="Test étendu de Focalisation">
                    Focaliser{focusDr != null ? ` (${focusDr}/${spell.cn})` : ''}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {battle.action === 'dispel' && (
        <div className="ab-spells">
          {dispellable.length === 0 && <div className="ab-hint">Aucun sort permanent à dissiper.</div>}
          {dispellable.map((d) => {
            const prog = active.dispel?.spellId === d.spellId && active.dispel.spellCasterId === d.casterId ? active.dispel.total : 0;
            return (
              <div key={`${d.spellId}@${d.casterId}`} className="ab-spell-row">
                <button className="btn btn-sm" onClick={() => dispelSpell(d.spellId, d.casterId)} title="Test étendu de Langue (Magick) — coûte l'Action chaque Round">
                  🌀 {d.label} <span className="bp-spell-ni">(NI {d.ni})</span>{prog > 0 ? ` — ${prog}/${d.ni} DR` : ''}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {battle.action === 'heal' && (
        <div className="ab-spells">
          {healTargets.length === 0 && <div className="ab-hint">Aucune cible à portée.</div>}
          {/* #20 : choisir QUI soigner par son PORTRAIT (puis le mode : Blessures / Hémorragie). */}
          {healTargets.map((t) => (
            <div key={t.id} className="ab-heal-pick">
              <CharFrame c={t} variant="full" size="md" />
              {availableHealModes(t).filter((m) => m !== 'trauma' && m !== 'surgery').map((m) => ( // convalescence/chirurgie = hors combat
                <button key={m} className="btn btn-sm" onClick={() => heal(t.id, m)} title="Test de Guérison Intermédiaire (+0) — coûte l'Action">
                  {m === 'wounds' ? '🩹 Blessures' : `🩸 Hémorragie ×${bleedStacks(t)}`}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {battle.action === 'ammo' && (
        <div className="ab-spells">
          {ammoChoices.map((a) => (
            <div key={a.uid} className="ab-spell-row">
              <button className={`btn btn-sm ${active.ammoUid === a.uid ? 'btn-primary' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => selectAmmo(a.uid)}><ItemIcon item={a} size={18} /> {a.name} ×{a.qty}</button>
              <CodexRef category="trappings" label={a.name} className="ab-codex-info" hideIfUnknown>ℹ️</CodexRef>
            </div>
          ))}
        </div>
      )}
      {showManeuvers && attacks.length > 1 && (
        <div className="ab-spells">
          {attacks.map((o) => {
            const armed = battle.action === null && (battle.selectedAttack ?? 'arme') === o.id;
            const immediate = o.id === 'hurlement'; // Hurlement : tous les ennemis à I mètres → résolution directe
            const onClick = () => {
              if (immediate) { maneuverArea('hurlement'); setShowManeuvers(false); return; }
              selectAttack(o.id); // arme l'attaque → le clic-ennemi l'exécute (approche-puis-frappe)
            };
            return (
              <div key={o.id} className="ab-spell-row">
                <button className={`btn btn-sm ${armed ? 'btn-primary' : ''}`} onClick={onClick}>
                  {o.icon} {o.label}{o.cost.advantage > 0 ? ` · ${o.cost.advantage} Av` : ''}{!immediate ? ' 🎯' : ''}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {battle.action === 'resolve' && resolve > 0 && (
        <div className="ab-spells">
          <div className="ab-spell-row">
            <button className="btn btn-sm" onClick={resolvePsychImmune} title="Détermination : immunisé à la Psychologie jusqu'à la fin du prochain Round">
              🛡️ Immunité Psychologie (ce Round + le prochain)
            </button>
          </div>
          {(active.traumas?.length ?? 0) > 0 && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={resolveIgnoreCrit} title="Détermination : ignorer les modificateurs de Blessure critique ce Round">
                🩹 Ignorer modifs de critique (ce Round)
              </button>
            </div>
          )}
          {removableConditions.map((c) => (
            <div key={c.name} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => spendResolve(c.name)} title="Dépense un point de Détermination pour retirer cet État">
                ✊ Retirer {c.name}{c.value > 1 ? ` (${c.value})` : ''}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ab-bar">
        <div className="ab-actor">
          {/* Cadre du combattant ACTIF : Action verticale | portrait | Mouvement vertical ; dessous vie
              (continue) puis Avantage (10 crans fixes). Jauges à taille fixe découpées en crans égaux. */}
          <ActiveFrame
            c={active} ring={ring} isHero={isHero}
            actAvail={actAvail} actMax={actMax} moveLeft={moveLeft} moveMax={moveMax}
            spendAction={previewDelta.action} spendMove={previewDelta.move} gainAdv={previewDelta.adv}
            title={active.career ? `${active.name} — ${active.career}` : active.name}
          />
          <div className="ab-actor-side">
            {/* Le NOM n'est plus affiché (dispo au survol du portrait / du pion). */}
            {(assailliN >= 2 || (isHero && battle.fearGate === 'failed')) && (
              <div className="ab-actor-top">
                {assailliN >= 2 && <span className="ab-assailli" title={`${assailliN} ennemis au contact`}>⚔️ ×{assailliN}</span>}
                {isHero && battle.fearGate === 'failed' && (
                  <span className="ab-assailli" title="Test de Calme d'approche raté : impossible de se rapprocher de la source de sa Peur ce Tour">😨 Cloué</span>
                )}
              </div>
            )}
            {/* Commutateur de set d'armes (1 switch gratuit/tour, même Engagé — LDB 13 l.116). */}
            {isHero && loadouts.length >= 2 && (
              <div className="ab-loadouts" title={battle.loadoutSwapped ? 'Set d’armes déjà changé ce tour' : 'Changer de set d’armes (gratuit, 1/tour)'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="ab-loadouts-ico">🗡</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {loadouts.map((lo) => {
                    const mainItem = lo.main ? active.items?.find((i) => i.uid === lo.main) : undefined;
                    const offItem = lo.off ? active.items?.find((i) => i.uid === lo.off) : undefined;
                    return (
                      <button
                        key={lo.id}
                        className={`btn btn-sm ${active.activeLoadoutId === lo.id ? 'btn-primary' : ''}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 5px' }}
                        disabled={!!battle.loadoutSwapped && active.activeLoadoutId !== lo.id}
                        title={`Set : ${mainItem?.name ?? 'mains nues'}${offItem ? ` + ${offItem.name}` : ''}`}
                        onClick={() => switchLoadout(lo.id)}
                      >
                        {mainItem ? <ItemIcon item={mainItem} size={20} /> : <span aria-hidden style={{ fontSize: 16 }}>✊</span>}
                        {offItem && <ItemIcon item={offItem} size={14} />}
                      </button>
                    );
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {isHero || isShip ? (
          <div className="ab-slots">
            {slots.map((s, i) => (
              <button key={s.id} className={'ab-slot ' + (s.cls ?? '')} disabled={s.disabled} onClick={s.run} title={s.title}>
                {i < 9 && <span className="ab-key">{i + 1}</span>}
                <span className="ab-ico">{s.icon}</span>
                <span className="ab-lbl">{s.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ab-enemy">⚔️ {active.kind === 'enemy' ? 'Tour de l’ennemi' : `L’IA joue ${active.name}`}…</div>
        )}
      </div>
    </div>
  );
}
