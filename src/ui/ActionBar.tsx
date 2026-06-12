import { useState, useEffect } from 'react';
import { useGame, activeCombatant, entityPickables, trampleTarget, movementRemaining, canMove } from '../state/store';
import { hasMeaningfulOption } from '../state/turnEconomy';
import { findSpell } from '../data/index';
import { isArcaneSpell } from '../engine/magic';
import { canTakeAction, hasCondition, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzyCapable } from '../engine/psychology';
import { itemUse } from '../engine/consumables';
import { compatibleAmmo } from '../engine/items';
import { canPushback } from '../engine/qualities/dispatch';
import { hasHealSkill, healableTargets, availableHealModes } from '../engine/healing';
import { mountableNear } from '../state/mount';
import { ownsLocally } from '../state/netFlow';
import type { Combatant } from '../engine/types';
import { HERO_RING, ENEMY_RING } from '../gameIso/teamColors';
import { TeamPortrait } from './TeamPortrait';
import { CharFrame } from './CharFrame';
import { previewResourceDelta, cleaveTargets, dualStrikeTargets, placingZoneOf } from '../state/combatFlow';
import { bonus, effectiveChar } from '../engine/characteristics';
import { ActiveFrame } from './ActiveFrame';

const bleedStacks = (c: Combatant) => c.conditions.find((x) => x.name === 'Hémorragique')?.value ?? 0;

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
  const recoverState = useGame((s) => s.battleRecoverState);
  const selectAmmo = useGame((s) => s.battleSelectAmmo);
  const aim = useGame((s) => s.battleAim);
  const togglePushback = useGame((s) => s.battleTogglePushback);
  const heal = useGame((s) => s.battleHeal);
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
  useEffect(() => { setConfirmEnd(false); }, [battle?.turn, battle?.round]);
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
  if (net.mode !== 'local' && active.kind === 'hero' && !ownsLocally(useGame.getState(), active.id)) {
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

  const isHero = active.kind === 'hero';
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
  const prone = isHero && hasCondition(active, 'À Terre'); // À Terre (LDB 16 l.37) : ni Charge ni Course
  const broken = isHero && hasCondition(active, 'Brisé'); // Brisé (LDB 16 l.55) : fuir/se cacher uniquement, aucune action offensive
  const entangled = isHero && hasCondition(active, 'Empêtré'); // Empêtré (LDB 16 l.61) : se libérer (Action, Test opposé de Force)
  const onFire = isHero && hasCondition(active, 'En flammes'); // En flammes (LDB 16 l.77) : se rouler (Action, Test d'Athlétisme)
  // Déplacement, Attaque, Charge et Course n'ont PLUS de bouton : implicites au clic (sol/ennemi).
  // La Charge se déclenche d'elle-même (mêlée + non Engagé + Mouvement intact — LDB 15 l.74-77) ;
  // la Course est la zone violette au-delà de la Marche (clic → Test d'Athlétisme, LDB 15 l.79-82).
  // Se relever (LDB 16 l.37) : possible si À Terre, ≥1 PB (LDB 18 l.28) et Mouvement non entamé.
  const canStandUp = prone && active.wounds.current > 0 && !moveStarted;
  // Piétinement (LDB 85 l.320-321) : action gratuite si ≥1 Avantage et un adversaire adjacent plus petit.
  const canTrample = isHero && active.advantage >= 1 && !!trampleTarget(battle, active);
  // Tentacule (trait Tentacules, LDB 85 l.354 — mutation) : Attaque gratuite 1/tour, 0 Avantage,
  // si un adversaire est au contact.
  const canTentacle = isHero && !active.tentacleUsedThisTurn && active.weapons.some((w) => w.uid === 'nat-tentacule')
    && !!active.pos && battle.combatants.some((c) => c.kind !== 'hero' && !isOutOfAction(c) && c.pos && Math.max(Math.abs(c.pos.x - active.pos!.x), Math.abs(c.pos.y - active.pos!.y)) <= 1);
  // Frénésie (LDB 21 l.31-32) : un héros capable peut tenter d'entrer en Frénésie (Test de FM, coûte l'Action).
  const canFrenzy = isHero && isFrenzyCapable(active) && !active.frenzied && !battle.acted && !stunned;
  // Frénésie : l'attaque CC gratuite (LDB 21 l.34) reste possible même l'Action dépensée (entrée en Frénésie incluse).
  const freeFrenzy = isHero && !!active.frenzied && !active.frenzyFreeUsed;
  // Frénésie (LDB 21 l.34) : « La seule Action possible est un Test de Capacité de Combat ou un Test
  // d'Athlétisme » + « sous aucun prétexte vous ne fuirez, ni ne battrez en retraite » → en Frénésie,
  // la hotbar masque Incanter/Soigner/Défensive/Tir/Objets/Se désengager (restent : attaque au clic,
  // Course vers la cible, Se relever, Piétiner, Détermination — qui ne coûte pas l'Action).
  const frenzied = isHero && !!active.frenzied;
  // Jauge d'Action : 1 Action de base (+1 attaque gratuite si frénétique). Pleins = encore disponibles.
  const actMax = 1 + (active.frenzied ? 1 : 0);
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
  const usable = isHero ? (active.items ?? []).filter((it) => itemUse(it, active) != null) : [];
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

  // Catégories repliables : on n'affiche le bouton conteneur que si ≥1 enfant existe.
  const hasMvt = canStandUp || (engaged && !frenzied) || mounted || !!mountCandidate;
  const hasTir = !!rangedW && !frenzied;
  const hasObjets = !frenzied && (usableGroups.length > 0 || groundItems.length > 0);
  // « Spécial » regroupe TOUT le situationnel (déplacement, tir, objets, Frénésie, Piétiner, Tentacule).
  const hasSpecial = hasMvt || hasTir || hasObjets || canFrenzy || canTrample || canTentacle;

  return (
    <div className="action-bar">
      {hasSpells && battle.action === 'cast' && !pendingCast && (
        <div className="ab-spells">
          {active.spells!.map((label) => {
            const spell = findSpell(label);
            if (!spell) return null;
            const selected = battle.selectedSpell === label;
            const ni = spell.cn != null ? `NI ${spell.cn}` : 'Prière';
            const canFocus = isArcaneSpell(spell) && (spell.cn ?? 0) > 0;
            const focusDr = active.focus?.spell === label ? active.focus.dr : null;
            // Découvrabilité (R4) : portée / durée / cibles d'un sort, AVANT de l'incanter (données SpellData).
            const tgtLabel = typeof spell.target === 'number' ? (spell.target === 1 ? '1 cible' : `${spell.target} cibles`) : spell.target;
            const meta = `📏 ${spell.range} · ⏳ ${spell.duration} · 🎯 ${tgtLabel}`;
            return (
              <div key={label} className="ab-spell-row">
                <button className={`btn btn-sm ${selected ? 'btn-primary' : ''}`} onClick={() => selectSpell(label)} title={`${spell.desc}\n\n${meta}`}>
                  {spell.label} <span className="bp-spell-ni">({ni})</span>
                  <span className="ab-spell-meta">{meta}</span>
                </button>
                {canFocus && (
                  <button className="btn btn-sm" onClick={() => focusSpell(label)} title="Test étendu de Focalisation">
                    Focaliser{focusDr != null ? ` (${focusDr}/${spell.cn})` : ''}
                  </button>
                )}
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
      {battle.action === 'mvt' && (
        <div className="ab-spells">
          {/* « Spécial » : toutes les manœuvres situationnelles regroupées (déplacement, tir, objets, rares). */}
          {canStandUp && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={standUp} title="Se relever de l'État À Terre — utilise le Mouvement">🧍 Se relever</button>
            </div>
          )}
          {engaged && !frenzied && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted && !canFreeDisengage} onClick={disengage} title="Quitter le corps à corps (Esquive si Action dispo, sinon sacrifice d'Avantage)">🚪 Se désengager</button>
            </div>
          )}
          {mountCandidate && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={moveStarted || broken} onClick={mountUp} title="Enfourcher cette monture (combat monté) — coûte le Mouvement (pas de jet → pas une Action)">🐎 Monter sur {mountCandidate.name}</button>
            </div>
          )}
          {mounted && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={moveStarted || broken} onClick={dismount} title="Descendre de sa monture (à pied, case libre adjacente) — coûte le Mouvement (pas de jet → pas une Action)">🥾 Descendre de monture</button>
            </div>
          )}
          {rangedW && !frenzied && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || active.aiming} onClick={aim} title="Viser : +20 (Accessible) au prochain tir — coûte l'Action">🎯 {active.aiming ? 'En joue ✓' : 'Viser'}</button>
            </div>
          )}
          {canPush && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={togglePushback} title="Perturbante : la prochaine attaque réussie repousse d'1 m par DR au lieu de causer des Dégâts">↩️ {active.pushbackMode ? 'Repousser ✓' : 'Repousser'}</button>
            </div>
          )}
          {needsReload && !frenzied && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={reload} title="Recharger (Test étendu de Projectiles — coûte l'Action)">🔄 Recharger{active.reloadProgress ? ` (${active.reloadProgress}/${rangedW!.reload} DR)` : ''}</button>
            </div>
          )}
          {ammoChoices.length > 1 && !frenzied && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => selectAction('ammo')} title="Choisir la munition à tirer">🏹 Munition</button>
            </div>
          )}
          {!frenzied && usableGroups.map((g) => (
            <div key={g.name} className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={() => useItem(g.uids[0])} title={g.desc}>🧪 {g.name}{g.uids.length > 1 ? ` ×${g.uids.length}` : ''}</button>
            </div>
          ))}
          {!frenzied && groundItems.map((g) => (
            <div key={`${g.entityId}:${g.key}`} className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={() => pickup(g.entityId, g.key)} title="Ramasser cet objet au sol (coûte l'Action)">✋ {g.label}</button>
            </div>
          ))}
          {canFrenzy && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={frenzy} title="Entrer en Frénésie : Test de Force Mentale — coûte l'Action">🐗 Frénésie</button>
            </div>
          )}
          {canTrample && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => selectAction('trample')} title="Piétiner un adversaire adjacent plus petit : action gratuite à 1 Avantage">🐾 Piétiner</button>
            </div>
          )}
          {canTentacle && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => selectAction('tentacle')} title="Frapper du tentacule un adversaire au contact : Attaque gratuite, 1/tour — Empêtré sur Dégâts">🐙 Tentacule</button>
            </div>
          )}
        </div>
      )}
      {battle.action === 'ammo' && (
        <div className="ab-spells">
          {ammoChoices.map((a) => (
            <div key={a.uid} className="ab-spell-row">
              <button className={`btn btn-sm ${active.ammoUid === a.uid ? 'btn-primary' : ''}`} onClick={() => selectAmmo(a.uid)} title={(a.qualities ?? []).join(', ')}>🏹 {a.name} ×{a.qty}</button>
            </div>
          ))}
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
              <div className="ab-loadouts" title={battle.loadoutSwapped ? 'Set d’armes déjà changé ce tour' : 'Changer de set d’armes (gratuit, 1/tour)'}>
                <span className="ab-loadouts-ico">🗡</span>
                {loadouts.map((lo) => (
                  <button
                    key={lo.id}
                    className={`btn btn-sm ${active.activeLoadoutId === lo.id ? 'btn-primary' : ''}`}
                    disabled={!!battle.loadoutSwapped && active.activeLoadoutId !== lo.id}
                    onClick={() => switchLoadout(lo.id)}
                  >
                    {lo.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isHero ? (
          <div className="ab-slots">
            {/* Annuler le déplacement (R6/LOT 6) : tant qu'aucune Action n'est prise, revenir au point de départ. */}
            {moveStarted && !battle.acted && (
              <button
                className="ab-slot ab-undo"
                onClick={cancelMove}
                title="Annuler tout le déplacement de ce tour et revenir au point de départ (possible tant qu'aucune Action n'est prise)"
              >
                <span className="ab-ico">↩️</span>
                <span className="ab-lbl">Annuler dépl.</span>
              </button>
            )}
            {hasSpells && !frenzied && (
              <button
                className={`ab-slot ${battle.action === 'cast' ? 'on' : ''}`}
                disabled={battle.acted || stunned || broken}
                onClick={() => selectAction(battle.action === 'cast' ? null : 'cast')}
                title="Incanter un sort (Test de Langage mystique) — coûte l'Action"
              >
                <span className="ab-ico">✨</span>
                <span className="ab-lbl">Incanter{battle.acted && ' ✓'}</span>
              </button>
            )}
            {canHeal && healTargets.length > 0 && (
              <button
                className={`ab-slot ${battle.action === 'heal' ? 'on' : ''}`}
                disabled={battle.acted || stunned || broken}
                onClick={() => selectAction(battle.action === 'heal' ? null : 'heal')}
                title="Soigner (Compétence Guérison) : rend des PB ou stoppe une hémorragie — coûte l'Action"
              >
                <span className="ab-ico">🩹</span>
                <span className="ab-lbl">Soigner</span>
              </button>
            )}
            {!frenzied && (
              <button
                className="ab-slot"
                disabled={battle.acted || stunned || broken}
                onClick={defendTotal}
                title="+20 à tous vos Tests de défense jusqu'à votre prochain tour"
              >
                <span className="ab-ico">🛡️</span>
                <span className="ab-lbl">Défensive{battle.acted && ' ✓'}</span>
              </button>
            )}
            {onFire && (
              <button
                className="ab-slot"
                disabled={battle.acted || stunned}
                onClick={() => recoverState('En flammes')}
                title="Se rouler au sol pour éteindre les flammes (Test d'Athlétisme — coûte l'Action)"
              >
                <span className="ab-ico">🔥</span>
                <span className="ab-lbl">Se rouler{battle.acted && ' ✓'}</span>
              </button>
            )}
            {entangled && (
              <button
                className="ab-slot"
                disabled={battle.acted || stunned}
                onClick={() => recoverState('Empêtré')}
                title="Se libérer de l'entrave (Test opposé de Force contre la source — coûte l'Action)"
              >
                <span className="ab-ico">🪢</span>
                <span className="ab-lbl">Se libérer{battle.acted && ' ✓'}</span>
              </button>
            )}

            {/* ── Spécial : TOUTES les manœuvres situationnelles regroupées ── */}
            {hasSpecial && (
              <button
                className={`ab-slot ${battle.action === 'mvt' || battle.action === 'ammo' || battle.action === 'trample' || battle.action === 'tentacle' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'mvt' || battle.action === 'ammo' || battle.action === 'trample' || battle.action === 'tentacle' ? null : 'mvt')}
                title="Manœuvres situationnelles : Charger, Courir, Se relever, Se désengager, Viser/Recharger, Objets, Frénésie, Piétiner…"
              >
                <span className="ab-ico">⭐</span>
                <span className="ab-lbl">Spécial ▾</span>
              </button>
            )}

            {/* ── Alerte visible (Détermination) ── */}
            {removableConditions.length > 0 && (
              <button
                className={`ab-slot ab-alert ${battle.action === 'resolve' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'resolve' ? null : 'resolve')}
                title="Détermination : retirer un État (ne coûte pas l'Action)"
              >
                <span className="ab-ico">✊</span>
                <span className="ab-lbl">Détermination ({resolve})</span>
              </button>
            )}

            {net.mode !== 'local' && (
              <button
                className={`ab-slot${battle.handRaised ? ' on' : ''}`}
                disabled={!!battle.handRaised}
                onClick={() => useGame.getState().raiseHand()}
                title="Demander la pause au prochain début de Round (fenêtre Chance « agir en premier »)"
              >
                <span className="ab-ico">✋</span>
                <span className="ab-lbl">{battle.handRaised ? 'Pause demandée' : 'Pause Round'}</span>
              </button>
            )}
            <button
              className={`ab-slot ab-end ${!meaningfulLeft ? 'pulse' : ''} ${confirmEnd ? 'warn' : ''}`}
              onClick={onEndTurn}
              title={confirmEnd ? 'Tu n’as pas encore agi ce tour — clique encore pour finir quand même' : !meaningfulLeft ? 'Plus rien à faire ce tour' : 'Finir le tour'}
            >
              <span className="ab-ico">{confirmEnd ? '⚠️' : '⏭️'}</span>
              <span className="ab-lbl">{confirmEnd ? 'Finir quand même ?' : 'Fin du tour'}</span>
            </button>
          </div>
        ) : (
          <div className="ab-enemy">⚔️ Tour de l'ennemi…</div>
        )}
      </div>
    </div>
  );
}
