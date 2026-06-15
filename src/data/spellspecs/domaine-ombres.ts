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
    summon: { ref: 'Cheval', count: 1, addTraits: ['Magique', 'Peur 1'], allyOfCaster: true },
    durationRounds: null, // « Jusqu'au prochain lever de soleil »
    curated: true,
    source: "LDB 48 — Domaine des Ombres « Destrier d'Ombre »",
  },
  {
    label: 'Illusion',
    // « Vous masquez la ZdE d'une image illusoire… trompe quiconque ne possède pas Seconde vue. » —
    //   illusion visuelle (perception/tromperie) : arbitré.
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Illusion »',
  },
  {
    label: 'Jumeau maléfique',
    // « Vous adoptez l'apparence d'une autre créature humanoïde familière. » — déguisement
    //   illusoire : arbitré.
    durationRounds: null, // « (Bonus d'Intelligence) minutes »
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Jumeau maléfique »',
  },
  {
    label: "Linceul d'Invisibilité",
    // « La cible devient invisible et ne peut pas être perçue par les sens ordinaires… le Sort prend
    //   fin si elle attire l'attention (bruits forts, attaque). » — invisibilité (perception) : arbitré.
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
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Miasme mystifiant »',
  },
  {
    label: 'Perte de mémoire',
    // « Tout souvenir de vous disparaît pour la durée… au terme, Test d'Intelligence (+20) ou la
    //   perte devient permanente. » — manipulation mnésique : arbitré.
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine des Ombres « Perte de mémoire »',
  },
  {
    label: "Portail d'Ombre",
    // « Vous disparaissez et réapparaissez à une distance pouvant aller jusqu'à votre Force Mentale
    //   (en mètres). Tous les ennemis Engagés au moment de votre disparition ou réapparition gagnent
    //   l'État Surpris. » — téléportation du lanceur (mécanique) ; le Surpris aux Engagés reste journalisé.
    teleportMeters: { charOf: 'FM' },
    durationRounds: null, // Instantané
    curated: true,
    source: "LDB 48 — Domaine des Ombres « Portail d'Ombre »",
  },
];
