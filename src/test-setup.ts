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
 *    - le RNG DE COMBAT (`state/battleRng`) : semé par `seedBattleRng`/`store.seedRng`, il garde sinon
 *      la POSITION de flux laissée par le fichier précédent (cf. le bloc `seedBattleRng` ci-dessous).
 *    - la PRÉFÉRENCE « Dés fixés » (`engine/fixedDie`, `resetDesFixes`) et le DRAPEAU de ré-entrance
 *      `onOwnTestFailed` (`state/triggeredEffects`, `resetOwnTestFailedGuard`) — cf. les commentaires
 *      du `beforeEach` ci-dessous.
 *    - le REGISTRE DES SCÈNES (`sceneRegistry`, `state/store`) : peuplé par `registerScene`/`loadProject`
 *      — donc aussi par des TESTS. Rendu à ses scènes `campaign` par défaut en `afterEach`
 *      (`resetSceneRegistry`) : la pollution INTER-fichiers meurt. PORTÉE RÉELLE, mesurée et gardée par
 *      `state/scene-registry-isolation.test.ts` : un enregistrement de TÊTE DE FICHIER (module,
 *      `beforeAll`) ne vaut que pour le PREMIER test — le teardown l'efface comme les autres. Un fichier
 *      qui a besoin du registre sur PLUSIEURS tests l'(ré)enregistre en `beforeEach` (`shipwreck.test.ts`,
 *      via `freshState`). Une scène laissée au registre changeait le comportement des fichiers suivants
 *      du worker : `transitionTo` est un NO-OP sur scène inconnue (`state/store.ts`) — la même clôture
 *      de séquence transitionnait ou non selon la partition, d'où des rouges CI verts en local (#1014).
 *    - la PILE DES COUCHES DISMISSIBLES et sa PORTE clavier (`state/dismissStack` + `ui/useDismissLayer`,
 *      `resetDismissLayers`) : la pile des surfaces congédiables et le refcount de l'écouteur Échap sont
 *      des singletons de module. Le congédiement étant LIFO PUR, une couche laissée par un fichier
 *      voisin décide si Échap atteint la surface qu'un banc mesure ou une autre : le rendez-vous entre
 *      l'appui et la surface dépendait de l'ordre des fichiers du worker (#1442, rouges CI intermittents
 *      sur `ui/compendium/CodexRef.hooks.test.tsx`, verts en local). Mesuré : une couche étrangère au
 *      sommet reproduit le rouge à l'identique, et le TEMPS n'y change rien (la fermeture est synchrone).
 *      Les bancs de la couture gardent en plus leur propre `resetDismissLayers` en `beforeEach` — ils
 *      posent leur décor de pile, ils ne dépendent pas de ce filet.
 *    - les REGISTRES D'ART du rig (cf. `rigArtRegistrySignatures` plus bas) : objets de module, donc
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
 *
 * 3. BARRIÈRE DE FUITE DOM (`residusDom`/`messageResiduDom`, `afterEach`). react-dom est lui aussi un
 *    module partagé par le worker sous `isolate:false` : une racine laissée MONTÉE par un fichier se met
 *    à jour hors `act()` pendant les fichiers suivants (« Attempted to synchronously unmount a root while
 *    React was already rendering », « Should not already be working ») et leurs rendus deviennent VIDES
 *    (#1619). Tout nœud ÉLÉMENT resté enfant de `document.body` après un test échoue AU FICHIER FAUTIF,
 *    sauf ceux du stock d'extinction `scripts/guards/lib/domResiduStock.mjs` (cliquet :
 *    `src/dom-residu-stock.test.ts` ; re-mesure : variable `WFRP_DOM_RESIDU_COLLECTE`).
 */
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { appendFileSync } from 'node:fs';
import { DOM_RESIDU_STOCK } from '../scripts/guards/lib/domResiduStock.mjs';
import { useGame, resetSceneRegistry, type GameState } from './state/store';
import { loadRuleOverrides } from './engine/policy';
import { cascadeAppliers } from './state/cascade';
import { clearTrackedTimers } from './state/combatTimers';
import { resetOwnTestFailedGuard } from './state/triggeredEffects';
import { resetDesFixes } from './engine/fixedDie';
import { seedBattleRng } from './state/battleRng';
import { reinitWebglRefusé } from './gameIso/stage/webglSupport';
import { resetDismissLayers } from './ui/useDismissLayer';

// État initial figé UNE fois (le `stringify` est la moitié coûteuse, et le geler à l'init le rend
// immunisé à toute mutation du gabarit) ; chaque test n'en `parse` qu'une copie fraîche.
const PRISTINE_STATE = JSON.stringify(useGame.getInitialState());
let cascadeSnapshot: Record<string, (typeof cascadeAppliers)[string]> = {};

/**
 * Modules d'art des parts du rig, énumérés STRUCTURELLEMENT (`import.meta.glob` eager) : une famille
 * de parts déposée demain sous `parts/<famille>/` est couverte d'office, sans toucher ce fichier.
 * On prend `index.ts` (tables dérivées : `ARMOUR`, `TENUE_BY_ID`, `HEADS`…) ET `_registry.generated.ts`
 * (listes de defs : `HAIRSTYLE_DEFS`, `WEAPON_DEFS`… — `shields`/`weapons` n'ont pas d'`index.ts`).
 */
const RIG_PART_MODULES = import.meta.glob<Record<string, unknown>>(
  './gameIso/rig/parts/*/{index,_registry.generated}.ts',
  { eager: true },
);

/** Poids d'une valeur d'art : somme des longueurs de ses chaînes et de ses clés, en profondeur.
 *  N'alloue rien (contrairement à `JSON.stringify`) : 1,17 ms l'empreinte des 42 registres (~4,37 Mo
 *  d'art) contre 9,55 ms pour un `JSON.stringify` équivalent — mesuré 2026-08-23, régime établi sur
 *  3 148 tests. Prise à CHAQUE `afterEach` (granularité = LE TEST), elle coûte 3,7 s des 40 s de
 *  `src/engine` en mono-worker, soit ~23 s de CPU cumulés sur les 19 584 tests de la suite. */
const artWeight = (v: unknown, depth = 0): number => {
  if (typeof v === 'string') return v.length;
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v !== 'object' || depth > 16) return 2;
  let n = 0;
  if (Array.isArray(v)) {
    for (const e of v) n += 1 + artWeight(e, depth + 1);
    return n;
  }
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) n += k.length + artWeight(e, depth + 1);
  return n;
};

/**
 * Signature PAR REGISTRE des tables d'art du rig : `clé:poids` par entrée, dans l'ordre de déclaration.
 * Détecte l'ajout, le retrait, le déplacement ET la SUBSTITUTION d'une valeur sous une clé existante
 * (`delete ARMOUR.plaque.pied` comme `ARMOUR.plaque.pied = '<g/>'` changent le poids de `plaque`).
 *
 * Angles morts ASSUMÉS, nominatifs :
 * - substitution de poids cumulé EXACTEMENT identique ;
 * - exports FONCTION, non pesables : `appendageArt`/`appendageFeature` (appendages), `feat`/
 *   `featureMorpho`/`elementsOf` (elements), `swapEye`/`applyEyes`/`eyesArtFromKeys` (eyes),
 *   `hairstylesForSex` (hairstyles) — aucun ne détient d'art, tous lisent une table pesée ici ;
 * - un `Map`/`Set` pèserait 0 (aucun à ce jour parmi les exports de `parts/*`) ;
 * - les registres d'art hors `parts/` : `rig/creatures/`, `rig/plans/`, `gameIso/catalog/`.
 */
export function rigArtRegistrySignatures(): Map<string, string> {
  const sigs = new Map<string, string>();
  for (const [path, mod] of Object.entries(RIG_PART_MODULES)) {
    const family = path.split('/parts/')[1] ?? path;
    for (const [name, reg] of Object.entries(mod)) {
      if (!reg || typeof reg !== 'object') continue;
      const parts: string[] = [];
      for (const [k, entry] of Object.entries(reg as Record<string, unknown>)) {
        const id = entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
          ? (entry as { id: string }).id
          : k;
        parts.push(`${id}:${artWeight(entry)}`);
      }
      sigs.set(`${family}#${name}`, parts.join('|'));
    }
  }
  return sigs;
}

const PRISTINE_RIG_REGISTRIES = rigArtRegistrySignatures();

/** Description d'un nœud ÉLÉMENT résiduel : `<tag class="…">`, jamais son contenu (le nom suffit à
 *  retrouver le montage fautif, le contenu ferait un message illisible). */
export function residusDom(body: { children: ArrayLike<Element> } | null | undefined): string[] {
  if (!body) return [];
  return Array.from(body.children as ArrayLike<Element>).map((el) => {
    const tag = el.tagName.toLowerCase();
    const cls = el.getAttribute?.('class');
    return cls ? `<${tag} class="${cls}">` : `<${tag}>`;
  });
}

/** Clé de stock d'un fichier de test : chemin POSIX relatif à la racine du dépôt. */
export function cleFichierTest(testPath: string | undefined, racine = process.cwd()): string {
  if (!testPath) return '(fichier inconnu)';
  const p = testPath.split('\\').join('/');
  const r = racine.split('\\').join('/').replace(/\/$/, '');
  return p.startsWith(`${r}/`) ? p.slice(r.length + 1) : p;
}

/** Verdict de la barrière : message d'échec, ou `null` si rien à dire (aucun résidu, ou fichier du
 *  stock d'extinction `scripts/guards/lib/domResiduStock.mjs`). */
export function messageResiduDom(
  fichier: string,
  residus: readonly string[],
  stock: ReadonlySet<string> = DOM_RESIDU_STOCK,
): string | null {
  if (!residus.length || stock.has(fichier)) return null;
  return (
    `Nœud(s) laissé(s) dans document.body par ${fichier} (${residus.length}) : ${residus.join(' ')}\n`
    + `Sous test.isolate:false, react-dom est partagé par tout le worker : une racine restée montée se met à jour `
    + `hors act() pendant les fichiers SUIVANTS, qui rendent alors le vide (#1619).\n`
    + `Démonter ce que le test monte (act(() => root.unmount()) en afterEach, ou cleanup()) — jamais ajouter une ligne au stock.`
  );
}

/** Fichier d'inventaire de la re-mesure (`WFRP_DOM_RESIDU_COLLECTE`) : la barrière n'échoue plus et
 *  écrit `fichier<TAB>nombre<TAB>nœuds` — c'est ainsi que le stock d'extinction se re-établit. */
const COLLECTE_RESIDU = process.env.WFRP_DOM_RESIDU_COLLECTE;
const residuVus = new Set<string>();

beforeEach(() => {
  useGame.setState(JSON.parse(PRISTINE_STATE) as Partial<GameState>);
  loadRuleOverrides({});
  // PRÉFÉRENCE « Dés fixés » (`engine/fixedDie`) : singleton de module, donc PARTAGÉ entre fichiers de
  // test sous `isolate:false` — un fichier qui l'allume sans le rendre contamine les suivants (une
  // fenêtre de pose de dé s'y ouvre, l'attaque suspend, les Blessures n'arrivent jamais). Remis à zéro
  // au même titre que le registre des règles optionnelles : l'ordre d'exécution ne décide de rien.
  resetDesFixes();
  // RNG DE COMBAT (`state/battleRng`) : singleton de module lui aussi, SEMÉ par tout fichier qui appelle
  // `seedBattleRng`/`store.seedRng`. Sans remise à zéro, un fichier qui a semé une graine fixe lègue au
  // suivant un flux à position ARBITRAIRE : les tests qui ne sèment pas (et lisent un dé « au hasard »)
  // deviennent dépendants de l'ordre des fichiers du worker — flake d'ordonnancement, comme les timers
  // (#405) et « Dés fixés » ci-dessus. On repart de l'état d'un module FRAÎCHEMENT chargé : une graine
  // d'horloge, que tout test déterministe écrase par son propre `seedBattleRng`.
  seedBattleRng(Date.now() & 0xffff);
  resetOwnTestFailedGuard(); // drapeau de re-entrance onOwnTestFailed (auto-reset par try/finally ; filet doctrinal)
  // VERDICT « pas de contexte volumique » (`gameIso/stage/webglSupport`) : singleton de module, et
  // LATCHÉ par construction (le jeu ne revient jamais d'un contexte refusé). jsdom n'a aucun contexte
  // WebGL : tout montage d'écran de monde SANS renderer de banc le pose — les fichiers suivants du
  // worker monteraient alors le message d'erreur au lieu du monde (`isolate:false`).
  reinitWebglRefusé();
  // PILE DES COUCHES DISMISSIBLES + PORTE clavier d'Échap (`ui/useDismissLayer`) : singletons de module
  // eux aussi, et le congédiement est LIFO PUR — une couche laissée par un fichier voisin prend l'appui
  // à la place de la surface que le banc mesure (portée et mesure : §1 de l'en-tête). Sans DOM la remise
  // à plat ne touche que la pile : aucun écouteur n'est branché sur un environnement `node`.
  resetDismissLayers();
  cascadeSnapshot = { ...cascadeAppliers };
});

afterEach(() => {
  // REGISTRE DES SCÈNES (`state/store`) : rendu à ses scènes `campaign` par défaut APRÈS CHAQUE test —
  // aucune scène enregistrée par un test (`registerScene`/`loadProject`) ne traverse vers un autre
  // fichier du worker (`isolate:false`). Portée exacte : en-tête §1 + `state/scene-registry-isolation.test.ts`.
  resetSceneRegistry();
  for (const k of Object.keys(cascadeAppliers)) if (!(k in cascadeSnapshot)) delete cascadeAppliers[k];
  Object.assign(cascadeAppliers, cascadeSnapshot);
  vi.useRealTimers();
  clearTrackedTimers();
  // FUITE DOM laissée par CE test (cf. §3 de l'en-tête) : observée au hook le plus EXTERNE, donc APRÈS
  // les `afterEach` du fichier (démontage, `cleanup()`). On échoue ICI, au site fautif, plutôt que dans
  // une victime éloignée du même worker. Stock d'extinction : scripts/guards/lib/domResiduStock.mjs.
  if (typeof document !== 'undefined') {
    const residus = residusDom(document.body);
    if (residus.length) {
      const fichier = cleFichierTest(expect.getState().testPath);
      if (COLLECTE_RESIDU) {
        if (!residuVus.has(fichier)) {
          residuVus.add(fichier);
          appendFileSync(COLLECTE_RESIDU, `${fichier}\t${residus.length}\t${residus.slice(0, 4).join(' ')}\n`);
        }
      } else {
        const msg = messageResiduDom(fichier, residus);
        if (msg) throw new Error(msg);
      }
    }
  }
  // Dérive d'un registre d'ART laissée par CE test : elle fuirait vers tous les fichiers suivants du
  // worker (`isolate: false`). On échoue ICI, au site fautif, plutôt que dans une victime éloignée.
  const now = rigArtRegistrySignatures();
  const drifted: string[] = [];
  for (const [reg, sig] of now) {
    const was = PRISTINE_RIG_REGISTRIES.get(reg);
    if (was === sig) continue;
    drifted.push(was === undefined
      ? `${reg} : registre APPARU`
      : `${reg}\n  attendu = ${was}\n  obtenu  = ${sig}`);
  }
  for (const reg of PRISTINE_RIG_REGISTRIES.keys()) if (!now.has(reg)) drifted.push(`${reg} : registre DISPARU`);
  if (drifted.length) {
    throw new Error(
      `Registre d'art du rig laissé MUTÉ par ce test (les tables de gameIso/rig/parts sont partagées par le worker).\n`
      + `Capturer la valeur d'origine et la REMETTRE (jamais un \`delete\` sec sur une clé déclarée).\n`
      + drifted.join('\n'),
    );
  }
});
