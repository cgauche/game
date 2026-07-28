/**
 * Setup global Vitest (`test.setupFiles`).
 *
 * 1. RESET DES SINGLETONS ENTRE TESTS (requis par `test.isolate: false`, cf. vite.config.ts).
 *    `isolate: false` partage le graphe de modules entre fichiers d'un même worker (le moteur pur +
 *    ~1 Mo de `src/data/*.json` sont évalués UNE fois par worker, au lieu d'une fois par fichier) → la
 *    suite passe de ~80 s à ~17 s. Contrepartie : les SINGLETONS de module gardent leur état d'un test
 *    à l'autre. On repart donc d'un état NEUF avant CHAQUE test (les hooks de setupFile sont les plus
 *    EXTERNES → s'exécutent AVANT le `beforeEach` propre du fichier, qui pose ensuite son décor) :
 *    - le STORE Zustand (`useGame`) : même reset « zéro-maintenance » que `startScene` (le JSON
 *      round-trip retire les fonctions → seules les données sont remises à plat ; le merge partiel de
 *      zustand préserve les actions).
 *    - le REGISTRE DES RÈGLES OPTIONNELLES (`engine/policy`) : `loadRuleOverrides({})` purge toute
 *      surcharge runtime → toutes les règles reviennent à leur défaut RAW (sinon une règle maison
 *      posée par un test — `cleave`, `combat-optional-rules`… — fuit dans un test pur ultérieur).
 *    - le REGISTRE DES CONSÉQUENCES DE CASCADE (`state/cascade`) : peuplé à l'import par les modules de
 *      domaine (restFlow/combatFlow/travelFlow — TOUJOURS importés ici via le store), mais aussi PAR
 *      LES TESTS (`cascade.test` enregistre un faux `shelter`, `cadence-rapide` un faux `tally`…). On
 *      capture le registre RÉEL avant chaque test et on le restaure après (retrait des kinds ajoutés,
 *      restauration des kinds écrasés) — sinon un faux applier écrase le vrai et fuit (ex. `shelter`
 *      écrasé → `rest-flow` n'insère plus l'Exposition).
 *    - les REGISTRES D'ART du rig (`ARMOUR` matériau×zone, `TENUE_BY_ID`) : objets de module, donc
 *      partagés par tous les fichiers du worker. Ils ne se restaurent pas ici (un test qui en pose
 *      un doit le remettre lui-même) : on DÉTECTE leur dérive après chaque test et on échoue AU SITE
 *      qui l'a laissée. Un nettoyage `delete` sur une clé que le registre déclarait VRAIMENT amputait
 *      la plaque (gantelet/soleret/gorgerin) pour tous les fichiers suivants — CI rouge sur le golden
 *      de combat et `enemyProfile`, verte en local, selon l'ordre des fichiers du worker (2026-07-29).
 *
 * 2. FILET D'ISOLATION DES TIMERS. Le combat planifie l'IA et l'enchaînement des tours via de VRAIS
 *    `setTimeout` (`combatFlow.ts`/`combatDirector.ts`/`combatAuto.ts`, via `scheduleCombatTimer` de
 *    `state/combatTimers.ts`) qui MUTENT `battle` et tirent `battleRng` (singleton de module) à leur
 *    échéance. Un test qui arme `vi.useFakeTimers()` sans le restaurer laisse des timers fantômes :
 *    `vi.useRealTimers()` DÉSINSTALLE l'horloge factice et JETTE ses timers en attente (en mode réel,
 *    c'est un no-op → ZÉRO risque). Mais un test SYNCHRONE qui déclenche un beat de combat AVANT de
 *    rendre la main arme un timer RÉEL (`setTimeout` natif, pas `vi.useFakeTimers`) que `vi.useRealTimers()`
 *    ne touche pas : sous `isolate:false` (module partagé entre fichiers du worker), ce timer en vol se
 *    déclenche pendant un test ULTÉRIEUR et corrompt son `battle`/sa séquence de RNG (#405, flake
 *    d'ordonnancement). `clearTrackedTimers()` annule tout timer tracé encore en vol au teardown (#405, #415).
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { useGame, type GameState } from './state/store';
import { loadRuleOverrides } from './engine/policy';
import { cascadeAppliers } from './state/cascade';
import { clearTrackedTimers } from './state/combatTimers';
import { resetOwnTestFailedGuard } from './state/triggeredEffects';
import { ARMOUR } from './gameIso/rig/parts/armour';
import { TENUE_BY_ID } from './gameIso/rig/parts/tenues';

// État initial figé UNE fois (le `stringify` est la moitié coûteuse, et le geler à l'init le rend
// immunisé à toute mutation du gabarit) ; chaque test n'en `parse` qu'une copie fraîche.
const PRISTINE_STATE = JSON.stringify(useGame.getInitialState());
let cascadeSnapshot: Record<string, (typeof cascadeAppliers)[string]> = {};

// Empreinte des registres d'ART du rig : liste des zones déclarées par matériau + ids de tenue. Ne
// lit que des CLÉS (l'art lui-même n'est jamais sérialisé) — le coût reste négligeable par test.
const rigRegistryFingerprint = (): string => JSON.stringify([
  Object.entries(ARMOUR as Record<string, Record<string, unknown>>)
    .map(([mat, zones]) => `${mat}:${Object.keys(zones).sort().join('|')}`),
  Object.keys(TENUE_BY_ID).length,
]);
const PRISTINE_RIG_REGISTRIES = rigRegistryFingerprint();

beforeEach(() => {
  useGame.setState(JSON.parse(PRISTINE_STATE) as Partial<GameState>);
  loadRuleOverrides({});
  resetOwnTestFailedGuard(); // drapeau de re-entrance onOwnTestFailed (auto-reset par try/finally ; filet doctrinal)
  cascadeSnapshot = { ...cascadeAppliers };
});

afterEach(() => {
  for (const k of Object.keys(cascadeAppliers)) if (!(k in cascadeSnapshot)) delete cascadeAppliers[k];
  Object.assign(cascadeAppliers, cascadeSnapshot);
  vi.useRealTimers();
  clearTrackedTimers();
  // Dérive d'un registre d'ART laissée par CE test : elle fuirait vers tous les fichiers suivants du
  // worker (`isolate: false`). On échoue ICI, au site fautif, plutôt que dans une victime éloignée.
  const rigNow = rigRegistryFingerprint();
  if (rigNow !== PRISTINE_RIG_REGISTRIES) {
    throw new Error(
      `Registre d'art du rig laissé MUTÉ par ce test (ARMOUR/TENUE_BY_ID sont partagés par le worker).\n`
      + `Capturer la valeur d'origine et la REMETTRE (jamais un \`delete\` sec sur une clé déclarée).\n`
      + `attendu = ${PRISTINE_RIG_REGISTRIES}\nobtenu  = ${rigNow}`,
    );
  }
});
