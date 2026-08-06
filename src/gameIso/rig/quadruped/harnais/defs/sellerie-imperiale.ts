import type { QuadHarnaisDef } from '../types';
import { SELLERIE_IMPERIALE_PROFIL_COMPILE } from '../sellerieImperialeProfilCompile';

// SELLERIE IMPÉRIALE — le harnachement de monture de l'Empire (selle matelassée verte, caparaçon
// rouge liseré d'or, croupière à panneaux olive et médaillons, sangle, étrivière et étrier doré,
// bride à ferret et anneau de mors).
//
// Deux os, ceux que le harnais chevauche en PROFIL : `tronc` et `tete`. `plan: 0` = le plan de l'os
// lui-même — le fragment se peint APRÈS l'art de l'os, de sorte que l'empilement déco d'un os
// reproduise exactement la concaténation qu'un dessin entier y aurait posée (garde :
// `harnais/quad-harnais.test.ts` pour l'étanchéité du set, `quad-purete-rendu` pour l'empreinte).
// L'art est CUIT au gabarit `cheval` (`bodyLen` 1,05 / `neckLen` 1,12 dans les coordonnées de
// tronc et de tête) : d'où `especes: ['cheval']` — posé sur une autre carrure, il glisserait.
export const quadHarnais: QuadHarnaisDef = {
  id: 'sellerie-imperiale',
  label: 'Sellerie impériale',
  especes: ['cheval'],
  deco: {
    'tronc#profile': [{ svg: SELLERIE_IMPERIALE_PROFIL_COMPILE.tronc, plan: 0 }],
    'tete#profile': [{ svg: SELLERIE_IMPERIALE_PROFIL_COMPILE.tete, plan: 0 }],
  },
};
