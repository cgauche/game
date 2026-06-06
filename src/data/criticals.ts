import type { HitLocation, Difficulty } from '../engine/types';
import type { TraumaKind, TraumaSeverity } from '../engine/trauma';

/**
 * Tables de Blessures critiques — Livre de base, « Traumatisme » (Source/Warhammer v4 - Livre de
 * base version corrigée/18 - Traumatisme.md), transcrites verbatim. `00` est encodé `max: 100`.
 *
 * Champs COMBAT : `wounds` (PB perdus, ignore BE+PA, l.62), `conditions` (États immédiats),
 * `resist` (« réussir un Test de Résistance ou gagner l'État X », auto-résolu par le moteur),
 * `lethal` (résultat « Mort »). `note` = texte canon des effets LONG TERME (amputation/fracture/
 * déchirure/pénalités permanentes), journalisé mais NON simulé (→ Jalon 5 méta/soins). Les valeurs
 * « 1d10 États » du canon sont encodées en valeur fixe représentative (indiqué en note).
 */
export interface CritEntry {
  min: number;
  max: number;
  name: string;
  wounds: number;
  lethal?: boolean;
  conditions?: { name: string; value: number }[];
  resist?: { difficulty: Difficulty; onFail: { name: string; value: number }[] };
  note: string;
  /** Traumatismes posés (LDB 18) — la localisation vient de la table. Transcrit des `note` verbatim. */
  traumas?: { kind: TraumaKind; severity: TraumaSeverity }[];
}
export type CritTable = CritEntry[];

const DECH_MIN = { kind: 'dechirure' as const, severity: 'mineur' as const };
const DECH_MAJ = { kind: 'dechirure' as const, severity: 'majeur' as const };
const FRAC_MIN = { kind: 'fracture' as const, severity: 'mineur' as const };
const FRAC_MAJ = { kind: 'fracture' as const, severity: 'majeur' as const };

const H = (value = 1) => ({ name: 'Hémorragique', value });
const SO = (value = 1) => ({ name: 'Sonné', value });
const AV = (value = 1) => ({ name: 'Aveuglé', value });
const AS = (value = 1) => ({ name: 'Assourdi', value });
const AT = (value = 1) => ({ name: 'À Terre', value });
const INC = (value = 1) => ({ name: 'Inconscient', value });
const EX = (value = 1) => ({ name: 'Exténué', value });

/** Tête (l.66-116). */
const TETE: CritTable = [
  { min: 1, max: 10, name: 'Blessure spectaculaire', wounds: 1, conditions: [H()], note: 'Entaille front→joue. Cicatrice : DR +1 à certains Tests sociaux une fois guérie.' },
  { min: 11, max: 20, name: 'Coupure mineure', wounds: 1, conditions: [H()], note: 'Le coup entaille la joue, le sang dégouline.' },
  { min: 21, max: 25, name: "Coup à l'œil", wounds: 1, conditions: [AV()], note: "Coup à l'orbite de l'œil." },
  { min: 26, max: 30, name: "Frappe à l'oreille", wounds: 1, conditions: [AS()], note: 'Bourdonnement ignoble.' },
  { min: 31, max: 35, name: 'Coup percutant', wounds: 2, conditions: [SO()], note: 'Points blancs et flashs de lumière.' },
  { min: 36, max: 40, name: 'Œil au beurre noir', wounds: 2, conditions: [AV(2)], note: 'Coup massif aux yeux, très douloureux.' },
  { min: 41, max: 45, name: 'Oreille tranchée', wounds: 2, conditions: [AS(2), H()], note: "Coup violent qui entaille l'oreille." },
  { min: 46, max: 50, name: 'En plein front', wounds: 2, conditions: [H(2), AV()], note: "L'Aveuglé persiste tant que tous les Hémorragique ne sont pas éliminés." },
  { min: 51, max: 55, name: 'Mâchoire fracturée', wounds: 3, conditions: [SO(2)], traumas: [FRAC_MIN], note: 'Traumatisme Fracture (Mineure).' },
  { min: 56, max: 60, name: "Blessure majeure à l'œil", wounds: 3, conditions: [H(), AV()], note: 'Aveuglé soigné uniquement par Aide Médicale.' },
  { min: 61, max: 65, name: "Blessure majeure à l'oreille", wounds: 3, note: 'Perte auditive permanente (-20 audition). Seconde fois = surdité totale (magie seule).' },
  { min: 66, max: 70, name: 'Nez cassé', wounds: 3, conditions: [H(2)], resist: { difficulty: 'intermediaire', onFail: [SO()] }, note: 'Une fois guéri, DR +1/-1 social selon contexte jusqu’à Chirurgie.' },
  { min: 71, max: 75, name: 'Mâchoire cassée', wounds: 4, conditions: [SO(3)], resist: { difficulty: 'intermediaire', onFail: [INC()] }, traumas: [FRAC_MAJ], note: 'Traumatisme Fracture (Majeure).' },
  { min: 76, max: 80, name: 'Commotion cérébrale', wounds: 4, conditions: [AS(), H(2), SO(5), EX()], note: 'Canon : 1d10 Sonné (encodé 5) ; Exténué dure 1d10 jours. Autre critique tête en Exténué : Résistance Accessible ou Inconscient.' },
  { min: 81, max: 85, name: 'Bouche explosée', wounds: 4, conditions: [H(2)], note: 'Perdez 1d10 dents — Amputation (Facile).' },
  { min: 86, max: 90, name: 'Oreille mutilée', wounds: 4, conditions: [AS(3), H(2)], note: "Perte de l'oreille — Amputation (Accessible)." },
  { min: 91, max: 93, name: 'Œil crevé', wounds: 5, conditions: [AV(3), H(2), SO()], note: "Perte de l'œil — Amputation (Complexe)." },
  { min: 94, max: 96, name: 'Coup défigurant', wounds: 5, conditions: [H(3), AV(3), SO(2)], note: "Perte d'un œil et du nez — Amputation (Difficile)." },
  { min: 97, max: 99, name: 'Mâchoire mutilée', wounds: 5, conditions: [H(4), SO(3)], resist: { difficulty: 'tresDifficile', onFail: [INC()] }, traumas: [FRAC_MAJ], note: 'Fracture (Majeure), perte de la langue et 1d10 dents — Amputation (Difficile).' },
  { min: 100, max: 100, name: 'Décapitation', wounds: 0, lethal: true, note: 'Votre tête est tranchée. Mort sur le coup.' },
];

/** Bras (l.118-187) — bras gauche = bras droit. */
const BRAS: CritTable = [
  { min: 1, max: 10, name: 'Choc au bras', wounds: 1, note: 'Lâchez ce que vous teniez.' },
  { min: 11, max: 20, name: 'Coupure mineure', wounds: 1, conditions: [H()], note: "Saignement abondant à l'avant-bras." },
  { min: 21, max: 25, name: 'Torsion', wounds: 1, traumas: [DECH_MIN], note: 'Traumatisme Déchirure musculaire (Mineur).' },
  { min: 26, max: 30, name: 'Choc violent au bras', wounds: 2, note: 'Lâchez ; main inutilisable 1d10-(BE) Rounds (min 1).' },
  { min: 31, max: 35, name: 'Déchirure musculaire', wounds: 2, conditions: [H()], traumas: [DECH_MIN], note: 'Traumatisme Déchirure musculaire (Mineur).' },
  { min: 36, max: 40, name: 'Main ensanglantée', wounds: 2, conditions: [H()], note: 'Tant que Hémorragique : Test de Dextérité Accessible avant toute action tenant un objet de cette main.' },
  { min: 41, max: 45, name: 'Clef de bras', wounds: 2, note: 'Lâchez ; bras inutilisable 1d10 Rounds.' },
  { min: 46, max: 50, name: 'Blessure béante', wounds: 3, conditions: [H(2)], note: 'Jusqu’à Chirurgie, tout nouveau Dégât au bras → +1 Hémorragique.' },
  { min: 51, max: 55, name: 'Cassure nette', wounds: 3, resist: { difficulty: 'complexe', onFail: [SO()] }, traumas: [FRAC_MIN], note: 'Lâchez ; Traumatisme Fracture (Mineure).' },
  { min: 56, max: 60, name: 'Ligament rompu', wounds: 3, traumas: [DECH_MAJ], note: 'Lâchez ; Traumatisme Déchirure musculaire (Majeur).' },
  { min: 61, max: 65, name: 'Coupure profonde', wounds: 3, conditions: [H(2), SO()], resist: { difficulty: 'difficile', onFail: [INC()] }, traumas: [DECH_MIN], note: 'Déchirure musculaire (Mineur).' },
  { min: 66, max: 70, name: 'Artère endommagée', wounds: 4, conditions: [H(4)], note: 'Jusqu’à Chirurgie, tout Dégât à cette Localisation → +2 Hémorragique.' },
  { min: 71, max: 75, name: 'Coude fracassé', wounds: 4, traumas: [FRAC_MAJ], note: 'Lâchez ; Traumatisme Fracture (Majeure).' },
  { min: 76, max: 80, name: 'Épaule luxée', wounds: 4, conditions: [SO()], resist: { difficulty: 'difficile', onFail: [SO(), AT()] }, note: 'Lâchez ; bras perdu (inutilisable) ; Sonné jusqu’à Aide Médicale ; Guérison étendue DR 6 pour récupérer le bras ; -10 aux Tests du bras 1d10 jours.' },
  { min: 81, max: 85, name: 'Doigt sectionné', wounds: 4, conditions: [H()], note: 'Amputation (Accessible).' },
  { min: 86, max: 90, name: 'Main ouverte', wounds: 5, conditions: [H(2), SO()], note: 'Perdez 1 doigt — Amputation (Complexe) ; 1 doigt de plus par Round sans Aide Médicale.' },
  { min: 91, max: 93, name: 'Biceps déchiqueté', wounds: 5, conditions: [H(2), SO()], traumas: [DECH_MAJ], note: 'Lâchez ; Traumatisme Déchirure musculaire (Majeur).' },
  { min: 94, max: 96, name: 'Main mutilée', wounds: 5, conditions: [H(2)], resist: { difficulty: 'difficile', onFail: [SO(), AT()] }, note: 'Perte de la main — Amputation (Difficile).' },
  { min: 97, max: 99, name: 'Tendons coupés', wounds: 5, conditions: [H(3), AT(), SO()], resist: { difficulty: 'difficile', onFail: [INC()] }, note: 'Bras inutilisable — Amputation (Très Difficile).' },
  { min: 100, max: 100, name: 'Démembrement brutal', wounds: 0, lethal: true, note: 'Votre bras est coupé, le coup termine dans la poitrine. Mort.' },
];

/** Corps (l.189-214). */
const CORPS: CritTable = [
  { min: 1, max: 10, name: "Rien qu'une égratignure !", wounds: 1, conditions: [H()], note: 'Égratignure.' },
  { min: 11, max: 20, name: 'Coup au ventre', wounds: 1, conditions: [SO()], resist: { difficulty: 'facile', onFail: [AT()] }, note: 'Vomissez et tombez À Terre sur un échec.' },
  { min: 21, max: 25, name: 'Coup bas', wounds: 1, resist: { difficulty: 'difficile', onFail: [SO(3)] }, note: 'Coup bas douloureux.' },
  { min: 26, max: 30, name: 'Torsion du dos', wounds: 1, traumas: [DECH_MIN], note: 'Traumatisme Déchirure musculaire (Mineur).' },
  { min: 31, max: 35, name: 'Souffle coupé', wounds: 2, conditions: [SO()], resist: { difficulty: 'accessible', onFail: [AT()] }, note: 'Mouvement réduit de moitié 1d10 Rounds.' },
  { min: 36, max: 40, name: 'Bleus aux côtes', wounds: 2, note: 'Tests d’Agilité -10 pendant 1d10 jours.' },
  { min: 41, max: 45, name: 'Clavicule tordue', wounds: 2, note: 'Lâchez (bras au hasard) ; bras inutilisable 1d10 Rounds.' },
  { min: 46, max: 50, name: 'Chairs déchirées', wounds: 2, conditions: [H(2)], note: 'Chairs déchirées.' },
  { min: 51, max: 55, name: 'Côtes fracturées', wounds: 3, conditions: [SO()], traumas: [FRAC_MIN], note: 'Traumatisme Fracture (Mineure).' },
  { min: 56, max: 60, name: 'Blessure béante', wounds: 3, conditions: [H(3)], note: 'Jusqu’à Chirurgie, tout Dégât à cette Localisation → +1 Hémorragique.' },
  { min: 61, max: 65, name: 'Entaille douloureuse', wounds: 3, conditions: [H(2), SO()], resist: { difficulty: 'difficile', onFail: [INC()] }, note: 'Hurle de douleur si DR < 4.' },
  { min: 66, max: 70, name: 'Dégâts artériels', wounds: 3, conditions: [H(4)], note: 'Jusqu’à Chirurgie, tout Dégât à cette Localisation → +2 Hémorragique.' },
  { min: 71, max: 75, name: 'Dos froissé', wounds: 4, traumas: [DECH_MAJ], note: 'Traumatisme Déchirure musculaire (Majeur).' },
  { min: 76, max: 80, name: 'Hanche fracturée', wounds: 4, conditions: [SO()], resist: { difficulty: 'intermediaire', onFail: [AT()] }, traumas: [FRAC_MIN], note: 'Traumatisme Fracture (Mineure).' },
  { min: 81, max: 85, name: 'Blessure majeure au torse', wounds: 4, conditions: [H(4)], note: 'Jusqu’à Chirurgie, tout Dégât à cette Localisation → +2 Hémorragique.' },
  { min: 86, max: 90, name: 'Blessure au ventre', wounds: 4, conditions: [H(2)], note: 'Contractez une Blessure Purulente (Maladie et Infection).' },
  { min: 91, max: 93, name: 'Cage thoracique perforée', wounds: 5, conditions: [SO()], traumas: [FRAC_MAJ], note: 'Sonné retiré uniquement par Aide Médicale ; Traumatisme Fracture (Majeure).' },
  { min: 94, max: 96, name: 'Clavicule cassée', wounds: 5, conditions: [INC()], traumas: [FRAC_MAJ], note: 'Inconscient jusqu’à Aide Médicale ; Traumatisme Fracture (Majeure).' },
  { min: 97, max: 99, name: 'Hémorragie interne', wounds: 5, conditions: [H()], note: 'Hémorragique retiré uniquement par Chirurgie ; Infection Sanguine (Maladie).' },
  { min: 100, max: 100, name: 'Éventré', wounds: 0, lethal: true, note: 'Vous êtes coupé en deux. Mort.' },
];

/** Jambe (l.223-285) — jambe gauche = jambe droite. */
const JAMBE: CritTable = [
  { min: 1, max: 10, name: 'Orteil contusionné', wounds: 1, note: 'Résistance Accessible ou -10 aux Tests d’Agilité jusqu’à la fin du prochain tour.' },
  { min: 11, max: 20, name: 'Cheville tordue', wounds: 1, note: 'Tests d’Agilité -10 pendant 1d10 Rounds.' },
  { min: 21, max: 25, name: 'Coupure mineure', wounds: 1, conditions: [H()], note: 'Coupure mineure.' },
  { min: 26, max: 30, name: "Perte d'équilibre", wounds: 1, resist: { difficulty: 'intermediaire', onFail: [AT()] }, note: "Perte d'équilibre." },
  { min: 31, max: 35, name: 'Coup à la cuisse', wounds: 2, conditions: [H()], resist: { difficulty: 'accessible', onFail: [AT()] }, note: 'Coup violent au haut de la cuisse.' },
  { min: 36, max: 40, name: 'Cheville foulée', wounds: 2, traumas: [DECH_MIN], note: 'Traumatisme Déchirure musculaire (Mineur).' },
  { min: 41, max: 45, name: 'Genou tordu', wounds: 2, note: 'Tests d’Agilité -20 pendant 1d10 Rounds.' },
  { min: 46, max: 50, name: "Coupure à l'orteil", wounds: 2, conditions: [H()], note: 'Après la rencontre, Résistance ou perte d’un orteil — Amputation (Accessible).' },
  { min: 51, max: 55, name: 'Mauvaise coupure', wounds: 3, conditions: [H(2)], resist: { difficulty: 'intermediaire', onFail: [AT()] }, note: 'Profonde blessure au tibia.' },
  { min: 56, max: 60, name: 'Genou méchamment tordu', wounds: 3, traumas: [DECH_MAJ], note: 'Traumatisme Déchirure musculaire (Majeur).' },
  { min: 61, max: 65, name: 'Jambe charcutée', wounds: 3, conditions: [H(2), AT()], resist: { difficulty: 'difficile', onFail: [SO()] }, traumas: [FRAC_MIN], note: 'Traumatisme Fracture (Mineure).' },
  { min: 66, max: 70, name: 'Cuisse lacérée', wounds: 3, conditions: [H(3)], resist: { difficulty: 'intermediaire', onFail: [AT()] }, note: 'Jusqu’à Chirurgie, tout Dégât à cette jambe → +1 Hémorragique.' },
  { min: 71, max: 75, name: 'Tendon rompu', wounds: 4, conditions: [AT(), SO()], resist: { difficulty: 'difficile', onFail: [INC()] }, traumas: [DECH_MAJ], note: 'Jambe inutilisable ; Traumatisme Déchirure musculaire (Majeur).' },
  { min: 76, max: 80, name: 'Entaille au tibia', wounds: 4, conditions: [SO(), AT()], traumas: [DECH_MAJ, FRAC_MAJ], note: 'Traumatismes Déchirure musculaire (Majeur) et Fracture (Majeure).' },
  { min: 81, max: 85, name: 'Genou cassé', wounds: 4, conditions: [SO(), AT()], traumas: [FRAC_MAJ], note: 'Traumatisme Fracture (Majeure).' },
  { min: 86, max: 90, name: 'Genou démis', wounds: 4, conditions: [AT()], resist: { difficulty: 'difficile', onFail: [SO()] }, note: 'Sonné retiré par Aide Médicale ; Guérison étendue DR 6 ; Mouvement moitié + -10 aux Tests de la jambe 1d10 jours.' },
  { min: 91, max: 93, name: 'Pied écrasé', wounds: 5, conditions: [H(2)], resist: { difficulty: 'accessible', onFail: [AT()] }, note: "Perte d'un orteil (+1 par DR sous 0) — Amputation (Accessible) ; perte du pied si pas de Chirurgie sous 1d10 jours." },
  { min: 94, max: 96, name: 'Pied sectionné', wounds: 5, conditions: [H(3), SO(2), AT()], note: 'Pied sectionné — Amputation (Difficile).' },
  { min: 97, max: 99, name: 'Tendon coupé', wounds: 5, conditions: [H(2), SO(2), AT()], note: 'Jambe inutilisable — Amputation (Très Difficile).' },
  { min: 100, max: 100, name: 'Bassin fracassé', wounds: 0, lethal: true, note: 'Le coup fracasse votre bassin. Mort instantanée (choc traumatique).' },
];

export const CRITICAL_TABLES: Record<HitLocation, CritTable> = {
  tete: TETE,
  brasG: BRAS,
  brasD: BRAS,
  corps: CORPS,
  jambeG: JAMBE,
  jambeD: JAMBE,
};
