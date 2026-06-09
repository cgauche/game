import type { Combatant, HitLocation, CharKey } from '../engine/types';
import { CHAR_LABELS, HIT_LOCATION_LABELS } from '../engine/types';
import { RigPortrait } from './RigPortrait';
import { hpColor, ENEMY_RING, HERO_RING } from '../gameIso/teamColors';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';

/**
 * Panneau d'INSPECTION en lecture seule d'un combattant (clic sur l'ordre de bataille) — répond au
 * besoin « décider qui viser sans connaître la cible » (diagnostic R5). 100 % des champs existent déjà
 * sur le Combatant : CC/CT/F/E…, armes (nom + dégâts), armure (PA par localisation), Peur/Terreur,
 * Frénésie, États. Aucune action, aucun impact moteur — pur affichage (la fiche complète d'un HÉROS
 * reste la CharacterSheet via le panneau de groupe).
 */
const SHOWN_CHARS: CharKey[] = ['CC', 'CT', 'F', 'E', 'Ag', 'FM'];
const ARMOUR_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];

export function InspectPanel({ combatant, onClose }: { combatant: Combatant; onClose: () => void }) {
  const c = combatant;
  const isHero = c.kind === 'hero';
  const ratio = c.wounds.max > 0 ? c.wounds.current / c.wounds.max : 0;
  const fx = summarizeEffects(c.conditions, c.activeEffects ?? [], Infinity, combatantFlags(c));
  const weapons = c.weapons ?? [];
  const armour = ARMOUR_LOCS.filter((l) => (c.armour?.[l] ?? 0) > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal inspect-panel" onClick={(e) => e.stopPropagation()}>
        <div className="insp-head">
          <RigPortrait combatant={c} size={48} ring={isHero ? HERO_RING[0] : ENEMY_RING} />
          <div className="insp-id">
            <h3>{c.name}</h3>
            <div className="insp-pv">
              <i style={{ width: `${Math.max(0, ratio) * 100}%`, background: hpColor(ratio) }} />
            </div>
            <span className="insp-pv-num">{c.wounds.current}/{c.wounds.max} PB</span>
          </div>
        </div>

        {(c.causesTerreur || c.causesPeur || c.psychImmune || c.frenzied) && (
          <div className="insp-badges">
            {c.causesTerreur ? (
              <span className="insp-badge foe">😱 Terreur {c.causesTerreur}</span>
            ) : c.causesPeur ? (
              <span className="insp-badge foe">😨 Peur {c.causesPeur}</span>
            ) : null}
            {c.psychImmune && <span className="insp-badge">🧠 Immunité psy</span>}
            {c.frenzied && <span className="insp-badge foe">🐗 Frénésie</span>}
          </div>
        )}

        <div className="insp-chars">
          {SHOWN_CHARS.map((k) => (
            <span key={k} className="insp-char" title={CHAR_LABELS[k]}>
              <b>{k}</b> {c.characteristics[k]}
            </span>
          ))}
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

        {(c.traits?.length ?? 0) > 0 && (
          <div className="insp-row">
            <span className="insp-lbl">Traits</span>
            <span className="insp-traits">{c.traits!.join(', ')}</span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
