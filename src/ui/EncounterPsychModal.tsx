import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { CIBLE_TYPES } from '../engine/psychology';
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
 * Modale de Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21) : à l'entrée d'une scène, un
 * héros teste son Calme face à un PNJ qui l'inspire (Peur/Terreur de Taille ou de statbloc) ou contre
 * lequel il porte un Trait ciblé (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie). Test SIMPLE
 * (binaire) hors combat. « Test de Calme » → « Chance / Résilience » → « Appliquer ». Invariante
 * « un jet = une modale ». Auto-chaînée héros par héros par le flux.
 */
export function EncounterPsychModal() {
  const pe = useGame((s) => s.pendingEncounterPsych);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.encounterPsychRoll);
  const reroll = useGame((s) => s.encounterPsychReroll);
  const force = useGame((s) => s.encounterPsychForceSuccess);
  const confirm = useGame((s) => s.encounterPsychConfirm);
  if (!pe) return null;
  const hero = party.find((h) => h.id === pe.heroId);
  if (!hero) return null;
  const r = pe.result;
  const fortune = hero.fortune ?? 0;
  const isTerreur = pe.kind === 'terreur';
  const isCible = CIBLE_TYPES.has(pe.kind);
  const ok = r ? !!r.success : false;
  const rerollable = !!r && canReroll(!r.success, !!pe.rerolled);
  const cl = isCible ? CIBLE_LABEL[pe.kind] : null;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>{cl ? `${cl.emoji} ${cl.label}${pe.cible ? ` (${pe.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pe.indice}`}</h3>
        <p className="rm-vs">
          <strong>{hero.name}</strong> doit garder son sang-froid face à <strong>{pe.sourceName}</strong>
        </p>
        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Test de Calme
            </button>
            {/* Résilience AVANT le jet (LDB 17 l.73). */}
            <ResilienceButton resilience={hero.resilience ?? 0} show={(hero.resilience ?? 0) > 0} onForce={force} />
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
