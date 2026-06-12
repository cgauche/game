import { useGame } from '../state/store';
import { RigPortrait } from './RigPortrait';
import { HERO_RING, ENEMY_RING } from '../gameIso/teamColors';
import { CharFrame } from './CharFrame';
import type { Combatant } from '../engine/types';

/** Couleur d'anneau d'équipe d'un combattant (héros = sa couleur de groupe, ennemi = anneau ennemi). */
export function teamRingOf(combatant: Combatant, party: Combatant[]): string {
  const idx = party.findIndex((h) => h.id === combatant.id);
  return idx >= 0 ? HERO_RING[idx % HERO_RING.length] : ENEMY_RING;
}

/** Portrait riggé NU avec l'anneau d'équipe — réservé aux usages denses en ligne (lignes de jet,
 *  ready-checks). Pour tout le reste : CharFrame (la tuile unifiée). */
export function TeamPortrait({ combatant, size = 30 }: { combatant: Combatant; size?: number }) {
  const party = useGame((s) => s.party);
  return <RigPortrait combatant={combatant} size={size} ring={teamRingOf(combatant, party)} />;
}

/** Badge d'identité d'un combattant dans les modales de jet (VsHeader) : la tuile unifiée en
 *  variante `vital` — portrait + jauge, SANS nom (le nom vit dans title/prose). */
export function CombatantBadge({ combatant }: { combatant: Combatant }) {
  return <CharFrame c={combatant} variant="vital" size="md" />;
}
