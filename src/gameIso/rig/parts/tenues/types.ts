import type { PartArt } from '../types';
import type { StoredPalette } from '../../palette';
import type { RigOverlay } from '../../bones';

/**
 * Slots habillables d'une tenue. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur).
 * Le slot `tete` recouvre le visage cosmétique (`heads/defs/*.ts` champ `visage`, PROFILE_FACE de
 * `cosmetic.ts`) ET les cheveux (champ `cheveux`) : x ≈ -9..9 (visage), -11..11 (cheveux) ;
 * y ≈ -2..17 (visage, front→menton), -12..-2 (cheveux, mèches→racine). Un casque/chapeau calé
 * uniquement sur -2..17 laisse la chevelure (jusqu'à y≈-12) à nu.
 */
export type TenueSet = Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', PartArt>>;

/**
 * Une tenue = un fichier `defs/<Nom>.ts`. SEULE source (plus d'AUTO/MANUAL/merge). `label` = le
 * NOM authoré, slugifié en id de lookup par `tenueFor` :
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
 * Elle pilote aussi les parts SYSTÈME du pied, que la tenue ne dessine pas (`FOOT`/`CLAWFOOT`
 * de `resolve.ts`, #426) : `botte` (cuir de la botte — TÊTE de famille : `semelle` et `botteDos`
 * la suivent) et `griffe` (pied nu griffu). Non déclarés → pied système (botte brune / griffes
 * sombres). Chaque membre se déclare aussi SEUL (`botteDos` sans `botte`) : la base déclarée est
 * honorée, son ombre se DÉRIVE, les autres restent système — aucune combinaison partielle n'est
 * interdite ni silencieuse. MÊME contrat pour la palette d'une RACE (`races/`, empilée sous la
 * tenue) : c'est la palette PORTÉE entière qui pilote le pied. Cf. `footPalette` et l'empilage
 * unique `rigStoredPalette` (career.ts) ; garde `parts/shared-parts-palette.test.ts`.
 *
 * `bareFoot` : tenue qui ne chausse pas (corps 'Nu', squelette décharné, pagne du Sanguinaire…) —
 * silhouettes dos/profil substituées (jambe sans botte) restent en chair. SOURCE UNIQUE du
 * barefoot (plus de hardcode par id dans resolve).
 *
 * `footStyle` : art du pied — `'boot'` (botte de cuir), `'claw'` (pied nu GRIFFU, espèces
 * monstrueuses), `'plain'` (pied nu LISSE, civilisé va-nu-pieds). Défaut dérivé de `bareFoot`
 * pour rétro-compat (absent → `'boot'`, présent → `'claw'`) : ne préciser `footStyle` que pour
 * s'écarter de ce défaut (#481).
 */
export type TenueDef = {
  label: string;
  set: TenueSet;
  palette?: StoredPalette;
  bareFoot?: boolean;
  footStyle?: 'boot' | 'claw' | 'plain';
  /** Calques ASYMÉTRIQUES attachés à un os précis (pauldron/fourrure qui déborde une SEULE
   *  épaule) — même vocabulaire que `dorsalOverlays`/`monsterInjection` (`RigOverlay`, `plane`
   *  pour échapper au z inégal des bras epauleG/epauleD, `view` pour une vue). Optionnel :
   *  absent = comportement inchangé (les 117 tenues existantes ne déclarent rien). */
  overlays?: RigOverlay[];
};
