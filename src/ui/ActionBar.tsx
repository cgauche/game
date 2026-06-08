import { useGame, activeCombatant, entityPickables, trampleTarget } from '../state/store';
import { findSpell } from '../data/index';
import { isArcaneSpell } from '../engine/magic';
import { canTakeAction, hasCondition } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzyCapable } from '../engine/psychology';
import { itemUse } from '../engine/consumables';
import { compatibleAmmo } from '../engine/items';
import { hasHealSkill, healableTargets, availableHealModes } from '../engine/healing';
import { mountableNear } from '../state/mount';
import type { Combatant } from '../engine/types';

const RING = ['#4f8fe0', '#37c07a', '#e0b13f', '#b455c9'];
const bleedStacks = (c: Combatant) => c.conditions.find((x) => x.name === 'Hémorragique')?.value ?? 0;

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
  const selectAmmo = useGame((s) => s.battleSelectAmmo);
  const aim = useGame((s) => s.battleAim);
  const heal = useGame((s) => s.battleHeal);
  const scene = useGame((s) => s.scene);
  const flags = useGame((s) => s.flags);
  if (!battle || battle.over) return null;
  const active = activeCombatant(battle);
  if (!active) return null;

  const isHero = active.kind === 'hero';
  const hasSpells = isHero && (active.spells?.length ?? 0) > 0;
  const stunned = !canTakeAction(active); // Sonné : aucune Action ce tour, seul le déplacement (à demi-Mouvement)
  const engaged = isHero && isEngaged(active); // Engagé : pas de déplacement libre ni de Charge (LDB 15-Dépl)
  // Combat monté (LDB 14) : descendre si à cheval ; enfourcher une monture libre adjacente (coûte l'Action).
  const mounted = isHero && !!active.mountId;
  const mountCandidate = isHero && !active.mountId && !battle.acted && !stunned ? mountableNear(battle, active) : undefined;
  const prone = isHero && hasCondition(active, 'À Terre'); // À Terre (LDB 16 l.37) : ni Charge ni Course
  const broken = isHero && hasCondition(active, 'Brisé'); // Brisé (LDB 16 l.55) : fuir/se cacher uniquement, aucune action offensive
  const canCharge = isHero && !engaged && !prone && !broken && active.weapons[0]?.type === 'melee';
  // Course (LDB 15-Dépl l.79-82) : Action + Test d'Athlétisme (+20) → déplacement étendu.
  const canRun = isHero && !engaged && !prone && !battle.moved && !battle.acted && !stunned;
  // Se relever (LDB 16 l.37) : possible si À Terre, ≥1 PB (LDB 18 l.28) et Mouvement non dépensé.
  const canStandUp = prone && active.wounds.current > 0 && !battle.moved;
  // Piétinement (LDB 85 l.320-321) : action gratuite si ≥1 Avantage et un adversaire adjacent plus petit.
  const canTrample = isHero && active.advantage >= 1 && !!trampleTarget(battle, active);
  // Frénésie (LDB 21 l.31-32) : un héros capable peut tenter d'entrer en Frénésie (Test de FM, coûte l'Action).
  const canFrenzy = isHero && isFrenzyCapable(active) && !active.frenzied && !battle.acted && !stunned;
  const heroIdx = party.findIndex((h) => h.id === active.id);
  const ring = heroIdx >= 0 ? RING[heroIdx % RING.length] : '#c0392b';

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

  // Guérison (LDB 09-Compétences) : soi + alliés (héros) adjacents soignables, si le héros a la Compétence.
  const canHeal = isHero && hasHealSkill(active) && !battle.acted && !stunned;
  const healTargets = canHeal ? healableTargets(active, battle.combatants.filter((c) => c.kind === 'hero'), { adjacency: true }) : [];

  // Catégories repliables : on n'affiche le bouton conteneur que si ≥1 enfant existe.
  const hasMvt = canCharge || canRun || canStandUp || engaged || mounted || !!mountCandidate;
  const hasTir = !!rangedW;
  const hasObjets = usableGroups.length > 0 || groundItems.length > 0;

  const hint =
    battle.action === 'move'
      ? 'Cliquez une case bleue pour vous déplacer.'
      : battle.action === 'attack'
        ? "Cliquez un ennemi adjacent pour l'attaquer."
        : battle.action === 'charge'
          ? 'Cliquez un ennemi à charger (jusqu’à 2× le Mouvement).'
          : battle.action === 'cast' && battle.selectedSpell
            ? `Cliquez une cible pour lancer ${battle.selectedSpell}.`
            : battle.action === 'trample'
              ? 'Cliquez un adversaire adjacent plus petit à piétiner (coûte 1 Avantage).'
              : battle.action === 'heal'
                ? 'Choisissez la cible à soigner (soi ou allié adjacent).'
                : null;

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
            return (
              <div key={label} className="ab-spell-row">
                <button className={`btn btn-sm ${selected ? 'btn-primary' : ''}`} onClick={() => selectSpell(label)} title={spell.desc}>
                  {spell.label} <span className="bp-spell-ni">({ni})</span>
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
          {healTargets.flatMap((t) =>
            availableHealModes(t).map((m) => (
              <div key={`${t.id}:${m}`} className="ab-spell-row">
                <button className="btn btn-sm" onClick={() => heal(t.id, m)} title="Test de Guérison Intermédiaire (+0) — coûte l'Action (LDB 09-Compétences)">
                  {m === 'wounds'
                    ? `🩹 Soigner ${t.name} (${t.wounds.current}/${t.wounds.max})`
                    : `🩸 Stopper l'hémorragie de ${t.name} (${bleedStacks(t)} pion)`}
                </button>
              </div>
            )),
          )}
        </div>
      )}
      {battle.action === 'mvt' && (
        <div className="ab-spells">
          {canCharge && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.moved || battle.acted || stunned} onClick={() => selectAction('charge')} title="Se ruer au contact (jusqu'à 2× le Mouvement) puis attaquer (LDB Charge)">🏃 Charger</button>
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
              <button className="btn btn-sm" disabled={battle.acted} onClick={disengage} title="Quitter le corps à corps (Esquive / sacrifice d'Avantage, LDB Désengagement)">🚪 Se désengager</button>
            </div>
          )}
          {mountCandidate && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={mountUp} title="Enfourcher cette monture (combat monté, LDB 14) — coûte l'Action">🐎 Monter sur {mountCandidate.name}</button>
            </div>
          )}
          {mounted && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || broken} onClick={dismount} title="Descendre de sa monture (à pied, case libre adjacente) — coûte l'Action">🥾 Descendre de monture</button>
            </div>
          )}
        </div>
      )}
      {battle.action === 'tir' && (
        <div className="ab-spells">
          {rangedW && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || active.aiming} onClick={aim} title="Viser : +20 (Accessible) au prochain tir — coûte l'Action (LDB Difficultés)">🎯 {active.aiming ? 'En joue ✓' : 'Viser'}</button>
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
      {battle.action === 'objets' && (
        <div className="ab-spells">
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

      {stunned && isHero && <div className="ab-hint">Sonné : aucune Action ce tour (déplacement à demi-Mouvement).</div>}
      {hint && <div className="ab-hint">{hint}</div>}

      <div className="ab-bar">
        <div className="ab-actor">
          <span className="ab-portrait" style={{ borderColor: ring, color: ring }}>
            {active.name.charAt(0)}
          </span>
          <div className="ab-actor-info">
            <strong>{active.name}</strong>
            <span className="ab-meta">
              {active.career ?? (isHero ? '' : 'Ennemi')} · {active.wounds.current}/{active.wounds.max}
              {active.advantage > 0 && <span className="adv"> Av+{active.advantage}</span>}
            </span>
          </div>
        </div>

        {isHero ? (
          <div className="ab-slots">
            {/* ── Primaires directs ── */}
            <button
              className={`ab-slot ${battle.action === 'move' ? 'on' : ''}`}
              disabled={battle.moved || (engaged && battle.acted)}
              onClick={() => selectAction(battle.action === 'move' ? null : 'move')}
              title={engaged ? 'Engagé : « Déplacer » lance un Désengagement (Esquive ou sacrifice d’Avantage)' : undefined}
            >
              <span className="ab-ico">🦶</span>
              <span className="ab-lbl">Déplacer{battle.moved && ' ✓'}</span>
            </button>
            <button
              className={`ab-slot ${battle.action === 'attack' ? 'on' : ''}`}
              disabled={battle.acted || stunned || broken}
              onClick={() => selectAction(battle.action === 'attack' ? null : 'attack')}
            >
              <span className="ab-ico">⚔️</span>
              <span className="ab-lbl">Attaquer{battle.acted && ' ✓'}</span>
            </button>
            {hasSpells && (
              <button
                className={`ab-slot ${battle.action === 'cast' ? 'on' : ''}`}
                disabled={battle.acted || stunned || broken}
                onClick={() => selectAction(battle.action === 'cast' ? null : 'cast')}
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

            {/* ── Catégories repliables ── */}
            {hasMvt && (
              <button
                className={`ab-slot ${battle.action === 'mvt' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'mvt' ? null : 'mvt')}
                title="Manœuvres de déplacement (Charger, Courir, Se relever, Se désengager)"
              >
                <span className="ab-ico">🏃</span>
                <span className="ab-lbl">Mouvement ▾</span>
              </button>
            )}
            {hasTir && (
              <button
                className={`ab-slot ${battle.action === 'tir' || battle.action === 'ammo' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'tir' || battle.action === 'ammo' ? null : 'tir')}
                title="Options de tir (Viser, Recharger, Munition)"
              >
                <span className="ab-ico">🏹</span>
                <span className="ab-lbl">Tir ▾</span>
              </button>
            )}
            {hasObjets && (
              <button
                className={`ab-slot ${battle.action === 'objets' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'objets' ? null : 'objets')}
                title="Objets : utiliser une potion, ramasser au sol"
              >
                <span className="ab-ico">🧪</span>
                <span className="ab-lbl">Objets ▾</span>
              </button>
            )}

            {/* ── Alerte visible (hors catégorie) ── */}
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

            {/* ── Contextuels rares ── */}
            {canFrenzy && (
              <button
                className="ab-slot"
                onClick={frenzy}
                title="Entrer en Frénésie : Test de Force Mentale — coûte l'Action (LDB 21)"
              >
                <span className="ab-ico">🐗</span>
                <span className="ab-lbl">Frénésie</span>
              </button>
            )}
            {canTrample && (
              <button
                className={`ab-slot ${battle.action === 'trample' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'trample' ? null : 'trample')}
                title="Piétiner un adversaire adjacent plus petit : action gratuite à 1 Avantage (LDB Taille)"
              >
                <span className="ab-ico">🐾</span>
                <span className="ab-lbl">Piétiner</span>
              </button>
            )}

            <button className="ab-slot ab-end" onClick={endTurn}>
              <span className="ab-ico">⏭️</span>
              <span className="ab-lbl">Fin du tour</span>
            </button>
          </div>
        ) : (
          <div className="ab-enemy">⚔️ Tour de l'ennemi…</div>
        )}
      </div>
    </div>
  );
}
