import type { PsychType, PsychTrait } from '../psychology';

/** Propriétés psy extraites des libellés de traits de données (creatures.json). */
export interface PsychParse {
  causesPeur?: number;
  causesTerreur?: number;
  psychImmune?: boolean;
  psychTraits?: PsychTrait[];
}

/** Un trait de Psychologie reconnu dans les données (LDB 21/85). 1 trait = 1 fichier `psych/defs/`.
 *  `apply` reconnaît le libellé (« Peur 2 », « Animosité (Elfes) »…) et écrit l'effet dans `out` ;
 *  renvoie `true` si reconnu. Ajouter un trait psy = déposer un fichier, zéro code applicatif. */
export interface PsychTraitDef {
  key: string;
  apply(trait: string, out: PsychParse): boolean;
}

/** Fabrique d'un trait CIBLÉ « Type (Cible) » (LDB 21). Cible « (un au choix) » ou vide → indéfinie
 *  (le trait reste INERTE tant qu'une Cible n'est pas assignée). `indice` : Phobie = 1, Effrayé = 0. */
export function targetedTraitDef(key: string, re: RegExp, type: PsychType, indice?: number): PsychTraitDef {
  return {
    key,
    apply(t, out) {
      const m = t.match(re);
      if (!m) return false;
      const raw = m[1].trim();
      const cible = raw === '' || /au choix/i.test(raw) ? undefined : raw;
      const trait: PsychTrait = { type, cible };
      if (indice !== undefined) trait.indice = indice;
      (out.psychTraits ??= []).push(trait);
      return true;
    },
  };
}
