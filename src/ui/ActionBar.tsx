import { useGame, activeCombatant, entityPickables } from '../state/store';
import { findSpell } from '../data/index';
import { isArcaneSpell } from '../engine/magic';
import { canTakeAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { itemUse } from '../engine/consumables';

const RING = ['#4f8fe0', '#37c07a', '#e0b13f', '#b455c9'];

/**
 * Barre d'action (hotbar) en bas de l'écran, façon Baldur's Gate / NWN : elle
 * affiche les actions du combattant ACTIF (à qui c'est le tour). C'est là que
 * viennent toutes les manœuvres (déplacer, attaquer, incanter, défensive, …) pour
 * ne pas surcharger le panneau d'info de droite. Conçue pour s'étendre : ajouter
 * une manœuvre = un slot de plus.
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
  const useItem = useGame((s) => s.battleUseItem);
  const spendResolve = useGame((s) => s.battleSpendResolve);
  const pickup = useGame((s) => s.battlePickup);
  const scene = useGame((s) => s.scene);
  const flags = useGame((s) => s.flags);
  if (!battle || battle.over) return null;
  const active = activeCombatant(battle);
  if (!active) return null;

  const isHero = active.kind === 'hero';
  const hasSpells = isHero && (active.spells?.length ?? 0) > 0;
  const stunned = !canTakeAction(active); // Sonné : aucune Action ce tour, seul le déplacement (à demi-Mouvement)
  const engaged = isHero && isEngaged(active); // Engagé : pas de déplacement libre ni de Charge (LDB 15-Dépl)
  const canCharge = isHero && !engaged && active.weapons[0]?.type === 'melee';
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
  // Objets au sol ramassables sur/adjacents à la case du combattant actif (LDB ch.13 l.115-116).
  const groundItems =
    isHero && active.pos
      ? (scene?.entities ?? [])
          .filter(
            (e) =>
              e.kind === 'objet' &&
              Math.max(Math.abs(e.pos.x - active.pos!.x), Math.abs(e.pos.y - active.pos!.y)) <= 1 &&
              !flags[`__fouille_${e.id}`],
          )
          .flatMap((e) => entityPickables(e).map((p) => ({ entityId: e.id, ...p })))
      : [];

  const hint =
    battle.action === 'move'
      ? 'Cliquez une case bleue pour vous déplacer.'
      : battle.action === 'attack'
        ? "Cliquez un ennemi adjacent pour l'attaquer."
        : battle.action === 'charge'
          ? 'Cliquez un ennemi à charger (jusqu’à 2× le Mouvement).'
          : battle.action === 'cast' && battle.selectedSpell
            ? `Cliquez une cible pour lancer ${battle.selectedSpell}.`
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
                <button
                  className={`btn btn-sm ${selected ? 'btn-primary' : ''}`}
                  onClick={() => selectSpell(label)}
                  title={spell.desc}
                >
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
      {usableGroups.length > 0 && battle.action === 'use' && (
        <div className="ab-spells">
          {usableGroups.map((g) => (
            <div key={g.name} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => useItem(g.uids[0])} title={g.desc}>
                🧪 {g.name}
                {g.uids.length > 1 ? ` ×${g.uids.length}` : ''}
              </button>
            </div>
          ))}
        </div>
      )}
      {removableConditions.length > 0 && battle.action === 'resolve' && (
        <div className="ab-spells">
          {removableConditions.map((c) => (
            <div key={c.name} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => spendResolve(c.name)} title="Dépense un point de Détermination pour retirer cet État (LDB Destin)">
                ✊ Retirer {c.name}
                {c.value > 1 ? ` (${c.value})` : ''}
              </button>
            </div>
          ))}
        </div>
      )}
      {groundItems.length > 0 && battle.action === 'pickup' && (
        <div className="ab-spells">
          {groundItems.map((g) => (
            <div key={`${g.entityId}:${g.key}`} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => pickup(g.entityId, g.key)} title="Ramasser cet objet (coûte l'Action) — LDB Combat">
                ✋ {g.label}
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
              disabled={battle.acted || stunned}
              onClick={() => selectAction(battle.action === 'attack' ? null : 'attack')}
            >
              <span className="ab-ico">⚔️</span>
              <span className="ab-lbl">Attaquer{battle.acted && ' ✓'}</span>
            </button>
            {canCharge && (
              <button
                className={`ab-slot ${battle.action === 'charge' ? 'on' : ''}`}
                disabled={battle.moved || battle.acted || stunned}
                onClick={() => selectAction(battle.action === 'charge' ? null : 'charge')}
                title="Se ruer au contact (jusqu'à 2× le Mouvement) puis attaquer — gagne de l'Avantage (LDB Charge)"
              >
                <span className="ab-ico">🏃</span>
                <span className="ab-lbl">Charger</span>
              </button>
            )}
            {hasSpells && (
              <button
                className={`ab-slot ${battle.action === 'cast' ? 'on' : ''}`}
                disabled={battle.acted || stunned}
                onClick={() => selectAction(battle.action === 'cast' ? null : 'cast')}
              >
                <span className="ab-ico">✨</span>
                <span className="ab-lbl">Incanter{battle.acted && ' ✓'}</span>
              </button>
            )}
            <button
              className="ab-slot"
              disabled={battle.acted || stunned}
              onClick={defendTotal}
              title="+20 à tous vos Tests de défense jusqu'à votre prochain tour"
            >
              <span className="ab-ico">🛡️</span>
              <span className="ab-lbl">Défensive{battle.acted && ' ✓'}</span>
            </button>
            {usableGroups.length > 0 && (
              <button
                className={`ab-slot ${battle.action === 'use' ? 'on' : ''}`}
                disabled={battle.acted || stunned}
                onClick={() => selectAction(battle.action === 'use' ? null : 'use')}
                title="Boire/utiliser un objet (potion…) — coûte l'Action"
              >
                <span className="ab-ico">🧪</span>
                <span className="ab-lbl">Utiliser{battle.acted && ' ✓'}</span>
              </button>
            )}
            {engaged && (
              <button
                className="ab-slot"
                disabled={battle.acted}
                onClick={disengage}
                title="Quitter le corps à corps : sacrifier l'Avantage (si supérieur), sinon tenter une Esquive (LDB Désengagement)"
              >
                <span className="ab-ico">🚪</span>
                <span className="ab-lbl">Se désengager</span>
              </button>
            )}
            {removableConditions.length > 0 && (
              <button
                className={`ab-slot ${battle.action === 'resolve' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'resolve' ? null : 'resolve')}
                title="Détermination : retirer un État (ne coûte pas l'Action) — LDB Destin"
              >
                <span className="ab-ico">✊</span>
                <span className="ab-lbl">Détermination ({resolve})</span>
              </button>
            )}
            {groundItems.length > 0 && (
              <button
                className={`ab-slot ${battle.action === 'pickup' ? 'on' : ''}`}
                disabled={battle.acted || stunned}
                onClick={() => selectAction(battle.action === 'pickup' ? null : 'pickup')}
                title="Ramasser un objet au sol adjacent (coûte l'Action) — LDB Combat"
              >
                <span className="ab-ico">✋</span>
                <span className="ab-lbl">Ramasser{battle.acted && ' ✓'}</span>
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
