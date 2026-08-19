import { useEffect, useState, type ReactNode } from 'react';
import { useGame, activeCombatant, movementRemaining, type BattleState } from '../state/store';
import type { Combatant, Weapon, WeaponLoadout } from '../engine/types';
import { hasMeaningfulOption } from '../state/turnEconomy';
import { advantageCapFor } from '../engine/advantage';
import { attackWeapon } from '../engine/combat';
import { availableAttacks, selfManeuversOf, selfManeuverApplicable, previewResourceDelta } from '../state/combatFlow';
import { combatAdvantageSkills } from '../engine/skillCombatApps';
import { findSpellById, findSkillById, findActionById } from '../data/index';
import { type CodexTarget } from '../engine/ruleRefs';
import { actionGate, runAction, type ActionCtx, type ActionRunCtx } from '../state/actionRegistry';
import { CodexRef } from './compendium/CodexRef';
import { isConsumable } from '../engine/consumables';
import { loadedAmmo, loadoutLabel, activeLoadout, weaponFromItem, isUnarmed } from '../engine/items';
import { weaponLoaded, reloadProgressOf } from '../engine/weaponLoad';
import { canPushback } from '../engine/qualities/dispatch';
import { hasBattement, hasDistraire } from '../engine/combatFeatures/dispatch';
import { dispellableSpellsOn } from '../engine/dispel';
import { actorHasSkill } from '../engine/skills';
import { hasHealSkill, healableTargets } from '../engine/healing';
import { canTakeAction, hasCondition, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzied, isFrenzyCapable } from '../engine/psychology';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { canAidTeam } from '../state/commandTeam';
import { shipOfCrew } from '../state/shipPostes';
import { isVehicle } from '../engine/vehicle';
import { controlsCombatant } from '../state/netOwnership';
import { inBattleId } from '../state/combatants';
import { combatDistance } from '../state/footprint';
import { hotbar } from '../state/hotbarBridge';
import { charIcon, type EffectChip } from '../gameIso/effectIcons';
import { HERO_RING, ENEMY_RING, hpColor } from '../gameIso/teamColors';
import { PortraitTile } from './PortraitTile';
import { StateChips } from './StateChips';
import { LifeBar } from './LifeBar';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import type { IconIdInput } from './icons';

/** Nombre de cases de chaque travée — GÉOMÉTRIE IMMUABLE (arbitrage utilisateur 2026-08-16 :
 *  « je ne veux pas que la taille de l'interface ou les boutons bougent » —
 *  `.claude/memory/game-arbitrage-hud-console-rt-2026-08-16.md:22`). Le contenu varie,
 *  le compte de cases JAMAIS : une case sans contenu se DESSINE vide. */
const LEFT_CELLS = 6; // travée gauche : 2×3 — les gestes déduits du set (§1a) puis les cases LIBRES
const QUICK_CELLS = 4; // rubrique ACCÈS RAPIDE : 2×2 (consommables groupés + Soin)
const SET_SLOTS = 3; // colonne latérale de SETS : vignettes toujours dessinées (planche 2026-08-17)
const RIGHT_CELLS = 12; // grille de capacités : 2×6
const ADVANTAGE_COLLARS = 10; // conduit d'Avantage (LDB 14 l.198)
const ARCH_STATE_CELLS = 4; // niche d'États de l'arche : alvéoles réservées (spec §1c-bis)
const PRINTED_KEYS = 8; // touches imprimées dans les cases de la grille (spec zone 8 : 1-8)

/** FAMILLE d'une alvéole — porte l'accent de la case (filet de tête) et, à gauche, sa MATIÈRE :
 *  ce qu'on fait AVEC L'ARME est de l'acier, le geste et l'objet sont du laiton chaud (spécimen C).
 *  Attribut de données, jamais une classe par écran. */
type CellFamily = 'arme' | 'geste' | 'mouvement' | 'defense' | 'avantage' | 'attaque' | 'magie';

/** Une alvéole : une ENTRÉE du registre des actions (`src/data/actions.json`) habillée du contenu réel
 *  du store. `run` absent = case dessinée non branchée (action `blocked`, ou console en lecture). */
type Cell = {
  key: string;
  /** ID D'ACTION du registre — l'IDENTITÉ de la case : rendue en `data-action`, publiée au pont
   *  clavier, exécutée par `runAction`. Jamais une closure anonyme (spec HUD « Zone 12 »). */
  id: string;
  icon: ReactNode;
  label: string;
  family: CellFamily;
  /** Coût en crans d'Avantage, adossé au conduit. */
  adv?: number;
  on?: boolean;
  disabled?: boolean;
  /** FOYER de règle de la case (`{category, id}` du Codex, `RULE_REF`/registre de données) : c'est LUI
   *  qui porte le texte de règle, en VERBATIM, dans le popover `CodexRef`. Aucune prose de règle n'est
   *  écrite ici (CLAUDE.md règles 5 & 6) — la case NOMME, la donnée EXPLIQUE. */
  rule?: CodexTarget;
  /** RAISON d'inéligibilité, quand la case se DESSINE quoi qu'il arrive mais que la situation en
   *  interdit l'usage (Charger alors qu'on est Engagé — `regles/charger`). Rendue en texte VISIBLE dans
   *  l'alvéole et liée par `aria-describedby` (idiome `GatedAction` : un `title` seul est invisible à
   *  l'arbre a11y). Le compte de cases ne bouge jamais. */
  gate?: string;
  run?: () => void;
};

/** L'alvéole vide PORTE son mot, dans les DEUX travées : la case est offerte au placement du joueur
 *  (planche 2026-08-17, « LIBRE »), elle n'est pas un trou de composition. Une seule grammaire de case
 *  vide — le mot partout (grief vision : la travée droite ne disait rien).
 *
 *  ZÉRO `title` : l'infobulle native est proscrite (charte + grief du juge vision « la raison n'est
 *  qu'en title »). Ce que la case doit dire passe par TROIS véhicules VISIBLES ou accessibles :
 *  le libellé (+ `aria-label` pour le libellé entier quand l'ellipse le tronque), la RAISON de gate en
 *  texte dans l'alvéole, et le popover `CodexRef` (mode `wrap` : le bouton EST l'affordance de sa
 *  règle, sans ⓘ voisin — #1078) pour le verbatim de la donnée.
 *
 *  `intentionArmee` MET CE POPOVER EN SOURDINE (`suppressPopover`) : une intention armée peint sa portée
 *  sur le terrain (spec zone 4), et la boîte de règle — ouverte par le focus que le clic vient de donner
 *  au bouton — recouvrait exactement ce que le joueur a demandé à voir. L'intention dissoute, la règle
 *  revient. */
function ConsoleCell({ cell, hotkey, advantage = 0, intentionArmee = false }: { cell?: Cell; hotkey?: number; advantage?: number; intentionArmee?: boolean }) {
  if (!cell) {
    return (
      <span className="chip cc-cell cc-empty">
        <span className="cc-lbl">LIBRE</span>
      </span>
    );
  }
  const inert = !cell.run;
  const gateId = cell.gate ? `cc-gate-${cell.key}` : undefined;
  const button = (
    <button
      type="button"
      data-cell={cell.key}
      data-action={cell.id}
      data-family={cell.family}
      data-gated={cell.gate ? '' : undefined}
      className={`chip cc-cell${cell.on ? ' on' : ''}${inert ? ' cc-inert' : ''}`}
      disabled={cell.disabled || inert}
      aria-label={cell.label}
      aria-describedby={gateId}
      onClick={cell.run}
    >
      {/* Touche imprimée SEULEMENT quand elle marche : la case branchée est publiée au pont clavier
          (`hotbar`), une case de maquette n'a aucune touche — jamais de badge mort. Une case REFUSÉE
          (gate du registre, ou situation qui la ferme) publie son slot `disabled` : son badge s'éteint
          aussi, il ne promet pas une touche qui ne fera rien — et il ne vient pas mordre la raison. */}
      {hotkey && !inert && !cell.disabled ? <span className="cc-key">{hotkey}</span> : null}
      <span className="cc-ico">{cell.icon}</span>
      <span className="cc-lbl">{cell.label}</span>
      {/* RAISON d'indisponibilité : VISIBLE dans l'alvéole (idiome `GatedAction`), jamais un title. */}
      {cell.gate ? <span className="cc-lbl" data-gate="" id={gateId}>{cell.gate}</span> : null}
      {cell.adv ? (
        <span className="cc-cost" aria-label={`Coût : ${cell.adv} Avantage (${Math.min(advantage, cell.adv)} couvert${Math.min(advantage, cell.adv) > 1 ? 's' : ''})`}>
          {Array.from({ length: cell.adv }, (_, i) => (
            <i key={i} className={i < advantage ? 'on' : undefined} />
          ))}
        </span>
      ) : null}
    </button>
  );
  // Le FOYER de règle enveloppe le bouton sans rien lui prendre (`wrap` : ni clic, ni rôle, ni
  // tabindex) — c'est l'idiome des boutons de dépense (`ChanceButtons`, `DeterminationButton`).
  return cell.rule
    ? <CodexRef category={cell.rule.category} id={cell.rule.id} label={cell.label} wrap suppressPopover={intentionArmee}>{button}</CodexRef>
    : button;
}

function icon(id: IconIdInput) {
  return <Icon id={id} />;
}

/** Un SET porte-t-il une arme à distance qui n'est pas prête à tirer ? L'état de charge vit sur
 *  l'ARME (registre `engine/weaponLoad`), pas sur le porteur : chaque objet du set est projeté par la
 *  dérivation UNIQUE `weaponFromItem` (l'`uid` survit, donc `loadRegister` retombe sur l'objet
 *  possédé) — c'est ainsi qu'un set NON ACTIF, dont les armes ne sont pas dans `c.weapons`, dit son
 *  état. PUR. */
function loadoutUnloaded(c: Combatant, lo: WeaponLoadout): boolean {
  const items = c.items ?? [];
  for (const uid of [lo.main, lo.off]) {
    const it = uid ? items.find((i) => i.uid === uid) : undefined;
    if (!it || it.kind !== 'ranged') continue;
    const w = weaponFromItem(it);
    if ((w.reload ?? 0) > 0 && !weaponLoaded(c, w)) return true;
  }
  return false;
}

/** GOUTTIÈRE de l'arche : une ressource du tour en crans verticaux (longueur constante, N segments
 *  égaux) + son SOCLE au pied — VALEUR COURANTE seule, `short` gravé dessous (planche 2026-08-17 :
 *  « 3 / MOUV. », « 1 / ACTION »). Le MAXIMUM se lit aux crans du rail, jamais deux fois.
 *  `spend` = crans qui vont partir au commit du geste en cours.
 *  Propre à la console : l'arche ne rend QUE portrait/nom/gouttières/Blessures/États (spec §1c-bis) —
 *  `ActiveFrame` garde son gabarit complet pour ses propres appelants.
 *  Une gouttière à 0 cran RESTE DESSINÉE, rail vide et socle « 0 » : la géométrie de l'arche ne
 *  dépend d'aucune ressource (héros Empêtré = Mouvement 0). */
function ArchGutter({ kind, value, max, label, short, unit, spend = 0 }: { kind: 'action' | 'move'; value: number; max: number; label: string; short: string; unit?: string; spend?: number }) {
  const spendFrom = Math.max(0, value - spend);
  // Le CHIFFRE et les crans sont à l'écran (socle + rail) : le nom accessible suffit à les nommer pour
  // un lecteur d'écran — aucune infobulle native (proscrite, cf. `ConsoleCell`).
  const nom = `${label} : ${value}/${max}${unit ? ` ${unit}` : ''}`;
  return (
    <span className={`cc-gutter cc-gutter-${kind}`} aria-label={nom}>
      <span className="cc-gutter-rail">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < spendFrom ? 'on' : i < value ? 'on spend' : 'off'} />
        ))}
      </span>
      <b className="cc-socle">
        {value}
        <i>{short}</i>
      </b>
    </span>
  );
}

/** États du porteur qui ne vivent PAS sur le Combatant mais sur la SITUATION (`battle`) : ils entrent
 *  dans le même rack d'alvéoles que les États portés (spec §1c-bis, chrome d'état de l'arche §1c) —
 *  Assailli ×N (ennemis vivants au contact, `combatDistance` z-aware), Cloué (`battle.fearGate`),
 *  Renfort de pièce (servant qui n'est pas le chef, `crewIds[0]`). Pur.
 *  Vaut pour TOUT acteur actif : les trois données sont celles du Tour en cours (`battle.fearGate`,
 *  `movementUsed`… sont per-Tour) et se lisent pour un ennemi comme pour un héros (spec zone 7 :
 *  hors du tour du joueur la console reste en LECTURE, mêmes cases). */
function actorStateChips(active: Combatant, battle: BattleState): EffectChip[] {
  const out: EffectChip[] = [];
  const assailliN = active.pos
    ? battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos && combatDistance(active, c) <= 1).length
    : 0;
  if (assailliN >= 2) out.push({ key: 'a-assailli', icon: 'action/attack', label: `Assailli par ${assailliN} ennemis au contact`, kind: 'state', severity: 58, indice: assailliN });
  if (battle.fearGate === 'failed') out.push({ key: 'a-cloue', flagId: 'calmeApproche', icon: 'flag/fear', label: 'Cloué', kind: 'state', severity: 64 });
  if (active.mannedPoste && active.mannedPoste.crewIds?.[0] !== active.id) {
    out.push({ key: 'a-renfort', icon: 'action/serve-engine', label: 'Renfort de pièce (le chef fait feu)', kind: 'state', severity: 40 });
  }
  return out;
}

/**
 * CONSOLE DE COMBAT — UN SEUL OBJET (spec §1c-ter) : `.combat-console` est LE PONT, une bande de
 * bord à bord qui PORTE ses quatre régions (travée gauche, arche, travée droite, coin de sortie).
 * Aucune n'est une boîte soeur flottante : entre deux régions, on voit le pont, jamais le terrain.
 * L'arche en est le FRONTON — elle s'élève au-dessus du liseré, de la même matière et sans couture.
 *
 * Contenu : arche = portrait + gouttières + Blessures + niche d'États ; grille de capacités à compte
 * FIXE, conduit d'Avantage branché sur la grille, coin de fin de tour ISOLÉ. Aucune liste
 * déroulante : une capacité vit dans sa case, l'exhaustif vit à l'écran de capacités.
 *
 * Travée GAUCHE = ce que le matériel tenu offre (gestes de l'arme du set, munition, objets) ;
 * travée DROITE = la grille de capacités du personnage ; hors du tour du joueur la console reste
 * en LECTURE (mêmes cases, inertes) sous un bandeau de phase SUPERPOSÉ (le pont ne bouge pas).
 */
export function CombatConsole() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  // Intention LOCALE armée (spec zone 4) : elle allume SA case. Jamais un intent réseau — c'est un
  // mode d'écran, le geste qu'il commet part, lui, par les chemins de clic habituels.
  const localIntent = useGame((s) => s.localIntent);
  const confirmRoundStart = useGame((s) => s.confirmRoundStart);
  // AUCUN dispatcher n'est capté ici : toute exécution passe par `runAction` (registre des actions).
  // Garde-fou « tour gâché » ARMÉ (2ᵉ clic attendu) — état d'UI local, remis à zéro à chaque tour/Round,
  // comme dans la barre v7 (`ActionBar.tsx:124,129`).
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => { setConfirmEnd(false); }, [battle?.turn, battle?.round]);

  if (!battle || battle.over) return null;
  const phase = pendingRoundStart
    ? {
        label: pendingRoundStart.round <= 1 ? 'Ouverture du combat' : `Début du Round ${pendingRoundStart.round}`,
        exit: pendingRoundStart.round <= 1 ? 'Commencer le combat' : `Commencer le round ${pendingRoundStart.round}`,
        onExit: confirmRoundStart,
      }
    : null;
  // Pendant la PAUSE de Round, `battle.turn` vaut -1 : personne n'agit encore. La console ne
  // DISPARAÎT pas pour autant (loi 1 : la géométrie ne bouge jamais) — elle passe en LECTURE sur
  // le combattant qui ouvrira le round (tête de l'ordre), sous le bandeau de phase (spec zone 7).
  const active = activeCombatant(battle) ?? (phase ? inBattleId(battle, battle.order[0]) : undefined);
  if (!active) {
    return phase ? (
      <div className="combat-console">
        <div className="cc-phase">
          <span className="cc-phase-label">{phase.label}</span>
          <button type="button" className="btn btn-primary" onClick={phase.onExit}>
            <Icon id="ui/round-start" size="sm" /> {phase.exit}
          </button>
        </div>
      </div>
    ) : null;
  }

  const playerControlled = controlsCombatant(useGame.getState(), active);
  const isHero = playerControlled && !isVehicle(active) && net.mode === 'local';
  // LECTURE : la console garde sa géométrie, ses cases deviennent inertes (spec zone 7).
  const live = isHero && !phase;

  const frenzied = isHero && isFrenzied(active);
  // Ressources du Tour EN COURS : `movementRemaining`/`battle.movementUsed`/`battle.acted` portent
  // l'acteur actif quel qu'il soit — l'arche affiche donc la valeur réelle du moteur pour un ennemi
  // comme pour un héros (spec zone 7 : mêmes cases, inertes).
  const moveLeft = movementRemaining(battle, active);
  const moveMax = moveLeft + battle.movementUsed;
  const actMax = 1 + (isFrenzied(active) ? 1 : 0);
  const actAvail = battle.acted ? 0 : 1;
  const heroIdx = party.findIndex((h) => h.id === active.id);
  const ring = heroIdx >= 0 ? HERO_RING[heroIdx % HERO_RING.length] : ENEMY_RING;
  const previewDelta = previewResourceDelta(battle);
  const stunned = !canTakeAction(active);
  const broken = isHero && hasCondition(active, 'brise');
  const busy = battle.acted || stunned || broken;

  // ── LA CONSOLE CONSOMME LE REGISTRE DES ACTIONS ────────────────────────────────────────────────
  // Contexte d'offre commun à toutes les cases (prédicats `ACTION_GATES`, spec HUD « Zone 12 »).
  const gateCtx: ActionCtx = { active, battle, netMode: net.mode };
  /** UNE CASE = UNE ENTRÉE de `src/data/actions.json` : libellé, icône, foyer de règle Codex, verdict
   *  d'offre (`actionGate` → raison VISIBLE) et dispatcher (`runAction`) viennent tous de l'action.
   *  La console ne décide QUE de la pertinence (le site dit quand la case existe), de sa MATIÈRE
   *  (famille) et de l'habillage porté par le contenu réel (art de l'objet, compteurs). Une action
   *  sans dispatcher (`blocked`) rend une case DESSINÉE mais inerte : le registre le dit, elle ne feint pas.
   *  `off` = restriction de SITE qui s'ajoute au verdict (jamais qui l'annule). */
  const cellFor = (
    actionId: string,
    family: CellFamily,
    over: { key?: string; label?: string; icon?: ReactNode; rule?: CodexTarget; on?: boolean; off?: boolean; adv?: number; args?: ActionRunCtx } = {},
  ): Cell | undefined => {
    const def = findActionById(actionId);
    if (!def) return undefined;
    const verdict = actionGate(def.id, gateCtx);
    // Une action à INTENTION (spec zone 4) : sa case s'allume quand SON mode est armé, et le re-clic
    // le dissout — même patron que les modes armés de `battle.action` (Détermination, Dissiper).
    const armedIntent = !!def.intent && localIntent?.actionId === def.id;
    return {
      key: over.key ?? def.keys?.[0] ?? def.id,
      id: def.id,
      family,
      icon: over.icon ?? icon(def.icon as IconIdInput),
      label: over.label ?? def.label,
      rule: over.rule ?? (def.rule && def.ruleCategory ? ({ category: def.ruleCategory, id: def.rule } as CodexTarget) : undefined),
      gate: verdict.ok ? undefined : verdict.reason,
      on: over.on ?? (armedIntent || undefined),
      adv: over.adv,
      disabled: !live || !verdict.ok || !!over.off,
      run: live && (def.run || def.intent)
        ? () => runAction(def.id, useGame.getState, { ...(over.args ?? {}), ...(armedIntent ? { toggleOff: true } : null) })
        : undefined,
    };
  };

  // ── Travée GAUCHE : l'arsenal du set au poing + le nécessaire ──────────────────────────────
  const loadouts = active.loadouts ?? [];
  const rangedW = active.weapons.find((w) => w.type === 'ranged');
  const heldSet = activeLoadout(active);
  // G1 porte l'arme DU SET, lue par `uid` — jamais la première arme de `c.weapons`, dont l'ordre ne dit
  // rien de ce qui est TENU. Sans set (statbloc de créature) : l'arme que le moteur ferait parler à
  // distance (`attackWeapon`, source unique du choix d'arme).
  const heldMainW = heldSet?.main ? active.weapons.find((w) => w.uid === heldSet.main) : undefined;
  const setWeapon = heldMainW ?? attackWeapon(active.weapons, false);
  // En-tête de travée = le SET AU POING, libellé DÉRIVÉ de son contenu (`loadoutLabel`) ; un acteur
  // sans set (statbloc de créature) porte le nom de son arme tenue.
  const setLabel = heldSet ? loadoutLabel(heldSet, active) : (setWeapon?.label ?? 'Mains nues');
  const needsReload = !!rangedW && (rangedW.reload ?? 0) > 0 && !weaponLoaded(active, rangedW);
  const reloadProg = rangedW ? reloadProgressOf(active, rangedW) : 0;
  // MUNITION : celle qui est RÉELLEMENT dans l'arme (`loadedAmmo` → `loadRegister`, `items.ts:1005`),
  // jamais la première compatible du sac. Elle vit dans l'EN-TÊTE de travée, à côté du nom du set
  // (arbitrage #1348, spec § « BUDGET DE HAUTEUR » complément a) : le bandeau réservé qu'elle occupait
  // sous la travée coûtait sa bande de plaque nue à TOUS les sets, même sans arme de tir.
  const ammo = rangedW ? loadedAmmo(active, rangedW) : undefined;
  const canPush = active.weapons.some((w) => w.type === 'melee' && canPushback(w));
  // Armes DU SET au poing, lues par `uid` : c'est le set qui dit ce qui est TENU (arbitrage #1348
  // « ARBITRAGE SET STRICT », `docs/plans/2026-08-16-spec-hud-combat.md` ; dérivation `recomputeLoadout`,
  // `engine/items.ts`). Sans set (statbloc de créature), le set est l'arsenal réel de la bête, Mains nues
  // écartées par le prédicat canonique `isUnarmed` (`items.ts:178`, marqueur `builtinId`).
  const setWeapons = heldSet
    ? [heldSet.main, heldSet.off].filter((u): u is string => !!u).map((uid) => active.weapons.find((w) => w.uid === uid)).filter((w): w is Weapon => !!w)
    : active.weapons.filter((w) => !isUnarmed(w));
  // G2 Charge — `LDB 15 l.35-37` / `LDB 13 l.90` (fiche `regles/charger`) : elle ne se DÉDUIT que
  // d'un set qui ouvre un corps à corps — arme de mêlée DU set, ou set MAINS NUES (aucune arme portée).
  // Un set de tir pur ne la déduit pas. AUCUNE PERTE DE DROIT : ce prédicat ne règle que le REMPLISSAGE
  // par défaut de la travée ; la Charge reste un geste par défaut de la grille de capacités et sera
  // posable en case libre (lot placement).
  const chargeDeduite = setWeapons.length === 0 || setWeapons.some((w) => w.type === 'melee');
  const consumables = (active.items ?? []).filter(isConsumable);
  // Consommables GROUPÉS par MODÈLE — plusieurs potions identiques = une case à compteur ×N. La clé de
  // regroupement est l'id STABLE de catalogue (`trappingId`, `items.ts:240`), jamais le libellé
  // (doctrine CLAUDE.md : « on ne manipule que des IDs », le `label` est de l'AFFICHAGE) ; un objet
  // CUSTOM n'en a pas — son `uid` le distingue alors, et deux customs homonymes restent deux cases.
  // Le libellé du groupe reste celui du 1ᵉʳ objet : c'est l'affichage.
  const consumableGroups = Object.values(
    consumables.reduce<Record<string, { key: string; label: string; uids: string[] }>>((acc, it) => {
      const cle = it.trappingId ?? it.uid;
      (acc[cle] ??= { key: cle, label: it.label, uids: [] }).uids.push(it.uid);
      return acc;
    }, {}),
  );
  const healTargets = hasHealSkill(active)
    ? healableTargets(active, battle.combatants.filter((c) => c.kind === active.kind), { adjacency: true })
    : [];

  // Aspersion d'eau (`water`) : le contenant est au sac, les cibles sont les alliés qui suffoquent.
  const waterTargets = hasWaterContainer(active)
    ? waterSprayCandidates(active, battle.combatants.filter((c) => c.kind === active.kind))
    : [];
  // Barre d'un navire : le porteur sert-il un poste de gouverne ? (source unique `shipOfCrew`)
  const atHelm = isHero ? shipOfCrew(battle.combatants, active.id) : undefined;

  // Gestes DÉDUITS du set au poing (spec §1a, G1-G6bis). Chaque case EST une entrée du registre,
  // habillée du contenu réel (art de l'arme tenue, progression de charge). Une case non pertinente
  // pour ce set n'est pas rendue ; le débord garnit la rangée LIBRE (voir `left`), aucun geste ne tombe.
  // ORDRE : l'arme d'abord, puis son cycle de charge (une arme à Recharge doit rester rechargeable
  // quel que soit le set), puis la Charge, la visée, le geste d'arme, la posture, l'état du porteur.
  const deduced: (Cell | undefined)[] = [
    // G1 — attaque de l'arme du set (entrée `attaque`). L'icône et le nom suivent l'ARME réelle
    // (`ItemIcon`, même routage d'art que la vignette de set) et le foyer de règle est la POSSESSION.
    setWeapon
      ? cellFor('attaque', 'arme', { icon: <ItemIcon item={setWeapon} />, label: setWeapon.label, rule: setWeapon.trappingId ? { category: 'trappings', id: setWeapon.trappingId } : undefined, args: { attackId: 'arme' } })
      : cellFor('attaque', 'arme', { icon: icon('melee/grapple'), label: 'Mains nues', rule: { category: 'trappings', id: 'mains-nues' }, args: { attackId: 'arme' } }),
    // G4 — Recharger : le porteur de l'état est l'ARME (progression du Test étendu), et c'est ELLE
    // que le dispatcher reçoit.
    rangedW && (rangedW.reload ?? 0) > 0
      ? cellFor('reload', 'arme', {
          label: `Recharger${reloadProg ? ` ${reloadProg}/${rangedW.reload}` : ''}`,
          on: needsReload,
          off: busy || !needsReload || frenzied,
          args: { weaponUid: rangedW.uid },
        })
      : undefined,
    // G2 — Charge (bouton d'intention : portée M×2 visible avant le clic). Le verdict d'offre vient
    // du registre (`charge-possible`), le verbatim du popover de sa fiche.
    chargeDeduite ? cellFor('charge', 'geste') : undefined,
    // G3 — Viser
    rangedW ? cellFor('aim', 'arme', { label: active.aiming ? 'En joue' : 'Viser', on: !!active.aiming, off: busy || !!active.aiming || frenzied }) : undefined,
    // G6 — geste d'ARME : la jauge est l'ARSENAL tenu (`canPushback`). L'Empoignade n'en est PAS un
    // (LDB 14 l.155, l.159) : elle reste à la modale d'attaque à mains nues (`useAttackJetProps.tsx:96`).
    canPush ? cellFor('pushback', 'geste', { on: !!active.pushbackMode }) : undefined,
    // G5 — posture de tir (intention pré-jet, sans valeur : la fenêtre de jet garde le chiffre)
    rangedW ? cellFor('posture-tir', 'arme') : undefined,
    // G6bis — gestes d'ÉTAT du porteur (surface `geste-d-etat` du registre, spec §1a) : ce que sa
    // SITUATION ouvre — en selle, à une pièce servie, à la barre — jamais ce que son arme offre.
    active.mountId ? cellFor('dismount', 'geste', { off: broken }) : undefined,
    active.mannedPoste ? cellFor('leave-poste', 'geste', { off: busy }) : undefined,
    atHelm ? cellFor('maneuver-ship', 'geste', { off: busy, args: { crewId: active.id } }) : undefined,
  ];
  // La rangée BASSE est LIBRE (placement joueur — spec §1c-bis) et son remplissage PAR DÉFAUT est le
  // DÉBORD des gestes déduits (spec §1b) : une case pré-remplie reste remplaçable, mais plus AUCUN geste
  // ne tombe hors de la travée. Six cases couvrent le pire set (arme de tir à Recharge + geste d'arme).
  const left: (Cell | undefined)[] = deduced.filter((c): c is Cell => !!c).slice(0, LEFT_CELLS);

  // ── ACCÈS RAPIDE (2×2) : le nécessaire du héros — consommables à compteur, Soin, aspersion ──────
  const quick: (Cell | undefined)[] = [
    ...consumableGroups.map((g) => {
      const it = consumables.find((i) => i.uid === g.uids[0])!;
      return cellFor('use-item', 'geste', {
        key: `q-objet-${g.key}`,
        icon: <ItemIcon item={it} />,
        label: `${g.label}${g.uids.length > 1 ? ` ×${g.uids.length}` : ''}`,
        rule: it.trappingId ? { category: 'trappings', id: it.trappingId } : undefined,
        off: busy || frenzied,
        args: { itemUid: g.uids[0] },
      });
    }),
    healTargets.length > 0
      ? cellFor('heal', 'geste', { key: 'q-soigner', on: battle.action === 'heal', off: busy || frenzied, args: { toggleOff: battle.action === 'heal' } })
      : undefined,
    waterTargets.length > 0 ? cellFor('water', 'geste', { off: busy || frenzied }) : undefined,
  ]
    .filter((c): c is Cell => !!c)
    .slice(0, QUICK_CELLS);

  // ── Travée DROITE : la grille de capacités (compte FIXE, remplissage par défaut mesuré) ─────
  const advSkills = [...new Map(combatAdvantageSkills(active).map((s) => [s.skillId, s])).values()];
  const canDispel = actorHasSkill(active, 'langue', 'magick');
  const dispellable = canDispel ? dispellableSpellsOn(battle.combatants) : [];
  // L'attaque d'ARME n'a rien à faire dans la grille de capacités : elle EST le geste du conduit (travée
  // gauche). Le tri se lit au DISCRIMINANT `kind` de `AttackOption` (union `AttackKind`), jamais à l'id.
  const attacks = availableAttacks(active, battle).filter((a) => a.kind !== 'arme');
  const spells = (active.spells ?? []).map((id) => findSpellById(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const selfManeuvers = selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m));

  const candidates: Cell[] = [
    cellFor('course', 'mouvement'),
    cellFor('mouvement', 'mouvement'),
    isEngaged(active) ? cellFor('disengage', 'mouvement') : undefined,
    cellFor('defend', 'defense', { off: busy }),
    // Une Compétence porte l'icône de SA caractéristique (source unique `charIcon`) : six alvéoles
    // d'Avantage ne partagent plus le même glyphe. UNE entrée de registre (`gain-advantage`), N cases.
    ...advSkills.map((s) =>
      cellFor('gain-advantage', 'avantage', {
        key: `advantage-${s.skillId}`,
        icon: icon(charIcon(findSkillById(s.skillId)?.characteristic)),
        label: findSkillById(s.skillId)?.label ?? s.skillId,
        rule: { category: 'skills', id: s.skillId },
        off: busy,
        args: { skillId: s.skillId },
      }),
    ),
    hasBattement(active) ? cellFor('battement', 'avantage', { off: busy }) : undefined,
    hasDistraire(active) ? cellFor('distraire', 'avantage', { off: busy }) : undefined,
    // Remèdes d'ÉTAT et relevé : offerts quand l'État est porté, exécutés par le registre.
    hasCondition(active, 'a-terre') && active.wounds.current > 0 ? cellFor('stand', 'mouvement') : undefined,
    hasCondition(active, 'en-flammes') ? cellFor('roll-fire', 'geste', { args: { stateId: 'en-flammes' } }) : undefined,
    hasCondition(active, 'empetre') ? cellFor('free-entangle', 'geste', { args: { stateId: 'empetre' } }) : undefined,
    isFrenzyCapable(active) && !isFrenzied(active) ? cellFor('frenzy', 'geste') : undefined,
    canAidTeam(active, battle.combatants) ? cellFor('aid-team', 'geste', { off: busy }) : undefined,
    cellFor('resolve', 'defense', { label: `Détermination ${active.resolve ?? 0}`, on: battle.action === 'resolve', args: { toggleOff: battle.action === 'resolve' } }),
    dispellable.length > 0
      ? cellFor('dispel', 'magie', { on: battle.action === 'dispel', off: busy || frenzied, args: { toggleOff: battle.action === 'dispel' } })
      : undefined,
    ...selfManeuvers.map((m) =>
      cellFor('self-maneuver', 'geste', { key: `self-${m.id}`, label: m.label, rule: { category: 'maneuvers', id: m.id }, off: busy, args: { maneuverId: m.id } }),
    ),
    // Attaques de trait : adossées au conduit (elles se paient en crans d'Avantage). Une attaque de
    // ZONE immédiate (Hurlement) part par `maneuver-area` ; les autres ARMENT le clic (`select-attack`).
    ...attacks.map((a) => {
      const habillage = { key: `attaque-${a.id}`, icon: icon(a.icon), label: a.label, rule: { category: 'traits', id: a.id } as CodexTarget, adv: a.cost?.advantage ?? 0, off: busy };
      return a.targeting === 'zone'
        ? cellFor('maneuver-area', 'attaque', { ...habillage, args: { attackKind: a.kind } })
        : cellFor('select-attack', 'attaque', { ...habillage, args: { attackId: a.id } });
    }),
    ...spells.map((sp) =>
      cellFor('cast-spell', 'magie', { key: `sort-${sp.id}`, icon: icon('magic/power'), label: sp.label, rule: { category: 'spells', id: sp.id }, off: busy || frenzied, args: { spellId: sp.id } }),
    ),
  ].filter((c): c is Cell => !!c);
  const right = candidates.slice(0, RIGHT_CELLS);
  // PONT CLAVIER de la console (`keybindings.ts`, section hotbar : « 1-9 = n-ième slot VISIBLE,
  // positionnel »). On publie les cases BRANCHÉES dans l'ORDRE DE LECTURE du pont — travée gauche
  // (gestes déduits + débord pré-rempli), ACCÈS RAPIDE, puis grille de capacités : sans la travée
  // gauche, les seules cases réellement branchées de la console (Recharger, Viser, un consommable,
  // Soigner) n'avaient AUCUNE touche. Le badge imprimé est ce MÊME rang : une case affichée et
  // branchée a sa touche, une maquette n'en a pas.
  const bridged: Cell[] = [...left, ...quick, ...right].filter((c): c is Cell => !!c && !!c.run);
  hotbar.slots = bridged.map((c) => ({ actionId: c.id, run: c.run!, disabled: !!c.disabled }));
  const keyRank = new Map(bridged.slice(0, PRINTED_KEYS).map((c, i) => [c.key, i + 1]));
  const hotkeyOf = (c?: Cell) => (c ? keyRank.get(c.key) : undefined);

  const advCap = advantageCapFor(active);
  const meaningfulLeft = isHero && hasMeaningfulOption(active, battle);
  // Garde-fou « tour gâché » (spec §1c-bis COIN) : finir avec l'Action NON DÉPENSÉE demande deux clics.
  // MÊME mécanisme que la barre v7 (`ActionBar.tsx:341-346`), pas une réinvention.
  const wastingAction = isHero && !battle.acted && canTakeAction(active);
  const onEndTurn = () => {
    if (wastingAction && !confirmEnd) { setConfirmEnd(true); return; }
    setConfirmEnd(false);
    runAction('end-turn', useGame.getState);
  };
  // 3ᵉ ligne de la plaque de sortie : elle dit l'état VRAI du tour — l'armement du 2ᵉ clic, sinon
  // l'avertissement « Action non dépensée », sinon « Tour fini », sinon SA touche (Espace,
  // `keybindings.ts` `end-turn`). Un héros Sonné n'a rien à dépenser : il lit la touche, pas un reproche.
  const endNote = confirmEnd ? 'Finir quand même ?' : wastingAction ? 'Action non dépensée' : battle.acted ? 'Tour fini' : 'ESPACE';

  return (
    // LE PONT : la bande porteuse. Le bandeau de phase est son seul enfant HORS FLUX (superposé au
    // parapet, `.cc-phase`) — une phase qui va et vient ne déplace donc aucune case.
    <div className="combat-console">
      {phase && (
        <div className="cc-phase">
          <span className="cc-phase-label">{phase.label}</span>
          <button type="button" className="btn btn-primary" onClick={phase.onExit}>
            <Icon id="ui/round-start" size="sm" /> {phase.exit}
          </button>
        </div>
      )}
      {!phase && !isHero && (
        <div className="cc-phase">
          <span className="cc-phase-label">
            <Icon id="ui/wait" size="sm" /> {active.kind === 'enemy' ? 'Tour de l’ennemi' : `Tour de ${active.label}`}
          </span>
        </div>
      )}

      {/* Les quatre RÉGIONS du pont, sur une seule ligne. */}
      <div className="cc-dock">
        {/* Travée GAUCHE (planche 2026-08-17) : COLONNE DE SETS · 2×3 cases (haute déduite du set,
            basse LIBRE) · rubrique ACCÈS RAPIDE 2×2. Le commutateur de sets N'EST PLUS une rangée
            sous la travée : il EST la colonne (chaque vignette commute son set, la touche X les fait
            tourner). La munition non plus : elle est dans l'EN-TÊTE, à côté du nom du set. */}
        <div className="cc-bay cc-bay-left">
          <div className="cc-bay-body">
            <div className="cc-arsenal">
              {/* En-tête de travée = le set AU POING (jamais un littéral) ET, quand l'arme au poing
                  consomme des munitions, celle qui est CHARGÉE avec sa réserve — « ARBALÈTE · Carreau ×12 ».
                  Elle porte sa fiche (popover `CodexRef`), comme toute possession de la console. */}
              <span className="cc-bay-head">
                {setLabel}
                {ammo ? (
                  <>
                    {' · '}
                    <CodexRef category="trappings" id={ammo.trappingId ?? ''} label={ammo.label} wrap suppressPopover={!!localIntent}>
                      <span data-ammo="">{ammo.label}{ammo.qty ? ` ×${ammo.qty}` : ''}</span>
                    </CodexRef>
                  </>
                ) : null}
              </span>
              <div className="cc-arsenal-body">
                {/* COLONNE DE SETS : SET_SLOTS vignettes, toujours dessinées (un set absent est une
                    vignette vide) — set au poing en relief, état de charge de l'arme mentionné. */}
                <div className="cc-sets" role="group" aria-label="Sets d’armes">
                  {Array.from({ length: SET_SLOTS }, (_, i) => {
                    const lo = loadouts[i];
                    if (!lo) {
                      return (
                        <span key={i} className="chip cc-set cc-empty">
                          <i className="cc-set-n">{i + 1}</i>
                        </span>
                      );
                    }
                    const mainItem = lo.main ? active.items?.find((it) => it.uid === lo.main) : undefined;
                    const held = heldSet?.id === lo.id;
                    const unloaded = loadoutUnloaded(active, lo);
                    // La VIGNETTE porte sa fiche : le popover `CodexRef` (mode `wrap`) montre l'arme du
                    // set — profil, Atouts/Défauts, source — là où un `title` cachait le libellé du set.
                    // Le nom accessible reste sur le bouton (le libellé ne tient pas dans 39px).
                    const vignette = (
                      <button
                        key={lo.id}
                        type="button"
                        data-set={lo.id}
                        className={`chip cc-set${held ? ' on' : ''}`}
                        disabled={!live || (!!battle.loadoutSwapped && !held)}
                        aria-label={loadoutLabel(lo, active)}
                        onClick={() => runAction('switch-loadout', useGame.getState, { loadoutId: lo.id })}
                      >
                        <i className="cc-set-n">{i + 1}</i>
                        {mainItem ? <ItemIcon item={mainItem} /> : <Icon id="item/weapon" size="sm" />}
                        {/* L'état de charge se DIT à l'ÉCRAN (jamais la couleur seule — grief vision a11y,
                            jamais un `title` — grief du juge vision), en MOT ENTIER lisible. */}
                        {unloaded ? <i className="cc-set-load">VIDE</i> : null}
                        {/* La touche s'imprime sur la case qui l'exécute : X commute le set au poing. */}
                        {held && live && loadouts.length >= 2 ? <span className="cc-key">X</span> : null}
                      </button>
                    );
                    return mainItem?.trappingId
                      ? <CodexRef key={lo.id} category="trappings" id={mainItem.trappingId} label={loadoutLabel(lo, active)} wrap suppressPopover={!!localIntent}>{vignette}</CodexRef>
                      : vignette;
                  })}
                </div>
                <div className="cc-grid cc-grid-left" aria-label="Arsenal">
                  {Array.from({ length: LEFT_CELLS }, (_, i) => (
                    <ConsoleCell key={i} cell={left[i]} hotkey={hotkeyOf(left[i])} intentionArmee={!!localIntent} />
                  ))}
                </div>
              </div>
            </div>
            {/* Rubrique ACCÈS RAPIDE : le nécessaire (consommables à compteur, Soin), cases libres
                dessinées comme dans la travée. */}
            <div className="cc-quick">
              <span className="cc-bay-head">ACCÈS RAPIDE</span>
              <div className="cc-grid cc-grid-quick" aria-label="Accès rapide">
                {Array.from({ length: QUICK_CELLS }, (_, i) => (
                  <ConsoleCell key={i} cell={quick[i]} hotkey={hotkeyOf(quick[i])} intentionArmee={!!localIntent} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Arche (spec §1c-bis, planche 2026-08-17) : gouttière MOUVEMENT à GAUCHE, portrait,
            gouttière ACTION à DROITE (socles : valeur courante + libellé dessous), NICHE D'ÉTATS
            (rack de 4 alvéoles réservées) au flanc droit, BARRE DE BLESSURES chiffrée pleine
            largeur sous le corps, NOM gravé au pied. RIEN d'autre — l'Avantage vit au conduit.
            La STRUCTURE est la même pour TOUT acteur actif (héros, PNJ, ennemi) : seule
            l'interactivité des cases est réservée au héros (spec zone 7). */}
        <div className="cc-arch">
          <div className="cc-arch-body">
            <ArchGutter kind="move" value={moveLeft} max={moveMax} label="Mouvement" short="MOUV." unit={`case${moveMax > 1 ? 's' : ''}`} spend={previewDelta.move} />
            {/* Portrait NU (`identity`) : les Blessures se lisent à la barre pleine largeur dessous —
                la jauge superposée de la tuile en aurait fait la 2ᵉ écriture de la même donnée.
                Le camp se lit au `kind` du combattant, jamais au contrôle joueur (un allié piloté par
                un autre client reste un allié). */}
            <PortraitTile c={active} ring={ring} variant="identity" size="lg" team={active.kind === 'enemy' ? 'enemy' : 'ally'} />
            <ArchGutter kind="action" value={actAvail} max={actMax} label="Action" short="ACTION" spend={previewDelta.action} />
            {/* NICHE D'ÉTATS : même primitive que la tuile du bandeau (`StateChips reserve`), icône +
                INDICE chiffré par État, alvéoles vides toujours dessinées. */}
            <StateChips c={active} max={ARCH_STATE_CELLS} reserve extra={actorStateChips(active, battle)} />
          </div>
          {/* BLESSURES : barre pleine largeur de l'arche, valeur NOMMÉE sur la piste. Le MOT est un
              enfant à part : à 360 la ligne d'arche ne peut pas le porter (texte mesuré 236px pour
              292px d'arche), la composition compacte le retire — le CHIFFRE (`9 / 9`) et la teinte de la
              piste restent à l'écran, et le `role="meter"` de la primitive porte la valeur à l'a11y. */}
          <LifeBar
            value={active.wounds.current}
            max={active.wounds.max}
            color={hpColor(active.wounds.max > 0 ? Math.max(0, Math.min(1, active.wounds.current / active.wounds.max)) : 0)}
            overlay
            format={(v, m) => (
              <>
                {v} / {m}
                <i> BLESSURES</i>
              </>
            )}
          />
          {/* Le NOM du porteur, gravé au pied de l'arche (spécimen D) : la console dit en entier
              qui agit — la frise ne le dit qu'à la position et à la taille. */}
          <span className="cc-arch-name">{active.label}</span>
        </div>

        {/* Travée DROITE : conduit d'Avantage BRANCHÉ sur la grille de capacités. */}
        <div className="cc-bay cc-bay-right">
          <div className="cc-conduit" aria-label={`Avantage : ${active.advantage}/${advCap}`}>
            <span className="cc-conduit-label">AVANTAGE</span>
            <span className="cc-conduit-rail">
              {Array.from({ length: ADVANTAGE_COLLARS }, (_, i) => (
                <i key={i} className={i < active.advantage ? 'on' : i < advCap ? 'off' : 'out'} />
              ))}
            </span>
            <span className="cc-conduit-plate">
              {active.advantage}/{advCap}
            </span>
          </div>
          <div className="cc-grid cc-grid-right" aria-label="Capacités">
            {Array.from({ length: RIGHT_CELLS }, (_, i) => (
              <ConsoleCell key={i} cell={right[i]} hotkey={hotkeyOf(right[i])} advantage={active.advantage} intentionArmee={!!localIntent} />
            ))}
          </div>
        </div>

        {/* Coin de fin de tour : ISOLÉ des deux travées. */}
        <div className="cc-corner">
          <button
            type="button"
            data-cell="end-turn"
            data-action="end-turn"
            data-armed={confirmEnd ? '' : undefined}
            className={`chip cc-cell cc-end${!meaningfulLeft ? ' pulse' : ''}`}
            disabled={!live}
            aria-label={confirmEnd ? 'Finir le tour quand même' : 'Finir le tour'}
            onClick={onEndTurn}
          >
            <span className="cc-ico">
              <Icon id={confirmEnd ? 'ui/warning' : 'ui/turn-end'} />
            </span>
            <span className="cc-lbl">{confirmEnd ? 'Finir quand même' : 'Fin du tour'}</span>
            <span className="cc-key">{endNote}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
