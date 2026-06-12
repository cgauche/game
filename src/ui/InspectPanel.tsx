import { useRef } from 'react';
import type { Combatant, HitLocation, CharKey } from '../engine/types';
import { CHAR_LABELS, HIT_LOCATION_LABELS } from '../engine/types';
import { useModalA11y } from './Modal';
import { CharFrame } from './CharFrame';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import { SIZE_LABEL, effectiveSize } from '../engine/size';
import { parseTrait } from '../engine/traits/dispatch';
import { traits as TRAIT_DATA } from '../data';

/**
 * Panneau d'INSPECTION en lecture seule d'un combattant (clic sur l'ordre de bataille) — répond au
 * besoin « décider qui viser sans connaître la cible » (diagnostic R5). 100 % des champs existent déjà
 * sur le Combatant : CC/CT/F/E…, armes (nom + dégâts), armure (PA par localisation), Peur/Terreur,
 * Frénésie, États. Aucune action, aucun impact moteur — pur affichage (la fiche complète d'un HÉROS
 * reste la CharacterSheet via le panneau de groupe).
 */
const SHOWN_CHARS: CharKey[] = ['CC', 'CT', 'F', 'E', 'Ag', 'FM'];
const ARMOUR_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];

/** Desc VERBATIM du trait (traits.json, LDB 85) — tooltip. Clé canonique de parseTrait (registre)
 *  d'abord, sinon libellé nu (sans Indice/parenthèse/compte) cherché dans la donnée (« 8 Tentacules
 *  +9 » → « Tentacules », « Arme +6 » → « Arme »). */
function traitDesc(t: string): string | undefined {
  const bare = t.replace(/^\d+\s+/, '').replace(/\s*\([^)]*\)/g, '').replace(/\s*[+-]?\d+\s*\+?\s*$/, '').trim().toLowerCase();
  const key = parseTrait(t)?.key.toLowerCase() ?? bare;
  return TRAIT_DATA.find((d) => d.label.toLowerCase() === key)?.desc ?? TRAIT_DATA.find((d) => d.label.toLowerCase() === bare)?.desc;
}

export function InspectPanel({ combatant, onClose }: { combatant: Combatant; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose); // dialogue au markup spécifique (tête portrait+PV) → hook a11y partagé
  const c = combatant;
  const isHero = c.kind === 'hero';
  const fx = summarizeEffects(c.conditions, c.activeEffects ?? [], Infinity, combatantFlags(c));
  const weapons = c.weapons ?? [];
  const armour = ARMOUR_LOCS.filter((l) => (c.armour?.[l] ?? 0) > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal inspect-panel" onClick={(e) => e.stopPropagation()}>
        <div className="insp-head">
          {/* Tuile vital (les États ont leur rangée détaillée plus bas) ; le NOM reste — l'Inspection
              est la « fiche » de l'adversaire, et les PB exacts y sont autorisés (texte ci-dessous). */}
          <CharFrame c={c} variant="vital" size="lg" />
          <div className="insp-id">
            <h3>{c.name}</h3>
            <span className="insp-pv-num">{c.wounds.current}/{c.wounds.max} PB</span>
          </div>
        </div>

        {(c.causesTerreur || c.causesPeur || c.psychImmune || c.frenzied || (c.spells?.length ?? 0) > 0) && (
          <div className="insp-badges">
            {c.causesTerreur ? (
              <span className="insp-badge foe">😱 Terreur {c.causesTerreur}</span>
            ) : c.causesPeur ? (
              <span className="insp-badge foe">😨 Peur {c.causesPeur}</span>
            ) : null}
            {c.psychImmune && <span className="insp-badge">🧠 Immunité psy</span>}
            {c.frenzied && <span className="insp-badge foe">🐗 Frénésie</span>}
            {(c.spells?.length ?? 0) > 0 && <span className="insp-badge foe" title={c.spells!.join(', ')}>🪄 Lanceur de sorts</span>}
          </div>
        )}

        <div className="insp-chars">
          <span className="insp-char" title="Mouvement">
            <b>M</b> {c.movement}
          </span>
          {/* « – » = caractéristique inexistante au bestiaire (Schéma des Profils, LDB 76) */}
          {SHOWN_CHARS.map((k) => (
            <span key={k} className="insp-char" title={CHAR_LABELS[k]}>
              <b>{k}</b> {c.characteristics[k] > 0 || isHero ? c.characteristics[k] : '–'}
            </span>
          ))}
          <span className="insp-char" title="Taille">
            <b>Taille</b> {SIZE_LABEL[effectiveSize(c.size)]}
          </span>
        </div>

        {weapons.length > 0 && (
          <div className="insp-row">
            <span className="insp-lbl">Armes</span>
            <span>{weapons.map((w) => `${w.name} (${w.damage})`).join(' · ')}</span>
          </div>
        )}

        <div className="insp-row">
          <span className="insp-lbl">Armure</span>
          <span>{armour.length ? armour.map((l) => `${HIT_LOCATION_LABELS[l]} ${c.armour[l]}`).join(' · ') : '— aucune'}</span>
        </div>

        {fx.visible.length > 0 && (
          <div className="insp-row">
            <span className="insp-lbl">États</span>
            <span className="fx-chips">
              {fx.visible.map((v) => (
                <span key={v.key} className={`fx-chip ${v.kind}`} title={v.label}>
                  {v.icon}
                  {v.count && v.count > 1 ? `×${v.count}` : ''}
                </span>
              ))}
            </span>
          </div>
        )}

        {(c.skills?.length ?? 0) > 0 && !isHero && (
          <div className="insp-row">
            <span className="insp-lbl">Compétences</span>
            <span className="insp-traits">
              {/* valeur de Test finale = Caractéristique + avances (LDB 09) */}
              {c.skills.map((s, i) => (
                <span key={i} className="insp-trait-chip">
                  {s.name}{s.spec ? ` (${s.spec})` : ''} {c.characteristics[s.characteristic] + s.advances}
                </span>
              ))}
            </span>
          </div>
        )}

        {(c.traits?.length ?? 0) > 0 && (
          <div className="insp-row">
            <span className="insp-lbl">Traits</span>
            <span className="insp-traits">
              {/* un chip par trait, desc VERBATIM (LDB 85) en tooltip */}
              {c.traits!.map((t, i) => (
                <span key={i} className="insp-trait-chip" title={traitDesc(t)}>
                  {t}
                </span>
              ))}
            </span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
