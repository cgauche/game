import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { testValue } from '../engine/skills';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { findSeaShantyById, findSeaShantyByLabel } from '../data';
import { RollFlowShell } from './RollFlowShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';

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
  const value = testValue(singer, 'divertissement', undefined, 'Chant');

  return (
    <RollFlowShell
      title="🎶 Chanson de marin"
      subtitle={<><strong>{singer.name}</strong> entonne pour l'équipage (Test de Divertissement (Chant), MDG 09)</>}
      setup={!r && (
        <OptionChooser
          layout="seg"
          groupLabel="Chanson"
          options={knownShanties(singer).map((label) => {
            const s = findSeaShantyByLabel(label);
            return {
              key: s?.id ?? label, label: s?.label ?? label, title: s?.desc, disabled: !s,
              selected: !!s && s.id === p.shantyId, onSelect: s ? () => setSong(s.id) : undefined,
            };
          })}
        />
      )}
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      breakdown={r ? testBreakdown('Divertissement (Chant)', value, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'intermediaire') : undefined}
      pending={testPending('Divertissement (Chant)', value, undefined, 'intermediaire')}
      outcome={r && chosen && (
        <div className="rm-journal">
          {r.success
            ? <>🎶 « {chosen.label} » porte {3 + Math.max(0, r.sl)} minute(s) : {chosen.desc}{chosen.note && <em className="muted"> — {chosen.note}</em>}</>
            : <>La chanson tombe à plat — aucun effet (le quart est consommé).</>}
        </div>
      )}
      fortune={singer.fortune ?? 0}
      freeReroll={freeRerollOf(singer)}
      rerollable={!!r && !r.success && canReroll(true, !!p.rerolled)}
      onReroll={reroll}
      onBonusSL={r?.success ? bonus : undefined}
      darkPactable={!!r && !r.success && singer.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={singer.resilience ?? 0}
      onForce={force}
      forceShow={!r?.success}
      onConfirm={confirm}
    />
  );
}
