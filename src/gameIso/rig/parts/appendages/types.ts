/**
 * Un APPENDICE monstrueux (cornes/queue) = un fichier `defs/<id>.ts`. Art SVG MULTI-VUES porté PAR
 * le def (comme têtes/tenues/nuées) : `front` + `profile` dédié (une corne de face plaquée sur une
 * tête tournée lit faux) ; `back` = `front` par défaut (cornes symétriques, lues juste de dos).
 * Référencé PAR ID depuis : têtes monstrueuses (`monster.cornes`), `features`/overlays de créature
 * (`appendageFeature`), `traitVisuals`. Résolu partout via `pickView`. Ajouter un type = déposer un
 * fichier + `npm run gen`.
 */
export interface AppendageDef {
  id: string;      // 'cornes-taureau', 'queue-rat'… — clé référencée par les consommateurs
  label: string;   // libellé FR (sélecteur d'éditeur)
  front: string;   // art SVG de face (repère local de l'os ; tokens @peau/@cheveux… autorisés)
  back?: string;   // art de dos (défaut = front)
  profile: string; // art de profil dédié (cornes balayées haut-arrière, queue traînant vers −x)
}
