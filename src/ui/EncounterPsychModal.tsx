import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { CIBLE_TYPES } from '../engine/psychology';
import { ResilienceButton } from './ResilienceButton';
import { Modal } from './Modal';

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
 * Modale de Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21). Depuis le retour playtest
 * 2026-06-10 : Peur/Terreur sont COMBAT seulement → ici, uniquement les Traits ciblés sociaux
 * (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie). Test SIMPLE binaire. Le héros concerné est
 * montré par son PORTRAIT (#20). « Test de Calme » → Chance / Résilience / **Détermination** (#6) →
 * « Appliquer ». Invariante « un jet = une modale ». Auto-chaînée héros par héros par le flux.
 */
export function EncounterPsychModal() {
  const pe = useGame((s) => s.pendingEncounterPsych);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.encounterPsychRoll);
  const reroll = useGame((s) => s.encounterPsychReroll);
  const force = useGame((s) => s.encounterPsychForceSuccess);
  const determine = useGame((s) => s.encounterPsychResolve);
  const confirm = useGame((s) => s.encounterPsychConfirm);
  if (!pe) return null;
  const hero = party.find((h) => h.id === pe.heroId);
  if (!hero) return null;
  const r = pe.result;
  const fortune = hero.fortune ?? 0;
  const resolve = hero.resolve ?? 0; // Détermination
  const isTerreur = pe.kind === 'terreur';
  const isCible = CIBLE_TYPES.has(pe.kind);
  const ok = r ? !!r.success : false;
  const rerollable = !!r && canReroll(!r.success, !!pe.rerolled);
  const cl = isCible ? CIBLE_LABEL[pe.kind] : null;

  // Bouton « Détermination » : immunité Psychologie (LDB 17 l.62) → surmonté d'office.
  const determinationBtn = resolve > 0 && (
    <button className="btn" onClick={determine} title="Dépense 1 point de Détermination : immunité à la Psychologie (LDB 17 l.62) — surmonté d'office">
      ✊ Détermination ({resolve})
    </button>
  );

  return (
    <Modal
      title={cl ? `${cl.emoji} ${cl.label}${pe.cible ? ` (${pe.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pe.indice}`}
      subject={hero}
    >
        <p className="rm-vs">doit garder son sang-froid face à <strong>{pe.sourceName}</strong></p>
        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Test de Calme
            </button>
            {/* Résilience AVANT le jet (LDB 17 l.73). */}
            <ResilienceButton resilience={hero.resilience ?? 0} show={(hero.resilience ?? 0) > 0} onForce={force} />
            {determinationBtn}
          </div>
        ) : (
          <>
            <div className={`test-result ${ok ? 'ok' : 'fail'}`}>
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {isCible
                  ? r.success
                    ? 'Sang-froid gardé.'
                    : `En proie à son ${cl?.label.toLowerCase() ?? pe.kind}.`
                  : isTerreur
                    ? r.success
                      ? 'Sang-froid gardé.'
                      : `Terrifié : ${r.brise} État(s) Brisé, puis Peur ${pe.indice}.`
                    : r.success
                      ? `Peur surmontée !`
                      : `${hero.name} a peur de ${pe.sourceName}.`}
              </span>
            </div>
            <div className="modal-actions">
              {rerollable && fortune > 0 && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer le Test (LDB Destin)">
                  🍀 Relancer ({fortune})
                </button>
              )}
              <ResilienceButton resilience={hero.resilience ?? 0} show={!ok} onForce={force} />
              {!ok && determinationBtn}
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}
