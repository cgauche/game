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

/**
 * Durée de convalescence d'un trauma en JOURS (LDB 18) : déchirure mineure 30−BE (l.317) ; déchirure
 * majeure 2×(30−BE), deux périodes (l.326) ; fracture 30+1d10 (l.300), +10 jours si majeure (l.309).
 * `be` = Bonus d'Endurance, `d10` = 1d10 (fractures). Plancher 1 jour.
 */
export function traumaRecoveryDays(kind: TraumaKind, severity: TraumaSeverity, be: number, d10 = 5): number {
  if (kind === 'dechirure') {
    const base = Math.max(1, 30 - be);
    return severity === 'majeur' ? base * 2 : base;
  }
  return 30 + d10 + (severity === 'majeur' ? 10 : 0);
}

/** `opts.be` (Bonus d'Endurance) + `opts.d10` (1d10 des fractures) → durée de convalescence `recoveryDays`.
 *  Omis (tests/legacy) ⇒ pas de décompte (trauma permanent jusqu'à traitement explicite). */
export function traumaFromKind(
  kind: TraumaKind,
  severity: TraumaSeverity,
  location: HitLocation,
  opts?: { be?: number; d10?: number },
): Trauma {
  const sev = severity === 'mineur' ? 'Mineure' : 'Majeure';
  const recoveryDays = opts?.be == null ? undefined : traumaRecoveryDays(kind, severity, opts.be, opts.d10 ?? 5);
  if (kind === 'dechirure') {
    const onLeg = LEG.includes(location);
    // Jambe : −10 (mineure) / −20 (majeure) aux Tests de mobilité/Esquive (LDB 18 l.315/324).
    const dodge = severity === 'mineur' ? -10 : -20;
    return {
      label: `Déchirure musculaire (${sev})`,
      location,
      ...(onLeg ? { movementHalved: true, dodgePenalty: dodge } : {}),
      recoveryDays,
      note: onLeg
        ? `LDB 18 l.315 : Mouvement ÷2 + ${dodge} aux Tests de mobilité de la jambe. Guérison 30−BE jours.`
        : 'LDB 18 l.315 : −10/−20 aux Tests de la Localisation (non modélisé en combat). Guérison 30−BE jours.',
    };
  }
  // fracture
  if (location === 'corps') {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      charPenalty: { F: -30, Ag: -30 },
      recoveryDays,
      note: 'LDB 18 l.298 (Torse) : −30 Force et Agilité, Mouvement ÷2. Guérison 30+1d10 jours.',
    };
  }
  if (LEG.includes(location)) {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      dodgePenalty: -20, // règle du Pied (l.369) : −20 aux Tests de mobilité, dont l'Esquive
      recoveryDays,
      note: 'LDB 18 l.298 (Jambe) : Mouvement ÷2 + −20 aux Tests de mobilité/Esquive (règle du Pied). Guérison 30+1d10 jours.',
    };
  }
  return {
    label: `Fracture (${sev})`,
    location,
    recoveryDays,
    note: location === 'tete'
      ? 'LDB 18 l.298 (Tête) : −30 aux Tests de Langue, régime liquide (non modélisé en combat). Guérison 30+1d10 jours.'
      : 'LDB 18 l.298 (Bras) : membre inutilisable (latéralité non modélisée en combat). Guérison 30+1d10 jours.',
  };
}

/**
 * Convalescence : décompte `days` jours sur chaque trauma à durée. À 0, le trauma disparaît (ses
 * pénalités, lues depuis `traumas[]`, tombent avec) et une Blessure critique est résolue (`criticalWounds`
 * décrémenté). Les traumas sans `recoveryDays` (legacy) restent. Pur ; mute `c`, renvoie le journal.
 */
export function tickTraumaRecovery(c: Combatant, days: number): string[] {
  if (!c.traumas?.length || days <= 0) return [];
  const log: string[] = [];
  const remaining: Trauma[] = [];
  for (const t of c.traumas) {
    if (t.recoveryDays == null) { remaining.push(t); continue; }
    const left = t.recoveryDays - days;
    if (left <= 0) {
      log.push(`${c.name} guérit de : ${t.label} (${t.location}).`);
      if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1);
    } else remaining.push({ ...t, recoveryDays: left });
  }
  c.traumas = remaining;
  return log;
}

/**
 * Soin assisté d'une déchirure par la Compétence Guérison (LDB 18 l.317) : réduit sa convalescence de
 * **1 jour + 1 par DR**, une seule fois (`healAccelerated`). RAW : seules les déchirures en profitent
 * (la fracture relève d'un autre flux ; la déchirure majeure n'est pas accélérée — laissé en dette).
 * Renvoie le journal (message d'échec si aucune déchirure éligible).
 */
/** Le personnage a-t-il une déchirure dont la Guérison peut encore raccourcir la convalescence ? */
export function hasTreatableTrauma(c: Combatant): boolean {
  return (c.traumas ?? []).some((t) => t.recoveryDays != null && !t.healAccelerated && /déchirure/i.test(t.label));
}

export function accelerateTrauma(c: Combatant, dr: number): string[] {
  const t = (c.traumas ?? []).find((x) => x.recoveryDays != null && !x.healAccelerated && /déchirure/i.test(x.label));
  if (!t) return [`${c.name} : aucune déchirure dont la Guérison puisse accélérer la convalescence.`];
  const cut = 1 + Math.max(0, dr);
  t.recoveryDays = Math.max(0, (t.recoveryDays ?? 0) - cut);
  t.healAccelerated = true;
  return [`${c.name} : la Guérison raccourcit la convalescence de ${t.label} de ${cut} jour(s) (reste ${t.recoveryDays}).`];
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
