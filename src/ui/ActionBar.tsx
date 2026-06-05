import { useGame, activeCombatant } from '../state/store';
import { findSpell } from '../data/index';
import { isArcaneSpell } from '../engine/magic';
import { canTakeAction } from '../engine/conditions';

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
  if (!battle || battle.over) return null;
  const active = activeCombatant(battle);
  if (!active) return null;

  const isHero = active.kind === 'hero';
  const hasSpells = isHero && (active.spells?.length ?? 0) > 0;
  const stunned = !canTakeAction(active); // Sonné : aucune Action ce tour, seul le déplacement (à demi-Mouvement)
  const heroIdx = party.findIndex((h) => h.id === active.id);
  const ring = heroIdx >= 0 ? RING[heroIdx % RING.length] : '#c0392b';

  const hint =
    battle.action === 'move'
      ? 'Cliquez une case bleue pour vous déplacer.'
      : battle.action === 'attack'
        ? "Cliquez un ennemi adjacent pour l'attaquer."
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
              disabled={battle.moved}
              onClick={() => selectAction(battle.action === 'move' ? null : 'move')}
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
