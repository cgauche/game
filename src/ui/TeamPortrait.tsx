import { useGame } from '../state/store';
import { RigPortrait } from './RigPortrait';
import { HERO_RING, ENEMY_RING } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/** Couleur d'anneau d'équipe d'un combattant (héros = sa couleur de groupe, ennemi = anneau ennemi). */
function teamRingOf(combatant: Combatant, party: Combatant[]): string {
  const idx = party.findIndex((h) => h.id === combatant.id);
  return idx >= 0 ? HERO_RING[idx % HERO_RING.length] : ENEMY_RING;
}

/** Portrait riggé NU avec l'anneau d'équipe — réservé aux usages denses EN LIGNE (lignes de jet,
 *  ready-checks, propriétaire d'objet au marchand). Pour tout le reste : CharFrame (la tuile
 *  unifiée). L'ancien CombatantBadge (portrait + nom + PV maison) est mort — remplacé par
 *  CharFrame vital dans VsHeader. */
export function TeamPortrait({ combatant, size = 30 }: { combatant: Combatant; size?: number }) {
  const party = useGame((s) => s.party);
  return <RigPortrait combatant={combatant} size={size} ring={teamRingOf(combatant, party)} />;
}
