import { useGame } from '../state/store';
import { castingValue } from '../engine/magic';
import { canReroll } from '../engine/fortune';
import { findSpell } from '../data/index';
import { Modal } from './Modal';
import { VsHeader } from './VsHeader';
import { RollPanel } from './RollPanel';
import { ParticipantRow } from './ParticipantRow';

/**
 * Modale de Contre-sort à PLUSIEURS (Dissipation, LDB 46 l.201-202/207) — flux MULTI PARALLÈLE.
 * Le Sort ENNEMI est figé dans `pendingCast` (l'« attaquant » de l'opposition, ligne du haut) ;
 * chaque héros contre-lanceur a SA rangée (`ParticipantRow`) : son jet de Langue (Magick) + son
 * propre cycle Chance/+1 DR/Pacte/Résilience. « Appliquer » agrège (dissipé si UN gagne) ; « Laisser
 * passer » = aucun Contre-sort. Réaction « comme la défense » : on choisit, on ne lance pas le dé
 * ennemi. (La fabrique est la même que tout flux ; seule la présentation N-rangées change.)
 */
export function CounterspellModal() {
  const battle = useGame((s) => s.battle);
  const pc = useGame((s) => s.pendingCast);
  const pcs = useGame((s) => s.pendingCounterspell);
  const roll = useGame((s) => s.counterspellRoll);
  const reroll = useGame((s) => s.counterspellReroll);
  const bonusSL = useGame((s) => s.counterspellBonusSL);
  const darkPact = useGame((s) => s.counterspellDarkPact);
  const force = useGame((s) => s.counterspellForceSuccess);
  const confirm = useGame((s) => s.counterspellConfirm);
  const cancel = useGame((s) => s.counterspellCancel);
  if (!pcs || !battle || !pc?.result) return null;
  const caster = battle.combatants.find((c) => c.id === pc.casterId);
  const target = battle.combatants.find((c) => c.id === pc.targetId);
  const spell = findSpell(pc.spellLabel);
  if (!caster || !spell) return null;
  const cast = pc.result;
  const dispelled = pcs.participants.some((p) => p.result?.dispelled);

  return (
    <Modal title="🛡️ Contre-sort" variant="roll" onClose={cancel}>
      <VsHeader
        actor={caster}
        target={target}
        label={<>{spell.label}{spell.cn != null ? ` · NI ${spell.cn}` : ''}</>}
        verb="incante →"
      />
      {/* Le jet d'incantation ENNEMI, FIGÉ (révélé, pas « lancé » par le joueur). */}
      <RollPanel rows={[{ combatant: caster, d: { label: 'Incantation', base: cast.target, modifier: 0, target: cast.target, roll: cast.roll, success: cast.cast, sl: cast.sl } }]} />
      <div className="mini-title">Contre-sort — chaque lanceur oppose son Langue (Magick)</div>
      <div className="cs-rows">
        {pcs.participants.map((part) => {
          const actor = battle.combatants.find((c) => c.id === part.id);
          if (!actor) return null;
          const res = part.result;
          const val = castingValue(actor, 'Langue', 'Magick');
          const row = res
            ? { combatant: actor, d: { label: 'Langue (Magick)', base: res.counter.target, modifier: 0, target: res.counter.target, roll: res.counter.roll, success: res.counter.success, sl: res.counter.sl } }
            : { combatant: actor, pending: { label: 'Langue (Magick)', base: val, mods: [] } };
          return (
            <ParticipantRow
              key={part.id}
              actor={actor}
              row={row}
              rolled={!!res}
              rollLabel="🛡️ Contre-sort"
              onRoll={() => roll(part.id)}
              rerollable={!!res && canReroll(!res.counter.success, !!part.rerolled)}
              onReroll={() => reroll(part.id)}
              onBonusSL={() => bonusSL(part.id)}
              darkPactable={actor.kind === 'hero' && !!res && !res.counter.success}
              onDarkPact={() => darkPact(part.id)}
              onForce={() => force(part.id)}
              forceShow={!!res && !res.dispelled}
              extra={res && <div className={`cs-outcome ${res.dispelled ? 'ok-text' : 'muted'}`}>{res.dispelled ? '✅ Dissipé !' : `DR net ${res.casterNetSL >= 0 ? '+' : ''}${res.casterNetSL}`}</div>}
            />
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cancel}>Laisser passer</button>
        <button className="btn btn-primary" onClick={() => confirm()}>{dispelled ? 'Appliquer (dissipé)' : 'Appliquer'}</button>
      </div>
    </Modal>
  );
}
