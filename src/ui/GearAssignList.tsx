import { useGame, type LootGear } from '../state/store';
import { bestDetector } from '../state/merchantFlow';
import { PortraitPicker } from './PortraitPicker';
import type { Combatant } from '../engine/types';
import { MINUTES_PER_DAY } from '../engine/clock';

/**
 * Liste de butin ATTRIBUABLE — brique partagée écran de victoire / fenêtre de loot : chaque ligne
 * porte son nom (✨ magique, qualités une fois révélées), ses actions de révélation — Évaluer
 * (LDB 09 l.241) / Détecter (Talent Détection d'artefact, LDB 10 l.310-312, si un héros l'a) —
 * et l'attribution par portrait (montrer, pas écrire).
 */
export function GearAssignList({ gear, assignable, onAssign, onAppraise }: {
  gear: LootGear[];
  assignable: Combatant[];
  onAssign: (index: number, heroId: string) => void;
  /** Absent = lecture seule (pas d'actions de révélation — ex. invité coop). */
  onAppraise?: (index: number, mode: 'evaluate' | 'detect') => void;
}) {
  const party = useGame((s) => s.party);
  const today = useGame((s) => Math.floor(s.gameTime / MINUTES_PER_DAY));
  const canDetect = !!bestDetector(party);
  return (
    <ul className="victory-loot">
      {gear.map((g, i) => {
        const fx = g.effect;
        const unidentified = fx.identified === false;
        const aura = !!fx.magicKnown;
        return (
          <li key={`${g.label}-${i}`} className="victory-loot-row">
            <span className="vl-name">
              {g.label}
              {(g.magic || aura) && (
                <span className="vl-magic" title={unidentified ? (aura ? 'Aura magique sentie — règles non identifiées' : 'Objet magique — qualités à révéler') : 'Objet magique'}> ✨</span>
              )}
              {unidentified
                ? <span className="vl-unid">{aura ? 'magique, non identifié' : 'non identifié'}</span>
                : fx.qualities?.length
                  ? <span className="vl-quals">{fx.qualities.join(', ')}</span>
                  : null}
            </span>
            {onAppraise && unidentified && (
              <span className="vl-acts">
                {fx.appraiseTriedDay !== today && (
                  <button className="btn vl-act" onClick={() => onAppraise(i, 'evaluate')} title="Évaluation (Int) : révèle les qualités cachées et estime le prix — un échec verrouille jusqu'à demain">Évaluer</button>
                )}
                {canDetect && !fx.detectTried && (
                  <button className="btn vl-act" onClick={() => onAppraise(i, 'detect')} title="Détection d'artefact (Intuition, au toucher) : sentir l'aura — une seule tentative par objet">Détecter</button>
                )}
              </span>
            )}
            <span className="vl-assign">
              {/* Attribution par portrait → picker mutualisé (cf. PortraitPicker, partagé avec le
                  choix du lanceur d'un Test et la cible montée) — clic = donner à ce héros. */}
              <PortraitPicker
                choices={assignable.map((h) => ({ c: h, title: `Donner « ${g.label} » à ${h.name}` }))}
                onPick={(id) => onAssign(i, id)}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
