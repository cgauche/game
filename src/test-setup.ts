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
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { useGame, type GameState } from './state/store';
import { loadRuleOverrides } from './engine/policy';
import { cascadeAppliers } from './state/cascade';
import { clearTrackedTimers } from './state/combatTimers';
import { resetOwnTestFailedGuard } from './state/triggeredEffects';
import { resetDesFixes } from './engine/fixedDie';
import { seedBattleRng } from './state/battleRng';

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
 *  N'alloue rien (contrairement à `JSON.stringify`) → 0,17 ms par empreinte au lieu de 6,4 ms sur les
 *  ~4,3 Mo d'art mesurés (2026-07-29), donc négligeable à chaque `afterEach`. */
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
  cascadeSnapshot = { ...cascadeAppliers };
});

afterEach(() => {
  for (const k of Object.keys(cascadeAppliers)) if (!(k in cascadeSnapshot)) delete cascadeAppliers[k];
  Object.assign(cascadeAppliers, cascadeSnapshot);
  vi.useRealTimers();
  clearTrackedTimers();
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
