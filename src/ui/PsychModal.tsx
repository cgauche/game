import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { CIBLE_TYPES } from '../engine/psychology';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/** Libellés des Traits psy ciblés (LDB 21). */
const CIBLE_LABEL: Record<string, { emoji: string; label: string }> = {
  animosite: { emoji: '😤', label: 'Animosité' },
  haine: { emoji: '😡', label: 'Haine' },
  prejuge: { emoji: '🙄', label: 'Préjugé' },
  amour: { emoji: '❤️', label: 'Amour' },
  camaraderie: { emoji: '🤝', label: 'Camaraderie' },
  phobie: { emoji: '🕷️', label: 'Phobie' },
};

/**
 * Modale de Test de Psychologie (Calme) du héros (LDB 21) : Peur (Test ÉTENDU — cumuler le DR vers
 * l'Indice), Terreur (1ʳᵉ rencontre → Brisé), ou Trait CIBLÉ (Animosité/Haine/… — Test binaire visant
 * un groupe). « Lancer » → « Chance » → « Appliquer ». Test obligatoire. Invariante « un jet = une modale ».
 */
export function PsychModal() {
  const pp = useGame((s) => s.pendingPsych);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.psychRoll);
  const reroll = useGame((s) => s.psychReroll);
  const bonusSL = useGame((s) => s.psychBonusSL);
  const force = useGame((s) => s.psychForceSuccess);
  const confirm = useGame((s) => s.psychConfirm);
  if (!pp || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pp.combatantId);
  const source = battle.combatants.find((x) => x.id === pp.sourceId);
  if (!c) return null;
  const r = pp.result;
  const fortune = c.fortune ?? 0;
  const isTerreur = pp.kind === 'terreur';
  const isCible = CIBLE_TYPES.has(pp.kind);
  const failed = r ? (isCible || isTerreur ? !r.success : (r.dr ?? 0) === 0) : false;
  const ok = r ? (isCible || isTerreur ? !!r.success : !!r.vaincue) : false;
  const rerollable = !!r && canReroll(failed, !!pp.rerolled);
  const cl = isCible ? CIBLE_LABEL[pp.kind] : null;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>{cl ? `${cl.emoji} ${cl.label}${pp.cible ? ` (${pp.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pp.indice}`}</h3>
        <p className="rm-vs">
          {isCible ? (
            <><strong>{c.name}</strong> doit garder son sang-froid face à <strong>{source?.name ?? pp.cible ?? '?'}</strong></>
          ) : (
            <>
              <strong>{c.name}</strong> doit garder son sang-froid face à <strong>{source?.name ?? '?'}</strong>
              {!isTerreur && ` (${pp.prevDR}/${pp.indice} DR)`}
            </>
          )}
        </p>
        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Test de Calme
            </button>
            {/* Résilience AVANT le jet (LDB 17 l.73). */}
            <ResilienceButton resilience={c.resilience ?? 0} show={(c.resilience ?? 0) > 0} onForce={force} />
          </div>
        ) : (
          <>
            <div className={`test-result ${ok ? 'ok' : 'fail'}`}>
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {isCible
                  ? r.success
                    ? 'Sang-froid gardé.'
                    : `En proie à son ${cl?.label.toLowerCase() ?? pp.kind}.`
                  : isTerreur
                    ? r.success
                      ? 'Sang-froid gardé.'
                      : `Terrifié : ${r.brise} État(s) Brisé, puis Peur ${pp.indice}.`
                    : r.vaincue
                      ? `Peur surmontée ! (${r.calmeDR}/${pp.indice} DR)`
                      : `Toujours apeuré (${r.calmeDR}/${pp.indice} DR).`}
              </span>
            </div>
            <div className="modal-actions">
              {isCible ? (
                rerollable && fortune > 0 && (
                  <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer le Test (LDB Destin)">
                    🍀 Relancer ({fortune})
                  </button>
                )
              ) : (
                <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              )}
              <ResilienceButton resilience={c.resilience ?? 0} show={!ok} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
