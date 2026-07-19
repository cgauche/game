import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { testValue } from '../engine/skills';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { findSeaShantyById } from '../data';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';

/**
 * Modale de CHANSON DE MARIN (Talent, MDG 09 l.32-40) : le pré-jet est un MENU (OptionChooser) des
 * chansons CONNUES du chanteur (specs du Talent — « chaque niveau … apprend une nouvelle chanson »),
 * puis « Lancer » jette le Test de **Divertissement (Chant)** ; « Appliquer » pose l'effet sur tout
 * l'équipage pour « trois minutes plus un nombre de minutes égal au DR » (l.38).
 */
export function ShantyModal() {
  const p = useGame((s) => s.pendingShanty);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.shantyRoll);
  const reroll = useGame((s) => s.shantyReroll);
  const bonus = useGame((s) => s.shantyBonusSL);
  const darkPact = useGame((s) => s.shantyDarkPact);
  const force = useGame((s) => s.shantyForceSuccess);
  const confirm = useGame((s) => s.shantyConfirm);
  const cancel = useGame((s) => s.shantyCancel);
  const setSong = useGame((s) => s.shantySetSong);
  if (!p || !battle) return null;
  const singer = battle.combatants.find((c) => c.id === p.singerId);
  if (!singer) return null;
  const r = p.result;
  const chosen = p.shantyId ? findSeaShantyById(p.shantyId) : undefined;
  const value = testValue(singer, 'divertissement', undefined, 'chant');
  const rolled = !!r;

  const actorRow: RollRowData = {
    actor: singer,
    row: {
      combatant: singer,
      d: r ? testBreakdown('Divertissement (Chant)', value, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'intermediaire') : undefined,
      pending: testPending('Divertissement (Chant)', value, undefined, 'intermediaire'),
    },
    rolled,
    freeReroll: freeRerollOf(singer),
    onRoll: roll,
    rerollable: !!r && !r.success && canReroll(true, !!p.rerolled),
    onReroll: reroll,
    onBonusSL: r?.success ? bonus : undefined,
    darkPactable: !!r && !r.success && singer.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !r?.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="shanty"
      title={<><Icon id="audio/music" size="sm" /> Chanson de marin</>}
      subtitle={<><strong>{singer.label}</strong> entonne pour l'équipage (Test de Divertissement (Chant))</>}
      setup={
        <OptionChooser
          layout="seg"
          groupLabel="Chanson"
          options={knownShanties(singer).map((id) => {
            const s = findSeaShantyById(id);
            return {
              key: s?.id ?? id, label: s?.label ?? id, title: s?.desc, disabled: !s,
              selected: !!s && s.id === p.shantyId, onSelect: s ? () => setSong(s.id) : undefined,
            };
          })}
        />
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && chosen && (
        <div className="rm-journal">
          {r.success
            ? <><Icon id="audio/music" size="sm" /> « {chosen.label} » porte {3 + Math.max(0, r.sl)} minute(s) : {chosen.desc}{chosen.note && <em className="muted"> — {chosen.note}</em>}</>
            : <>La chanson tombe à plat — aucun effet (le quart est consommé).</>}
        </div>
      )}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
