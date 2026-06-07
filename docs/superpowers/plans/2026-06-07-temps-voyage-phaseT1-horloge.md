# Phase #T1 — Horloge & Calendrier impérial — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Étapes en `- [ ]`.
> ⚠️ Fichiers chauds (`store.ts`, `combatFlow.ts` édités par d'autres sessions //) → relire avant chaque edit ; committer **uniquement** mes fichiers via `git commit -- <chemins>`, vérifier le diff.

**Goal:** Une **horloge in-game** (calendrier impérial WFRP4 + heures) qui avance à **chaque action** (« tout est horodaté »), affichée dans le HUD. Fondation de Temps & Voyage (#T2/#T3 la consommeront).

**Architecture:** Module **pur** `src/engine/clock.ts` (calendrier impérial figé + conversions `minutes ↔ date` + `formatImperial`). État store `gameTime` (minutes depuis l'**époque** = Hexenstag 2512 CI 00:00) + action `advanceTime(min)`. Table pure `TIME_COST` (RAW où cité, paramétrable sinon). Les points d'action **existants** appellent `advanceTime`. HUD affiche la date+heure.

**Tech Stack:** TypeScript pur, Zustand, Vitest.

---

## Données canon vérifiées (workflow adversarial 2026-06-07 — 2 extractions FR concordantes + croisement VO)

**Source primaire** : `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/12 - Annexe 3 - Documents et aides de jeux.md` (l.16-178). Croisements : ADE2 « Des signes dans le ciel », Middenheim, Le Pouvoir Derrière le Trône (carnaval), EiS VO Handouts.

- **12 mois** (ordre = confiance très haute) + jours (grilles OCR, confiance moyenne) :
  `Nachhexen 32 · Jahrdrung 33 · Pflugzeit 33 · Sigmarzeit 33 · Sommerzeit 33 · Vorgeheim 33 · Nachgeheim 33 · Erntezeit 33 · Brauzeit 33 · Kaldezeit 33 · Ulriczeit 33 · Vorhexen 33` (somme = 395).
- **6 jours intercalaires** (1 jour chacun, entre 2 mois) : `Hexenstag` (avant Nachhexen, Nouvel An, 2 lunes pleines) · `Mitterfrühl` (avant Pflugzeit, équinoxe printemps) · `Sonnstill` (avant Vorgeheim, solstice été) · `Geheimnistag` (avant Nachgeheim, 2 lunes pleines) · `Mittherbst` (avant Brauzeit, équinoxe automne) · `Mondstille` (avant Kaldezeit, solstice hiver).
- **8 jours de la semaine** : `Wellentag · Aubentag · Marktag · Backertag · Bezahltag · Konistag · Angestag · Festag`.
- **⚠️ Incohérence canon** : la prose (EiS Annexe 3 l.20+34, VO l.21+23) affirme **« année = 400 jours, 12 mois + 6 intercalaires »**, mais les grilles donnent 395 j de mois (32/33). Le canon **n'imprime aucune table mois→jours propre**. → le moteur prend les valeurs de grille (table auto-cohérente : 395 + 6 = **401 j/an**) et **documente l'écart** (ajustable si l'utilisateur fournit la valeur exacte du PDF).
- **Date de départ campagne** : **fin Jahrdrung** (confirmé FR `01 - Chapitre 1` l.11 « à la fin du mois de Jahrdrung » + EN). Jour exact non donné → **dernier jour de Jahrdrung**. Année **non datée** dans le Vol 1 → **2512 CI** (défaut WFRP4, documenté). Heure de départ : **08:00** (assumé).

---

## Task 1 : `clock.ts` — calendrier impérial pur + conversions

**Files:** Create `src/engine/clock.ts` ; Create `src/engine/clock.test.ts`.

- [ ] **Step 1 : Tests qui échouent**

```ts
import { describe, it, expect } from 'vitest';
import { IMPERIAL_MONTHS, INTERCALARY, WEEKDAYS, DAYS_PER_YEAR, MINUTES_PER_DAY, toDate, fromDate, formatImperial, CAMPAIGN_START } from './clock';

describe('clock — calendrier impérial', () => {
  it('a 12 mois, 6 intercalaires, 8 jours de semaine ; année auto-cohérente', () => {
    expect(IMPERIAL_MONTHS).toHaveLength(12);
    expect(IMPERIAL_MONTHS[0]).toEqual({ name: 'Nachhexen', days: 32 });
    expect(INTERCALARY).toHaveLength(6);
    expect(WEEKDAYS).toHaveLength(8);
    expect(DAYS_PER_YEAR).toBe(IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0) + INTERCALARY.length); // 395 + 6 = 401
  });

  it('toDate/fromDate font un aller-retour (époque = Hexenstag 2512 00:00)', () => {
    for (const min of [0, 1440, 33 * 1440, 401 * 1440, 401 * 1440 + 17 * 60 + 30]) {
      expect(fromDate(toDate(min))).toBe(min);
    }
  });

  it('minute 0 = Hexenstag 2512 (jour intercalaire de Nouvel An)', () => {
    const d = toDate(0);
    expect(d.year).toBe(2512);
    expect(d.intercalary).toBe('Hexenstag');
    expect(d.month).toBeNull();
  });

  it('le 1er jour après Hexenstag = 1 Nachhexen 2512, 00:00', () => {
    const d = toDate(1 * MINUTES_PER_DAY);
    expect(d).toMatchObject({ year: 2512, monthName: 'Nachhexen', day: 1, hour: 0, minute: 0, intercalary: null });
  });

  it('franchit l’intercalaire Mitterfrühl entre Jahrdrung et Pflugzeit', () => {
    // Hexenstag(1) + Nachhexen(32) + Jahrdrung(33) = 66 jours → jour 66 = Mitterfrühl
    const d = toDate(66 * MINUTES_PER_DAY);
    expect(d.intercalary).toBe('Mitterfrühl');
  });

  it('formatImperial affiche date + heure françaises', () => {
    const min = (1 + 32 + 30) * MINUTES_PER_DAY + 14 * 60 + 30; // 30 Jahrdrung 2512, 14:30
    expect(formatImperial(min)).toMatch(/30 Jahrdrung 2512 CI · 14:30/);
  });

  it('CAMPAIGN_START = fin Jahrdrung 2512 08:00', () => {
    const d = toDate(CAMPAIGN_START);
    expect(d).toMatchObject({ year: 2512, monthName: 'Jahrdrung', day: 33, hour: 8, minute: 0 });
  });
});
```

- [ ] **Step 2 : Lancer → échoue** (`npx vitest run src/engine/clock.test.ts` → module absent).

- [ ] **Step 3 : Implémenter `clock.ts`**

```ts
/**
 * Calendrier impérial WFRP4 (CI) — pur, sans état. Données vérifiées depuis la source FR
 * (EiS « L'ennemi dans l'Ombre » Annexe 3, croisées ADE2/Middenheim/VO ; cf. plan #T1).
 *
 * ⚠️ Le canon affirme « année = 400 jours, 12 mois + 6 intercalaires » (Annexe 3 l.20/34) mais
 * n'imprime AUCUNE table mois→jours propre ; les grilles OCR donnent 32/33 j (somme 395). On
 * adopte une table AUTO-COHÉRENTE (395 + 6 = 401 j/an) ; ajuster `IMPERIAL_MONTHS` si la valeur
 * exacte du PDF est confirmée. Aucune valeur inventée hors de cette table sourcée.
 */
export interface ImperialMonth { name: string; days: number; }

/** 12 mois, dans l'ordre (confiance très haute : 3 sources concordantes). */
export const IMPERIAL_MONTHS: ImperialMonth[] = [
  { name: 'Nachhexen', days: 32 }, { name: 'Jahrdrung', days: 33 }, { name: 'Pflugzeit', days: 33 },
  { name: 'Sigmarzeit', days: 33 }, { name: 'Sommerzeit', days: 33 }, { name: 'Vorgeheim', days: 33 },
  { name: 'Nachgeheim', days: 33 }, { name: 'Erntezeit', days: 33 }, { name: 'Brauzeit', days: 33 },
  { name: 'Kaldezeit', days: 33 }, { name: 'Ulriczeit', days: 33 }, { name: 'Vorhexen', days: 33 },
];

/** 6 jours intercalaires (1 jour chacun). `afterMonth` = index (0-based) du mois APRÈS lequel il tombe ;
 *  -1 = avant le 1er mois (Hexenstag, Nouvel An). */
export const INTERCALARY: { name: string; afterMonth: number }[] = [
  { name: 'Hexenstag', afterMonth: -1 },   // avant Nachhexen (Nouvel An, 2 lunes pleines)
  { name: 'Mitterfrühl', afterMonth: 1 },  // après Jahrdrung (équinoxe printemps)
  { name: 'Sonnstill', afterMonth: 4 },    // après Sommerzeit (solstice été)
  { name: 'Geheimnistag', afterMonth: 5 }, // après Vorgeheim (2 lunes pleines)
  { name: 'Mittherbst', afterMonth: 7 },   // après Erntezeit (équinoxe automne)
  { name: 'Mondstille', afterMonth: 8 },   // après Brauzeit (solstice hiver)
];

export const WEEKDAYS = ['Wellentag', 'Aubentag', 'Marktag', 'Backertag', 'Bezahltag', 'Konistag', 'Angestag', 'Festag'] as const;

export const MINUTES_PER_DAY = 24 * 60;
export const EPOCH_YEAR = 2512; // minute 0 = Hexenstag 2512 00:00

/** Séquence ordonnée des « slots de jour » d'une année (intercalaires intercalés entre les mois). */
const YEAR_SLOTS: ({ intercalary: string } | { monthIndex: number; day: number })[] = (() => {
  const slots: ({ intercalary: string } | { monthIndex: number; day: number })[] = [];
  const inter = (after: number) => INTERCALARY.filter((i) => i.afterMonth === after);
  for (const i of inter(-1)) slots.push({ intercalary: i.name }); // Hexenstag avant le mois 0
  for (let m = 0; m < IMPERIAL_MONTHS.length; m++) {
    for (let d = 1; d <= IMPERIAL_MONTHS[m].days; d++) slots.push({ monthIndex: m, day: d });
    for (const i of inter(m)) slots.push({ intercalary: i.name });
  }
  return slots;
})();

export const DAYS_PER_YEAR = YEAR_SLOTS.length; // 395 + 6 = 401

export interface ImperialDate {
  year: number;
  /** Index 0-based du mois, ou null si jour intercalaire. */
  month: number | null;
  monthName: string | null;
  /** Jour dans le mois (1-based), ou null si intercalaire. */
  day: number | null;
  /** Nom du jour intercalaire, ou null si jour de mois. */
  intercalary: string | null;
  /** Jour de la semaine (nom). */
  weekday: string;
  hour: number;
  minute: number;
}

/** Minutes depuis l'époque → date impériale. */
export function toDate(minutes: number): ImperialDate {
  const totalDays = Math.floor(minutes / MINUTES_PER_DAY);
  const minOfDay = minutes - totalDays * MINUTES_PER_DAY;
  const year = EPOCH_YEAR + Math.floor(totalDays / DAYS_PER_YEAR);
  const dayOfYear = ((totalDays % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const slot = YEAR_SLOTS[dayOfYear];
  const weekday = WEEKDAYS[((totalDays % WEEKDAYS.length) + WEEKDAYS.length) % WEEKDAYS.length];
  const base = { year, weekday, hour: Math.floor(minOfDay / 60), minute: minOfDay % 60 };
  return 'intercalary' in slot
    ? { ...base, month: null, monthName: null, day: null, intercalary: slot.intercalary }
    : { ...base, month: slot.monthIndex, monthName: IMPERIAL_MONTHS[slot.monthIndex].name, day: slot.day, intercalary: null };
}

/** Date impériale → minutes depuis l'époque (inverse de toDate). */
export function fromDate(d: ImperialDate): number {
  const dayOfYear = YEAR_SLOTS.findIndex((s) =>
    d.intercalary != null ? 'intercalary' in s && s.intercalary === d.intercalary
      : 'monthIndex' in s && s.monthIndex === d.month && s.day === d.day,
  );
  const totalDays = (d.year - EPOCH_YEAR) * DAYS_PER_YEAR + dayOfYear;
  return totalDays * MINUTES_PER_DAY + d.hour * 60 + d.minute;
}

/** « 30 Jahrdrung 2512 CI · 14:30 » ou « Hexenstag 2512 CI · 08:00 » (intercalaire). */
export function formatImperial(minutes: number): string {
  const d = toDate(minutes);
  const hhmm = `${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
  const datePart = d.intercalary ? `${d.intercalary} ${d.year} CI` : `${d.day} ${d.monthName} ${d.year} CI`;
  return `${datePart} · ${hhmm}`;
}

/** Début de la campagne (EiS) : dernier jour de Jahrdrung 2512, 08:00 (« fin Jahrdrung », année défaut WFRP4). */
export const CAMPAIGN_START = fromDate({
  year: 2512, month: 1, monthName: 'Jahrdrung', day: IMPERIAL_MONTHS[1].days,
  intercalary: null, weekday: WEEKDAYS[0], hour: 8, minute: 0,
});
```

- [ ] **Step 4 : Lancer → passent** (`npx vitest run src/engine/clock.test.ts`). Corriger jusqu'au vert (attention au `weekday` dans `fromDate` : il n'est pas utilisé pour la conversion inverse, seuls year/month/day/intercalary/hour/minute comptent — OK).

- [ ] **Step 5 : Typecheck + commit**

```bash
npm run typecheck
git commit -- src/engine/clock.ts src/engine/clock.test.ts -m "feat(temps): calendrier imperial pur + conversions (Phase T1)"
```

---

## Task 2 : État store `gameTime` + action `advanceTime`

**Files:** Modify `src/state/store.ts` ; Test `src/state/store.test.ts`.

- [ ] **Step 1 : Test qui échoue**

```ts
import { CAMPAIGN_START, MINUTES_PER_DAY } from '../engine/clock';

it('advanceTime fait avancer gameTime (depuis le départ de campagne)', () => {
  useGame.setState({ gameTime: CAMPAIGN_START });
  useGame.getState().advanceTime(90); // +1h30
  expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + 90);
  useGame.getState().advanceTime(MINUTES_PER_DAY); // +1 jour
  expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + 90 + MINUTES_PER_DAY);
});
```

- [ ] **Step 2 : Lancer → échoue** (`gameTime`/`advanceTime` absents).

- [ ] **Step 3 : Implémenter** (`store.ts`)
  - Import : `import { CAMPAIGN_START } from '../engine/clock';`
  - Interface `GameState` : ajouter `gameTime: number;` et `advanceTime: (minutes: number) => void;`
  - Init du store : `gameTime: CAMPAIGN_START,`
  - Action (près de `log`) :
```ts
  advanceTime: (minutes) => {
    if (minutes <= 0) return;
    set({ gameTime: get().gameTime + minutes });
    bus.emit(EVT.TIME_ADVANCED, { minutes }); // #T3 (cascade) branchera ses déclencheurs sur les franchissements
  },
```
  - Dans `src/state/bus.ts` : ajouter `TIME_ADVANCED: 'time:advanced'` à `EVT`.

- [ ] **Step 4 : Lancer → passe ; typecheck → 0 ; commit**

```bash
git commit -- src/state/store.ts src/state/bus.ts src/state/store.test.ts -m "feat(temps): etat gameTime + action advanceTime + event TIME_ADVANCED (Phase T1)"
```

---

## Task 3 : Table `TIME_COST` + branchement « tout est horodaté »

**Files:** Create `src/engine/timeCost.ts` ; Create `src/engine/timeCost.test.ts` ; Modify `src/state/store.ts` + `src/state/combatFlow.ts` (points d'action).

- [ ] **Step 1 : Test (table pure)**

```ts
import { TIME_COST } from './timeCost';
it('expose des coûts-temps positifs par catégorie d’action', () => {
  expect(TIME_COST.combatRound).toBeGreaterThan(0);
  expect(TIME_COST.sceneMovePerTile).toBeGreaterThanOrEqual(0);
  expect(TIME_COST.search).toBeGreaterThan(0);
  expect(TIME_COST.dialogue).toBeGreaterThanOrEqual(0);
  expect(TIME_COST.sceneTransition).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2 : Lancer → échoue ; Step 3 : Implémenter `timeCost.ts`**

```ts
/**
 * Coûts-temps des actions (« tout est horodaté », Phase T1). En MINUTES.
 * RAW où cité ; à l'échelle d'une scène/d'un round, le canon est muet → valeurs PARAMÉTRABLES
 * (ne rien inventer comme « règle »). Voyage/repos/activités = #T2/#T3 (non ici).
 */
export const TIME_COST = {
  combatRound: 1,      // un Round WFRP ≈ quelques secondes → arrondi à 1 min/Round (paramétrable)
  sceneMovePerTile: 0, // déplacement intra-scène : négligeable (paramétrable)
  search: 10,          // fouiller un corps/coffre ≈ 10 min (paramétrable)
  dialogue: 5,         // une conversation ≈ 5 min (paramétrable)
  sceneTransition: 0,  // franchir une porte/zone (intérieur) ≈ 0 (paramétrable)
} as const;
```

- [ ] **Step 4 : Brancher aux points d'action existants** (relire chaque site — fichiers chauds) :
  - **Fin de combat / résolution** : à la fin d'un combat (ou à chaque `advanceTurn` de Round complet), appeler `get().advanceTime(TIME_COST.combatRound)`. *Choix : 1 fois par Round franchi* (dans `advanceTurn`, au passage de Round). Lire le site exact.
  - **Fouille** (`search` d'une entité) : dans l'action qui applique `SceneEntity.search`, `advanceTime(TIME_COST.search)`.
  - **Dialogue** : à la clôture d'un dialogue (`endDialogue`), `advanceTime(TIME_COST.dialogue)`.
  - **Transition** : dans `transitionTo`, `advanceTime(TIME_COST.sceneTransition)` (0 par défaut → sans effet, mais le point d'appel existe pour le futur extérieur/voyage #T2).
  - **Déplacement de scène** : si `sceneMovePerTile > 0`, à chaque pas de déplacement hors combat. (0 par défaut → pas de branchement nécessaire tant que = 0 ; documenter le point.)

  Pour chaque branchement : test ciblé (ex. « après une fouille, gameTime a avancé de TIME_COST.search »).

- [ ] **Step 5 : Tests des branchements + suite complète + typecheck + commit**

```bash
npm test
git commit -- src/engine/timeCost.ts src/engine/timeCost.test.ts src/state/store.ts src/state/combatFlow.ts src/state/store.test.ts -m "feat(temps): table TIME_COST + horodatage des actions existantes (Phase T1)"
```

---

## Task 4 : Affichage HUD (date + heure)

**Files:** Modify `src/ui/CampaignView.tsx` (près de la Bourse).

- [ ] **Step 1 : Ajouter l'affichage**
  - Sélecteur : `const gameTime = useGame((s) => s.gameTime);`
  - Import : `import { formatImperial } from '../engine/clock';`
  - Rendu (à côté de la Bourse, dans `hud-left`) :
```tsx
        <div className="game-clock" title="Date et heure (Calendrier Impérial)">
          🕓 {formatImperial(gameTime)}
        </div>
```

- [ ] **Step 2 : Typecheck (0) ; l'éditeur/jeu charge sans erreur ; commit**

```bash
git commit -- src/ui/CampaignView.tsx -m "feat(temps): affichage horloge imperiale dans le HUD (Phase T1)"
```

---

## Task 5 : Vérification finale

- [ ] `npm test` + `npm run typecheck` verts ; `golden-combat` intact (T1 ne touche pas la résolution de combat, seulement un `advanceTime` au franchissement de Round).
- [ ] Recette légère (optionnelle) : lancer le jeu, vérifier que le HUD affiche « … Jahrdrung 2512 CI · 08:00 » au départ et que l'heure avance après un combat / une fouille / un dialogue.

---

## Fin — différé / hors périmètre

- **#T2 Voyage** : graphe de lieux + distances + coût-temps (vitesse = Mouvement, RAW Déplacement) + rencontres + repos. Consommera `advanceTime`.
- **#T3 Cascade RAW** : `EVT.TIME_ADVANCED` branchera guérison (LDB 18), Fatigue/Exténué (`travelFatigue`), maladies (LDB 20), Corruption, **re-stock marchand**.
- **Marchand v1** : parqué (annexe de la spec), conçu time-ready.
- **Calendrier** : si l'utilisateur confirme une table mois→jours exacte (sommant à 400) depuis le PDF physique, ajuster `IMPERIAL_MONTHS` (le moteur reste auto-cohérent).

## Self-review

- **Couverture spec #T1** : horloge+calendrier (T1), état+advanceTime+event (T2), TIME_COST+« tout horodaté » (T3), HUD (T4), vérif (T5). ✓ Données calendrier **vérifiées+citées** (pas inventées) ; écart canon 400/401 **documenté**, pas masqué.
- **Pas de placeholder** : clock.ts complet (constantes sourcées + conversions + format), table TIME_COST, branchements listés avec sites, ~10 assertions. ✓
- **Cohérence types** : `toDate→ImperialDate→fromDate` (round-trip) ; `CAMPAIGN_START` via `fromDate` ; `advanceTime(min)` → `gameTime` → `formatImperial`. ✓
- **Pièges** : `fromDate` ignore `weekday` (dérivé) ; `advanceTime` no-op si ≤0 ; T3 = fichiers chauds → relire chaque site + commits ciblés ; « tout est horodaté » est une **invariante** (toute action future déclare son coût). ✓
- **Risque** : la valeur exacte jours/mois est OCR-incertaine (confiance moyenne) — isolée dans `IMPERIAL_MONTHS`, ajustable sans toucher la logique.
