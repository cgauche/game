import type { PartArt } from '../types';
import type { StoredPalette } from '../../palette';

/**
 * Slots habillables d'une tenue. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur).
 * Le slot `tete` recouvre le visage cosmétique (`heads/defs/*.ts` champ `visage`, PROFILE_FACE de
 * `cosmetic.ts`) ET les cheveux (champ `cheveux`) : x ≈ -9..9 (visage), -11..11 (cheveux) ;
 * y ≈ -2..17 (visage, front→menton), -12..-2 (cheveux, mèches→racine). Un casque/chapeau calé
 * uniquement sur -2..17 laisse la chevelure (jusqu'à y≈-12) à nu.
 */
export type TenueSet = Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', PartArt>>;

/**
 * Une tenue = un fichier `defs/<Nom>.ts`. SEULE source (plus d'AUTO/MANUAL/merge). `name` = la
 * CLÉ de lookup, résolue par id (slug) dans `tenueFor` :
 *   - nom d'une CLASSE WFRP (Guerriers, Lettrés, Roublards…) → archétype de classe, repli quand
 *     une carrière n'a pas de tenue dédiée. La taxonomie des classes (careers.json) discrimine
 *     seule « archétype de classe » vs « tenue spécifique » — aucun flag à porter ;
 *   - nom d'une CARRIÈRE / CRÉATURE / PNJ → tenue spécifique (prioritaire par id) ;
 *   - 'Nu' pour le corps de chair sans vêtement (torse/jambes en @peau, le token suit l'espèce).
 * Les slots portent une string (FRONT) ou les 3 vues `{front, back, profile}`. Ajouter un
 * humanoïde habillé = DÉPOSER ce fichier (+ un def de race/PNJ pointant `tenue: '<name>'`).
 *
 * `palette` : couleurs par défaut des `@tokens` de l'art (StoredPalette = hex exact) → rendu
 * sans perte + recoloriage cohérent. Résolue par `tenuePaletteFor` (tenue > classe).
 *
 * `bareFoot` : tenue qui ne chausse pas (corps 'Nu', squelette décharné, pagne du Sanguinaire…) —
 * pied nu griffu (CLAWFOOT), silhouettes dos/profil substituées restent en chair. SOURCE UNIQUE
 * du barefoot (plus de hardcode par id dans resolve).
 */
export type TenueDef = { name: string; set: TenueSet; palette?: StoredPalette; bareFoot?: boolean };
