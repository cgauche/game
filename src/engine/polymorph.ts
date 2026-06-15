/**
 * Métamorphose en créature (Forme bestiale, LDB 48 — Domaine de la Bête) : « remplacez vos F, E, Ag
 * et Dex par celles de la créature, recalculez vos PB, gagnez tous ses Traits sauf Bestial ».
 *
 * RÉUTILISE la machinerie d'effets existante plutôt qu'un sous-système dédié : le remplacement de
 * Caractéristique = un `charMod` DIFFÉRENTIEL (la cible atteint la valeur de la créature ; les PB
 * sont recalculés par `refreshWounds` au passage, et le bonus est RETIRÉ à l'expiration → on
 * reprend sa vraie forme tout seul) ; chaque Trait = un `grantTrait` (retiré à l'expiration aussi).
 * Tout est donc auto-restitué à la fin du Sort par `endOfRound` / la purge d'horloge — aucun
 * handler de restauration custom. La perte de la parole/incantation, le +1 Trait facultatif par
 * +2 DR et la persistance des PB perdus restent journalisés (arbitrage MJ).
 */
import type { Combatant } from './types';
import type { GameOp } from './ops';
import { findCreature } from '../data';
import { asTrait, formatTrait } from './traits/dispatch';

export function polymorphOps(target: Combatant, ref: string): GameOp[] {
  const cr = findCreature(ref);
  if (!cr) return [{ op: 'narrative', text: `Forme bestiale : « ${ref} » introuvable au bestiaire — arbitrage MJ.` }];
  const ops: GameOp[] = [];
  // F/E/Ag/Dex de la créature, par DIFFÉRENCE (effectiveChar = base + bonus = valeur de la créature).
  for (const k of ['F', 'E', 'Ag', 'Dex'] as const) {
    const v = cr.char[k];
    if (typeof v === 'number') {
      const diff = v - (target.characteristics[k] ?? 0);
      if (diff !== 0) ops.push({ op: 'charMod', char: k, mod: diff });
    }
  }
  // Tous les Traits standards SAUF Bestial (grantTrait prend une chaîne ; instance structurée → libellé).
  for (const t of cr.traits ?? [])
    if (asTrait(t).key !== 'Bestial') ops.push({ op: 'grantTrait', trait: typeof t === 'string' ? t : formatTrait(t) });
  ops.push({
    op: 'narrative',
    text: `${target.name} prend la forme d'un(e) ${cr.label} (F/E/Ag/Dex et Traits de la créature, PB recalculés) ; elle ne peut ni parler ni incanter, et conserve les PB perdus en reprenant sa vraie forme — arbitrage MJ.`,
  });
  return ops;
}
