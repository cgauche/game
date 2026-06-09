import { useGame } from '../state/store';
import { RigPortrait } from './RigPortrait';
import { HERO_RING, ENEMY_RING, hpColor } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/** Couleur d'anneau d'équipe d'un combattant (héros = sa couleur de groupe, ennemi = anneau ennemi). */
export function teamRingOf(combatant: Combatant, party: Combatant[]): string {
  const idx = party.findIndex((h) => h.id === combatant.id);
  return idx >= 0 ? HERO_RING[idx % HERO_RING.length] : ENEMY_RING;
}

/** Portrait riggé avec l'anneau d'équipe — brique partagée (badge d'identité ET lignes de jet opposé). */
export function TeamPortrait({ combatant, size = 30 }: { combatant: Combatant; size?: number }) {
  const party = useGame((s) => s.party);
  return <RigPortrait combatant={combatant} size={size} ring={teamRingOf(combatant, party)} />;
}

/**
 * Badge d'identité d'un combattant pour les modales (R10 du diagnostic lisibilité-combat) : portrait riggé
 * + couleur d'équipe + PV — pour qu'on sache QUI EST QUI dans une modale d'attaque/défense (avant, seul le
 * nom apparaissait). Réutilise les briques d'identité d'ActionBar (RigPortrait / teamColors), aucune dup.
 */
export function CombatantBadge({ combatant, size = 42 }: { combatant: Combatant; size?: number }) {
  const ratio = combatant.wounds.max > 0 ? combatant.wounds.current / combatant.wounds.max : 0;
  return (
    <div className="cb-badge">
      <TeamPortrait combatant={combatant} size={size} />
      <strong className="cb-name">{combatant.name}</strong>
      <div className="cb-pv">
        <div className="cb-pv-bar">
          <i style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: hpColor(ratio) }} />
        </div>
        <span className="cb-pv-val">{combatant.wounds.current}/{combatant.wounds.max}</span>
      </div>
    </div>
  );
}
