# Cycle jour/nuit piloté par l'horloge — Plan d'implémentation (#T1c)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution INLINE recommandée — plusieurs fichiers chauds édités par d'autres sessions //). Étapes en `- [ ]`.
> ⚠️ **Fichiers chauds** (`scene.ts`, `combatFlow.ts`, `store.ts`, `IsoStage.tsx`) édités en parallèle → **relire l'ancre avant chaque edit** ; committer **uniquement mes hunks**. Technique : index temporaire seedé sur HEAD + `git add` (fichiers à moi) / reverse-apply des hunks étrangers (fichiers partagés), en vérifiant `git diff --cached`/`git show --stat` (aucune fuite étrangère) avant commit. Mes hunks de ce plan contiennent toujours un marqueur identifiable (`dayPhase`/`isNight`/`sceneIsDark`/`setTime`/`gameTime`). Terminer chaque message de commit par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Goal:** Le jour/nuit dérive de l'heure (`gameTime`) — affichage HUD, rendu sombre, et obscurité de combat (−20 tir) suivent l'horloge ; un Effet `setTime` permet de forcer une scène de nuit via trigger.

**Architecture:** `clock.ts` (pur) expose les 7 phases + `isNight` (obscurité, fenêtre paramétrable découplée). `scene.ts` réduit `ambiance` à intérieur/extérieur (legacy normalisé) et ajoute l'Effet `setTime`. `sceneRules.sceneIsDark(scene, gameTime)` est l'unique dérivation, consommée par le combat (`sceneCombatModifiers`) et le rendu (`IsoStage`). Le HUD affiche jour-de-semaine + phase + heure.

**Tech Stack:** TypeScript pur, Zustand, Vitest, React/SVG.

**Spec:** `docs/superpowers/specs/2026-06-07-cycle-jour-nuit-design.md`.

**Runners:** `npx vitest`/`tsc` via Bash natif (RTK). Sur échec JSON tronqué → `npx vitest run X --reporter=json --outputFile=vt.json` puis parser au node.

---

## Task 1 : `clock.ts` — phases du jour + obscurité + saut horaire (pur)

**Files:** Modify `src/engine/clock.ts` ; Modify `src/engine/clock.test.ts`. *(les deux à moi, commit direct.)*

- [ ] **Step 1 : Tests qui échouent** — ajouter au début de `clock.test.ts` l'import puis un nouveau describe :

Ajouter à la ligne d'import existante `dayPhase, isNight, minutesUntilNext` :
```ts
import { IMPERIAL_MONTHS, INTERCALARY, WEEKDAYS, DAYS_PER_YEAR, MINUTES_PER_DAY, toDate, fromDate, formatImperial, CAMPAIGN_START, dayPhase, isNight, minutesUntilNext } from './clock';
```
Ajouter à la fin du fichier :
```ts
describe('clock — phases du jour & obscurité (#T1c)', () => {
  const at = (h: number, m = 0) => h * 60 + m;
  it('dayPhase : 7 phases aux frontières (la nuit enjambe minuit)', () => {
    expect(dayPhase(at(4, 59)).key).toBe('nuit');
    expect(dayPhase(at(5)).key).toBe('aube');
    expect(dayPhase(at(8)).key).toBe('matin');
    expect(dayPhase(at(11)).key).toBe('midi');
    expect(dayPhase(at(14)).key).toBe('apresmidi');
    expect(dayPhase(at(18)).key).toBe('crepuscule');
    expect(dayPhase(at(20)).key).toBe('soir');
    expect(dayPhase(at(22)).key).toBe('nuit');
    expect(dayPhase(at(0)).key).toBe('nuit');
  });
  it('isNight = obscurité 22:00–05:00 (enjambe minuit), découplé des phases', () => {
    expect(isNight(at(22))).toBe(true);
    expect(isNight(at(2))).toBe(true);
    expect(isNight(at(4, 59))).toBe(true);
    expect(isNight(at(5))).toBe(false);
    expect(isNight(at(12))).toBe(false);
    expect(isNight(at(21, 59))).toBe(false);
  });
  it('dayPhase expose label/icon et isNight', () => {
    expect(dayPhase(at(12))).toMatchObject({ key: 'midi', icon: '☀️', isNight: false });
    expect(dayPhase(at(23))).toMatchObject({ key: 'nuit', isNight: true });
  });
  it('minutesUntilNext : plus tard / déjà passé → demain / pile = 0', () => {
    expect(minutesUntilNext(at(14), at(22))).toBe(8 * 60); // 14:00 → 22:00
    expect(minutesUntilNext(at(23), at(22))).toBe(23 * 60); // 23:00 → prochaine 22:00
    expect(minutesUntilNext(at(22), at(22))).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer → échoue** : `npx vitest run src/engine/clock.test.ts` → exports absents.

- [ ] **Step 3 : Implémenter** — ajouter à la fin de `clock.ts` (après `CAMPAIGN_START`) :
```ts
// ─── Phases du jour (#T1c) ─── affichage riche, découplé de l'obscurité mécanique ───
export type DayPhaseKey = 'aube' | 'matin' | 'midi' | 'apresmidi' | 'crepuscule' | 'soir' | 'nuit';
export interface DayPhase { key: DayPhaseKey; label: string; icon: string; isNight: boolean; }

/** Table ordonnée des phases d'AFFICHAGE : heure de début (minutes-de-jour) + libellé FR + icône.
 *  Paramétrable (canon muet sur l'heure exacte du lever/coucher). 'nuit' enjambe minuit (00:00–05:00). */
export const DAY_PHASES: { key: DayPhaseKey; start: number; label: string; icon: string }[] = [
  { key: 'aube',       start:  5 * 60, label: 'Aube',       icon: '🌅' },
  { key: 'matin',      start:  8 * 60, label: 'Matin',      icon: '🌄' },
  { key: 'midi',       start: 11 * 60, label: 'Midi',       icon: '☀️' },
  { key: 'apresmidi',  start: 14 * 60, label: 'Après-midi', icon: '🌤️' },
  { key: 'crepuscule', start: 18 * 60, label: 'Crépuscule', icon: '🌇' },
  { key: 'soir',       start: 20 * 60, label: 'Soir',       icon: '🌆' },
  { key: 'nuit',       start: 22 * 60, label: 'Nuit',       icon: '🌙' },
];

/** Fenêtre d'OBSCURITÉ mécanique (combat −20 tir / rendu sombre), paramétrable et DÉCOUPLÉE des
 *  phases d'affichage. [start,end) en minutes-de-jour ; enjambe minuit (22:00 → 05:00). */
export const NIGHT_WINDOW = { start: 22 * 60, end: 5 * 60 } as const;

const minuteOfDay = (minutes: number) => ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** Obscurité ? (seul seuil mécanique). Vrai si l'heure du jour ∈ NIGHT_WINDOW (qui enjambe minuit). */
export function isNight(minutes: number): boolean {
  const m = minuteOfDay(minutes);
  return m >= NIGHT_WINDOW.start || m < NIGHT_WINDOW.end;
}

/** Phase d'affichage (7) pour une heure donnée. */
export function dayPhase(minutes: number): DayPhase {
  const m = minuteOfDay(minutes);
  let chosen = DAY_PHASES[DAY_PHASES.length - 1]; // 'nuit' par défaut (00:00–05:00, avant 'aube')
  for (const p of DAY_PHASES) if (m >= p.start) chosen = p;
  return { key: chosen.key, label: chosen.label, icon: chosen.icon, isNight: isNight(minutes) };
}

/** Minutes à avancer pour atteindre la PROCHAINE occurrence (toujours en avant) de l'heure-du-jour
 *  cible. 0 si on y est déjà. Le temps ne recule jamais (« tout est horodaté »). */
export function minutesUntilNext(currentMinutes: number, targetMinuteOfDay: number): number {
  return (minuteOfDay(targetMinuteOfDay) - minuteOfDay(currentMinutes) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
```

- [ ] **Step 4 : Lancer → passent** : `npx vitest run src/engine/clock.test.ts`. Corriger jusqu'au vert.

- [ ] **Step 5 : Typecheck + commit**
```bash
npm run typecheck
git commit -- src/engine/clock.ts src/engine/clock.test.ts -m "feat(temps): phases du jour + obscurite isNight + minutesUntilNext (#T1c)"
```

---

## Task 2 : `scene.ts` — ambiance intérieur/extérieur + Effet `setTime`

**Files:** Modify `src/state/scene.ts` (**CHAUD** — `smoke?` WIP //) ; Create `src/state/scene.test.ts` (à moi).

- [ ] **Step 1 : Test qui échoue** — créer `src/state/scene.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { normalizeAmbiance, isIndoor } from './scene';
import type { Scene } from './scene';

describe('ambiance — intérieur vs extérieur (jour/nuit vient de l’horloge, #T1c)', () => {
  it('normalizeAmbiance : interieur conservé ; jour/nuit/foret/undefined → exterieur', () => {
    expect(normalizeAmbiance('interieur')).toBe('interieur');
    expect(normalizeAmbiance('exterieur')).toBe('exterieur');
    expect(normalizeAmbiance('jour')).toBe('exterieur');
    expect(normalizeAmbiance('nuit')).toBe('exterieur');
    expect(normalizeAmbiance('foret')).toBe('exterieur');
    expect(normalizeAmbiance(undefined)).toBe('exterieur');
  });
  it('isIndoor', () => {
    expect(isIndoor({ ambiance: 'interieur' } as Scene)).toBe(true);
    expect(isIndoor({ ambiance: 'nuit' } as Scene)).toBe(false);
    expect(isIndoor({ ambiance: undefined } as Scene)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer → échoue** : `npx vitest run src/state/scene.test.ts` → exports absents.

- [ ] **Step 3 : Implémenter dans `scene.ts`** (relire l'ancre avant chaque edit) :

3a. Remplacer la ligne du champ `ambiance` (actuellement `ambiance?: 'jour' | 'nuit' | 'interieur' | 'foret';`) par :
```ts
  /** Décor : 'interieur' (éclairé en permanence, l'horloge ne l'assombrit pas) vs 'exterieur'
   *  (jour/nuit = horloge). Valeurs HÉRITÉES 'jour'|'nuit'|'foret' = legacy, normalisées 'exterieur'
   *  (cf. normalizeAmbiance) — gardées pour la rétro-compat des scènes existantes (#T1c). */
  ambiance?: 'interieur' | 'exterieur' | 'jour' | 'nuit' | 'foret';
```

3b. Ajouter en haut du fichier (avec les autres imports de type) :
```ts
import type { DayPhaseKey } from '../engine/clock';
```

3c. Dans l'union `export type Effect =`, ajouter ces deux variantes juste avant `| { type: 'endDialogue' };` :
```ts
  | { type: 'setTime'; phase: DayPhaseKey }            // « passe à l'aube/jour/…/nuit » (saut en avant)
  | { type: 'setTime'; hour: number; minute?: number } // heure précise (saut en avant)
```

3d. Ajouter les helpers (en fin de fichier, ou près de `isWalkable`) :
```ts
/** Le jour/nuit ne vient plus de la scène (il vient de l'horloge) ; `ambiance` ne distingue plus que
 *  intérieur vs extérieur. Normalise les valeurs héritées (jour/nuit/foret/undefined → exterieur). */
export function normalizeAmbiance(a: Scene['ambiance']): 'interieur' | 'exterieur' {
  return a === 'interieur' ? 'interieur' : 'exterieur';
}
/** Scène en intérieur (éclairée, l'obscurité de l'horloge ne s'y applique pas). */
export function isIndoor(scene: Pick<Scene, 'ambiance'>): boolean {
  return normalizeAmbiance(scene.ambiance) === 'interieur';
}
```

- [ ] **Step 4 : Lancer → passent** : `npx vitest run src/state/scene.test.ts` ; `npm run typecheck` (les scènes legacy `ambiance:'foret'`/`'nuit'` typecheckent toujours).

- [ ] **Step 5 : Commit** — `scene.ts` est **chaud** → commit isolé de mes seuls hunks (marqueur : `normalizeAmbiance`/`isIndoor`/`setTime`/`exterieur`) ; `scene.test.ts` est à moi.
```bash
# vérifier l'absence de hunk étranger (ex. smoke) dans le diff de scene.ts avant de committer mes hunks
git diff --stat -- src/state/scene.ts
git commit -- src/state/scene.test.ts   # fichier à moi (direct)
# scene.ts : commit isolé (cf. en-tête) -m "feat(temps): ambiance interieur/exterieur + Effet setTime (#T1c)"
```

---

## Task 3 : `sceneRules.ts` — `sceneIsDark` + `sceneCombatModifiers(scene, gameTime)` + appelants

**Files:** Modify `src/state/sceneRules.ts` (à moi) ; Modify `src/state/sceneRules.test.ts` (à moi) ; Modify `src/state/combatFlow.ts:333` (**CHAUD**) ; Modify `src/state/store.ts:1871,1885` (**CHAUD**).

- [ ] **Step 1 : Réécrire les tests `sceneRules.test.ts`** (le 1er describe) — `sceneCombatModifiers` prend désormais `gameTime` ; la nuit vient de l'horloge :
```ts
const sc = (over: Partial<Scene>): Scene => ({ ambiance: 'exterieur', ...over } as Scene);
const DAY = 12 * 60;   // midi (clair)
const NIGHT = 23 * 60; // nuit (obscurité)

describe('sceneCombatModifiers — obscurité (horloge) / météo (LDB 14 l.94-116/107, #T1c)', () => {
  it('clair de jour → aucun mod', () => {
    expect(sceneCombatModifiers(sc({ weather: 'clair' }), DAY)).toMatchObject({ concealed: false, attackMod: 0, dodgeMod: 0 });
  });
  it('pluie → aucun mod (flavor, +0 LDB l.94-98)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'pluie' }), DAY)).toMatchObject({ concealed: false, attackMod: 0, dodgeMod: 0 });
  });
  it('brouillard → cible dissimulée (concealed), -20 au tir', () => {
    expect(sceneCombatModifiers(sc({ weather: 'brouillard' }), DAY)).toMatchObject({ concealed: true, attackMod: 0, dodgeMod: 0 });
  });
  it('extérieur de nuit (horloge) → concealed (obscurité, l.107)', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'exterieur' }), NIGHT).concealed).toBe(true);
  });
  it('extérieur de jour (horloge) → pas d’obscurité', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'exterieur' }), DAY).concealed).toBe(false);
  });
  it('intérieur, même de nuit → jamais obscur (éclairé)', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'interieur' }), NIGHT).concealed).toBe(false);
  });
  it('tempête → -20 attaque, esquive 0 (l.108-109)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'tempete' }), DAY)).toMatchObject({ attackMod: -20, dodgeMod: 0 });
  });
  it('neige → -20 attaque ET -20 esquive (l.115-116)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'neige' }), DAY)).toMatchObject({ attackMod: -20, dodgeMod: -20 });
  });
});
```

- [ ] **Step 2 : Lancer → échoue** : `npx vitest run src/state/sceneRules.test.ts` (signature/`sceneIsDark` absents).

- [ ] **Step 3 : Implémenter `sceneRules.ts`** :

3a. Ajouter les imports en haut :
```ts
import { isNight } from '../engine/clock';
import { isIndoor } from './scene';
```
3b. Ajouter `sceneIsDark` + changer la signature de `sceneCombatModifiers` :
```ts
/** Obscurité de la scène (combat + rendu) : extérieur de nuit uniquement (l'intérieur reste éclairé).
 *  Source = l'HORLOGE (`gameTime`), plus l'ambiance authored (#T1c). Unique dérivation partagée. */
export function sceneIsDark(scene: Pick<Scene, 'ambiance'>, gameTime: number): boolean {
  return !isIndoor(scene) && isNight(gameTime);
}

export function sceneCombatModifiers(scene: Pick<Scene, 'ambiance' | 'weather'>, gameTime: number): SceneCombatMods {
  const night = sceneIsDark(scene, gameTime);
```
(le reste du corps de `sceneCombatModifiers` est inchangé : `night` garde sa sémantique).

- [ ] **Step 4 : Threader `gameTime` dans les 3 appelants** (relire chaque ancre) :
  - `src/state/combatFlow.ts:333` : `const sc = sceneCombatModifiers(scene, get().gameTime);`
  - `src/state/store.ts:1871` : `const dodgeMod = get().scene ? sceneCombatModifiers(get().scene!, get().gameTime).dodgeMod : 0;`
  - `src/state/store.ts:1885` : idem (même ligne dupliquée).

- [ ] **Step 5 : Suite + golden + typecheck** :
```bash
npm test           # sceneRules verts + golden-combat intact (resolveMelee pur non touché)
npm run typecheck
```

- [ ] **Step 6 : Commit** — `sceneRules.ts`/`.test.ts` à moi (direct) ; `combatFlow.ts`/`store.ts` **chauds** → commit isolé (marqueur : `gameTime`/`sceneIsDark`).
```bash
git commit -- src/state/sceneRules.ts src/state/sceneRules.test.ts   # à moi
# combatFlow.ts + store.ts : commit isolé -m "feat(temps): obscurite de combat pilotee par l'horloge (sceneIsDark) (#T1c)"
```

---

## Task 4 : Effet `setTime` — handler dans `applyEffects`

**Files:** Modify `src/state/combatFlow.ts` (**CHAUD** — switch `applyEffects`, ~l.176-260) ; Modify `src/state/store.test.ts` (**CHAUD**).

- [ ] **Step 1 : Tests qui échouent** — ajouter dans `store.test.ts` (l'import `applyEffects` existe déjà) :

Ajouter à l'import clock : `import { CAMPAIGN_START, MINUTES_PER_DAY } from '../engine/clock';` → ajouter `DAY_PHASES`. Puis :
```ts
describe('Effet setTime — forcer l’heure du jour (jour/nuit via trigger, #T1c)', () => {
  beforeEach(() => reset());
  const dayAt = (h: number) => CAMPAIGN_START - (CAMPAIGN_START % MINUTES_PER_DAY) + h * 60; // un jour donné, à h:00

  it('setTime phase nuit depuis 14:00 → avance à la prochaine 22:00 (8 h)', () => {
    useGame.setState({ gameTime: dayAt(14) });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setTime', phase: 'nuit' }]);
    expect(useGame.getState().gameTime).toBe(dayAt(14) + 8 * 60);
  });
  it('setTime heure précise 02:00 depuis 23:00 → saute en avant (3 h, lendemain)', () => {
    useGame.setState({ gameTime: dayAt(23) });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setTime', hour: 2 }]);
    expect(useGame.getState().gameTime).toBe(dayAt(23) + 3 * 60);
  });
  it('setTime sur la phase déjà courante → no-op (temps ne recule jamais)', () => {
    useGame.setState({ gameTime: dayAt(22) }); // déjà au début de 'nuit'
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setTime', phase: 'nuit' }]);
    expect(useGame.getState().gameTime).toBe(dayAt(22));
  });
});
```

- [ ] **Step 2 : Lancer → échoue** : `npx vitest run src/state/store.test.ts -t "setTime"` (le `case` n'existe pas → gameTime inchangé, assertions échouent).

- [ ] **Step 3 : Implémenter le handler** dans `combatFlow.ts` :

3a. Ajouter à l'import clock (combatFlow importe déjà `TIME_COST` de `../engine/timeCost`) :
```ts
import { DAY_PHASES, minutesUntilNext } from '../engine/clock';
```
3b. Dans le `switch (e.type)` de `applyEffects`, ajouter ce `case` juste avant `case 'endDialogue':` :
```ts
      case 'setTime': {
        // Saut EN AVANT jusqu'à la prochaine occurrence de la phase/heure visée (le temps ne recule jamais).
        const target = 'phase' in e
          ? (DAY_PHASES.find((p) => p.key === e.phase)?.start ?? 0)
          : e.hour * 60 + (e.minute ?? 0);
        get().advanceTime(minutesUntilNext(get().gameTime, target));
        break;
      }
```

- [ ] **Step 4 : Lancer → passent** : `npx vitest run src/state/store.test.ts -t "setTime"` ; `npm run typecheck`.

- [ ] **Step 5 : Commit** — les deux fichiers sont **chauds** → commit isolé (marqueur : `setTime`/`minutesUntilNext`).
```bash
# combatFlow.ts + store.test.ts : commit isolé -m "feat(temps): Effet setTime (saut en avant a une phase/heure) (#T1c)"
```

---

## Task 5 : `IsoStage` — rendu sombre piloté par l'horloge

**Files:** Modify `src/gameIso/IsoStage.tsx` (**CHAUD**).

- [ ] **Step 1 : Implémenter** (relire l'ancre — pas de test unitaire de rendu ; couvert par la recette navigateur + le typecheck) :

1a. Ajouter l'import :
```ts
import { sceneIsDark } from '../state/sceneRules';
```
1b. Ajouter le sélecteur `gameTime` près des autres lectures du store (avec `scene`/`mode`/`battle`) :
```ts
  const gameTime = useGame((s) => s.gameTime);
```
1c. Remplacer la ligne 291 `const night = scene.ambiance === 'nuit';` par :
```ts
  const night = sceneIsDark(scene, gameTime); // jour/nuit = horloge (#T1c)
```

- [ ] **Step 2 : Typecheck** : `npm run typecheck` (0 erreur).

- [ ] **Step 3 : Commit** — fichier **chaud** → commit isolé (marqueur : `sceneIsDark`/`gameTime`).
```bash
# IsoStage.tsx : commit isolé -m "feat(temps): rendu sombre des exterieurs pilote par l'horloge (#T1c)"
```

---

## Task 6 : HUD — jour de la semaine + phase + heure

**Files:** Modify `src/ui/CampaignView.tsx` (à moi, commit direct).

- [ ] **Step 1 : Implémenter** :

1a. Remplacer l'import `formatImperial` par :
```ts
import { formatImperial, toDate, dayPhase } from '../engine/clock';
```
1b. Dans le corps de `CampaignView` (après `const gameTime = useGame((s) => s.gameTime);`), dériver l'affichage :
```ts
  const clockDate = toDate(gameTime);
  const phase = dayPhase(gameTime);
```
1c. Remplacer le bloc `.game-clock` actuel (`🕓 {formatImperial(gameTime)}`) par :
```tsx
        <div className="game-clock" title={`${phase.label} — Calendrier Impérial`}>
          {phase.icon} {clockDate.weekday ? `${clockDate.weekday} · ` : ''}{formatImperial(gameTime)}
        </div>
```
(jour de semaine omis sur un jour intercalaire — `weekday === null`.)

- [ ] **Step 2 : Typecheck + commit**
```bash
npm run typecheck
git commit -- src/ui/CampaignView.tsx -m "feat(temps): HUD jour de la semaine + phase du jour + heure (#T1c)"
```

---

## Task 7 : Vérification finale

- [ ] `npm test` + `npm run typecheck` verts ; `golden-combat` intact.
- [ ] **Recette navigateur** (`localhost:5173`, scénario de test extérieur) :
  - HUD affiche « 🌅 Konistag · 33 Jahrdrung 2512 CI · 06:30 » (ou la phase correspondant à l'heure).
  - Un trigger/Effet `setTime { phase:'nuit' }` (data) → l'horloge saute à la nuit, la scène s'assombrit, et un tir subit −20 (modale d'attaque : « Obscurité »).
  - Une scène `ambiance:'interieur'` reste éclairée même de nuit.

---

## Suite / hors périmètre

- **Exposition éditeur (plan séparé, à écrire ensuite)** : contrôle `ambiance` → Intérieur/Extérieur (`Editor.tsx` ~l.710 ; le rendu bâtiment de l'éditeur l.834 `scene.ambiance==='nuit'` → `false`, l'aperçu nuit deviendra un futur curseur d'heure) ; Effet `setTime` dans le constructeur d'Effets (`EffectList.tsx`, sélecteur de phase + heure). Le cœur (ce plan) est jouable sans : `setTime` fonctionne déjà en data (scènes en code/JSON).
- **Durée du jour variable selon la saison** (le calendrier a les solstices/équinoxes) — futur.
- **Sources de lumière locales** (torche/lanterne annulant l'obscurité) — futur.

## Self-review

- **Couverture spec** : phases+isNight+minutesUntilNext (T1) ; ambiance resserré + normalize + setTime type (T2) ; sceneIsDark + combat câblé + 3 appelants (T3) ; handler setTime (T4) ; rendu (T5) ; HUD weekday+phase (T6) ; vérif (T7). Éditeur = plan suivant (séquencé après, validé). ✓
- **Pas de placeholder** : code complet à chaque step (DAY_PHASES, isNight, dayPhase, minutesUntilNext, normalizeAmbiance, isIndoor, sceneIsDark, case setTime, HUD), ~20 assertions, sites exacts (combatFlow:333, store:1871/1885, IsoStage:291). ✓
- **Cohérence types** : `DayPhaseKey` (clock) réutilisé par l'Effet `setTime` (scene) et le handler (combatFlow) ; `sceneCombatModifiers(scene, gameTime)` aligné sur ses 3 appelants + tests ; `dayPhase().isNight` ⇔ `isNight()`. ✓
- **RAW** : obscurité −20 = LDB 14 l.107 (déjà câblé, suit l'horloge) ; heures de phase = paramétrables (canon muet). ✓
- **Pièges** : 4 fichiers chauds → relire + commits isolés (marqueurs listés) ; le champ `ambiance` garde les valeurs legacy pour ne PAS casser les scènes existantes (zéro migration) ; `golden-combat` pur n'est pas concerné par le changement de signature.
