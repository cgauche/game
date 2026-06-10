/**
 * Descriptions FR canoniques des qualités d'objet (Atouts/Défauts), pour l'affichage (fiche, marchand,
 * infobulles). RAW : Atouts d'arme **LDB 62 « Les armes »**, Défauts d'arme + Taille + Recharge
 * **LDB 63 « Armures »**, qualités d'artisanat **LDB 60 « Fabrication »**, magie **ADE II**. Aucune
 * invention : chaque texte résume fidèlement le passage cité. Le `type` (Atout/Défaut) vient du registre.
 */
import { QUALITIES } from './registry';
import { parseQuality } from './normalize';

/** Description courte par clé canonique (résumé fidèle du passage LDB cité en commentaire). */
export const QUALITY_DESC: Record<string, string> = {
  // Atouts d'arme — LDB 62
  'À Enroulement': 'Difficile à parer : −1 DR aux Tests de Corps à corps opposés à cette arme.', // 62 l.259
  'À Explosion': "Tous les Personnages à Indice mètres du point d'impact subissent DR + Dégâts d'arme et les États infligés.", // 62 l.287
  'À Poudre noire': "Détonation : la cible visée doit réussir un Test de Calme (+20) ou gagner l'État Brisé, même si le tir la rate.", // 62 l.262
  'Assommante': "Touche à la Tête → Test opposé Force/Résistance ; gagné, la cible gagne l'État Sonné.", // 62 l.268
  'Défensive': '+1 DR à vos Tests de Corps à corps quand vous opposez une attaque (parer).', // 62 l.273
  'Dévastatrice': 'Dégâts = le plus haut entre le DR et le dé des unités (annulée par Inoffensive).', // 62 l.279
  'Empaleuse': "Coup Critique sur tout multiple de 10 ou double réussi ; à distance, la munition reste fichée (retrait : Guérison/Chirurgie).", // 62 l.282
  'Incassable': 'Quasiment jamais brisée, corrodée ni émoussée.', // 62 l.310
  'Magique': "Arme considérée comme Magique : ses attaques blessent l'Éthéré.", // 85 p.339 ; posée par un enchantement (41/42/47)
  'Percutante': "Sur une touche, ajoute le dé des unités du jet d'attaque aux Dégâts (annulée par Inoffensive).", // 62 l.313
  'Perforante': "Ignore les PA non métalliques et le premier point de toute autre armure.", // 62 l.316
  'Pistolet': 'Peut être utilisée pour attaquer en Combat rapproché.', // 62 l.298
  'Pointue': '+1 DR à tout Test réussi quand vous attaquez avec cette arme.', // 62 l.301
  'Précise': '+10 à tout Test quand vous utilisez cette arme.', // 62 l.304
  'À Répétition': "Chargeur de Indice munitions, auto-rechargées entre les coups ; vide, l'arme se recharge entièrement (règles normales).", // 62 l.264
  'Immobilisante': "Toute touche réussie inflige l'État Empêtré (Force de l'attaquant) à l'adversaire.", // 62 l.289
  'Perturbante': "Au lieu de causer des Dégâts, une attaque réussie peut repousser l'adversaire d'1 mètre par DR.", // 62 l.275
  'Piège-lame': "Critique en défense contre une lame : peut la piéger (Test opposé de Force +DR) — désarme, voire brise (sauf Incassable).", // 62 l.292
  'Protectrice': "Opposer une attaque avec cette arme confère Indice PA partout ; Indice ≥ 2 → peut aussi opposer les projectiles en vue.", // 62 l.306
  'Rapide': "Peut attaquer hors de l'ordre d'Initiative ; −10 aux parades adverses sans arme Rapide.", // 62 l.318
  // Défauts d'arme + Taille + Recharge — LDB 63
  'Taille': "Lourde lame : sur une touche, Endommage de 1 une armure ou un Bouclier frappé, en plus de blesser.", // 63 l.7
  'Dangereuse': 'Tout Test raté incluant un 9 (dizaines ou unités) entraîne une Maladresse.', // 63 l.13
  'Épuisante': 'Percutante et Dévastatrice ne fonctionnent que lors d’un Tour de Charge.', // 63 l.16
  'Imprécise': "−1 DR quand vous attaquez avec l'arme (prime sur Précise).", // 63 l.19
  'Inoffensive': "Peu efficace contre l'armure : tous les PA sont doublés, et pas de minimum de 1 Blessure sur une touche.", // 63 l.22
  'Lente': 'Frappe toujours en dernier dans le Round ; les adversaires gagnent +1 DR pour se défendre (prime sur Rapide).', // 63 l.25
  'Recharge': "Longue à recharger : une fois déchargée, exige un Test étendu de Projectiles cumulant Indice DR.", // 63 l.28
  // Qualités d'armure intrinsèques — LDB 63
  'Flexible': "Peut être portée sous une couche d'armure non Flexible : vous gagnez les bénéfices des deux.", // 63 Qualités des armures
  'Impénétrable': 'Les Blessures Critiques causées par un nombre impair pour vous toucher sont ignorées.', // 63 Qualités des armures
  'Partielle': "Couverture incomplète : un jet de toucher pair, ou un Coup Critique, ignore les PA de cette pièce.", // 63 Qualités des armures
  'Points faibles': "Une arme Empaleuse qui obtient un Critique ignore les PA de cette armure.", // 63 Qualités des armures
  // Atouts/Défauts d'artisanat — LDB 60
  'Léger': "Fabriqué pour le transport : −1 Point d'Encombrement.", // 60 l.55
  'Pratique': "+1 DR à un Test raté avec l'objet ; pour une armure, pénalités de port réduites d'un niveau.", // 60 l.58
  'Raffiné': 'Travail soigné : signe de statut social (cumulable).', // 60 l.61
  'Solide': 'Robuste : encaisse Indice Points de Dégâts avant pénalités, et Sauvegarde 9+ (−1/cran) contre la casse.', // 60 l.64
  'Bâclé': "Fait à la hâte : casse sur tout Test raté obtenant un double (armure : casse sur un Critique à sa localisation).", // 60 l.81
  'Laid': 'Sans esthétique : jusqu’à −10 aux Tests de Sociabilité associés.', // 60 l.84
  'Peu Fiable': "−1 DR à un Test raté avec l'objet ; pour une armure, pénalités de port doublées.", // 60 l.87
  'Volumineux': '+1 Encombrement (1 même porté pour vêtements/armures) ; pénalités de Fatigue doublées.', // 60 l.90
  // Magie — ADE II
  'De plaies atroces': 'Magique : les Dégâts prennent le plus haut du DR ou du dé des unités (comme Dévastatrice).', // ADE2 « Un peu de magie » l.228
};

export interface QualityInfo {
  /** Clé canonique du registre (ex. 'Solide'). */
  key: string;
  /** Atout (bénéfique) / Défaut (handicap) — du registre ; undefined si non classé. */
  type?: 'Atout' | 'Défaut';
  /** Indice numérique éventuel (« Solide 3 » → 3, « Recharge 1 » → 1). */
  indice?: number;
  /** Libellé d'affichage (clé + Indice, ex. « Solide 3 »). */
  label: string;
  /** Description courte canonique (LDB), si connue. */
  desc?: string;
}

/** Décrit une chaîne de qualité (« Recharge 1 », « précise ») pour l'affichage : clé, type, Indice, desc.
 *  null si la qualité est inconnue du registre. */
export function describeQuality(raw: string): QualityInfo | null {
  const p = parseQuality(raw);
  if (!p) return null;
  const def = QUALITIES[p.key];
  return {
    key: p.key,
    type: def?.type,
    indice: p.indice,
    label: p.indice != null ? `${p.key} ${p.indice}` : p.key,
    desc: QUALITY_DESC[p.key],
  };
}
