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
import type { Combatant } from '../engine/types';
import { HERO_RING, ENEMY_RING } from '../gameIso/teamColors';
import { PortraitTile } from './PortraitTile';
import { TeamPortrait } from './CombatantBadge';

const bleedStacks = (c: Combatant) => c.conditions.find((x) => x.name === 'Hémorragique')?.value ?? 0;

/** Mini-jauge à bâtons colorée, SANS icône — le survol (title) nomme la ressource. Pleins = restants.
 *  `max` absent → jauge de pool (tous pleins). Rien rendu si total ≤ 0 (compteur masqué quand vide). */
function Gauge({ kind, value, max, title }: { kind: string; value: number; max?: number; title: string }) {
  const total = Math.max(max ?? value, 0);
  if (total <= 0) return null;
  return (
    <span className={`ab-g ab-g-${kind}`} title={title} aria-label={title}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={`gp ${i < value ? 'on' : 'off'}`} />
      ))}
    </span>
  );
}

/**
 * Barre d'action (hotbar) du combattant ACTIF, façon Baldur's Gate / NWN. Désencombrée :
 * primaires directs (Déplacer/Attaquer/Incanter/Soigner/Défensive) ; manœuvres situationnelles
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
  const run = useGame((s) => s.battleRun);
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
  const canCharge = isHero && !engaged && !prone && !broken && active.weapons[0]?.type === 'melee';
  // Course (LDB 15-Dépl l.79-82) : Action + Test d'Athlétisme (+20) → déplacement étendu.
  const canRun = isHero && !engaged && !prone && !moveStarted && !battle.acted && !stunned;
  // Se relever (LDB 16 l.37) : possible si À Terre, ≥1 PB (LDB 18 l.28) et Mouvement non entamé.
  const canStandUp = prone && active.wounds.current > 0 && !moveStarted;
  // Piétinement (LDB 85 l.320-321) : action gratuite si ≥1 Avantage et un adversaire adjacent plus petit.
  const canTrample = isHero && active.advantage >= 1 && !!trampleTarget(battle, active);
  // Frénésie (LDB 21 l.31-32) : un héros capable peut tenter d'entrer en Frénésie (Test de FM, coûte l'Action).
  const canFrenzy = isHero && isFrenzyCapable(active) && !active.frenzied && !battle.acted && !stunned;
  // Frénésie : l'attaque CC gratuite (LDB 21 l.34) reste possible même l'Action dépensée (entrée en Frénésie incluse).
  const freeFrenzy = isHero && !!active.frenzied && !active.frenzyFreeUsed;
  // Jauge d'Action : 1 Action de base (+1 attaque gratuite si frénétique). Pleins = encore disponibles.
  const actMax = 1 + (active.frenzied ? 1 : 0);
  const actAvail = (battle.acted ? 0 : 1) + (freeFrenzy ? 1 : 0);
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
  const canHeal = isHero && hasHealSkill(active) && !battle.acted && !stunned;
  const healTargets = canHeal ? healableTargets(active, battle.combatants.filter((c) => c.kind === 'hero'), { adjacency: true }) : [];

  // Catégories repliables : on n'affiche le bouton conteneur que si ≥1 enfant existe.
  const hasMvt = canCharge || canRun || canStandUp || engaged || mounted || !!mountCandidate;
  const hasTir = !!rangedW;
  const hasObjets = usableGroups.length > 0 || groundItems.length > 0;
  // « Spécial » regroupe TOUT le situationnel (déplacement, tir, objets, Frénésie, Piétiner).
  const hasSpecial = hasMvt || hasTir || hasObjets || canFrenzy || canTrample;

  return (
    <div className="action-bar">
      {hasSpells && battle.action === 'cast' && (
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
              <TeamPortrait combatant={t} size={34} />
              <span className="ab-heal-name">{t.name}</span>
              {availableHealModes(t).filter((m) => m !== 'trauma' && m !== 'surgery').map((m) => ( // convalescence/chirurgie = hors combat
                <button key={m} className="btn btn-sm" onClick={() => heal(t.id, m)} title="Test de Guérison Intermédiaire (+0) — coûte l'Action (LDB 09-Compétences)">
                  {m === 'wounds' ? `🩹 ${t.wounds.current}/${t.wounds.max}` : `🩸 ${bleedStacks(t)} pion`}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {battle.action === 'mvt' && (
        <div className="ab-spells">
          {/* « Spécial » : toutes les manœuvres situationnelles regroupées (déplacement, tir, objets, rares). */}
          {canCharge && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={moveStarted || (battle.acted && !freeFrenzy) || stunned} onClick={() => selectAction('charge')} title="Se ruer au contact (jusqu'à 2× le Mouvement) puis attaquer (LDB Charge)">🏃 Charger</button>
            </div>
          )}
          {canRun && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={run} title="Courir : Action + Test d'Athlétisme (+20) → déplacement étendu (LDB 15)">💨 Courir</button>
            </div>
          )}
          {canStandUp && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={standUp} title="Se relever de l'État À Terre — utilise le Mouvement (LDB 16)">🧍 Se relever</button>
            </div>
          )}
          {engaged && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted && !canFreeDisengage} onClick={disengage} title="Quitter le corps à corps (Esquive si Action dispo, sinon sacrifice d'Avantage — LDB 15 l.84-89)">🚪 Se désengager</button>
            </div>
          )}
          {mountCandidate && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={moveStarted || broken} onClick={mountUp} title="Enfourcher cette monture (combat monté, LDB 14) — coûte le Mouvement (pas de jet → pas une Action)">🐎 Monter sur {mountCandidate.name}</button>
            </div>
          )}
          {mounted && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={moveStarted || broken} onClick={dismount} title="Descendre de sa monture (à pied, case libre adjacente) — coûte le Mouvement (pas de jet → pas une Action)">🥾 Descendre de monture</button>
            </div>
          )}
          {rangedW && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || active.aiming} onClick={aim} title="Viser : +20 (Accessible) au prochain tir — coûte l'Action (LDB Difficultés)">🎯 {active.aiming ? 'En joue ✓' : 'Viser'}</button>
            </div>
          )}
          {canPush && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={togglePushback} title="Perturbante : la prochaine attaque réussie repousse d'1 m par DR au lieu de causer des Dégâts (LDB 62)">↩️ {active.pushbackMode ? 'Repousser ✓' : 'Repousser'}</button>
            </div>
          )}
          {needsReload && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={reload} title="Recharger (Test étendu de Projectiles — coûte l'Action)">🔄 Recharger{active.reloadProgress ? ` (${active.reloadProgress}/${rangedW!.reload} DR)` : ''}</button>
            </div>
          )}
          {ammoChoices.length > 1 && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => selectAction('ammo')} title="Choisir la munition à tirer">🏹 Munition</button>
            </div>
          )}
          {usableGroups.map((g) => (
            <div key={g.name} className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={() => useItem(g.uids[0])} title={g.desc}>🧪 {g.name}{g.uids.length > 1 ? ` ×${g.uids.length}` : ''}</button>
            </div>
          ))}
          {groundItems.map((g) => (
            <div key={`${g.entityId}:${g.key}`} className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={() => pickup(g.entityId, g.key)} title="Ramasser cet objet au sol (coûte l'Action) — LDB Combat">✋ {g.label}</button>
            </div>
          ))}
          {canFrenzy && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={frenzy} title="Entrer en Frénésie : Test de Force Mentale — coûte l'Action (LDB 21)">🐗 Frénésie</button>
            </div>
          )}
          {canTrample && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => selectAction('trample')} title="Piétiner un adversaire adjacent plus petit : action gratuite à 1 Avantage (LDB Taille)">🐾 Piétiner</button>
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
            <button className="btn btn-sm" onClick={resolvePsychImmune} title="Détermination : immunisé à la Psychologie jusqu'à la fin du prochain Round (LDB 17 l.62)">
              🛡️ Immunité Psychologie (ce Round + le prochain)
            </button>
          </div>
          {(active.traumas?.length ?? 0) > 0 && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={resolveIgnoreCrit} title="Détermination : ignorer les modificateurs de Blessure critique ce Round (LDB 17 l.64)">
                🩹 Ignorer modifs de critique (ce Round)
              </button>
            </div>
          )}
          {removableConditions.map((c) => (
            <div key={c.name} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => spendResolve(c.name)} title="Dépense un point de Détermination pour retirer cet État (LDB Destin)">
                ✊ Retirer {c.name}{c.value > 1 ? ` (${c.value})` : ''}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ab-bar">
        <div className="ab-actor">
          {/* Tuile-portrait partagée (même système que le dock/la frise) : portrait + jauge de PV
              verticale interne + PV chiffrés + états — remplace l'ancien bloc large portrait+barre. */}
          <PortraitTile c={active} ring={ring} size={72} showPv title={active.career ? `${active.name} — ${active.career}` : active.name} />
          <div className="ab-actor-side">
            <div className="ab-actor-top">
              <span className="ab-name" title={active.career ? `${active.name} — ${active.career}` : active.name}>{active.name}</span>
              {active.advantage > 0 && <span className="adv">Av+{active.advantage}</span>}
              {assailliN >= 2 && (
                <span className="ab-assailli" title={`${assailliN} ennemis au contact`}>⚔️ ×{assailliN}</span>
              )}
            </div>
            {/* RESSOURCES DU TOUR uniquement (bâtons colorés, survol = title) : Action + Mouvement — le PV
                est dans le portrait. Chance/Résilience/Détermination/Destin sont des points PERMANENTS (pas
                une ressource de tour) → pas affichés ici ; ils restent sur la fiche et dans les modales. */}
            {isHero && (
              <div className="ab-stats">
                <Gauge kind="action" value={actAvail} max={actMax} title={`Action${actMax > 1 ? 's' : ''} disponible${actAvail > 1 ? 's' : ''} : ${actAvail}/${actMax}${active.frenzied ? ' (dont attaque gratuite de Frénésie)' : ''}`} />
                <Gauge kind="move" value={moveLeft} max={moveMax} title={`Mouvement : ${moveLeft}/${moveMax} case${moveMax > 1 ? 's' : ''}`} />
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
            {/* ── Primaires directs ── */}
            <button
              className={`ab-slot ${battle.action === 'move' ? 'on' : ''}`}
              disabled={engaged ? (battle.acted && !canFreeDisengage) : !canMoveNow}
              onClick={() => selectAction(battle.action === 'move' ? null : 'move')}
              title={engaged ? 'Engagé : « Déplacer » lance un Désengagement (Esquive ou sacrifice d’Avantage)' : (battle.acted && battle.movedPreAction) ? 'Mouvement déjà fait avant l’Action : pas de Mouvement → Action → Mouvement' : moveStarted ? `Mouvement décomposable : ${moveLeft} case${moveLeft > 1 ? 's' : ''} restante${moveLeft > 1 ? 's' : ''}` : undefined}
            >
              <span className="ab-ico">🦶</span>
              <span className="ab-lbl">Déplacer{moveStarted ? (moveLeft > 0 ? ` (${moveLeft})` : ' ✓') : ''}</span>
            </button>
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
            <button
              className={`ab-slot ${battle.action === 'attack' ? 'on' : ''}`}
              disabled={(battle.acted && !freeFrenzy) || stunned || broken}
              onClick={() => selectAction(battle.action === 'attack' ? null : 'attack')}
              title={freeFrenzy && battle.acted ? 'Attaque GRATUITE de Frénésie (ne consomme pas l’Action)' : 'Attaquer une cible : mêlée à portée d’Allonge, ou tir selon la distance — coûte l’Action'}
            >
              <span className="ab-ico">⚔️</span>
              <span className="ab-lbl">Attaquer{freeFrenzy && battle.acted ? ' 🐗 libre' : battle.acted ? ' ✓' : ''}</span>
            </button>
            {hasSpells && (
              <button
                className={`ab-slot ${battle.action === 'cast' ? 'on' : ''}`}
                disabled={battle.acted || stunned || broken}
                onClick={() => selectAction(battle.action === 'cast' ? null : 'cast')}
                title="Incanter un sort (Test de Langage mystique) — coûte l'Action (LDB Magie)"
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
                title="Soigner (Compétence Guérison) : rend des PB ou stoppe une hémorragie — coûte l'Action (LDB 09-Compétences)"
              >
                <span className="ab-ico">🩹</span>
                <span className="ab-lbl">Soigner</span>
              </button>
            )}
            <button
              className="ab-slot"
              disabled={battle.acted || stunned || broken}
              onClick={defendTotal}
              title="+20 à tous vos Tests de défense jusqu'à votre prochain tour"
            >
              <span className="ab-ico">🛡️</span>
              <span className="ab-lbl">Défensive{battle.acted && ' ✓'}</span>
            </button>
            {onFire && (
              <button
                className="ab-slot"
                disabled={battle.acted || stunned}
                onClick={() => recoverState('En flammes')}
                title="Se rouler au sol pour éteindre les flammes (Test d'Athlétisme — coûte l'Action, LDB 16 l.77)"
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
                title="Se libérer de l'entrave (Test opposé de Force contre la source — coûte l'Action, LDB 16 l.61)"
              >
                <span className="ab-ico">🪢</span>
                <span className="ab-lbl">Se libérer{battle.acted && ' ✓'}</span>
              </button>
            )}

            {/* ── Spécial : TOUTES les manœuvres situationnelles regroupées ── */}
            {hasSpecial && (
              <button
                className={`ab-slot ${battle.action === 'mvt' || battle.action === 'ammo' || battle.action === 'trample' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'mvt' || battle.action === 'ammo' || battle.action === 'trample' ? null : 'mvt')}
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
                title="Détermination : retirer un État (ne coûte pas l'Action) — LDB Destin"
              >
                <span className="ab-ico">✊</span>
                <span className="ab-lbl">Détermination ({resolve})</span>
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
