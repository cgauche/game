import { useGame } from '../state/store';
import { combatFeed, narrateIntent } from '../gameIso/combatNarration';
import { Icon } from './Icon';

/**
 * Bandeau haut : annonce le beat de combat COURANT — projection de DEUX sources existantes (zéro état
 * dédié) : l'INTENTION télégraphiée de l'IA (`actorAim` → « X charge / vise / lance un sort sur Y »),
 * sinon le RÉSULTAT (dernière ligne importante du journal, héros comme ennemis). Le `ton` (critique /
 * mise à mort / Peur) renforce l'entrée pour qu'on ne la rate plus ; la `key` ré-anime à chaque beat.
 * La TENUE est portée par la cadence (`combatDirector.beatHold`), pas ici. Affichage seul.
 */
export function CombatBanner() {
  const battle = useGame((s) => s.battle);
  const aim = useGame((s) => s.actorAim);
  if (!battle || battle.over) return null;
  const line = aim ? narrateIntent(aim, battle.combatants) : combatFeed(battle.log, battle.combatants, 1)[0];
  if (!line) return null;
  // key : l'intention re-anime quand la cible change ; le résultat quand sa ligne change.
  const key = aim ? `aim-${aim.fromId}-${aim.toId}-${aim.kind}` : line.raw;

  return (
    <div className="combat-feed">
      <div key={key} className={`cb-ev cb-now cb-tone-${line.tone}`}>
        <span className="cb-ic"><Icon id={line.icon} size={15} /></span>
        <span className="cb-tx">
          {line.segments.map((s, j) =>
            s.team ? (
              <b key={j} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}>{s.text}</b>
            ) : (
              <span key={j}>{s.text}</span>
            ),
          )}
        </span>
      </div>
    </div>
  );
}
