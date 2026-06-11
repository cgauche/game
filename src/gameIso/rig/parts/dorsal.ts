/**
 * Appendice DORSAL (ailes, queue, cape, aura…) — codifie UNE FOIS les règles de
 * vue/profondeur apprises à la dure, pour ne plus les redécouvrir à chaque nouvel art :
 *
 *  - de FACE et de PROFIL, l'appendice passe DERRIÈRE TOUT le corps (plan 'fond') :
 *    un simple calque d'os est trahi par le z inégal des bras (G=4 derrière, D=8 devant) ;
 *  - de DOS, il passe DEVANT tout (plan 'avant') : on regarde le dos où il s'attache ;
 *  - de PROFIL, le dos du personnage est à −x (il regarde +x) : l'art `profile` DOIT
 *    s'ancrer au bord arrière (x négatif) et se déployer vers −x — pas au centre.
 *
 * Le miroir (regarder à gauche) est géré au niveau token : tout le svg est retourné,
 * l'appendice suit. Les trois arts sont donc dessinés pour un personnage regardant +x.
 */
import type { BoneId, RigOverlay } from '../bones';

/** Les trois vues d'un appendice dorsal → calques prêts (plan/vue corrects). */
export function dorsalOverlays(bone: BoneId, art: { front: string; back: string; profile: string }): RigOverlay[] {
  return [
    { bone, svg: art.front, plane: 'fond', view: 'front' },
    { bone, svg: art.back, plane: 'avant', view: 'back' },
    { bone, svg: art.profile, plane: 'fond', view: 'profile' },
  ];
}
