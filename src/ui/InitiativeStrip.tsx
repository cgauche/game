import { PortraitTile } from './PortraitTile';
import { ALLY_TINT, ENEMY_TINT } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Frise d'INITIATIVE (haut du champ, façon BG3) : une tuile-portrait par combattant dans l'ordre
 * du Round (`battle.order`), cadre = teinte d'ÉQUIPE (vert allié / rouge ennemi — la forme
 * pleine/tirets du cadre vient de RigPortrait, R9 daltonisme), actif = or + ▼, KO grisé ✕.
 * Pendant la pause de début de Round (LDB ch.17 l.27), badge « ⏫🍀 » sous les héros éligibles
 * (pré-emption d'initiative — l'ancien « Agir en premier » de BattlePanel). Chip « Round N » +
 * toggle 🔍 d'inspection au bout. Pur à props — câblé par CampaignView.
 */
export interface InitiativeStripProps {
  order: string[];
  turn: number;
  round: number;
  combatants: Combatant[];
  /** battle.over != null → plus de marqueur actif. */
  over: boolean;
  /** Round de la pause d'initiative en cours (pendingRoundStart), sinon null. */
  pendingRound: number | null;
  /** Ids des combattants pouvant « agir en premier » (canActFirst, calculé par CampaignView). */
  canFirstIds: string[];
  inspectEnabled: boolean;
  onToggleInspect: () => void;
  onInspect?: (id: string) => void;
  onPromote: (id: string) => void;
}

export function InitiativeStrip(p: InitiativeStripProps) {
  return (
    <div className="initiative-strip">
      <div className="is-tiles">
        {p.order.map((id, i) => {
          const c = p.combatants.find((x) => x.id === id);
          if (!c) return null;
          const isHero = c.kind === 'hero';
          return (
            <div key={id} className="is-cell">
              <PortraitTile
                c={c}
                ring={isHero ? ALLY_TINT : ENEMY_TINT}
                size={40}
                active={!p.over && i === p.turn}
                onClick={p.onInspect ? () => p.onInspect!(id) : undefined}
                title={p.onInspect ? `${c.name} — inspecter` : c.name}
              />
              {p.canFirstIds.includes(id) && (
                <button
                  type="button"
                  className="is-first"
                  onClick={() => p.onPromote(id)}
                  title={`Dépense 1 point de Chance pour qu'${c.name} agisse en premier ce Round (LDB Destin)`}
                >
                  ⏫🍀{c.fortune ?? 0}
                </button>
              )}
            </div>
          );
        })}
        <span className="is-round">Round {p.round}</span>
        <button
          type="button"
          className={`inspect-toggle ${p.inspectEnabled ? 'on' : ''}`}
          onClick={p.onToggleInspect}
          title={p.inspectEnabled ? 'Inspection activée — tape un portrait pour voir son statbloc. Cliquer pour désactiver.' : 'Activer l’inspection des combattants (statbloc au tap sur la frise)'}
        >
          🔍 {p.inspectEnabled ? 'On' : 'Off'}
        </button>
      </div>
      {p.pendingRound != null && <div className="is-pause">⏳ Round {p.pendingRound} — choisis qui agit en premier</div>}
    </div>
  );
}
