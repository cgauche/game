/**
 * Domaine des Ombres (Ulgu) — LDB 48 p.252. Famille AMORCÉE par la démo de curation
 * Suffocation (Jalon 2.6 L10) : seuls les sorts curés figurent ici, le reste de la
 * famille passe au repli regex en attendant sa curation.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_OMBRES: SpellSpec[] = [
  {
    label: 'Ombres étrangleuses',
    // « Vous enroulez des tentacules d'ombre d'Ulgu autour du cou de vos ennemis. En supposant
    //   qu'ils aient besoin de respirer, ils gagnent +1 État Exténué, ne peuvent pas parler et
    //   sont soumis aux règles de la Suffocation (voir page 181). » — « ne peuvent pas parler »
    //   coupe l'incantation (cf. Forme bestiale : « vous ne pouvez pas parler, ce qui signifie
    //   que vous ne pouvez pas lancer de Sorts ») → castPenalty bloquant pour la durée (BFM Rounds).
    ops: [
      { op: 'condition', name: 'Exténué' },
      { op: 'suffocate' },
      { op: 'castPenalty', skill: 'all', blocked: true, rounds: { bonusOf: 'FM' } },
      { op: 'narrative', text: 'Ombres étrangleuses : la cible ne peut pas parler (interactions vocales — arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 p.252 « Ombres étrangleuses » (Suffocation : LDB 18 l.424-425)',
  },
  {
    label: "Destrier d'Ombre",
    // « Vous invoquez un destrier fantomatique (règles d'un cheval de monte ; hors lumière du soleil :
    //   Éthéré, Infravision, Magique, Insensible à la douleur, Furtif, Foulée, Peur 1, Protection
    //   (9+)). » — monture alliée invoquée (moteur d'invocation : Cheval + Magique/Peur 1) ; les
    //   Traits conditionnels « la nuit » et la chevauchée restent journalisés.
    ops: [{ op: 'narrative', text: 'Destrier d’Ombre : chevauchez-le (règles de monture) ; la nuit, il gagne aussi Éthéré/Infravision/Insensible à la douleur/Furtif/Foulée/Protection 9+ — arbitrage MJ.' }],
    summon: { ref: 'Cheval', count: 1, addTraits: ['Magique', 'Peur 1'], allyOfCaster: true },
    durationRounds: null, // « Jusqu'au prochain lever de soleil »
    curated: true,
    source: "LDB 48 — Domaine des Ombres « Destrier d'Ombre »",
  },
  {
    label: 'Illusion',
    // « Vous masquez la ZdE d'une image illusoire… trompe quiconque ne possède pas Seconde vue. » —
    //   illusion visuelle (perception/tromperie) : arbitré.
    ops: [{ op: 'narrative', text: 'Illusion : masque la ZdE d’une image illusoire ; seul le Talent Seconde vue (Test de Perception Complexe) permet de la remarquer — arbitrage MJ.' }],
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Illusion »',
  },
  {
    label: 'Jumeau maléfique',
    // « Vous adoptez l'apparence d'une autre créature humanoïde familière. » — déguisement
    //   illusoire : arbitré.
    ops: [{ op: 'narrative', text: 'Jumeau maléfique : vous prenez l’apparence d’un humanoïde familier (seul Seconde vue peut le percer) — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus d'Intelligence) minutes »
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Jumeau maléfique »',
  },
  {
    label: "Linceul d'Invisibilité",
    // « La cible devient invisible et ne peut pas être perçue par les sens ordinaires… le Sort prend
    //   fin si elle attire l'attention (bruits forts, attaque). » — invisibilité (perception) : arbitré.
    ops: [{ op: 'narrative', text: 'Linceul d’Invisibilité : la cible devient invisible aux sens ordinaires (Seconde vue la situe vaguement) ; le Sort cesse si elle fait du bruit ou attaque — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 48 — Domaine des Ombres « Linceul d'Invisibilité »",
  },
  {
    label: 'Miasme mystifiant',
    // « Tous ceux dans la brume (hors Magie des Arcanes (Ombre)) gagnent +1 Aveuglé, +1 Assourdi et
    //   +1 Exténué qui persistent pour la durée. Toute personne tentant de se déplacer doit réussir un
    //   Test de Perception (+0) ou gagner À Terre. Si dissipé, Test d'Initiative (+40) ou Sonné. » —
    //   les trois États sont mécaniques ; le Test de déplacement et la dissipation restent journalisés.
    ops: [
      { op: 'condition', name: 'Aveuglé', durationRounds: { bonusOf: 'FM' } },
      { op: 'condition', name: 'Assourdi', durationRounds: { bonusOf: 'FM' } },
      { op: 'condition', name: 'Exténué', durationRounds: { bonusOf: 'FM' } },
      { op: 'narrative', text: 'Miasme mystifiant : se déplacer dans la brume exige un Test de Perception (+0) sous peine d’À Terre ; à la dissipation, Test d’Initiative (+40) ou Sonné — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Miasme mystifiant »',
  },
  {
    label: 'Perte de mémoire',
    // « Tout souvenir de vous disparaît pour la durée… au terme, Test d'Intelligence (+20) ou la
    //   perte devient permanente. » — manipulation mnésique : arbitré.
    ops: [{ op: 'narrative', text: 'Perte de mémoire : la cible oublie tout de vous pour la durée ; au terme, un Test d’Intelligence (+20) raté rend l’oubli permanent — arbitrage MJ.' }],
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Perte de mémoire »',
  },
  {
    label: "Portail d'Ombre",
    // « Vous disparaissez et réapparaissez à une distance pouvant aller jusqu'à votre Force Mentale
    //   (en mètres). Tous les ennemis Engagés au moment de votre disparition ou réapparition gagnent
    //   l'État Surpris. » — téléportation du lanceur (mécanique) ; le Surpris aux Engagés reste journalisé.
    ops: [{ op: 'narrative', text: 'Portail d’Ombre : les ennemis Engagés avec vous au départ ou à l’arrivée gagnent l’État Surpris — arbitrage MJ.' }],
    teleportMeters: { charOf: 'FM' },
    durationRounds: null, // Instantané
    curated: true,
    source: "LDB 48 — Domaine des Ombres « Portail d'Ombre »",
  },
];
