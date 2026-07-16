import type { TenueDef } from '../types';

// Chevalier du Loup Blanc (AA 03 l.234-266) — templier d'Ulric, tête nue.
//
// ÉTALON DE FACTURE. Quatre idiomes réutilisables, à recopier pour tout le vestiaire :
//  · LAMELLE  : path fill=url(#g_steelD) (le gradient suit la bbox → clair en HAUT de chaque
//               bande) + nappe @metalO qui enfonce la masse + arête spéculaire @metalH TRACÉE
//               PAR-DESSUS la nappe + ombre portée @metalO sous le bord. Jamais un aplat+liseré.
//  · CANNELURE: sillon @metalO large accolé à une arête @metalH fine — c'est la PAIRE qui
//               fait lire le creux, un trait seul ne rend qu'un rayure.
//  · MÈCHE    : @poil, traits COURTS suivant le sens du poil, + silhouette à bord déchiqueté
//               (dents dans le path lui-même) → la fourrure se lit comme des poils, pas un aplat.
//  · RIVET    : point @metalO + éclat @metalH décalé d'un quart de pixel.
//
// Lecture à 40px : elle est portée par le CONTRASTE DE VALEUR entre matières adjacentes —
// acier anthracite ↔ pelisse crème ↔ ceinture de laiton clair. Pas par la teinte.
//
// Repères (contrat de part, torse : origine = taille, -y = haut) mesurés au rendu :
//  · la TÊTE couvre x -8..+8 jusqu'à y≈-22 → rien d'utile au centre au-dessus de -22 ;
//  · le bras VUE-GAUCHE (epauleG, z=4) est DERRIÈRE le torse → l'art déborde dessus (crâne) ;
//  · le bras VUE-DROITE (epauleD, z=8) est DEVANT → l'art au-delà de x≈+11 est masqué ;
//  · l'écart des jambes ne laisse que x -4.5..+4.5 (la jambe vue-droite, z=6, passe devant).
// D'où la composition, FIDÈLE à l'illustration : crâne sur l'épaule DROITE du personnage
// (= vue-gauche de face, côté qui déborde) ; pelisse sur son épaule GAUCHE ; de DOS les côtés
// s'inversent → la pelisse tombe côté vue-gauche et s'y déploie en entier.
//
// PROFIL — pas de crâne, et c'est un CONSTAT de géométrie, pas un oubli : le bras dessiné
// devant (epauleD, z=8) est le bras GAUCHE du personnage et couvre x -0.7..+10.7 dès y=-33 ;
// la tête occupe y -53..-33 juste au-dessus. Ce profil regarde donc le chevalier PAR SA
// GAUCHE : le crâne, posé sur son épaule DROITE, est de l'autre côté du corps et se projette
// DANS la silhouette de la tête → occlus. L'y planter quand même reviendrait à plaquer l'art
// de face sur un latéral (docs/creer-une-creature.md §4). Le profil porte donc la pelisse
// (côté proche, sa vraie place) + la collerette de poil qui franchit l'épaule.
//
// L'illustration est un homme de ~7,5 têtes, le rig un gabarit de ~5 têtes à grosse tête :
// les repères sont ADAPTÉS proportionnellement (fraction taille→pieds), jamais décalqués.
export const tenue: TenueDef = {
  name: 'Chevalier du Loup Blanc',
  palette: {
    // acier lamellaire ANTHRACITE à ruptures spéculaires fortes (relevé au zoom : la masse est
    // sombre, ce sont les arêtes qui brillent — l'inverse d'un gris moyen uniforme).
    metal: '#4c5663', metalO: '#0f1216', metalH: '#ccd6e2',
    // pelisse : crème chaud, ombres BLEU-GRIS (et non gris neutre — relevé au zoom).
    fourrure: '#f2efe4', fourrureO: '#8fa6b8', fourrureH: '#fdfcf6',
    // hachures du poil : brun-violacé très sombre (le trait d'encre de l'illustration).
    poil: '#3f3540', poilO: '#221d23', poilH: '#6d5e6b',
    // crâne : ivoire à patine ocre.
    os: '#ece2c6', osO: '#a08a58', osH: '#faf6e8',
    // orbite et cavités : olive sombre (et non noir — relevé au zoom).
    orbite: '#4b4b36',
    // baudrier de cuir rouge (sangle d'épée).
    vet2: '#9c4442', vet2O: '#5a2224', vet2H: '#bd6b60',
    // ceinture à plaques de LAITON : le contraste de valeur qui porte la lecture à 40px.
    or: '#cdb95e', orO: '#7c6920', orH: '#f2e6a6',
    cuir: '#5b4229', cuirO: '#231a10', cuirH: '#8c6c46',
  },
  set: {
    // Pas de slot `tete` : le chevalier est tête nue dans l'illustration. Cheveux/barbe/visage
    // viennent de la couche PERSONNAGE — une tenue n'en dessine JAMAIS.
    torse: {
      front: `<g stroke="@metalO" stroke-width="0.5" stroke-linejoin="round">
<path d="M-11.8 -30 Q0 -33.6 11.8 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="url(#g_steelD)"/>
<path d="M-11.8 -30 Q0 -33.6 11.8 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M-9.4 -27.6 Q-10.1 -14 -9.1 -1.4" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M-8.5 -27.8 Q-9.2 -14 -8.2 -1.4" stroke="@metalH" stroke-width="0.34" opacity="0.42"/>
<path d="M-6.3 -28.8 Q-6.9 -14 -6.1 -1.2" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M-5.4 -29 Q-6 -14 -5.2 -1.2" stroke="@metalH" stroke-width="0.34" opacity="0.42"/>
<path d="M-3.1 -29.6 Q-3.5 -14 -3 -1.1" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M-2.2 -29.8 Q-2.6 -14 -2.1 -1.1" stroke="@metalH" stroke-width="0.34" opacity="0.42"/>
<path d="M0.1 -29.9 Q0.1 -14 0.1 -1" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M1 -29.9 Q1 -14 1 -1" stroke="@metalH" stroke-width="0.34" opacity="0.42"/>
<path d="M3.3 -29.6 Q3.7 -14 3.2 -1.1" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M4.2 -29.4 Q4.6 -14 4.1 -1.1" stroke="@metalH" stroke-width="0.34" opacity="0.42"/>
<path d="M6.5 -28.8 Q7.1 -14 6.3 -1.2" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M7.4 -28.5 Q8 -14 7.2 -1.2" stroke="@metalH" stroke-width="0.34" opacity="0.42"/>
<path d="M9.6 -27.6 Q10.3 -14 9.3 -1.4" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
</g>
<path d="M-11.9 -29.6 Q0 -33.2 11.9 -29.6 Q0 -31.4 -11.9 -29.6 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<path d="M-12.3 -8.6 Q0 -5.2 12.3 -8.6 L12.2 -3.8 Q0 -0.4 -12.2 -3.8 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.3 -8.6 Q0 -5.2 12.3 -8.6 L12.2 -3.8 Q0 -0.4 -12.2 -3.8 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-12.3 -8.6 Q0 -5.2 12.3 -8.6" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.9"/>
<path d="M-12.2 -3.8 Q0 -0.4 12.2 -3.8" stroke="@metalO" stroke-width="0.7" fill="none" opacity="0.9"/>
<path d="M-12.2 -3.9 Q0 -0.5 12.2 -3.9 L12 0.4 Q0 3.8 -12 0.4 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.2 -3.9 Q0 -0.5 12.2 -3.9 L12 0.4 Q0 3.8 -12 0.4 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-12.15 -3.7 Q0 -0.3 12.15 -3.7" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.75"/>
<g fill="@metalO" stroke="none"><circle cx="-9.6" cy="-6.1" r="0.52"/><circle cx="0" cy="-4.3" r="0.52"/><circle cx="9.6" cy="-6.1" r="0.52"/></g>
<g fill="@metalH" stroke="none" opacity="0.7"><circle cx="-9.75" cy="-6.3" r="0.2"/><circle cx="-0.15" cy="-4.5" r="0.2"/><circle cx="9.45" cy="-6.3" r="0.2"/></g>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="url(#g_steelD)"/>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-11.6 6.8 Q0 10 11.6 6.8" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="url(#g_steelD)"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-11.2 11.6 Q0 15 11.2 11.6" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="url(#g_steelD)"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-10.6 16 Q0 19.4 10.6 16" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-9.8 20.2 Q0 23.6 9.8 20.2" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-9.2 24.4 Q0 27.6 9.2 24.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<g stroke="none">
<path d="M-6.6 10.4 L-4.6 10.8 L-4.9 17.6 L-6.9 17.2 Z" fill="@cuir"/>
<path d="M-6.6 10.4 L-5.9 10.55 L-6.2 17.35 L-6.9 17.2 Z" fill="@cuirH" opacity="0.5"/>
<rect x="-6.7" y="16.6" width="2.2" height="1.7" rx="0.3" fill="@or" stroke="@orO" stroke-width="0.35"/>
<path d="M4.6 10.8 L6.6 10.4 L6.9 17.2 L4.9 17.6 Z" fill="@cuir"/>
<path d="M4.6 10.8 L5.3 10.65 L5.6 17.45 L4.9 17.6 Z" fill="@cuirH" opacity="0.5"/>
<rect x="4.5" y="16.6" width="2.2" height="1.7" rx="0.3" fill="@or" stroke="@orO" stroke-width="0.35"/>
</g>
<path d="M-11.4 2.4 Q0 5.2 11.4 2.4 L11.3 7.8 Q0 10.6 -11.3 7.8 Z" fill="@or"/>
<path d="M-11.4 2.4 Q0 5.2 11.4 2.4 L11.35 3.9 Q0 6.7 -11.35 3.9 Z" fill="@orH" opacity="0.85" stroke="none"/>
<path d="M-11.32 6.5 Q0 9.3 11.32 6.5 L11.3 7.8 Q0 10.6 -11.3 7.8 Z" fill="@orO" opacity="0.85" stroke="none"/>
<g stroke="@orO" stroke-width="0.45" fill="none" opacity="0.9">
<path d="M-7.6 3.5 L-7.65 8.9"/><path d="M-3.8 4.5 L-3.85 9.9"/><path d="M0 4.8 L0 10.2"/><path d="M3.8 4.5 L3.85 9.9"/><path d="M7.6 3.5 L7.65 8.9"/>
</g>
<g fill="@cuirO" stroke="none">
<circle cx="-9.5" cy="5.6" r="0.5"/><circle cx="-5.7" cy="6.3" r="0.5"/><circle cx="-1.9" cy="6.6" r="0.5"/><circle cx="1.9" cy="6.6" r="0.5"/><circle cx="5.7" cy="6.3" r="0.5"/><circle cx="9.5" cy="5.6" r="0.5"/>
</g>
<g fill="@orH" stroke="none" opacity="0.55">
<circle cx="-9.65" cy="5.4" r="0.18"/><circle cx="-5.85" cy="6.1" r="0.18"/><circle cx="-2.05" cy="6.4" r="0.18"/><circle cx="1.75" cy="6.4" r="0.18"/><circle cx="5.55" cy="6.1" r="0.18"/><circle cx="9.35" cy="5.4" r="0.18"/>
</g>
<path d="M-11 4.6 L-2.6 8.9 L-3.4 11 L-11.4 6.6 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4"/>
<path d="M-11 4.6 L-2.6 8.9 L-2.9 9.7 L-11.2 5.4 Z" fill="@vet2H" opacity="0.5" stroke="none"/>
<path d="M-2.6 8.9 L6.4 12.4 L5.8 14.6 L-3.4 11 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4"/>
<path d="M-2.6 8.9 L6.4 12.4 L6.2 13.2 L-2.9 9.7 Z" fill="@vet2H" opacity="0.5" stroke="none"/>
<path d="M-3.6 10.4 L-1.4 11.3 L-2.8 17.4 L-4.6 16.6 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4"/>
<path d="M-3.6 10.4 L-2.9 10.7 L-4.2 16.9 L-4.6 16.6 Z" fill="@vet2H" opacity="0.45" stroke="none"/>
<ellipse cx="-2.9" cy="9.9" rx="1.5" ry="1.15" fill="none" stroke="@or" stroke-width="0.65"/>
<ellipse cx="-2.9" cy="9.9" rx="1.5" ry="1.15" fill="none" stroke="@orH" stroke-width="0.25" opacity="0.6"/>
<path d="M-3.5 17.1 L-1.9 16.4 Q-0.9 17.6 -2 18.5 Q-3.4 18.4 -3.5 17.1 Z" fill="@or" stroke="@orO" stroke-width="0.4"/>
<g fill="@vet2O" stroke="none"><circle cx="-8.2" cy="6.1" r="0.4"/><circle cx="-5.4" cy="7.6" r="0.4"/><circle cx="1.4" cy="11.1" r="0.4"/><circle cx="4.2" cy="12.6" r="0.4"/></g>
<circle cx="-9.2" cy="-16.4" r="3.3" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.55"/>
<circle cx="-9.2" cy="-16.4" r="3.3" fill="@metalO" opacity="0.3" stroke="none"/>
<g stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.8">
<path d="M-9.2 -19.5 L-9.2 -13.3"/><path d="M-12.3 -16.4 L-6.1 -16.4"/><path d="M-11.4 -18.6 L-7 -14.2"/><path d="M-7 -18.6 L-11.4 -14.2"/>
</g>
<g stroke="@metalO" stroke-width="0.28" fill="none" opacity="0.85">
<path d="M-9.5 -19.45 L-9.5 -13.35"/><path d="M-12.25 -16.7 L-6.15 -16.7"/><path d="M-11.65 -18.35 L-7.25 -13.95"/><path d="M-7.25 -18.35 L-11.65 -13.95"/>
</g>
<circle cx="-9.2" cy="-16.4" r="3.3" fill="none" stroke="@metalO" stroke-width="0.5"/>
<path d="M-12.1 -17.9 A3.3 3.3 0 0 1 -7.3 -19.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.95"/>
<circle cx="-9.2" cy="-16.4" r="1.1" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.35"/>
<circle cx="-9.5" cy="-16.75" r="0.34" fill="@metalH" stroke="none" opacity="0.85"/>
<path d="M-9.8 -26.6 L-15.8 -27.6 Q-16.5 -23 -16.8 -19 Q-17 -17.2 -15.2 -17.4 Q-13.7 -17.6 -13.6 -19.2 Q-11.7 -22.9 -9.8 -26.6 Z" fill="@os" stroke="@poilO" stroke-width="0.45"/>
<path d="M-15.6 -27 Q-16.3 -23 -16.6 -19.2" fill="none" stroke="@osH" stroke-width="1" opacity="0.95"/>
<path d="M-14 -26.9 Q-14.9 -23 -15.2 -19.4" fill="none" stroke="@osH" stroke-width="0.4" opacity="0.4"/>
<path d="M-10.6 -25.6 Q-12.3 -22 -13.9 -19.4" fill="none" stroke="@osO" stroke-width="0.55" opacity="0.6"/>
<g fill="@os" stroke="@poilO" stroke-width="0.28" stroke-linejoin="round">
<path d="M-10.75 -25.3 L-9.6 -24.6 L-10.85 -24.1 Z"/>
<path d="M-11.7 -23.45 L-10.55 -22.75 L-11.8 -22.25 Z"/>
<path d="M-12.65 -21.6 L-11.5 -20.9 L-12.75 -20.4 Z"/>
<path d="M-13.3 -20.2 L-12.15 -19.5 L-13.4 -19 Z"/>
</g>
<path d="M-15.6 -17.8 L-14.9 -14.2 L-14.4 -17.4 Z" fill="@os" stroke="@poilO" stroke-width="0.32" stroke-linejoin="round"/>
<ellipse cx="-16.2" cy="-18.4" rx="0.85" ry="0.55" fill="@orbite" stroke="none" opacity="0.85" transform="rotate(-14 -16.2 -18.4)"/>
<path d="M-14.7 -32.4 Q-10.9 -33.4 -8.7 -30.6 Q-7.4 -28.2 -8.5 -25.6 Q-9.9 -23.4 -12.7 -24.2 Q-15.4 -25.2 -16 -27.8 Q-16.4 -30.8 -14.7 -32.4 Z" fill="@os" stroke="@poilO" stroke-width="0.5"/>
<path d="M-14.4 -31.8 Q-15.8 -30.2 -15.4 -27.8 Q-15 -25.6 -13 -24.8" fill="none" stroke="@osH" stroke-width="0.9" opacity="0.9"/>
<path d="M-9.8 -31.6 Q-8.2 -29.2 -9.2 -26.4 Q-10 -24.6 -11.8 -24.4" fill="none" stroke="@osO" stroke-width="0.55" opacity="0.6"/>
<path d="M-13.6 -32.8 Q-11.4 -33.2 -9.9 -32" fill="none" stroke="@osO" stroke-width="0.45" opacity="0.5"/>
<path d="M-15.6 -27.6 Q-13.8 -29.2 -12.4 -27.6 Q-12.1 -25.9 -13.7 -25.2 Q-15.4 -25.2 -15.9 -26.4 Q-16.1 -27.2 -15.6 -27.6 Z" fill="@orbite" stroke="@poilO" stroke-width="0.36"/>
<path d="M-15.1 -27.4 Q-13.8 -28.4 -12.7 -27.2" fill="none" stroke="@osH" stroke-width="0.38" opacity="0.55"/>
<path d="M-13.4 -27.4 Q-11.6 -27.9 -9.9 -26.7" fill="none" stroke="@poilO" stroke-width="0.45" opacity="0.8"/>
<path d="M-14.6 -25 Q-12 -22.2 -9.2 -24.6" fill="none" stroke="@poilO" stroke-width="0.7"/>
<path d="M-14.6 -25.4 Q-12 -22.8 -9.3 -25" fill="none" stroke="@os" stroke-width="0.8"/>
<path d="M-14.4 -25.8 Q-12 -23.4 -9.6 -25.4" fill="none" stroke="@osH" stroke-width="0.32" opacity="0.6"/>
<g fill="@osO" stroke="none" opacity="0.4">
<ellipse cx="-13.4" cy="-22.4" rx="0.9" ry="2.1" transform="rotate(-14 -13.4 -22.4)"/>
<ellipse cx="-10.6" cy="-29.6" rx="1.1" ry="1.8" transform="rotate(-20 -10.6 -29.6)"/>
</g>
<path d="M0.8 20.6 Q3.4 22.2 4 26 Q4.4 30 3.4 34 L4.6 36.4 L2.8 36.6 L3.6 39.2 Q4.2 42.4 2.6 44.6 L4 46.2 L2 46 L2.4 44 Q1 45.6 -0.6 44.4 L-0.2 42 Q-1.6 43.2 -2.6 41.6 L-2 39.2 Q-2.8 36.8 -2.4 34 Q-2 30 -1.4 26 Q-0.8 22.4 0.8 20.6 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M1.2 22 Q3 23.6 3.2 27 Q3.4 31 2.6 35 Q2 39 1.8 42.6 L0.4 42.4 Q0.8 38 1 34 Q1.2 29 0.6 25.4 Q0.2 23 1.2 22 Z" fill="@fourrureO" opacity="0.6" stroke="none"/>
<path d="M-0.6 22.6 Q-1.4 26 -1.2 30 Q-1 34 -1.6 38 L-2.2 40.4 L-1.4 40.6 Q-0.6 36 -0.4 31 Q-0.2 26 0.4 22.8 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>
<g stroke="@poil" stroke-width="0.28" fill="none" opacity="0.75" stroke-linecap="round">
<path d="M0 23.4 Q0.6 26.4 0.4 29.4"/><path d="M2.2 24.6 Q2.8 27.4 2.6 30.2"/><path d="M-1.4 26.6 Q-0.9 29.4 -1 32"/>
<path d="M0.2 31 Q0.8 34 0.6 37"/><path d="M2.4 31.8 Q2.8 34.6 2.6 37.4"/><path d="M-1.6 33.4 Q-1.1 36 -1.2 38.6"/>
</g>
<path d="M-2 41.4 Q-0.4 40.4 0.6 42 L1.4 39.8 Q2.8 39.4 3.2 41.4 L4 39.6 Q5.4 39.8 5.2 41.8 Q5 44 3.4 45.6 Q1.4 47.4 -0.6 46.4 Q-2.4 45.2 -2.4 43 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-1.4 42.6 Q0.2 41.8 0.8 43.4 Q1 45.4 -0.2 46 Q-1.6 45.6 -1.8 44 Z" fill="@fourrureO" opacity="0.45" stroke="none"/>
<g stroke="@poilO" stroke-width="0.42" fill="none" stroke-linecap="round">
<path d="M0.4 42.2 Q0.2 44.4 -0.6 46.2"/><path d="M2.2 41.6 Q2.2 43.8 1.6 45.8"/><path d="M4 41.4 Q4.2 43.4 3.4 45.2"/>
</g>
<g stroke="@poilO" stroke-width="0.5" fill="none" stroke-linecap="round">
<path d="M-0.6 46.4 Q-1.2 47.6 -1.8 48"/><path d="M1.4 46.9 Q1.2 48.2 0.8 48.8"/><path d="M3.2 45.9 Q3.4 47.2 3.2 47.9"/><path d="M4.7 44.4 Q5.2 45.4 5.3 46.1"/>
</g>
</g>`,
      back: `<g stroke="@metalO" stroke-width="0.5" stroke-linejoin="round">
<path d="M-12 -30 Q0 -33.6 12 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="url(#g_steelD)"/>
<path d="M-12 -30 Q0 -33.6 12 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-11.9 -29.6 Q0 -33.2 11.9 -29.6 Q0 -31.4 -11.9 -29.6 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<path d="M-1.5 -29.6 Q0 -30 1.5 -29.6 L1.9 -6 Q0 -4.6 -1.9 -6 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-1.5 -29.6 Q0 -30 1.5 -29.6 L1.9 -6 Q0 -4.6 -1.9 -6 Z" fill="@metalO" opacity="0.3" stroke="none"/>
<path d="M-0.9 -29.4 Q0 -29.7 0.9 -29.4 L1.1 -6.4 Q0 -5.6 -1.1 -6.4 Z" fill="@metalH" opacity="0.4" stroke="none"/>
<path d="M-1.9 -29.6 L-2.3 -6" stroke="@metalO" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M1.9 -29.6 L2.3 -6" stroke="@metalO" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M-12.4 -20 Q0 -16.4 12.4 -20 L12.5 -14.6 Q0 -11 -12.5 -14.6 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.4 -20 Q0 -16.4 12.4 -20 L12.5 -14.6 Q0 -11 -12.5 -14.6 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-12.4 -19.8 Q0 -16.2 12.4 -19.8" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.9"/>
<path d="M-12.5 -14.7 Q0 -11.1 12.5 -14.7 L12.4 -9.2 Q0 -5.6 -12.4 -9.2 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.5 -14.7 Q0 -11.1 12.5 -14.7 L12.4 -9.2 Q0 -5.6 -12.4 -9.2 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-12.5 -14.5 Q0 -10.9 12.5 -14.5" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.9"/>
<path d="M-12.4 -9.3 Q0 -5.7 12.4 -9.3 L12.2 -3.8 Q0 -0.2 -12.2 -3.8 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.4 -9.3 Q0 -5.7 12.4 -9.3 L12.2 -3.8 Q0 -0.2 -12.2 -3.8 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-12.4 -9.1 Q0 -5.5 12.4 -9.1" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.9"/>
<path d="M-12.2 -3.9 Q0 -0.3 12.2 -3.9 L12 1.4 Q0 5 -12 1.4 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.2 -3.9 Q0 -0.3 12.2 -3.9 L12 1.4 Q0 5 -12 1.4 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-12.2 -3.7 Q0 -0.1 12.2 -3.7" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.8"/>
<g fill="@metalO" stroke="none"><circle cx="-9.8" cy="-17.6" r="0.5"/><circle cx="9.8" cy="-17.6" r="0.5"/><circle cx="-10" cy="-12.2" r="0.5"/><circle cx="10" cy="-12.2" r="0.5"/><circle cx="-9.9" cy="-6.8" r="0.5"/><circle cx="9.9" cy="-6.8" r="0.5"/></g>
<g fill="@metalH" stroke="none" opacity="0.65"><circle cx="-9.95" cy="-17.8" r="0.19"/><circle cx="9.65" cy="-17.8" r="0.19"/><circle cx="-10.15" cy="-12.4" r="0.19"/><circle cx="9.85" cy="-12.4" r="0.19"/><circle cx="-10.05" cy="-7" r="0.19"/><circle cx="9.75" cy="-7" r="0.19"/></g>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="url(#g_steelD)"/>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-11.6 6.8 Q0 10 11.6 6.8" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="url(#g_steelD)"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-11.2 11.6 Q0 15 11.2 11.6" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="url(#g_steelD)"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-10.6 16 Q0 19.4 10.6 16" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-9.8 20.2 Q0 23.6 9.8 20.2" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-9.2 24.4 Q0 27.6 9.2 24.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-11.4 2.4 Q0 5.2 11.4 2.4 L11.3 7.8 Q0 10.6 -11.3 7.8 Z" fill="@or"/>
<path d="M-11.4 2.4 Q0 5.2 11.4 2.4 L11.35 3.9 Q0 6.7 -11.35 3.9 Z" fill="@orH" opacity="0.85" stroke="none"/>
<path d="M-11.32 6.5 Q0 9.3 11.32 6.5 L11.3 7.8 Q0 10.6 -11.3 7.8 Z" fill="@orO" opacity="0.85" stroke="none"/>
<g stroke="@orO" stroke-width="0.45" fill="none" opacity="0.9">
<path d="M-7.6 3.5 L-7.65 8.9"/><path d="M-3.8 4.5 L-3.85 9.9"/><path d="M0 4.8 L0 10.2"/><path d="M3.8 4.5 L3.85 9.9"/><path d="M7.6 3.5 L7.65 8.9"/>
</g>
<g fill="@cuirO" stroke="none">
<circle cx="-9.5" cy="5.6" r="0.5"/><circle cx="-5.7" cy="6.3" r="0.5"/><circle cx="-1.9" cy="6.6" r="0.5"/><circle cx="1.9" cy="6.6" r="0.5"/><circle cx="5.7" cy="6.3" r="0.5"/><circle cx="9.5" cy="5.6" r="0.5"/>
</g>
<path d="M10.6 -30.6 Q4 -33.8 -4 -33.6 Q-12 -33.2 -15.4 -28 Q-17.8 -23.4 -17.2 -15.6 L-18.6 -13.2 L-16.8 -12.6 L-18 -8.2 L-16.2 -7.6 L-17.2 -3.2 L-15.4 -2.6 L-16.2 1.8 L-14.4 2.4 L-15 6.8 L-13.2 7.4 L-13.6 11.8 L-11.8 12.4 L-12 16.8 L-10.2 17.4 L-10.2 21.4 L-8.4 22 Q-6 25 -3.4 23.2 L-2.6 25.6 L-1 22.6 L0 24.6 L1 21.4 Q1.6 14 0.6 6 Q-0.2 -2 1.2 -10 Q2.6 -19 5.6 -25 Q7.6 -29 10.6 -30.6 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.45"/>
<path d="M-8.6 -32.4 Q-12.8 -31.6 -15.4 -28 Q-17.8 -23.4 -17.2 -15.6 Q-16.6 -6 -15.6 4 Q-14.6 14 -12.6 21.6 Q-11.4 25 -8.8 23.4 Q-10.4 14 -11.4 4 Q-12.4 -6 -12.2 -16 Q-12 -25 -9.6 -30.4 Z" fill="@fourrureO" opacity="0.44" stroke="none"/>
<path d="M-10.4 -32 Q-13.8 -30.8 -16 -27.4 Q-18 -23 -17.4 -15.6 Q-16.9 -6 -15.9 4 Q-14.9 14 -13 21.8 Q-12.2 24.2 -10.6 24 Q-12 14.4 -13 4.4 Q-14 -5.6 -13.8 -15.8 Q-13.6 -25 -11.4 -31.2 Z" fill="@fourrureO" opacity="0.4" stroke="none"/>
<path d="M-1.2 22.8 Q-4.4 24.6 -7.4 23 L-8.4 18 Q-4.6 20 -0.6 18.4 Z" fill="@fourrureO" opacity="0.5" stroke="none"/>
<path d="M-8 -32.6 Q-5.4 -27 -5.8 -18 Q-6.2 -8 -5.2 2 Q-4.2 12 -2.4 20.6 L-5.4 21.6 Q-7.4 12 -8.4 2 Q-9.4 -8 -9.2 -18 Q-9 -26 -10.6 -31.4 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>
<path d="M9.4 -30.6 Q4.4 -32.8 -1.4 -32.8 Q-5.6 -32.8 -9 -31.8 Q-4.4 -31 0.4 -31 Q5.2 -31 9.4 -30.6 Z" fill="@fourrureH" opacity="0.55" stroke="none"/>
<g stroke="@poil" fill="none" opacity="0.85" stroke-linecap="round">
<path d="M7 -31.8 Q5.6 -29.8 4.8 -27.6" stroke-width="0.32"/><path d="M5.8 -31.6 Q5 -30.4 4.6 -29.4" stroke-width="0.22"/>
<path d="M2.8 -32.6 Q1.2 -30.4 0.4 -28.2" stroke-width="0.3"/><path d="M1.6 -32.6 Q0.8 -31.4 0.4 -30.4" stroke-width="0.2"/><path d="M3.6 -32.4 Q2.8 -31.2 2.6 -30.2" stroke-width="0.22"/>
<path d="M-1.4 -32.8 Q-2.8 -30.6 -3.6 -28.4" stroke-width="0.32"/><path d="M-2.6 -32.8 Q-3.4 -31.6 -3.8 -30.6" stroke-width="0.2"/>
<path d="M-5.8 -32.6 Q-7.2 -30.2 -8 -27.8" stroke-width="0.3"/><path d="M-7 -32.4 Q-7.8 -31.2 -8.2 -30.2" stroke-width="0.22"/><path d="M-4.6 -32.4 Q-5.2 -31.4 -5.4 -30.6" stroke-width="0.18"/>
<path d="M-10 -31.8 Q-11.6 -29.4 -12.4 -27" stroke-width="0.32"/><path d="M-11.2 -31.2 Q-12 -30 -12.4 -29" stroke-width="0.2"/>
<path d="M-13.8 -29.8 Q-15 -27.6 -15.6 -25.4" stroke-width="0.3"/><path d="M-14.8 -28.6 Q-15.4 -27.4 -15.6 -26.6" stroke-width="0.2"/>
<path d="M-16.6 -24.2 Q-16.1 -21.6 -16.4 -19.2" stroke-width="0.3"/><path d="M-16.2 -23 Q-15.9 -21.8 -16 -20.8" stroke-width="0.18"/>
<path d="M-13.6 -25.2 Q-13.1 -22.6 -13.4 -20.2" stroke-width="0.32"/><path d="M-12.8 -24.4 Q-12.5 -23.2 -12.6 -22.2" stroke-width="0.2"/>
<path d="M-10.4 -25.8 Q-10 -23.4 -10.2 -21.4" stroke-width="0.28"/>
<path d="M-7.2 -26.4 Q-6.7 -23.6 -7 -21.2" stroke-width="0.32"/><path d="M-6.2 -25.6 Q-5.9 -24.4 -6 -23.4" stroke-width="0.18"/>
<path d="M-3.8 -26.6 Q-3.4 -24.2 -3.6 -22.2" stroke-width="0.26"/>
<path d="M-1 -25.8 Q-0.6 -23.8 -0.8 -22.2" stroke-width="0.22"/>
<path d="M-16.8 -18.4 Q-16.3 -15.6 -16.6 -13.2" stroke-width="0.32"/>
<path d="M-14 -19.4 Q-13.5 -16.6 -13.8 -14.2" stroke-width="0.3"/><path d="M-13.2 -18.4 Q-12.9 -17.2 -13 -16.2" stroke-width="0.2"/>
<path d="M-10.6 -20.2 Q-10.2 -17.8 -10.4 -15.8" stroke-width="0.26"/>
<path d="M-7.4 -20.8 Q-6.9 -18 -7.2 -15.6" stroke-width="0.32"/><path d="M-6.4 -20 Q-6.1 -18.8 -6.2 -17.8" stroke-width="0.18"/>
<path d="M-4.2 -21 Q-3.8 -18.6 -4 -16.6" stroke-width="0.26"/>
<path d="M-1.4 -20.4 Q-1 -18.4 -1.2 -16.8" stroke-width="0.22"/>
<path d="M-16.9 -12.4 Q-16.4 -9.6 -16.7 -7.2" stroke-width="0.3"/><path d="M-16.2 -11.4 Q-15.9 -10.2 -16 -9.2" stroke-width="0.18"/>
<path d="M-14 -13.4 Q-13.6 -11 -13.8 -9" stroke-width="0.26"/>
<path d="M-10.8 -14.2 Q-10.3 -11.4 -10.6 -9" stroke-width="0.32"/><path d="M-9.8 -13.4 Q-9.5 -12.2 -9.6 -11.2" stroke-width="0.2"/>
<path d="M-7.6 -14.8 Q-7.2 -12.4 -7.4 -10.4" stroke-width="0.26"/>
<path d="M-4.4 -15 Q-3.9 -12.2 -4.2 -9.8" stroke-width="0.3"/>
<path d="M-1.6 -14.2 Q-1.2 -12.2 -1.4 -10.6" stroke-width="0.22"/>
<path d="M-16.6 -6.4 Q-16.2 -4 -16.4 -2" stroke-width="0.26"/>
<path d="M-13.8 -7.4 Q-13.3 -4.6 -13.6 -2.2" stroke-width="0.32"/><path d="M-13 -6.4 Q-12.7 -5.2 -12.8 -4.2" stroke-width="0.2"/>
<path d="M-10.6 -8.2 Q-10.2 -5.8 -10.4 -3.8" stroke-width="0.26"/>
<path d="M-7.4 -8.8 Q-6.9 -6 -7.2 -3.6" stroke-width="0.3"/><path d="M-6.4 -8 Q-6.1 -6.8 -6.2 -5.8" stroke-width="0.18"/>
<path d="M-4.2 -9 Q-3.8 -6.6 -4 -4.6" stroke-width="0.26"/>
<path d="M-1.4 -8.2 Q-1 -6.2 -1.2 -4.6" stroke-width="0.22"/>
<path d="M-15.8 -0.4 Q-15.4 2 -15.6 4" stroke-width="0.26"/>
<path d="M-13.2 -1.4 Q-12.7 1.4 -13 3.8" stroke-width="0.32"/><path d="M-12.4 -0.4 Q-12.1 0.8 -12.2 1.8" stroke-width="0.2"/>
<path d="M-10.2 -2.2 Q-9.8 0.2 -10 2.2" stroke-width="0.26"/>
<path d="M-7 -2.8 Q-6.5 0 -6.8 2.4" stroke-width="0.3"/>
<path d="M-3.8 -3 Q-3.4 -0.6 -3.6 1.4" stroke-width="0.26"/><path d="M-3 -2 Q-2.7 -0.8 -2.8 0.2" stroke-width="0.18"/>
<path d="M-1 -2 Q-0.6 0 -0.8 1.6" stroke-width="0.22"/>
<path d="M-15.2 5.6 Q-14.8 8 -15 10" stroke-width="0.26"/>
<path d="M-12.6 4.6 Q-12.1 7.4 -12.4 9.8" stroke-width="0.32"/><path d="M-11.8 5.6 Q-11.5 6.8 -11.6 7.8" stroke-width="0.2"/>
<path d="M-9.6 3.8 Q-9.2 6.2 -9.4 8.2" stroke-width="0.26"/>
<path d="M-6.4 3.2 Q-5.9 6 -6.2 8.4" stroke-width="0.3"/>
<path d="M-3.2 3 Q-2.8 5.4 -3 7.4" stroke-width="0.26"/><path d="M-2.4 4 Q-2.1 5.2 -2.2 6.2" stroke-width="0.18"/>
<path d="M-0.6 4 Q-0.2 6 -0.4 7.6" stroke-width="0.22"/>
<path d="M-14.2 11.6 Q-13.8 14 -14 16" stroke-width="0.26"/>
<path d="M-11.6 10.6 Q-11.1 13.4 -11.4 15.8" stroke-width="0.32"/>
<path d="M-8.6 9.8 Q-8.2 12.2 -8.4 14.2" stroke-width="0.26"/><path d="M-7.8 10.8 Q-7.5 12 -7.6 13" stroke-width="0.18"/>
<path d="M-5.4 9.2 Q-4.9 12 -5.2 14.4" stroke-width="0.3"/>
<path d="M-2.4 9 Q-2 11.4 -2.2 13.4" stroke-width="0.26"/>
<path d="M-0.2 10 Q0.2 12 0 13.6" stroke-width="0.22"/>
<path d="M-12.6 17.2 Q-12.2 19.6 -12.4 21.4" stroke-width="0.28"/>
<path d="M-9.8 16.2 Q-9.3 19 -9.6 21.2" stroke-width="0.32"/><path d="M-9 17.2 Q-8.7 18.4 -8.8 19.4" stroke-width="0.2"/>
<path d="M-6.8 15.6 Q-6.4 18 -6.6 20" stroke-width="0.26"/>
<path d="M-3.6 15.2 Q-3.1 18 -3.4 20.2" stroke-width="0.3"/>
<path d="M-0.8 15.6 Q-0.4 17.6 -0.6 19.2" stroke-width="0.22"/>
</g>
<g stroke="@poilH" stroke-width="0.2" fill="none" opacity="0.55" stroke-linecap="round">
<path d="M-8.8 -23.8 Q-8.4 -21.8 -8.6 -19.8"/><path d="M-5.6 -24 Q-5.2 -22 -5.4 -20"/>
<path d="M-9 -11.4 Q-8.6 -9.4 -8.8 -7.4"/><path d="M-5.8 -12.2 Q-5.4 -10.2 -5.6 -8.2"/>
<path d="M-8.4 1 Q-8 3 -8.2 5"/><path d="M-5.2 0.4 Q-4.8 2.4 -5 4.4"/>
</g>
<path d="M4.6 -30.2 Q5.4 -33 7.8 -33.2 Q9.8 -33 10 -30.6 Q10.2 -27.8 9 -25.4 Q7.8 -23.6 6 -24.2 Q4.4 -25.2 4.4 -27.4 Z" fill="@os" stroke="@poilO" stroke-width="0.45"/>
<path d="M5.6 -31.4 Q6.2 -32.4 7.6 -32.6" fill="none" stroke="@osH" stroke-width="0.75" opacity="0.9"/>
<path d="M7.4 -30.2 Q7 -27.4 7.4 -25" fill="none" stroke="@osO" stroke-width="0.45" opacity="0.6"/>
<ellipse cx="7" cy="-28.2" rx="1.4" ry="2" fill="@osO" opacity="0.35" stroke="none" transform="rotate(-12 7 -28.2)"/>
<path d="M-1.4 24.4 Q1.4 26 2 30 Q2.4 34 1.4 38 L2.6 40.4 L0.8 40.6 L1.6 43.2 Q2.2 46 0.6 48 L2 49.6 L0 49.4 L0.4 47.4 Q-1 49 -2.6 47.8 L-2.2 45.4 Q-3.6 46.6 -4.6 45 L-4 42.6 Q-4.8 40.2 -4.4 37.4 Q-4 33.4 -3.4 29.4 Q-2.8 25.8 -1.4 24.4 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-1 25.8 Q0.8 27.4 1 30.8 Q1.2 34.8 0.4 38.8 Q-0.2 42.8 -0.4 46.4 L-1.8 46.2 Q-1.4 41.8 -1.2 37.8 Q-1 32.8 -1.6 29.2 Q-2 26.8 -1 25.8 Z" fill="@fourrureO" opacity="0.6" stroke="none"/>
<path d="M-2.6 26.4 Q-3.4 29.8 -3.2 33.8 Q-3 37.8 -3.6 41.8 L-4.2 44.2 L-3.4 44.4 Q-2.6 39.8 -2.4 34.8 Q-2.2 29.8 -1.6 26.6 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>
<g stroke="@poil" stroke-width="0.28" fill="none" opacity="0.75" stroke-linecap="round">
<path d="M-2.2 27.2 Q-1.6 30.2 -1.8 33.2"/><path d="M0 28.4 Q0.6 31.2 0.4 34"/><path d="M-3.6 30.4 Q-3.1 33.2 -3.2 35.8"/>
<path d="M-2 34.8 Q-1.4 37.8 -1.6 40.8"/><path d="M0.2 35.6 Q0.6 38.4 0.4 41.2"/><path d="M-3.8 37.2 Q-3.3 39.8 -3.4 42.4"/>
</g>
<path d="M-4.2 45.2 Q-2.6 44.2 -1.6 45.8 L-0.8 43.6 Q0.6 43.2 1 45.2 L1.8 43.4 Q3.2 43.6 3 45.6 Q2.8 47.8 1.2 49.4 Q-0.8 51.2 -2.8 50.2 Q-4.6 49 -4.6 46.8 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-3.6 46.4 Q-2 45.6 -1.4 47.2 Q-1.2 49.2 -2.4 49.8 Q-3.8 49.4 -4 47.8 Z" fill="@fourrureO" opacity="0.45" stroke="none"/>
<g stroke="@poilO" stroke-width="0.42" fill="none" stroke-linecap="round">
<path d="M-1.8 46 Q-2 48.2 -2.8 50"/><path d="M0 45.4 Q0 47.6 -0.6 49.6"/><path d="M1.8 45.2 Q2 47.2 1.2 49"/>
</g>
</g>`,
      profile: `<g stroke="@metalO" stroke-width="0.5" stroke-linejoin="round">
<path d="M-7.6 -29.4 Q1 -32.6 8.4 -28.6 L9 -12 Q8.6 -4 7.4 3 L-6.4 3 Q-7.4 -4 -7.8 -12 Z" fill="url(#g_steelD)"/>
<path d="M-7.6 -29.4 Q1 -32.6 8.4 -28.6 L9 -12 Q8.6 -4 7.4 3 L-6.4 3 Q-7.4 -4 -7.8 -12 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M2 -29 Q2.8 -14 2.2 -1.4" stroke="@metalO" stroke-width="0.8" opacity="0.95"/>
<path d="M2.9 -29.2 Q3.7 -14 3.1 -1.4" stroke="@metalH" stroke-width="0.32" opacity="0.45"/>
<path d="M5.4 -28.2 Q6.4 -14 5.6 -1.2" stroke="@metalO" stroke-width="0.8" opacity="0.95"/>
<path d="M6.3 -28 Q7.3 -14 6.5 -1.2" stroke="@metalH" stroke-width="0.32" opacity="0.45"/>
<path d="M-1 -29.4 Q-0.6 -14 -1 -1.6" stroke="@metalO" stroke-width="0.8" opacity="0.95"/>
<path d="M-0.1 -29.5 Q0.3 -14 -0.1 -1.6" stroke="@metalH" stroke-width="0.32" opacity="0.45"/>
</g>
<path d="M-7.5 -29 Q1 -32.2 8.3 -28.2 Q1 -30.4 -7.5 -29 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<path d="M-7.6 -8.4 Q1 -4.8 8.8 -8.4 L8.7 -3.6 Q1 0 -7.5 -3.6 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-7.6 -8.4 Q1 -4.8 8.8 -8.4 L8.7 -3.6 Q1 0 -7.5 -3.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-7.6 -8.4 Q1 -4.8 8.8 -8.4" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.9"/>
<path d="M-7.5 -3.7 Q1 -0.1 8.7 -3.7 L8.5 1.2 Q1 4.8 -7.3 1.2 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-7.5 -3.7 Q1 -0.1 8.7 -3.7 L8.5 1.2 Q1 4.8 -7.3 1.2 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-7.5 -3.5 Q1 0.1 8.7 -3.5" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.8"/>
<g fill="@metalO" stroke="none"><circle cx="6.4" cy="-6" r="0.5"/><circle cx="-5.2" cy="-6" r="0.5"/></g>
<path d="M-7 6.6 Q1 9.8 8.2 6.6 L8 12 Q1 15.4 -6.8 12 Z" fill="url(#g_steelD)"/>
<path d="M-7 6.6 Q1 9.8 8.2 6.6 L8 12 Q1 15.4 -6.8 12 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-7 6.8 Q1 10 8.2 6.8" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-6.8 11.4 Q1 14.8 8 11.4 L7.8 16.4 Q1 19.8 -6.6 16.4 Z" fill="url(#g_steelD)"/>
<path d="M-6.8 11.4 Q1 14.8 8 11.4 L7.8 16.4 Q1 19.8 -6.6 16.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-6.8 11.6 Q1 15 8 11.6" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-6.4 15.8 Q1 19.2 7.6 15.8 L7.2 20.6 Q1 24 -6 20.6 Z" fill="url(#g_steelD)"/>
<path d="M-6.4 15.8 Q1 19.2 7.6 15.8 L7.2 20.6 Q1 24 -6 20.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-6.4 16 Q1 19.4 7.6 16" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-5.8 20 Q1 23.4 7 20 L6.4 24.6 Q1 27.8 -5.2 24.6 Z" fill="url(#g_steelD)"/>
<path d="M-5.8 20 Q1 23.4 7 20 L6.4 24.6 Q1 27.8 -5.2 24.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-5.8 20.2 Q1 23.6 7 20.2" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.95"/>
<path d="M-5.2 24.2 Q1 27.4 6.4 24.2 L5.6 27.6 Q1 30.6 -4.4 27.6 Z" fill="url(#g_steelD)"/>
<path d="M-5.2 24.2 Q1 27.4 6.4 24.2 L5.6 27.6 Q1 30.6 -4.4 27.6 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-5.2 24.4 Q1 27.6 6.4 24.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M3.6 10.6 L5.6 10.4 L5.8 17.2 L3.8 17.4 Z" fill="@cuir" stroke="none"/>
<path d="M3.6 10.6 L4.3 10.55 L4.5 17.35 L3.8 17.4 Z" fill="@cuirH" opacity="0.5" stroke="none"/>
<rect x="3.6" y="16.6" width="2.2" height="1.7" rx="0.3" fill="@or" stroke="@orO" stroke-width="0.35"/>
<path d="M-6.9 2.6 Q1 5.4 8.5 2.6 L8.4 8 Q1 10.8 -6.8 8 Z" fill="@or"/>
<path d="M-6.9 2.6 Q1 5.4 8.5 2.6 L8.45 4.1 Q1 6.9 -6.85 4.1 Z" fill="@orH" opacity="0.85" stroke="none"/>
<path d="M-6.82 6.7 Q1 9.5 8.42 6.7 L8.4 8 Q1 10.8 -6.8 8 Z" fill="@orO" opacity="0.85" stroke="none"/>
<g stroke="@orO" stroke-width="0.45" fill="none" opacity="0.9">
<path d="M-3.4 3.9 L-3.45 9.3"/><path d="M0.2 5 L0.2 10.4"/><path d="M4 4.7 L4.05 10.1"/>
</g>
<g fill="@cuirO" stroke="none"><circle cx="-5.2" cy="5.6" r="0.5"/><circle cx="-1.6" cy="6.6" r="0.5"/><circle cx="2.2" cy="6.8" r="0.5"/><circle cx="6.2" cy="5.8" r="0.5"/></g>
<path d="M-6.4 4.8 L1.6 8.6 L0.8 10.8 L-6.8 6.8 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4"/>
<path d="M-6.4 4.8 L1.6 8.6 L1.3 9.4 L-6.6 5.6 Z" fill="@vet2H" opacity="0.5" stroke="none"/>
<ellipse cx="1.4" cy="9.6" rx="1.4" ry="1.1" fill="none" stroke="@or" stroke-width="0.6"/>
<path d="M0.6 10.2 L2.4 11 L1 17.2 L-0.8 16.4 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4"/>
<path d="M-8.6 -33.2 Q-4.6 -34.6 -1.2 -32.8 L0.4 -31 L-1.6 -30.6 L0 -28.6 L-2 -28.4 L-1 -26.2 L-3 -26.4 L-2.4 -24 Q-4.6 -22.6 -6.4 -24.4 Q-8.4 -26.6 -9.2 -29.4 Q-9.6 -31.8 -8.6 -33.2 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.45"/>
<path d="M-8 -32.6 Q-9 -30.4 -8.2 -27.6 Q-7.4 -25.2 -5.6 -23.8 L-3.8 -24.2 Q-6 -26.2 -6.8 -29 Q-7.4 -31.4 -6.6 -33.2 Z" fill="@fourrureH" opacity="0.7" stroke="none"/>
<g stroke="@poil" fill="none" opacity="0.85" stroke-linecap="round">
<path d="M-7 -32.6 Q-6 -30.2 -5 -28" stroke-width="0.3"/><path d="M-6 -32 Q-5.4 -30.8 -5 -29.8" stroke-width="0.2"/>
<path d="M-4 -33.4 Q-3.2 -31 -2.4 -28.8" stroke-width="0.32"/><path d="M-3 -32.8 Q-2.4 -31.6 -2 -30.6" stroke-width="0.2"/>
<path d="M-1.2 -32.6 Q-0.6 -30.6 -0.2 -29" stroke-width="0.26"/>
<path d="M-8.4 -30.6 Q-7.4 -28.2 -6.2 -26" stroke-width="0.28"/>
</g>
<path d="M-7.4 -29.6 Q-9.4 -28 -9.6 -24 Q-9.8 -18 -9.4 -12 L-10.6 -9.2 L-8.8 -9 L-9.8 -5 L-8 -4.8 L-8.8 -0.4 L-7 -0.2 L-7.6 4.4 L-5.8 4.6 L-6.2 9 L-4.4 9.2 L-4.6 13.6 L-2.8 13.8 L-2.6 18 L-0.8 18.2 L-0.4 22 Q-2 25 -4.6 23 L-5.8 19.6 Q-7.8 21.2 -9 18.2 L-9.4 14.6 Q-11.6 15.6 -12 12.2 L-11.8 8.4 Q-14.2 8.8 -13.8 5.4 L-13.2 1.6 Q-15.6 1.6 -14.8 -1.8 L-13.8 -5.8 Q-16 -6.6 -14.8 -10 Q-15.6 -16 -15 -22 Q-14.4 -27.4 -11.8 -30 Q-9.4 -32 -7.4 -29.6 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.45"/>
<path d="M-8 -28.6 Q-10.4 -26.6 -10.6 -22 Q-10.8 -14 -10 -6 Q-9.2 2 -8 10 Q-7.2 15 -6 18.8 L-4.2 18 Q-5.4 12 -6.4 4 Q-7.4 -4 -7.6 -12 Q-7.8 -22 -6.6 -27.4 Q-7.2 -29.4 -8 -28.6 Z" fill="@fourrureO" opacity="0.45" stroke="none"/>
<path d="M-12.4 -27.4 Q-13.8 -24 -13.8 -18 Q-13.8 -8 -12.8 2 Q-12 10 -10.6 17 L-12.2 17.4 Q-13.8 10 -14.6 2 Q-15.4 -8 -14.6 -18 Q-14 -25 -12.4 -27.4 Z" fill="@fourrureH" opacity="0.7" stroke="none"/>
<g stroke="@poil" stroke-width="0.3" fill="none" opacity="0.8" stroke-linecap="round">
<path d="M-13.6 -25.6 Q-13 -22.6 -13.4 -19.6"/><path d="M-10.4 -26.4 Q-9.8 -23.4 -10.2 -20.4"/>
<path d="M-14 -18 Q-13.4 -15 -13.8 -12"/><path d="M-10.8 -18.6 Q-10.2 -15.6 -10.6 -12.6"/>
<path d="M-14.2 -10.4 Q-13.6 -7.4 -14 -4.4"/><path d="M-11 -11 Q-10.4 -8 -10.8 -5"/>
<path d="M-14 -2.8 Q-13.4 0.2 -13.8 3.2"/><path d="M-10.8 -3.4 Q-10.2 -0.4 -10.6 2.6"/>
<path d="M-13.4 4.8 Q-12.8 7.8 -13.2 10.8"/><path d="M-10.2 4.2 Q-9.6 7.2 -10 10.2"/>
<path d="M-12.4 12.4 Q-11.8 15.4 -12.2 18"/><path d="M-9.2 11.8 Q-8.6 14.8 -9 17.4"/><path d="M-6 12.6 Q-5.4 15.6 -5.8 18.2"/>
</g>
<path d="M-4.6 20.6 Q-2 22.2 -1.4 26 Q-1 30 -2 34 L-0.8 36.4 L-2.6 36.6 L-1.8 39.2 Q-1.2 42.4 -2.8 44.6 L-1.4 46.2 L-3.4 46 L-3 44 Q-4.4 45.6 -6 44.4 L-5.6 42 Q-7 43.2 -8 41.6 L-7.4 39.2 Q-8.2 36.8 -7.8 34 Q-7.4 30 -6.8 26 Q-6.2 22.4 -4.6 20.6 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-4.2 22 Q-2.4 23.6 -2.2 27 Q-2 31 -2.8 35 Q-3.4 39 -3.6 42.6 L-5 42.4 Q-4.6 38 -4.4 34 Q-4.2 29 -4.8 25.4 Q-5.2 23 -4.2 22 Z" fill="@fourrureO" opacity="0.6" stroke="none"/>
<path d="M-6 22.6 Q-6.8 26 -6.6 30 Q-6.4 34 -7 38 L-7.6 40.4 L-6.8 40.6 Q-6 36 -5.8 31 Q-5.6 26 -5 22.8 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>
<g stroke="@poil" stroke-width="0.28" fill="none" opacity="0.75" stroke-linecap="round">
<path d="M-5.4 23.4 Q-4.8 26.4 -5 29.4"/><path d="M-3.2 24.6 Q-2.6 27.4 -2.8 30.2"/><path d="M-6.8 26.6 Q-6.3 29.4 -6.4 32"/>
<path d="M-5.2 31 Q-4.6 34 -4.8 37"/><path d="M-3 31.8 Q-2.6 34.6 -2.8 37.4"/><path d="M-7 33.4 Q-6.5 36 -6.6 38.6"/>
</g>
<path d="M-7.4 41.4 Q-5.8 40.4 -4.8 42 L-4 39.8 Q-2.6 39.4 -2.2 41.4 L-1.4 39.6 Q0 39.8 -0.2 41.8 Q-0.4 44 -2 45.6 Q-4 47.4 -6 46.4 Q-7.8 45.2 -7.8 43 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-6.8 42.6 Q-5.2 41.8 -4.6 43.4 Q-4.4 45.4 -5.6 46 Q-7 45.6 -7.2 44 Z" fill="@fourrureO" opacity="0.45" stroke="none"/>
<g stroke="@poilO" stroke-width="0.42" fill="none" stroke-linecap="round">
<path d="M-5 42.2 Q-5.2 44.4 -6 46.2"/><path d="M-3.2 41.6 Q-3.2 43.8 -3.8 45.8"/><path d="M-1.4 41.4 Q-1.2 43.4 -2 45.2"/>
</g>
</g>`,
    },
    jambes: {
      front: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M-2.6 0.6 Q-3.1 7 -2.6 12.6" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
<path d="M-1.9 0.5 Q-2.4 7 -1.9 12.6" stroke="@metalH" stroke-width="0.3" opacity="0.45"/>
<path d="M0.1 0.5 Q0.1 7 0.1 12.7" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
<path d="M0.8 0.5 Q0.8 7 0.8 12.7" stroke="@metalH" stroke-width="0.3" opacity="0.45"/>
<path d="M2.8 0.6 Q3.3 7 2.8 12.6" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
</g>
<path d="M-4.75 0.4 L4.75 0.4 Q4.9 1.8 4.85 2.6 L-4.85 2.6 Q-4.9 1.8 -4.75 0.4 Z" fill="@metalH" opacity="0.5" stroke="none"/>
<path d="M-4.6 12.6 Q0 10.4 4.6 12.6 Q5.6 16.4 4.3 20.2 Q0 22.2 -4.3 20.2 Q-5.6 16.4 -4.6 12.6 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-4.6 12.6 Q0 10.4 4.6 12.6 Q5.6 16.4 4.3 20.2 Q0 22.2 -4.3 20.2 Q-5.6 16.4 -4.6 12.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.2 13.4 Q0 11.2 4.2 13.4 Q4.6 14.6 4.5 15.4 Q0 13.4 -4.5 15.4 Q-4.6 14.6 -4.2 13.4 Z" fill="@metalH" opacity="0.85" stroke="none"/>
<path d="M-3.4 18.6 Q0 20.4 3.4 18.6" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.8"/>
<g fill="@metalO" stroke="none"><circle cx="-3.4" cy="16.4" r="0.42"/><circle cx="3.4" cy="16.4" r="0.42"/></g>
<path d="M-4.2 19.8 Q0 21.8 4.2 19.8 L4.5 26 Q0 27.6 -4.5 26 Z" fill="url(#g_steelD)"/>
<path d="M-4.2 19.8 Q0 21.8 4.2 19.8 L4.5 26 Q0 27.6 -4.5 26 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.2 20 Q0 22 4.2 20" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="url(#g_steelD)"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.5 26 Q0 27.6 4.5 26" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="url(#g_steelD)"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.7 32 Q0 33.6 4.7 32" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-1.7 21 Q-2.1 30 -1.7 37.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.5"/>
<path d="M2.4 21 Q2.8 30 2.4 37.6" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.55"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.65"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.75 37.6 Q0 39.6 4.75 37.6 Q4.8 38.4 4.85 38.8 Q0 40.8 -4.85 38.8 Q-4.8 38.4 -4.75 37.6 Z" fill="@metalH" opacity="0.75" stroke="none"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L5 44 Q0 46 -5 44 Z" fill="url(#g_steelD)"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L5 44 Q0 46 -5 44 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-5 40.8 Q0 42.8 5 40.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-5 43.6 Q0 45.6 5 43.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="url(#g_steelD)"/>
<path d="M-5 43.6 Q0 45.6 5 43.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-5 43.8 Q0 45.8 5 43.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="url(#g_steelD)"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.9 46.6 Q0 48.6 4.9 46.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
</g>`,
      back: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M-2.4 0.6 Q-2.9 7 -2.4 12.6" stroke="@metalO" stroke-width="0.6" opacity="0.9"/>
<path d="M2.4 0.6 Q2.9 7 2.4 12.6" stroke="@metalO" stroke-width="0.6" opacity="0.9"/>
</g>
<path d="M-4.75 0.4 L4.75 0.4 Q4.9 1.6 4.85 2.4 L-4.85 2.4 Q-4.9 1.6 -4.75 0.4 Z" fill="@metalH" opacity="0.42" stroke="none"/>
<path d="M-4.4 12.6 Q0 11 4.4 12.6 Q5.2 16.2 4.1 19.8 Q0 21.2 -4.1 19.8 Q-5.2 16.2 -4.4 12.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-4.4 12.6 Q0 11 4.4 12.6 Q5.2 16.2 4.1 19.8 Q0 21.2 -4.1 19.8 Q-5.2 16.2 -4.4 12.6 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-4.1 13.2 Q0 11.6 4.1 13.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.75"/>
<path d="M-3.6 15.6 Q0 14.6 3.6 15.6" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-3.8 17.8 Q0 16.8 3.8 17.8" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-4.1 19.4 Q0 20.8 4.1 19.4 L4.5 26 Q0 27.6 -4.5 26 Z" fill="url(#g_steelD)"/>
<path d="M-4.1 19.4 Q0 20.8 4.1 19.4 L4.5 26 Q0 27.6 -4.5 26 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.1 19.6 Q0 21 4.1 19.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="url(#g_steelD)"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.5 26 Q0 27.6 4.5 26" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="url(#g_steelD)"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.7 32 Q0 33.6 4.7 32" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-2.8 21 Q-3.2 30 -2.8 37.6" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.4"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.65"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.8 37.6 Q0 39.6 4.8 37.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.7"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="url(#g_steelD)"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-5 40.8 Q0 42.8 5 40.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="url(#g_steelD)"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-4.9 46.6 Q0 48.6 4.9 46.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.7"/>
</g>`,
      profile: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-3.6 0 Q-4.4 7 -3.7 13.2 L3.7 13.2 Q4.6 7 3.8 0 Z" fill="url(#g_steelD)"/>
<path d="M-3.6 0 Q-4.4 7 -3.7 13.2 L3.7 13.2 Q4.6 7 3.8 0 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M0.2 0.6 Q-0.2 7 0.2 12.6" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
<path d="M0.9 0.6 Q0.5 7 0.9 12.6" stroke="@metalH" stroke-width="0.3" opacity="0.45"/>
<path d="M2.4 0.6 Q2.1 7 2.4 12.6" stroke="@metalO" stroke-width="0.6" opacity="0.9"/>
</g>
<path d="M-3.55 0.4 L3.75 0.4 Q3.9 1.8 3.85 2.6 L-3.75 2.6 Q-3.9 1.8 -3.55 0.4 Z" fill="@metalH" opacity="0.5" stroke="none"/>
<path d="M-3.3 12.6 Q1 10.4 4.7 13 Q5.9 16.6 4.7 20.2 Q0.8 22.2 -2.9 20.2 Q-4.1 16.6 -3.3 12.6 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-3.3 12.6 Q1 10.4 4.7 13 Q5.9 16.6 4.7 20.2 Q0.8 22.2 -2.9 20.2 Q-4.1 16.6 -3.3 12.6 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-2.9 13.4 Q1 11.2 4.3 13.6 Q4.7 14.8 4.7 15.6 Q1 13.2 -3.2 15.4 Q-3.3 14.6 -2.9 13.4 Z" fill="@metalH" opacity="0.85" stroke="none"/>
<path d="M-2.2 18.8 Q0.8 20.4 4 18.8" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.8"/>
<circle cx="3.8" cy="16.4" r="0.42" fill="@metalO" stroke="none"/>
<path d="M-3 19.8 Q0.8 21.8 4.4 19.8 L4.5 26 Q0.6 27.6 -3.3 26 Z" fill="url(#g_steelD)"/>
<path d="M-3 19.8 Q0.8 21.8 4.4 19.8 L4.5 26 Q0.6 27.6 -3.3 26 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3 20 Q0.8 22 4.4 20" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-3.3 25.8 Q0.6 27.4 4.5 25.8 L4.6 32 Q0.6 33.6 -3.5 32 Z" fill="url(#g_steelD)"/>
<path d="M-3.3 25.8 Q0.6 27.4 4.5 25.8 L4.6 32 Q0.6 33.6 -3.5 32 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.3 26 Q0.6 27.6 4.5 26" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-3.5 31.8 Q0.6 33.4 4.6 31.8 L4.6 38 L-3.6 38 Z" fill="url(#g_steelD)"/>
<path d="M-3.5 31.8 Q0.6 33.4 4.6 31.8 L4.6 38 L-3.6 38 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.5 32 Q0.6 33.6 4.6 32" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M0.4 21 Q0 30 0.4 37.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.5"/>
<path d="M3 21 Q3.4 30 3 37.6" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.55"/>
<path d="M-3.6 37.2 Q0.6 39.2 4.6 37.2 L4.8 41 Q0.6 43 -3.8 41 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.65"/>
<path d="M-3.6 37.2 Q0.6 39.2 4.6 37.2 L4.8 41 Q0.6 43 -3.8 41 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.55 37.6 Q0.6 39.6 4.55 37.6 Q4.6 38.4 4.65 38.8 Q0.6 40.8 -3.65 38.8 Q-3.6 38.4 -3.55 37.6 Z" fill="@metalH" opacity="0.75" stroke="none"/>
<path d="M-3.8 40.6 Q0.6 42.6 4.8 40.6 L4.9 44 Q0.6 46 -4 44 Z" fill="url(#g_steelD)"/>
<path d="M-3.8 40.6 Q0.6 42.6 4.8 40.6 L4.9 44 Q0.6 46 -4 44 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.8 40.8 Q0.6 42.8 4.8 40.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-4 43.6 Q0.6 45.6 4.9 43.6 L4.9 46.8 Q0.6 48.8 -4 46.8 Z" fill="url(#g_steelD)"/>
<path d="M-4 43.6 Q0.6 45.6 4.9 43.6 L4.9 46.8 Q0.6 48.8 -4 46.8 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4 43.8 Q0.6 45.8 4.9 43.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-4 46.4 Q0.6 48.4 4.9 46.4 L4.6 49.4 Q0.6 51.2 -3.8 49.4 Z" fill="url(#g_steelD)"/>
<path d="M-4 46.4 Q0.6 48.4 4.9 46.4 L4.6 49.4 Q0.6 51.2 -3.8 49.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4 46.6 Q0.6 48.6 4.9 46.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-3.9 44.2 L-6.4 45.4 L-3.7 46.8" fill="none" stroke="@orO" stroke-width="0.9"/>
<path d="M-3.9 43.9 L-6.4 45.1 L-3.7 46.5" fill="none" stroke="@or" stroke-width="0.7"/>
<path d="M-6.5 43.2 L-5.9 44.6 L-4.4 44.9 L-5.6 45.7 L-5.3 47.2 L-6.5 46.3 L-7.7 47.2 L-7.4 45.7 L-8.6 44.9 L-7.1 44.6 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<circle cx="-6.5" cy="45.4" r="0.5" fill="@orH" stroke="none" opacity="0.8"/>
</g>`,
    },
    bras: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-5.2 -3.4 Q0 -8 5.2 -3.4 Q6.2 0.6 4.8 4 Q0 6.2 -4.8 4 Q-6.2 0.6 -5.2 -3.4 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.75"/>
<path d="M-5.2 -3.4 Q0 -8 5.2 -3.4 Q6.2 0.6 4.8 4 Q0 6.2 -4.8 4 Q-6.2 0.6 -5.2 -3.4 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-4.9 -3 Q0 -7.4 4.9 -3 Q5.2 -1.8 5.15 -1 Q0 -5.6 -5.15 -1 Q-5.2 -1.8 -4.9 -3 Z" fill="@metalH" opacity="0.9" stroke="none"/>
<g fill="none" stroke="@metalO" stroke-width="0.4" opacity="0.7" stroke-linecap="round">
<path d="M-3.4 -4.2 Q-3.8 -0.6 -3.4 3.4"/><path d="M-1.2 -5.6 Q-1.4 -1 -1.2 4.4"/><path d="M1.2 -5.6 Q1.4 -1 1.2 4.4"/><path d="M3.4 -4.2 Q3.8 -0.6 3.4 3.4"/>
</g>
<path d="M-4.8 4 Q0 6.2 4.8 4 L4.4 8.2 Q0 10.4 -4.4 8.2 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 4 Q0 6.2 4.8 4 L4.4 8.2 Q0 10.4 -4.4 8.2 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.8 4.2 Q0 6.4 4.8 4.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.9"/>
<path d="M-4.4 8.2 Q0 10.4 4.4 8.2 L4.1 12 Q0 14 -4.1 12 Z" fill="url(#g_steelD)"/>
<path d="M-4.4 8.2 Q0 10.4 4.4 8.2 L4.1 12 Q0 14 -4.1 12 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.4 8.4 Q0 10.6 4.4 8.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.9"/>
<path d="M-4.1 12 Q0 14 4.1 12 L3.8 15.8 Q0 17.6 -3.8 15.8 Z" fill="url(#g_steelD)"/>
<path d="M-4.1 12 Q0 14 4.1 12 L3.8 15.8 Q0 17.6 -3.8 15.8 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.1 12.2 Q0 14.2 4.1 12.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.9"/>
<g fill="@metalO" stroke="none"><circle cx="-3.5" cy="6.4" r="0.4"/><circle cx="3.5" cy="6.4" r="0.4"/><circle cx="-3.3" cy="10.4" r="0.4"/><circle cx="3.3" cy="10.4" r="0.4"/></g>
<path d="M-3.9 15.4 Q0 13.6 3.9 15.4 Q4.7 18 3.7 20.2 Q0 21.8 -3.7 20.2 Q-4.7 18 -3.9 15.4 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-3.9 15.4 Q0 13.6 3.9 15.4 Q4.7 18 3.7 20.2 Q0 21.8 -3.7 20.2 Q-4.7 18 -3.9 15.4 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-3.6 16 Q0 14.4 3.6 16 Q3.9 16.9 3.85 17.5 Q0 15.8 -3.85 17.5 Q-3.9 16.9 -3.6 16 Z" fill="@metalH" opacity="0.85" stroke="none"/>
<path d="M-3.7 20 Q0 21.6 3.7 20 L3.9 24.2 Q0 26 -3.9 24.2 Z" fill="url(#g_steelD)"/>
<path d="M-3.7 20 Q0 21.6 3.7 20 L3.9 24.2 Q0 26 -3.9 24.2 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.7 20.2 Q0 21.8 3.7 20.2" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.85"/>
<path d="M-3.9 24 Q0 25.8 3.9 24 L4 28.2 Q0 30 -4 28.2 Z" fill="url(#g_steelD)"/>
<path d="M-3.9 24 Q0 25.8 3.9 24 L4 28.2 Q0 30 -4 28.2 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.9 24.2 Q0 26 3.9 24.2" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.85"/>
<path d="M-1.6 21 Q-1.9 25 -1.6 29" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.45"/>
<path d="M-4 28 Q0 29.8 4 28 L4.2 31.2 Q0 33 -4.2 31.2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>
<path d="M-4 28 Q0 29.8 4 28 L4.2 31.2 Q0 33 -4.2 31.2 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-4 28.2 Q0 30 4 28.2" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.8"/>
</g>`,
  },
  // Calque d'ÉPAULE ASYMÉTRIQUE (canal RigOverlay/plane, composeRig.tsx) — la masse de
  // fourrure (ex-partie du torse, x 0.8..14.3, masquée au-delà de x≈11 par le bras epauleD
  // z=8 DEVANT le torse z=5) est déplacée ICI : attachée à epauleD, plan 'avant' (échappe
  // au z de son os hôte, cf. dorsal.ts) → elle déborde enfin le contour au lieu d'être
  // rognée par la manche. Repère LOCAL de epauleD (translate ~ pivot torse→epauleD = (14,-26)
  // inversé) : ajustement de géométrie MINIMAL, pas un nouveau dessin (l'artiste repassera).
  overlays: [
    {
      bone: 'epauleD',
      view: 'front',
      plane: 'avant',
      svg: `<g transform="translate(-14,26)">
<path d="M1.6 -32.6 Q7 -35 11.6 -32.4 Q13.4 -30.6 13.2 -26.6 L14.3 -24.4 L12.8 -23.6 L13.9 -21 L12.4 -20.2 L13.5 -17.6 L12 -16.8 L13.1 -14.2 L11.6 -13.4 L12.7 -10.8 L11.2 -10 L12.3 -7.4 L10.8 -6.6 L11.9 -4 L10.4 -3.2 L11.5 -0.6 L10 0.2 L11.1 2.8 L9.6 3.6 L10.7 6.2 L9.2 7 L10.3 9.6 L8.8 10.4 L9.5 13 L8 13.8 L8.7 16.4 L7.2 17.2 Q5.4 20.8 3.6 18.4 L2.4 21.2 L0.8 18 L-0.4 20.4 L-1 17 Q-1.6 10 -0.8 2 Q-0.2 -8 0.2 -18 Q0.4 -26 1.6 -32.6 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.42"/>
<path d="M7.6 -33.4 Q11 -33.2 12.4 -30.6 Q13.2 -28 13 -24 Q12.6 -14 11.6 -4 Q10.6 6 9 16 L6.4 16.8 Q8 6 8.8 -4 Q9.6 -14 9.4 -23 Q9.2 -30 7.6 -33.4 Z" fill="@fourrureO" opacity="0.42" stroke="none"/>
<path d="M8.6 -33.4 Q11.6 -32.6 12.7 -29.6 Q13.1 -26 12.9 -22 Q12.4 -12 11.4 -2 Q10.4 8 8.8 16.4 L7.6 16.6 Q9.2 7 10 -3 Q10.8 -13 10.6 -22 Q10.4 -29 8.6 -33.4 Z" fill="@fourrureO" opacity="0.4" stroke="none"/>
<path d="M2.6 -30.6 Q5 -32.2 6.8 -30.4 Q7.8 -27 7.4 -20 Q6.8 -10 5.6 0 Q4.6 8 3.4 16.4 L1.6 16.6 Q2.6 8 3.2 0 Q4 -10 3.8 -20 Q3.6 -27 2.6 -30.6 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>
<g stroke="@poil" fill="none" opacity="0.85" stroke-linecap="round">
<path d="M3 -31.6 Q4.2 -29 4.6 -26.4" stroke-width="0.3"/><path d="M4 -31 Q4.8 -29.8 5 -28.8" stroke-width="0.2"/>
<path d="M6 -32.6 Q7 -30 7.4 -27.4" stroke-width="0.32"/><path d="M7.2 -32 Q7.8 -30.8 8 -29.8" stroke-width="0.2"/>
<path d="M9.4 -32 Q10.6 -29.4 11 -26.8" stroke-width="0.3"/><path d="M10.6 -31 Q11.2 -29.8 11.4 -28.8" stroke-width="0.18"/>
<path d="M12 -29.6 Q12.8 -27 12.9 -24.6" stroke-width="0.26"/>
<path d="M0.8 -26 Q1.6 -23.4 1.8 -20.6" stroke-width="0.3"/><path d="M1.8 -25.2 Q2.4 -24 2.6 -23" stroke-width="0.18"/>
<path d="M3.6 -25.6 Q4.6 -22.8 4.8 -20" stroke-width="0.32"/>
<path d="M6.6 -25 Q7.6 -22.4 7.8 -19.8" stroke-width="0.28"/><path d="M7.6 -24.2 Q8.2 -23 8.4 -22" stroke-width="0.2"/>
<path d="M9.8 -24.4 Q10.8 -21.8 11 -19.4" stroke-width="0.3"/>
<path d="M12.4 -22.6 Q13 -20.4 13 -18.4" stroke-width="0.24"/>
<path d="M0.6 -19 Q1.4 -16.4 1.6 -13.6" stroke-width="0.3"/>
<path d="M3.4 -18.6 Q4.4 -15.8 4.6 -13" stroke-width="0.32"/><path d="M4.4 -17.8 Q5 -16.6 5.2 -15.6" stroke-width="0.18"/>
<path d="M6.4 -18 Q7.4 -15.4 7.6 -12.8" stroke-width="0.28"/>
<path d="M9.6 -17.4 Q10.6 -14.8 10.8 -12.4" stroke-width="0.3"/><path d="M10.6 -16.6 Q11.2 -15.4 11.4 -14.4" stroke-width="0.2"/>
<path d="M12 -16 Q12.6 -13.8 12.6 -11.8" stroke-width="0.24"/>
<path d="M0.4 -12 Q1.2 -9.4 1.4 -6.6" stroke-width="0.3"/><path d="M1.4 -11.2 Q2 -10 2.2 -9" stroke-width="0.18"/>
<path d="M3.2 -11.6 Q4.2 -8.8 4.4 -6" stroke-width="0.32"/>
<path d="M6.2 -11 Q7.2 -8.4 7.4 -5.8" stroke-width="0.28"/><path d="M7.2 -10.2 Q7.8 -9 8 -8" stroke-width="0.2"/>
<path d="M9.4 -10.4 Q10.4 -7.8 10.6 -5.4" stroke-width="0.3"/>
<path d="M11.6 -9 Q12.2 -6.8 12.2 -4.8" stroke-width="0.24"/>
<path d="M0.2 -5 Q1 -2.4 1.2 0.4" stroke-width="0.3"/>
<path d="M3 -4.6 Q4 -1.8 4.2 1" stroke-width="0.32"/><path d="M4 -3.8 Q4.6 -2.6 4.8 -1.6" stroke-width="0.18"/>
<path d="M6 -4 Q7 -1.4 7.2 1.2" stroke-width="0.28"/>
<path d="M9.2 -3.4 Q10.2 -0.8 10.4 1.6" stroke-width="0.3"/><path d="M10.2 -2.6 Q10.8 -1.4 11 -0.4" stroke-width="0.2"/>
<path d="M11.2 -2 Q11.8 0.2 11.8 2.2" stroke-width="0.24"/>
<path d="M0.2 2 Q1 4.6 1.2 7.4" stroke-width="0.3"/><path d="M1.2 2.8 Q1.8 4 2 5" stroke-width="0.18"/>
<path d="M2.8 2.4 Q3.8 5.2 4 8" stroke-width="0.32"/>
<path d="M5.8 3 Q6.8 5.6 7 8.2" stroke-width="0.28"/><path d="M6.8 3.8 Q7.4 5 7.6 6" stroke-width="0.2"/>
<path d="M8.8 3.6 Q9.8 6.2 10 8.6" stroke-width="0.3"/>
<path d="M10.8 5 Q11.4 7.2 11.4 9.2" stroke-width="0.24"/>
<path d="M0.4 9 Q1.2 11.6 1.4 14.4" stroke-width="0.3"/>
<path d="M2.8 9.4 Q3.8 12.2 4 15" stroke-width="0.32"/><path d="M3.8 10.2 Q4.4 11.4 4.6 12.4" stroke-width="0.18"/>
<path d="M5.6 10 Q6.6 12.6 6.8 15.2" stroke-width="0.28"/>
<path d="M8.4 10.6 Q9.2 13.2 9.4 15.6" stroke-width="0.3"/>
<path d="M0.8 15.4 Q1.6 17.4 1.8 19.2" stroke-width="0.26"/>
<path d="M3.6 15.8 Q4.4 17.8 4.6 19.4" stroke-width="0.28"/><path d="M4.4 16.4 Q5 17.4 5.2 18.2" stroke-width="0.18"/>
<path d="M6.4 15.2 Q7.2 17.2 7.4 18.6" stroke-width="0.26"/>
</g>
<g stroke="@poilH" stroke-width="0.2" fill="none" opacity="0.55" stroke-linecap="round">
<path d="M2 -28.4 Q2.8 -26 3 -23.6"/><path d="M5 -27.6 Q5.8 -25.2 6 -22.8"/>
<path d="M1.8 -14.4 Q2.6 -12 2.8 -9.6"/><path d="M4.8 -13.8 Q5.6 -11.4 5.8 -9"/>
<path d="M1.6 -0.4 Q2.4 2 2.6 4.4"/><path d="M4.6 0.2 Q5.4 2.6 5.6 5"/>
</g>
</g>`,
    },
  ],
};
