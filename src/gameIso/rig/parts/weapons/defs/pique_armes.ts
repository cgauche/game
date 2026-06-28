import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: 'pique_armes',
  label: "Pique d'armes",
  type: 'melee',
  group: 'Base',
  target: 'pic de guerre a une main : pioche a long bec recourbe + contre-lame, sur manche court',
  art: '<!-- Pique d armes (war pick / pioche a une main) : repere os arme, manche (0,0), tete pic en haut --><!-- talon ferre --><rect x="-2.2" y="6" width="4.4" height="3" rx="1" fill="@metalO" stroke="@metalO" stroke-width="0.3"/><!-- manche de bois (1 main, allonge moyenne) --><rect x="-1.9" y="-32" width="3.8" height="40" rx="1.6" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><rect x="-0.7" y="-31" width="1.2" height="38" fill="@cuirH" opacity="0.5"/><line x1="-1.9" y1="0" x2="1.9" y2="0.8" stroke="@cuirO" stroke-width="0.4" opacity="0.7"/><line x1="-1.9" y1="3" x2="1.9" y2="3.8" stroke="@cuirO" stroke-width="0.4" opacity="0.7"/><!-- oeil / collet metal ou passe le manche --><rect x="-3" y="-42" width="6" height="11" rx="1.2" fill="@metalO" stroke="@metalO" stroke-width="0.5"/><rect x="-2.6" y="-41" width="5.2" height="1.2" fill="@metalH" opacity="0.6"/><!-- BEC : long pic recourbe vers le bas (droite) - signature perce-armure --><path d="M2.6 -41 Q13.5 -40 20 -30.5 L17.6 -28.4 Q11 -36 2.6 -35.2 Z" fill="@metal" stroke="@metalO" stroke-width="0.6" stroke-linejoin="round"/><path d="M4 -40 Q12 -39 18.6 -30.6" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.65"/><!-- contre-lame / panne plate (gauche) - donne la silhouette de pioche --><path d="M-2.6 -41 L-12 -39.4 L-13.6 -34.4 L-2.6 -35.2 Z" fill="@metal" stroke="@metalO" stroke-width="0.6" stroke-linejoin="round"/><line x1="-11.6" y1="-38.6" x2="-12.8" y2="-35" stroke="@metalH" stroke-width="0.5" opacity="0.6"/>',
  palette: { metalO: '#2a3038', metalH: '#eef3fa', metal: '#9aa6b8', cuir: '#5a3f24', cuirO: '#33241a', cuirH: '#7c5832' },
};
