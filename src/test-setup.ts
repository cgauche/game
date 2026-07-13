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
 *
 * 2. FILET D'ISOLATION DES TIMERS. Le combat planifie l'IA et l'enchaînement des tours via de VRAIS
 *    `setTimeout` (`combatFlow.ts`, délais `TEMPO` de 400-850 ms) qui MUTENT `battle` et TIRENT le
 *    `battleRng`. Deux fuites de CLASSE, toutes deux couvertes ici :
 *    - un test qui arme `vi.useFakeTimers()` sans le restaurer laisse des timers factices fantômes →
 *      `vi.useRealTimers()` désinstalle l'horloge factice et JETTE ses timers en attente.
 *    - un test SYNCHRONE qui déclenche un tour d'IA finit AVANT que son `setTimeout` réel (650 ms) ne se
 *      draine : le timer survit sur l'horloge RÉELLE et se déclenche pendant un test ULTÉRIEUR du même
 *      worker (`advanceTurn`/`runEnemyAI` sur le `battle` courant → mutation + décalage du flux RNG →
 *      flake, ex. duel-naval `G:fire` absent, #379 #339). `vi.useRealTimers()` ne peut PAS annuler un
 *      timer réel natif : on TRAÇE donc les handles de `setTimeout` réels et on les `clearTimeout` en fin
 *      de chaque test (les timers légitimes, awaités dans le test, sont déjà déclenchés → seuls les
 *      FUYARDS restent en attente à ce point).
 *
 * 3. RNG DE COMBAT (`battleRng`) : singleton de module réensemencé à une graine FIXE avant chaque test —
 *    même patron de reset que le store/policy/cascade ci-dessus (doctrine « nouveau singleton = reset »),
 *    pour qu'un test qui ne réensemence pas explicitement reparte d'un flux déterministe et non du résidu
 *    du test précédent.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { useGame, type GameState } from './state/store';
import { loadRuleOverrides } from './engine/policy';
import { cascadeAppliers } from './state/cascade';
import { seedBattleRng } from './state/battleRng';

// Traçage des `setTimeout` RÉELS (cf. §2) : on enveloppe le global UNE fois (installé AVANT que
// `vi.useFakeTimers` d'un test ne capture le « vrai » setTimeout → restauré tel quel par useRealTimers).
type TimeoutSetter = typeof globalThis.setTimeout;
const _g = globalThis as unknown as { setTimeout: TimeoutSetter; clearTimeout: typeof clearTimeout };
const _realSetTimeout = _g.setTimeout;
const _realClearTimeout = _g.clearTimeout;
const _pendingTimers = new Set<ReturnType<TimeoutSetter>>();
_g.setTimeout = ((fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  const h = _realSetTimeout(() => { _pendingTimers.delete(h); (fn as (...a: unknown[]) => void)(...args); }, ms);
  _pendingTimers.add(h);
  return h;
}) as TimeoutSetter;
_g.clearTimeout = ((h: ReturnType<TimeoutSetter>) => { _pendingTimers.delete(h); _realClearTimeout(h); }) as typeof clearTimeout;

// État initial figé UNE fois (le `stringify` est la moitié coûteuse, et le geler à l'init le rend
// immunisé à toute mutation du gabarit) ; chaque test n'en `parse` qu'une copie fraîche.
const PRISTINE_STATE = JSON.stringify(useGame.getInitialState());
let cascadeSnapshot: Record<string, (typeof cascadeAppliers)[string]> = {};

beforeEach(() => {
  useGame.setState(JSON.parse(PRISTINE_STATE) as Partial<GameState>);
  loadRuleOverrides({});
  seedBattleRng(0);
  cascadeSnapshot = { ...cascadeAppliers };
});

afterEach(() => {
  for (const k of Object.keys(cascadeAppliers)) if (!(k in cascadeSnapshot)) delete cascadeAppliers[k];
  Object.assign(cascadeAppliers, cascadeSnapshot);
  vi.useRealTimers();
  for (const h of _pendingTimers) _realClearTimeout(h);
  _pendingTimers.clear();
});
