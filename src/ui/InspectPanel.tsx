import { useRef } from 'react';
import type { Combatant } from '../engine/types';
import { useModalA11y } from './Modal';
import { CharFrame } from './CharFrame';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import { CodexSections } from './compendium/CodexEntry';
import { combatantSections } from './compendium/registry';
import { EffectChips } from './EffectChips';
import { isFrenzied } from '../engine/psychology';

/**
 * Panneau d'INSPECTION d'un combattant (clic sur l'ordre de bataille) : tête VIVANTE (portrait,
 * PB exacts, psychologie au coup d'œil, États) + le STATBLOC COMPLET rendu par le MÊME composant
 * que la fiche Codex (`CodexSections`, alimenté par les valeurs réelles via `combatantSections`).
 * Plus de panneau recopié ni de sous-ensemble de caractéristiques — une seule vérité de rendu.
 */
export function InspectPanel({ combatant, onClose }: { combatant: Combatant; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose); // dialogue au markup spécifique (tête portrait+PV) → hook a11y partagé
  const c = combatant;
  const fx = summarizeEffects(c.conditions, c.activeEffects ?? [], Infinity, combatantFlags(c));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal inspect-panel" onClick={(e) => e.stopPropagation()}>
        <div className="insp-head">
          <CharFrame c={c} variant="vital" size="lg" />
          <div className="insp-id">
            <h3>{c.name}</h3>
            <span className="insp-pv-num">{c.wounds.current}/{c.wounds.max} PB</span>
          </div>
        </div>

        {/* Coup d'œil tactique : psychologie + « lanceur de sorts » (le détail est dans le statbloc). */}
        {(c.causesTerreur || c.causesPeur || c.psychImmune || isFrenzied(c) || (c.spells?.length ?? 0) > 0) && (
          <div className="insp-badges">
            {c.causesTerreur ? (
              <span className="insp-badge foe">😱 Terreur {c.causesTerreur}</span>
            ) : c.causesPeur ? (
              <span className="insp-badge foe">😨 Peur {c.causesPeur}</span>
            ) : null}
            {c.psychImmune && <span className="insp-badge">🧠 Immunité psy</span>}
            {isFrenzied(c) && <span className="insp-badge foe">🐗 Frénésie</span>}
            {(c.spells?.length ?? 0) > 0 && <span className="insp-badge foe">🪄 Lanceur de sorts</span>}
          </div>
        )}

        {fx.visible.length > 0 && (
          <div className="insp-row">
            <span className="insp-lbl">États</span>
            <EffectChips conditions={c.conditions} effects={c.activeEffects ?? []} flags={combatantFlags(c)} />
          </div>
        )}

        {/* Statbloc COMPLET via le rendu PARTAGÉ du Codex (toutes les caracs, armes, armure, traits,
            compétences, talents, sorts — chaque entité cliquable vers sa fiche). */}
        <div className="insp-statblock">
          <CodexSections sections={combatantSections(c)} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
