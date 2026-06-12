/**
 * Tableau des Événements « Entre deux aventures » (LDB `22 - Événements.md`, d100) — manuscrit
 * VERBATIM (résumés fidèles, même statut que criticals.ts/oups.ts). `fx` ne porte QUE les effets
 * mécaniques sans ambiguïté du texte ; tout le reste est narratif (journalisé, rien d'inventé).
 *
 * Classes canon visées par certains événements : Citadins, Courtisans, Guerriers, Itinérants,
 * Lettrés, Riverains, Roublards, Ruraux. (Le texte dit « Voleurs » pour les Roublards.)
 */
export interface InterludeEventFx {
  /** % appliqué à la bourse du groupe AVANT les Activités (le Prévôt −30, Kleptomane −50). */
  moneyPct?: number;
  /** % appliqué aux gains de l'Activité Revenus (Fausse monnaie −20, Profits +50…). */
  revenuePct?: number;
  /** Le `revenuePct` ne vise que ces Classes (absent = tout le monde). */
  revenueClasses?: string[];
  /** L'Activité Revenus est interdite à ces Classes (`['*']` = à tous — Complications monstrueuses). */
  revenueBlockedClasses?: string[];
  /** % appliqué aux dépôts bancaires existants (Fausse monnaie −20). */
  bankPct?: number;
  /** +N au maximum de Points de Chance pour la prochaine aventure (Un homme averti). */
  fortuneMaxDelta?: number;
  /** Le héros perd une Activité (Festivités, Vieilles dettes, Suspect). */
  loseActivity?: boolean;
  /** Les PLANQUES du héros sont dévalisées avant toute Opération bancaire (Mise à sac). */
  stashRaided?: boolean;
  /** Les dépôts INVESTIS vérifient immédiatement la faillite (Émeutes). */
  bankCrashCheck?: boolean;
}

export interface InterludeEvent {
  min: number;
  max: number;
  label: string;
  /** Résumé fidèle du texte (verbatim abrégé) — affiché au joueur et journalisé. */
  text: string;
  fx?: InterludeEventFx;
}

export const INTERLUDE_EVENTS: InterludeEvent[] = [
  { min: 1, max: 3, label: 'Allié inculpé', text: 'Un de vos alliés est impliqué dans un horrible crime — le disculper demanderait des Activités (Savoir (Loi) Accessible +20, ou trois Activités du groupe) ; sinon il sera pendu. Arbitrage table.' },
  { min: 4, max: 6, label: 'Enchères ésotériques', text: 'Les biens d’un voisin décédé sont aux enchères, dont un vieux livre d’origine inconnue (10 CO) — il donnerait +20 aux Recherches de Savoir des Lettrés. Arbitrage table.' },
  { min: 7, max: 10, label: 'Trahison !', text: 'Un ami, un parent ou un allié se retourne contre vous ; les répercussions influenceront votre prochaine aventure.' },
  { min: 11, max: 14, label: 'Imprévu', text: 'La porte de l’écurie est restée ouverte : votre monture s’est enfuie (Test de Dressage (Cheval) Accessible +20 pour la rattraper — arbitrage table). Sans monture : une ampoule douloureuse au pied.' },
  { min: 15, max: 18, label: 'Eh ! Tu as renversé ma pinte !', text: 'Un petit différend a tourné au conflit : quelqu’un ne laissera pas passer une occasion de se venger.' },
  { min: 19, max: 21, label: 'Répression du crime', text: 'La Garde veut une augmentation : tous les « coups » sont en suspens. Les Voleurs ne peuvent rien gagner avec Revenus.', fx: { revenueBlockedClasses: ['Roublards'] } },
  { min: 22, max: 25, label: 'Le Prévôt arrive', text: 'Le collecteur d’impôts sillonne la communauté : tous les Personnages perdent 30 % de leur argent avant de pouvoir le dépenser.', fx: { moneyPct: -30 } },
  { min: 26, max: 29, label: 'Fausse monnaie', text: 'Un trafic de pièces contrefaites sévit : un cinquième de toutes les pièces est concerné — Opérations bancaires et Revenus réduits de 20 %.', fx: { revenuePct: -20, bankPct: -20 } },
  { min: 30, max: 33, label: 'Profits abondants', text: 'Les affaires du commerce fluvial sont excellentes : les Riverains gagnent 50 % de plus avec Revenus.', fx: { revenuePct: 50, revenueClasses: ['Riverains'] } },
  { min: 34, max: 36, label: 'Un homme averti en vaut deux', text: 'Un présage cryptique vous a été donné : votre maximum de Points de Chance augmente de 1 pour la prochaine aventure.', fx: { fortuneMaxDelta: 1 } },
  { min: 37, max: 40, label: 'Festivités', text: 'Une fête est annoncée — mariage, récolte généreuse ou exécution publique ! Vous êtes entraîné dans l’événement et perdez une Activité.', fx: { loseActivity: true } },
  { min: 41, max: 44, label: 'Météo défavorable', text: 'Conditions détestables : pour la prochaine aventure, les Tests sociaux subissent −10 et le prix des aliments augmente de 20 %. Arbitrage table.' },
  { min: 45, max: 48, label: 'Météo radieuse', text: 'Les magnifiques conditions vous inspirent : vous pouvez ajouter une nouvelle Ambition.' },
  { min: 49, max: 52, label: 'Mauvaise récolte', text: 'La nourriture devient extrêmement rare : les Ruraux ne peuvent pas entreprendre Revenus, et le prix des aliments double pour la prochaine aventure.', fx: { revenueBlockedClasses: ['Ruraux'] } },
  { min: 53, max: 56, label: 'Maladie pernicieuse', text: 'Le Flux Sanglant sévit en ville : Test d’Endurance Facile (+40) ou contracter la maladie. Arbitrage table (maladie hors registre V1).' },
  { min: 57, max: 60, label: 'Complications monstrueuses', text: 'Un monstre sème la panique : Revenus ne fournit aucun fonds tant que la bête rôde (la régler = une rencontre à jouer).', fx: { revenueBlockedClasses: ['*'] } },
  { min: 61, max: 63, label: 'L’étreinte de Morr', text: 'Un parent, ami ou allié meurt — causes naturelles, accident… ou le début de quelque chose de plus sinistre.' },
  { min: 64, max: 65, label: 'Nouvelle lune', text: 'Les nuits sont particulièrement noires : les Voleurs qui entreprennent Revenus gagnent +20 %.', fx: { revenuePct: 20, revenueClasses: ['Roublards'] } },
  { min: 66, max: 67, label: 'Vieilles dettes', text: 'Une Faveur Majeure ou Importante vous est réclamée : ses tenants feront partie de votre prochaine aventure, et vous perdez une Activité en préparation.', fx: { loseActivity: true } },
  { min: 68, max: 69, label: 'Opportunité de passage', text: 'Soldats, riches marchands ou nobles traversent la région : les Citadins et Ruraux gagnent +50 % avec Revenus.', fx: { revenuePct: 50, revenueClasses: ['Citadins', 'Ruraux'] } },
  { min: 70, max: 71, label: 'Paix et sérénité', text: 'Un sommeil paisible après un bon fromage : vous serez en pleine forme au début de votre prochaine aventure.' },
  { min: 72, max: 73, label: 'Colporteur', text: 'Un colporteur friand de ragots arrive : pour 3 sc, +10 à toutes vos Activités Dernières nouvelles. Arbitrage table (Activité V2).' },
  { min: 74, max: 76, label: 'Animal domestique malade', text: 'Un de vos animaux tombe malade : Test de Soin aux animaux Intermédiaire (+0) ou la créature meurt. Sans animal : un nuage menaçant vous tourmente. Arbitrage table.' },
  { min: 77, max: 79, label: 'Mise à sac', text: 'Avant toute Opération bancaire, votre planque est dévalisée : tout l’argent planqué a disparu (et votre équipement le plus précieux si le butin valait moins d’1 CO).', fx: { stashRaided: true } },
  { min: 80, max: 82, label: 'Émeutes', text: 'Le peuple est furieux contre les puissants : les Courtisans ne peuvent pas entreprendre Revenus, et les banques vérifient immédiatement la faillite. Semer la dissension gagne +10.', fx: { revenueBlockedClasses: ['Courtisans'], bankCrashCheck: true } },
  { min: 83, max: 85, label: 'Kleptomane', text: 'Votre sacoche est entaillée ! Vous perdez la moitié de l’argent avec lequel vous avez terminé votre dernière aventure.', fx: { moneyPct: -50 } },
  { min: 86, max: 88, label: 'Soupçonné d’hérésie', text: 'Un Répurgateur vous soupçonne : Test de Charme Très Difficile (−30) pour le convaincre, sinon vous gagnez une némésis. Arbitrage table.' },
  { min: 89, max: 91, label: 'Suspect', text: 'Votre soudaine richesse attire les soupçons : tous les Personnages renoncent à une Activité pour faire profil bas ; les Voleurs ne peuvent pas utiliser Revenus.', fx: { loseActivity: true, revenueBlockedClasses: ['Roublards'] } },
  { min: 92, max: 94, label: 'Rien à signaler', text: 'Peu de choses se passent : vous commencez la prochaine aventure avec un appétit pour le risque inspiré par l’ennui.' },
  { min: 95, max: 97, label: 'Considération inattendue', text: 'Quelqu’un que vous avez aidé vous rend la pareille — d’un objet de grande qualité à une bourse d’argent. Tout ce qui brille n’est pas or… Arbitrage table.' },
  { min: 98, max: 100, label: 'Mercenaires particuliers', text: 'Des mercenaires peu communs cherchent du travail : Entraînement et Apprentissage coûtent −20 %, et l’Entraînement au combat gagne +20. Arbitrage table.' },
];

/** Entrée du tableau pour un jet d100 (01-00). */
export function interludeEventFor(roll: number): InterludeEvent {
  const r = Math.max(1, Math.min(100, roll));
  return INTERLUDE_EVENTS.find((e) => r >= e.min && r <= e.max) ?? INTERLUDE_EVENTS[INTERLUDE_EVENTS.length - 1];
}
