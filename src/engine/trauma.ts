/**
 * Traumatismes — Livre de base, « Traumatisme » (18-Traumatisme.md). Factory unique
 * kind+sévérité+localisation → effets en-combat modélisés, partagée par les Blessures critiques
 * et les Maladresses. On ne modélise que ce qui est quantifié et câblable sans inventer :
 *   - Déchirure musculaire sur Jambe → Mouvement ÷2 (l.315).
 *   - Fracture Torse → Force/Agilité −30 + Mouvement ÷2 (l.298).
 *   - Fracture Jambe → Mouvement ÷2 (règle du Pied, l.298).
 * Bras/Tête et Amputations : effet de combat journalisé (latéralité non modélisée ; amputation =
 * post-combat/Chirurgie → Jalon 5). Le trauma est enregistré (label+note) même sans effet modélisé.
 */
import { Combatant, CharKey, HitLocation, Trauma } from './types';

export type TraumaKind = 'dechirure' | 'fracture';
export type TraumaSeverity = 'mineur' | 'majeur';

const LEG: HitLocation[] = ['jambeG', 'jambeD'];

export function traumaFromKind(kind: TraumaKind, severity: TraumaSeverity, location: HitLocation): Trauma {
  const sev = severity === 'mineur' ? 'Mineure' : 'Majeure';
  if (kind === 'dechirure') {
    const onLeg = LEG.includes(location);
    // Jambe : −10 (mineure) / −20 (majeure) aux Tests de mobilité/Esquive (LDB 18 l.315/324).
    const dodge = severity === 'mineur' ? -10 : -20;
    return {
      label: `Déchirure musculaire (${sev})`,
      location,
      ...(onLeg ? { movementHalved: true, dodgePenalty: dodge } : {}),
      note: onLeg
        ? `LDB 18 l.315 : Mouvement ÷2 + ${dodge} aux Tests de mobilité de la jambe. Guérison 30−BE jours (Jalon 5).`
        : 'LDB 18 l.315 : −10/−20 aux Tests de la Localisation (non modélisé en combat). Guérison 30−BE jours (Jalon 5).',
    };
  }
  // fracture
  if (location === 'corps') {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      charPenalty: { F: -30, Ag: -30 },
      note: 'LDB 18 l.298 (Torse) : −30 Force et Agilité, Mouvement ÷2. Guérison 30+1d10 jours (Jalon 5).',
    };
  }
  if (LEG.includes(location)) {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      dodgePenalty: -20, // règle du Pied (l.369) : −20 aux Tests de mobilité, dont l'Esquive
      note: 'LDB 18 l.298 (Jambe) : Mouvement ÷2 + −20 aux Tests de mobilité/Esquive (règle du Pied). Guérison 30+1d10 jours (Jalon 5).',
    };
  }
  return {
    label: `Fracture (${sev})`,
    location,
    note: location === 'tete'
      ? 'LDB 18 l.298 (Tête) : −30 aux Tests de Langue, régime liquide (non modélisé en combat). Guérison 30+1d10 jours (Jalon 5).'
      : 'LDB 18 l.298 (Bras) : membre inutilisable (latéralité non modélisée en combat). Guérison 30+1d10 jours (Jalon 5).',
  };
}

/** Un trauma réduit-il le Mouvement de moitié ? (Détermination « ignorer modifs de critique » → non, LDB 17 l.64.) */
export function traumaMovementHalved(c: Combatant): boolean {
  if (c.ignoreCritMods) return false;
  return (c.traumas ?? []).some((t) => t.movementHalved === true);
}

/** Pénalités de Caractéristique dues aux traumatismes (valeurs négatives, pour le pool « pire pénalité »). */
export function traumaCharPenalties(c: Combatant, key: CharKey): number[] {
  if (c.ignoreCritMods) return []; // Détermination : modificateurs de critique ignorés ce Round (LDB 17 l.64)
  return (c.traumas ?? []).map((t) => t.charPenalty?.[key] ?? 0).filter((p) => p < 0);
}

/** Pire pénalité de mobilité/Esquive due aux traumatismes de jambe (≤ 0 ; non-cumul, LDB l.20). */
export function traumaDodgePenalty(c: Combatant): number {
  if (c.ignoreCritMods) return 0; // Détermination : modificateurs de critique ignorés ce Round (LDB 17 l.64)
  const pens = (c.traumas ?? []).map((t) => t.dodgePenalty ?? 0).filter((p) => p < 0);
  return pens.length ? Math.min(...pens) : 0;
}
