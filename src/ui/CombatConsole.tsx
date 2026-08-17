import { useState, type ReactNode } from 'react';
import { useGame, activeCombatant, movementRemaining, type BattleState } from '../state/store';
import type { Combatant } from '../engine/types';
import { hasMeaningfulOption } from '../state/turnEconomy';
import { advantageCapFor } from '../engine/advantage';
import { availableAttacks, selfManeuversOf, selfManeuverApplicable, previewResourceDelta } from '../state/combatFlow';
import { combatAdvantageSkills } from '../engine/skillCombatApps';
import { findSpellById, findSkillById } from '../data/index';
import { isConsumable } from '../engine/consumables';
import { compatibleAmmo, loadoutLabel } from '../engine/items';
import { canPushback } from '../engine/qualities/dispatch';
import { hasBattement, hasDistraire } from '../engine/combatFeatures/dispatch';
import { dispellableSpellsOn } from '../engine/dispel';
import { actorHasSkill } from '../engine/skills';
import { canTakeAction, hasCondition, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzied } from '../engine/psychology';
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
 *  « je ne veux pas que la taille de l'interface ou les boutons bougent »). Le contenu varie,
 *  le compte de cases JAMAIS : une case sans contenu se DESSINE vide. */
const LEFT_CELLS = 8; // travée gauche : 2×4
const RIGHT_CELLS = 12; // grille de capacités : 2×6
const ADVANTAGE_COLLARS = 10; // conduit d'Avantage (LDB 14 l.198)
const ARCH_STATE_CELLS = 4; // niche d'États de l'arche : alvéoles réservées (spec §1c-bis)
const PRINTED_KEYS = 8; // touches imprimées dans les cases de la grille (spec zone 8 : 1-8)

/** FAMILLE d'une alvéole — porte l'accent de la case (filet de tête) et, à gauche, sa MATIÈRE :
 *  ce qu'on fait AVEC L'ARME est de l'acier, le geste et l'objet sont du laiton chaud (spécimen C).
 *  Attribut de données, jamais une classe par écran. */
type CellFamily = 'arme' | 'geste' | 'mouvement' | 'defense' | 'avantage' | 'attaque' | 'magie';

/** Une alvéole : contenu RÉEL du store. `run` absent = case dessinée non branchée. */
type Cell = {
  key: string;
  icon: ReactNode;
  label: string;
  title: string;
  family: CellFamily;
  /** Coût en crans d'Avantage, adossé au conduit. */
  adv?: number;
  on?: boolean;
  disabled?: boolean;
  run?: () => void;
};

const MAQUETTE_TITLE = ' — maquette (case dessinée, action non branchée)';

function ConsoleCell({ cell, hotkey, advantage = 0 }: { cell?: Cell; hotkey?: number; advantage?: number }) {
  if (!cell) {
    return <span className="chip cc-cell cc-empty" />;
  }
  const inert = !cell.run;
  return (
    <button
      type="button"
      data-cell={cell.key}
      data-family={cell.family}
      className={`chip cc-cell${cell.on ? ' on' : ''}${inert ? ' cc-inert' : ''}`}
      disabled={cell.disabled || inert}
      title={inert ? cell.title + MAQUETTE_TITLE : cell.title}
      onClick={cell.run}
    >
      {/* Touche imprimée SEULEMENT quand elle marche : la case branchée est publiée au pont clavier
          (`hotbar`), une case de maquette n'a aucune touche — jamais de badge mort. */}
      {hotkey && !inert ? <span className="cc-key">{hotkey}</span> : null}
      <span className="cc-ico">{cell.icon}</span>
      <span className="cc-lbl">{cell.label}</span>
      {cell.adv ? (
        <span className="cc-cost" aria-label={`Coût : ${cell.adv} Avantage (${Math.min(advantage, cell.adv)} couvert${Math.min(advantage, cell.adv) > 1 ? 's' : ''})`}>
          {Array.from({ length: cell.adv }, (_, i) => (
            <i key={i} className={i < advantage ? 'on' : undefined} />
          ))}
        </span>
      ) : null}
    </button>
  );
}

function icon(id: IconIdInput) {
  return <Icon id={id} />;
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
  const title = `${label} : ${value}/${max}${unit ? ` ${unit}` : ''}`;
  return (
    <span className={`cc-gutter cc-gutter-${kind}`} title={title} aria-label={title}>
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
  const confirmRoundStart = useGame((s) => s.confirmRoundStart);
  const endTurn = useGame((s) => s.battleEndTurn);
  const aim = useGame((s) => s.battleAim);
  const reload = useGame((s) => s.battleReload);
  const switchLoadout = useGame((s) => s.battleSwitchLoadout);
  /** Repli du commutateur de sets — état d'AFFICHAGE local (composition compacte ≤560px). */
  const [setsOpen, setSetsOpen] = useState(false);

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

  // ── Travée GAUCHE : l'arsenal du set au poing + le nécessaire ──────────────────────────────
  const loadouts = active.loadouts ?? [];
  const meleeW = active.weapons.find((w) => w.type === 'melee');
  const rangedW = active.weapons.find((w) => w.type === 'ranged');
  const setWeapon = meleeW ?? rangedW;
  const needsReload = !!rangedW && (rangedW.reload ?? 0) > 0 && !active.loaded;
  const ammoChoices = rangedW ? compatibleAmmo(active, rangedW) : [];
  const canPush = active.weapons.some((w) => w.type === 'melee' && canPushback(w));
  const consumables = (active.items ?? []).filter(isConsumable);

  const left: (Cell | undefined)[] = [
    // G1 — attaque de l'arme du set
    setWeapon
      ? { key: 'g1-attaque', family: 'arme', icon: icon('action/attack'), label: setWeapon.label, title: `Attaquer avec ${setWeapon.label}` }
      : { key: 'g1-attaque', family: 'arme', icon: icon('melee/grapple'), label: 'Mains nues', title: 'Attaquer à mains nues' },
    // G2 — Charge (bouton d'intention : portée M×2 visible avant le clic)
    { key: 'g2-charge', family: 'geste', icon: icon('journal/charge'), label: 'Charger', title: 'Charger : montrer la portée de Charge avant de désigner la cible' },
    // G3 — Viser (BRANCHÉ)
    rangedW
      ? {
          key: 'g3-viser',
          family: 'arme',
          icon: icon('action/aim'),
          label: active.aiming ? 'En joue' : 'Viser',
          title: 'Viser : +20 (Accessible) au prochain tir — coûte l’Action',
          on: !!active.aiming,
          disabled: !live || busy || !!active.aiming || frenzied,
          run: live ? aim : undefined,
        }
      : undefined,
    // G4 — Recharger (BRANCHÉ)
    rangedW && (rangedW.reload ?? 0) > 0
      ? {
          key: 'g4-recharger',
          family: 'arme',
          icon: icon('journal/reload'),
          label: `Recharger${active.reloadProgress ? ` ${active.reloadProgress}/${rangedW.reload}` : ''}`,
          title: 'Recharger : Test étendu de Projectiles — coûte l’Action',
          on: needsReload,
          disabled: !live || busy || !needsReload || frenzied,
          run: live ? reload : undefined,
        }
      : undefined,
    // G5 — posture de tir (intention pré-jet, sans valeur : la fenêtre de jet garde le chiffre)
    rangedW ? { key: 'g5-posture', family: 'arme', icon: icon('action/shoot'), label: 'Tir immobile', title: 'Posture de tir : tirer sans bouger / tirer dans le tas' } : undefined,
    // G6 — geste d'ARME
    canPush
      ? { key: 'g6-geste-arme', family: 'geste', icon: icon('ui/undo'), label: 'Repousser', title: 'Perturbante : la prochaine attaque réussie repousse au lieu de blesser', on: !!active.pushbackMode }
      : { key: 'g6-geste-arme', family: 'geste', icon: icon('melee/grapple'), label: 'Empoigner', title: 'Empoignade — geste de l’arme au poing' },
    // G6bis — geste d'ÉTAT du héros
    active.mountId
      ? { key: 'g6bis-etat', family: 'geste', icon: icon('action/dismount'), label: 'Descendre', title: 'Descendre de sa monture — coûte le Mouvement' }
      : active.mannedPoste
        ? { key: 'g6bis-etat', family: 'geste', icon: icon('action/leave-post'), label: 'Quitter la pièce', title: 'Quitter la pièce servie — coûte l’Action' }
        : undefined,
    // G7 — objets (consommable, Soin, Asperger d'eau)
    consumables[0]
      ? { key: 'g7-objet', family: 'geste', icon: <ItemIcon item={consumables[0]} size={22} />, label: consumables[0].label, title: `Utiliser ${consumables[0].label}` }
      : { key: 'g7-objet', family: 'geste', icon: icon('journal/heal'), label: 'Soigner', title: 'Soigner (Compétence Guérison) — coûte l’Action' },
  ];

  // ── Travée DROITE : la grille de capacités (compte FIXE, remplissage par défaut mesuré) ─────
  const advSkills = [...new Map(combatAdvantageSkills(active).map((s) => [s.skillId, s])).values()];
  const canDispel = actorHasSkill(active, 'langue', 'magick');
  const dispellable = canDispel ? dispellableSpellsOn(battle.combatants) : [];
  const attacks = availableAttacks(active, battle).filter((a) => a.id !== 'arme');
  const spells = (active.spells ?? []).map((id) => findSpellById(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const selfManeuvers = selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m));

  const candidates: Cell[] = [
    { key: 'course', family: 'mouvement', icon: icon('travel/foot'), label: 'Course', title: 'Course : Test d’Athlétisme — montrer la portée réelle avant de désigner la case' },
    { key: 'mouvement', family: 'mouvement', icon: icon('journal/move'), label: 'Mouvement', title: 'Mouvement : montrer la portée de Marche' },
    ...(isEngaged(active) ? [{ key: 'disengage', family: 'mouvement' as const, icon: icon('melee/disengage'), label: 'Se désengager', title: 'Quitter le corps à corps' }] : []),
    { key: 'defend', family: 'defense', icon: icon('flag/defensive'), label: 'Défensive', title: '+20 à tous vos Tests de défense jusqu’à votre prochain tour' },
    // Une Compétence porte l'icône de SA caractéristique (source unique `charIcon`) : six alvéoles
    // d'Avantage ne partagent plus le même glyphe.
    ...advSkills.map((s) => ({
      key: `advantage-${s.skillId}`,
      family: 'avantage' as const,
      icon: icon(charIcon(findSkillById(s.skillId)?.characteristic)),
      label: findSkillById(s.skillId)?.label ?? s.skillId,
      title: `Prendre l’Avantage par ${findSkillById(s.skillId)?.label ?? s.skillId} — coûte l’Action`,
    })),
    ...(hasBattement(active) ? [{ key: 'battement', family: 'avantage' as const, icon: icon('melee/close-in'), label: 'Battement', title: 'Battement : retirer de l’Avantage à un adversaire armé' }] : []),
    ...(hasDistraire(active) ? [{ key: 'distraire', family: 'avantage' as const, icon: icon('flag/focus'), label: 'Distraire', title: 'Distraire : Test opposé d’Athlétisme contre le Calme' }] : []),
    { key: 'resolve', family: 'defense', icon: icon('resource/resolve'), label: `Détermination ${active.resolve ?? 0}`, title: 'Détermination : immunité à la Psychologie, ignorer les modificateurs de critique, retirer un État' },
    ...(dispellable.length > 0 ? [{ key: 'dispel', family: 'magie' as const, icon: icon('action/dispel'), label: 'Dissiper', title: 'Dissiper un sort permanent : désigner son porteur' }] : []),
    ...selfManeuvers.map((m) => ({ key: `self-${m.id}`, family: 'geste' as const, icon: icon('flag/frenzy'), label: m.label, title: m.label })),
    // Attaques de trait : adossées au conduit (elles se paient en crans d'Avantage).
    ...attacks.map((a) => ({ key: `attaque-${a.id}`, family: 'attaque' as const, icon: icon(a.icon), label: a.label, title: a.label, adv: a.cost?.advantage ?? 0 })),
    ...spells.map((sp) => ({ key: `sort-${sp.id}`, family: 'magie' as const, icon: icon('magic/power'), label: sp.label, title: `${sp.label} — incantation` })),
  ];
  const right = candidates.slice(0, RIGHT_CELLS);
  // PONT CLAVIER de la console : les touches 1-8 (`keybindings.ts`, section hotbar) visent la case
  // de MÊME RANG de la grille de capacités. Publier ici est ce qui rend la touche imprimée VRAIE —
  // une case non branchée publie un slot désactivé et n'imprime aucun badge.
  hotbar.slots = Array.from({ length: PRINTED_KEYS }, (_, i) => {
    const c = right[i];
    return { run: c?.run ?? (() => {}), disabled: !c?.run || !!c.disabled };
  });

  const advCap = advantageCapFor(active);
  const meaningfulLeft = isHero && hasMeaningfulOption(active, battle);
  // 3ᵉ ligne de la plaque de sortie : au repos elle imprime SA touche (Espace — `keybindings.ts`
  // `end-turn`), en état d'appel elle dit CE QUI reste (jamais la couleur seule).
  const endNote = meaningfulLeft ? 'ESPACE' : battle.acted ? 'Tour fini' : 'Action intacte';

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
        {/* Travée GAUCHE : l'arsenal, et sous elle le commutateur de sets + la munition. */}
        <div className="cc-bay cc-bay-left">
          <div className="cc-grid cc-grid-left" aria-label="Arsenal">
            {Array.from({ length: LEFT_CELLS }, (_, i) => (
              <ConsoleCell key={i} cell={left[i]} />
            ))}
          </div>
          {/* La rangée du matériel ne se monte QUE si elle a quelque chose à dire : un set unique
              n'a rien à commuter, et une arme sans munition n'a rien à compter — une case isolée
              sous la grille ne désignait rien (grief d'assemblage 2026-08-17). */}
          {(loadouts.length >= 2 || ammoChoices.length > 0) && (
            <div className={`cc-loadouts${setsOpen ? ' on' : ''}`}>
              {loadouts.length >= 2 && (
                <>
                  {/* Poignée de REPLI (composition compacte ≤560px) : le commutateur ne montre que
                      le set au poing, le tap déplie les autres — aucun set ne quitte la console. */}
                  <button
                    type="button"
                    className="chip cc-set cc-sets-toggle"
                    aria-expanded={setsOpen}
                    title={setsOpen ? 'Replier les sets' : 'Déplier les sets'}
                    onClick={() => setSetsOpen((v) => !v)}
                  >
                    <Icon id="item/weapon" size="sm" />
                  </button>
                  {loadouts.map((lo) => {
                    const mainItem = lo.main ? active.items?.find((i) => i.uid === lo.main) : undefined;
                    return (
                      <button
                        key={lo.id}
                        type="button"
                        className={`chip cc-set${active.activeLoadoutId === lo.id ? ' on' : ''}`}
                        disabled={!live || (!!battle.loadoutSwapped && active.activeLoadoutId !== lo.id)}
                        title={`Set : ${loadoutLabel(lo, active)}`}
                        onClick={() => switchLoadout(lo.id)}
                      >
                        {mainItem ? <ItemIcon item={mainItem} size={18} /> : <Icon id="item/weapon" size="sm" />}
                      </button>
                    );
                  })}
                </>
              )}
              {/* La munition ne se montre QUE si l'arme au poing en consomme : un tiret nu adossé à
                  une icône ne disait rien (grief vision). */}
              {ammoChoices.length > 0 && (
                <span className="cc-ammo" title={`Munition : ${ammoChoices[0].label}`}>
                  <Icon id="item/ammo" size="sm" />
                  {ammoChoices[0].label}
                </span>
              )}
            </div>
          )}
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
            <PortraitTile c={active} ring={ring} variant="identity" size="lg" team={active.kind === 'enemy' ? 'enemy' : 'ally'} title={active.label} />
            <ArchGutter kind="action" value={actAvail} max={actMax} label="Action" short="ACTION" spend={previewDelta.action} />
            {/* NICHE D'ÉTATS : même primitive que la tuile du bandeau (`StateChips reserve`), icône +
                INDICE chiffré par État, alvéoles vides toujours dessinées. */}
            <StateChips c={active} max={ARCH_STATE_CELLS} reserve extra={actorStateChips(active, battle)} />
          </div>
          {/* BLESSURES : barre pleine largeur de l'arche, valeur NOMMÉE sur la piste. Le MOT est un
              enfant à part : à 360 la ligne d'arche ne peut pas le porter (texte mesuré 236px pour
              292px d'arche), la composition compacte le retire — le chiffre, la teinte de la piste
              et le `title` disent toujours les Blessures. */}
          <LifeBar
            value={active.wounds.current}
            max={active.wounds.max}
            color={hpColor(active.wounds.max > 0 ? Math.max(0, Math.min(1, active.wounds.current / active.wounds.max)) : 0)}
            overlay
            title={`Blessures : ${active.wounds.current}/${active.wounds.max}`}
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
          <div className="cc-conduit" title={`Avantage : ${active.advantage}/${advCap}`}>
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
              <ConsoleCell key={i} cell={right[i]} hotkey={i < PRINTED_KEYS ? i + 1 : undefined} advantage={active.advantage} />
            ))}
          </div>
        </div>

        {/* Coin de fin de tour : ISOLÉ des deux travées. */}
        <div className="cc-corner">
          <button
            type="button"
            data-cell="end-turn"
            className={`chip cc-cell cc-end${!meaningfulLeft ? ' pulse' : ''}`}
            disabled={!live}
            title="Finir le tour"
            onClick={endTurn}
          >
            <span className="cc-ico">
              <Icon id="ui/turn-end" />
            </span>
            <span className="cc-lbl">Fin du tour</span>
            <span className="cc-key">{endNote}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
