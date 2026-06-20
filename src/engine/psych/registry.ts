/**
 * Psychologie DATA-DRIVEN (LDB 21/85) — `parsePsychTraits` lit la sémantique psy directement dans la
 * DONNÉE : `TraitData.capabilities` (`psychType`/`psychImmune`/`psychIndice` de `traits.json`) + le
 * `TraitInstance` structuré (`value` = Indice de Peur/Terreur ; `arg` = Cible d'un trait ciblé).
 * Plus de `defs/` ni de regex sur libellé reconstitué (l'ancien round-trip struct→string→regex est
 * retiré). Ajouter/éditer un trait psy = la DONNÉE (au Codex), zéro code par trait.
 */
import type { PsychParse } from './types';
import type { PsychTrait, PsychType } from '../psychology';
import type { TraitList } from '../statEntry';
import { findTraitById } from '../../data';

export type { PsychParse } from './types';

/** Traits psy CIBLÉS (Cible = `instance.arg`) ; Peur/Terreur portent un Indice (`instance.value`). */
const TARGETED: ReadonlySet<string> = new Set(['animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']);

/** Propriétés psy d'un combattant, dérivées de ses `TraitInstance` via les capacités de la donnée. */
export function parsePsychTraits(traits: TraitList): PsychParse {
  const out: PsychParse = {};
  for (const x of traits) {
    const caps = findTraitById(x.id)?.capabilities;
    if (!caps) continue;
    if (caps.psychImmune) out.psychImmune = true;
    const pt = caps.psychType;
    if (pt === 'peur') {
      if (x.value != null) out.causesPeur = x.value;
    } else if (pt === 'terreur') {
      if (x.value != null) out.causesTerreur = x.value;
    } else if (pt && TARGETED.has(pt)) {
      // « (un au choix) » / vide → Cible indéfinie → trait INERTE tant qu'une Cible n'est pas assignée.
      const cible = !x.arg || /au choix/i.test(x.arg) ? undefined : x.arg;
      const trait: PsychTrait = { type: pt as PsychType, cible };
      if (caps.psychIndice != null) trait.indice = caps.psychIndice;
      (out.psychTraits ??= []).push(trait);
    }
  }
  return out;
}
