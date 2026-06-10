import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { CIBLE_TYPES, calmeValue } from '../engine/psychology';
import { RollFlowShell } from './RollFlowShell';
import { TeamPortrait } from './CombatantBadge';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { DrBar } from './DrBar';
import { CIBLE_LABEL, calmeBreakdown } from './psychLabels';

/**
 * Modale de Test de Psychologie (Calme) du héros (LDB 21) : Peur (Test ÉTENDU — cumuler le DR vers
 * l'Indice), Terreur (1ʳᵉ rencontre → Brisé), ou Trait CIBLÉ (Animosité/Haine/…). Sur la coquille de
 * jet partagée, comme Attaque/Défense : ligne de jet riche (RollLine) + issue style journal +
 * Détermination 1ʳᵉ classe (immunité Psychologie, LDB 17 l.62). Test obligatoire (pas d'« Annuler »).
 */
export function PsychModal() {
  const pp = useGame((s) => s.pendingPsych);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.psychRoll);
  const reroll = useGame((s) => s.psychReroll);
  const bonusSL = useGame((s) => s.psychBonusSL);
  const force = useGame((s) => s.psychForceSuccess);
  const determine = useGame((s) => s.psychResolve);
  const confirm = useGame((s) => s.psychConfirm);
  if (!pp || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pp.combatantId);
  const source = battle.combatants.find((x) => x.id === pp.sourceId);
  if (!c) return null;
  const r = pp.result;
  const isTerreur = pp.kind === 'terreur';
  const isCible = CIBLE_TYPES.has(pp.kind);
  const failed = r ? (isCible || isTerreur ? !r.success : (r.dr ?? 0) === 0) : false;
  const ok = r ? (isCible || isTerreur ? !!r.success : !!r.vaincue) : false;
  const cl = isCible ? CIBLE_LABEL[pp.kind] : null;

  const outcomeText = !r
    ? ''
    : isCible
      ? r.success ? `${c.name} garde son sang-froid.` : `${c.name} est en proie à son ${cl?.label.toLowerCase() ?? pp.kind}.`
      : isTerreur
        ? r.success ? `${c.name} garde son sang-froid.` : `${c.name} est terrifié : ${r.brise} État(s) Brisé, puis Peur ${pp.indice}.`
        : r.vaincue ? `${c.name} surmonte sa peur.` : `${c.name} reste sous l'emprise de la Peur (${r.calmeDR}/${pp.indice} DR).`;

  return (
    <RollFlowShell
      title={cl ? `${cl.emoji} ${cl.label}${pp.cible ? ` (${pp.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pp.indice}`}
      subtitle={<>{c.name} doit garder son sang-froid{isCible && cl ? ` (${cl.label}${pp.cible ? ` — ${pp.cible}` : ''})` : ''}.</>}
      extra={
        <>
          <div className="modal-vs">
            <span className="mv-side"><TeamPortrait combatant={c} size={40} /><strong>{c.name}</strong></span>
            {source && (
              <>
                <span className="mv-arrow">▸</span>
                <span className="mv-side"><TeamPortrait combatant={source} size={40} /><strong>{source.name}</strong></span>
              </>
            )}
          </div>
          {/* Peur = Test ÉTENDU : barre de DR cumulé vers l'Indice (#23) — après le jet, montre le
              cumul MIS À JOUR (result.calmeDR), pas l'état d'avant. */}
          {!isCible && !isTerreur && <DrBar cum={r ? (r.calmeDR ?? pp.prevDR ?? 0) : (pp.prevDR ?? 0)} target={pp.indice} />}
        </>
      }
      rolled={!!r}
      rollLabel="🎲 Test de Calme"
      onRoll={roll}
      breakdown={r ? calmeBreakdown(calmeValue(c), r) : undefined}
      outcome={r ? <JournalLine className="rm-journal" event={ev('fear', outcomeText, c.id, source?.id)} combatants={battle.combatants} /> : undefined}
      determination={{ resolve: c.resolve ?? 0, onResolve: determine }}
      fortune={c.fortune ?? 0}
      freeReroll={freeRerollOf(c)}
      rerollable={!!r && canReroll(failed, !!pp.rerolled)}
      onReroll={reroll}
      /* Trait ciblé = Test binaire → pas de « +1 DR » (bouton Relancer simple). */
      onBonusSL={isCible ? undefined : bonusSL}
      resilience={c.resilience ?? 0}
      onForce={force}
      forceShow={!ok}
      onConfirm={confirm}
    />
  );
}
