import { PortraitTile } from './PortraitTile';
import { ALLY_TINT, ENEMY_TINT } from '../gameIso/teamColors';
import { strikesLast } from '../engine/qualities/dispatch';
import { baseWithTraits } from '../engine/characteristics';
import { talentInitiativeBonus } from '../engine/combatFeatures/dispatch';
import { rule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { Icon } from './Icon';

/** Infobulle détaillant le calcul d'Initiative (`rollInitiative`, `state/combatSetup.ts`) pour le
 *  badge `.is-score` — décomposition disponible SANS inventer la valeur d'un d10 non conservé dans
 *  l'état (méthodes `roll-i`/`roll-bi`, LDB 13 l.40). */
function initiativeTitle(c: Combatant): string {
  const base = baseWithTraits(c, 'initiative');
  const talent = talentInitiativeBonus(c);
  const talentPart = talent ? ` + Instinctif(${talent})` : '';
  switch (rule('combat-init-method')) {
    case 'fixed-i':
      return `Init(${base})${talentPart} = ${c.initiative}`;
    case 'roll-bi':
      return `d10 + BonusInit + BonusAg${talentPart} = ${c.initiative} (détail du jet non conservé)`;
    default: // 'roll-i'
      return `d10 + Init(${base})${talentPart} = ${c.initiative} (détail du jet non conservé)`;
  }
}

/**
 * Frise d'INITIATIVE (haut du champ, façon BG3) : une tuile-portrait par combattant dans l'ordre
 * du Round (`battle.order`), cadre = teinte d'ÉQUIPE (vert allié / rouge ennemi — la forme
 * pleine/tirets du cadre vient de RigPortrait, R9 daltonisme), actif = or + marqueur, KO grisé.
 * Badge de score d'Initiative (LDB 13) en coin de chaque tuile (héros + ennemis), sablier si arme
 * Lente — visible UNIQUEMENT pendant la pause d'ouverture/de Round (`turn === -1`, LDB 17 l.27),
 * masqué une fois le tour engagé (retour playtest #205). Pendant cette pause, badge de pré-emption (Icon ui/preempt)
 * sous les héros éligibles — gratuit (arme Rapide) =
 * classe `.free`, sinon coût en Chance affiché. Toggle d'inspection au bout. Pur à props — câblé
 * par CampaignView.
 */
export interface InitiativeStripProps {
  order: string[];
  turn: number;
  combatants: Combatant[];
  /** battle.over != null → plus de marqueur actif. */
  over: boolean;
  /** Ids des combattants pouvant « agir en premier » (canActFirst, calculé par CampaignView). */
  canFirstIds: string[];
  /** Ids dont la pré-emption est GRATUITE (arme Rapide, LDB 62 l.318-319) — badge `.free`, pas de coût en Chance. */
  freeFirstIds?: string[];
  inspectEnabled: boolean;
  /** Action de CIBLAGE en cours (#21) : le clic sur une tuile CIBLE ce combattant (titre adapté). */
  targeting?: boolean;
  onToggleInspect: () => void;
  /** Clic d'un portrait = MÊME comportement que cliquer le token sur la carte (attaque/charge/cast,
   *  ou inspection si rien n'est actionnable). Toujours présent — la frise n'est jamais inerte. */
  onActivate: (id: string) => void;
  /** Survol d'un portrait (frise uniquement) : pilote le réticule sur la carte + le peek caméra.
   *  `null` au relâchement. Souris seulement (le tactile n'a pas de survol). */
  onHover?: (id: string | null) => void;
  /** Combattant actuellement survolé (token carte OU portrait) — surligne le portrait correspondant
   *  (réciprocité). Lu depuis store.hovered par CampaignView. */
  hoveredId?: string | null;
  onPromote: (id: string) => void;
  /** Ids des héros pouvant déclencher Tir rapide pendant la pause (canPreemptRanged + contrôle local). */
  canPreemptIds?: string[];
  /** Héros dont le Tir rapide est ARMÉ (en attente d'une cible) — badge surligné. */
  preemptArmedId?: string | null;
  /** Clic sur le badge Tir rapide d'un héros : arme/désarme sa visée (LDB 10). */
  onPreempt?: (id: string) => void;
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
            <div
              key={id}
              className="is-cell"
              onMouseEnter={() => p.onHover?.(id)}
              onMouseLeave={() => p.onHover?.(null)}
            >
              {p.turn === -1 && (
                <span className={`is-score${strikesLast(c.weapons) ? ' lente' : ''}`}
                  title={strikesLast(c.weapons) ? `${initiativeTitle(c)} — arme Lente : frappe en dernier` : initiativeTitle(c)}>
                  {c.initiative}{strikesLast(c.weapons) ? <> <Icon id="ui/wait" size={10} /></> : null}
                </span>
              )}
              <PortraitTile
                c={c}
                ring={isHero ? ALLY_TINT : ENEMY_TINT}
                team={isHero ? 'ally' : 'enemy'}
                variant="full"
                size="sm"
                active={!p.over && i === p.turn}
                hovered={c.id === p.hoveredId}
                onClick={() => p.onActivate(id)}
                title={p.targeting ? `${c.label} — cibler` : c.label}
              />
              {p.canFirstIds.includes(id) && (
                <button
                  type="button"
                  className={`is-first${p.freeFirstIds?.includes(id) ? ' free' : ''}`}
                  onClick={() => p.onPromote(id)}
                  title={p.freeFirstIds?.includes(id)
                    ? `${c.label} agit en premier ce Round — gratuit (arme Rapide)`
                    : `Dépense 1 point de Chance pour qu'${c.label} agisse en premier ce Round`}
                >
                  <Icon id="ui/preempt" size="sm" />{p.freeFirstIds?.includes(id) ? null : c.fortune ?? 0}
                </button>
              )}
              {p.canPreemptIds?.includes(id) && (
                <button
                  type="button"
                  className={`is-preempt${p.preemptArmedId === id ? ' armed' : ''}`}
                  onClick={() => p.onPreempt?.(id)}
                  title={p.preemptArmedId === id
                    ? `${c.label} — choisissez une cible pour son Tir rapide (re-cliquez pour annuler)`
                    : `Tir rapide : ${c.label} tire hors de son tour (épuise son Action et son Mouvement)`}
                >
                  <Icon id="action/shoot" size="sm" />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className={`inspect-toggle ${p.inspectEnabled ? 'on' : ''}`}
          onClick={p.onToggleInspect}
          title={p.inspectEnabled ? 'Inspection activée — tape un portrait pour voir son statbloc. Cliquer pour désactiver.' : 'Activer l’inspection des combattants (statbloc au tap sur la frise)'}
        >
          <Icon id="nav/identify" size="sm" /> {p.inspectEnabled ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}
