# Cycle jour/nuit piloté par l'horloge — Design (#T1c)

**Sous-projet** : Temps & Voyage (#T). Prérequis livré : #T1 Horloge (`src/engine/clock.ts`, `gameTime`, `advanceTime`, HUD). Spec parente : `2026-06-07-temps-voyage-design.md`.

## Goal

Le **jour/nuit dérive de l'heure** (`gameTime`), plus d'une donnée figée par scène. L'heure pilote :
1. l'**affichage** (HUD : jour de la semaine + date + phase + heure),
2. le **rendu** (scène extérieure assombrie la nuit),
3. le **combat** (obscurité de nuit = **−20 au tir sur cible dissimulée**, RAW LDB 14 l.107 — déjà câblé sur `ambiance==='nuit'`, désormais piloté par l'horloge).

Pour scénariser une scène de nuit, l'auteur **avance l'heure** via un Effet `setTime` (trigger), au lieu de taguer la scène.

## Décisions (validées en brainstorming 2026-06-07)

- **Source unique = l'horloge.** Aucune scène ne porte plus de jour/nuit. `ambiance` se réduit à `'interieur' | 'exterieur'`. Les valeurs héritées `'jour' | 'nuit' | 'foret'` sont **normalisées `'exterieur'`** à la lecture (rétro-compat, zéro migration de données). `'foret'` était vestigial (aucun effet en code) → supprimé du modèle.
- **`'interieur'`** = éclairé en permanence, l'horloge ne l'assombrit pas. **`'exterieur'`** = jour/nuit = horloge.
- **4 phases** d'affichage : `aube`, `jour`, `crepuscule`, `nuit`. **Mécanique binaire** : seule la phase `nuit` déclenche l'obscurité de combat ; aube/jour/crépuscule = clair.
- **Seuils paramétrables** (canon muet sur l'heure exacte du lever/coucher — règle projet « si canon muet, paramétrer ») ; défauts : aube 05:00–07:00 · jour 07:00–19:00 · crépuscule 19:00–21:00 · **nuit 21:00–05:00**.
- **Durée du jour fixe** (pas de variation saisonnière) — noté hors périmètre (le calendrier a déjà les solstices/équinoxes si on l'ajoute un jour).
- **Éditeur** inclus mais **séquencé après** le cœur (combat/rendu/HUD).

## Architecture & composants

Découpage respectant la discipline du repo (moteur pur → état → rendu/UI) :

### 1. `src/engine/clock.ts` — phases pures (paramétrable, testé)
Ajouts purs, sans état :
```ts
export type DayPhaseKey = 'aube' | 'jour' | 'crepuscule' | 'nuit';
export interface DayPhase { key: DayPhaseKey; label: string; icon: string; isNight: boolean; }
// Seuils en minutes-de-jour [début,fin), paramétrables. La phase 'nuit' enjambe minuit.
export const DAY_PHASE_BOUNDS = { aube: 5*60, jour: 7*60, crepuscule: 19*60, nuit: 21*60 } as const;
export function dayPhase(minutes: number): DayPhase; // dérive de l'heure du jour (minutes % MINUTES_PER_DAY)
export function isNight(minutes: number): boolean;    // === dayPhase(minutes).key === 'nuit'
```
- `label`/`icon` FR : Aube 🌅 · Jour ☀️ · Crépuscule 🌇 · Nuit 🌙.
- `isNight` est l'unique seuil mécanique (obscurité).

### 2. `src/state/scene.ts` — schéma
- `ambiance?: 'interieur' | 'exterieur'` (type resserré). 
- `normalizeAmbiance(a): 'interieur' | 'exterieur'` : `'interieur'→'interieur'` ; tout le reste (y compris legacy `'jour'/'nuit'/'foret'`/undefined) → `'exterieur'`. Défaut extérieur.
- `isIndoor(scene): boolean` = `normalizeAmbiance(scene.ambiance) === 'interieur'`.
- **Effet `setTime`** ajouté à l'union `Effect` :
  ```ts
  | { type: 'setTime'; phase: DayPhaseKey }            // « passe à la nuit/aube/… »
  | { type: 'setTime'; hour: number; minute?: number } // heure précise
  ```

### 3. `src/state/sceneRules.ts` — pont scène × horloge
- `sceneIsDark(scene, gameTime): boolean = !isIndoor(scene) && isNight(gameTime)`. Unique dérivation, importée par le combat ET le rendu.
- `sceneCombatModifiers(scene, gameTime)` : remplace `scene.ambiance === 'nuit'` par `sceneIsDark(scene, gameTime)`. **Signature change** (ajoute `gameTime`) → threader depuis les appelants (`store`/`combatFlow` lors du calcul de difficulté de tir). `golden-combat` (moteur pur `resolveMelee`) **non concerné**.

### 4. `src/gameIso/IsoStage.tsx` — rendu
- `const night = sceneIsDark(scene, gameTime)` (au lieu de `scene.ambiance === 'nuit'`), `gameTime` lu du store. Idem ligne ~834 (bâtiments).

### 5. `src/state/store.ts` — Effet `setTime` (dans `applyEffects`)
- Sémantique **monotone** (le temps ne recule jamais) : saut **en avant** jusqu'à la prochaine occurrence de la phase (son heure de début) ou de l'heure visée. Déjà dans la phase / à l'heure visée → no-op. Implémenté via `advanceTime(delta)` (réutilise l'émission `TIME_ADVANCED`).
- Helper pur `minutesUntilNext(gameTime, targetMinuteOfDay): number` (dans `clock.ts`, testé) pour le calcul du delta.

### 6. HUD — `src/ui/CampaignView.tsx`
- Affiche `{weekday} · {date} · {icon} {hh:mm}`. `weekday` omis sur un jour intercalaire (`weekday === null`). Icône = `dayPhase(gameTime).icon`. Réutilise `formatImperial` pour la partie date+heure, compose weekday + icône autour.

### 7. Éditeur (séquencé après le cœur)
- Contrôle `ambiance` : 2 options **Intérieur / Extérieur** (au lieu de 4). Chargement d'une scène legacy `'jour'/'nuit'/'foret'` → affiché « Extérieur » (via `normalizeAmbiance`).
- `setTime` ajouté au constructeur d'Effets (`EffectList`) : sélecteur de phase (aube/jour/crépuscule/nuit) + option heure précise.

## Flux de données

```
gameTime (store) ──► clock.dayPhase / clock.isNight (pur)
                         │
   scene.ambiance ──► sceneRules.sceneIsDark(scene, gameTime)
                         ├──► sceneCombatModifiers ──► −20 tir (obscurité, LDB 14 l.107)
                         └──► IsoStage (rendu sombre)
HUD ◄── dayPhase(gameTime).icon + toDate(gameTime).weekday + formatImperial(gameTime)
Trigger/Effet setTime ──► store.applyEffects ──► advanceTime(delta) ──► gameTime ↑ (TIME_ADVANCED)
```

## Tests

- `clock.test.ts` : `dayPhase` aux frontières (04:59 nuit, 05:00 aube, 06:59 aube, 07:00 jour, 18:59 jour, 19:00 crépuscule, 20:59 crépuscule, 21:00 nuit) ; `isNight` ⇔ phase nuit ; `minutesUntilNext` (cible plus tard aujourd'hui ; cible déjà passée → demain ; cible == maintenant → 0).
- `scene` : `normalizeAmbiance` (interieur conservé ; jour/nuit/foret/undefined → exterieur) ; `isIndoor`.
- `sceneRules` : `sceneIsDark` (intérieur jamais sombre quelle que soit l'heure ; extérieur sombre ⇔ nuit) ; `sceneCombatModifiers` met à jour ses tests existants (passe `gameTime` ; nuit → −20 ; jour → +0).
- `store` : Effet `setTime` (phase nuit depuis 14:00 → gameTime à la prochaine 21:00 ; déjà nuit → no-op ; heure précise) ; monotonie (jamais en arrière).
- Suite complète verte + `golden-combat` intact + typecheck.

## Hors périmètre

- Durée du jour **variable selon la saison** (le calendrier a les repères solstices/équinoxes).
- Sources de lumière locales (torche/lanterne) annulant l'obscurité — futur (#T ou objets).
- Aube/crépuscule comme obscurité **partielle** (mécanique reste binaire).

## Self-review

- **Pas de placeholder** : signatures, seuils, sémantique `setTime`, sites de câblage et ~15 assertions explicités.
- **Cohérence** : une seule dérivation `sceneIsDark` partagée combat/rendu ; `ambiance` resserré + normalisation rétro-compat (zéro casse données) ; `isNight` = seul seuil mécanique, aligné sur la phase `nuit`.
- **Discipline repo** : `clock.ts` pur (phases), `sceneRules`/`store` en état, `IsoStage`/éditeur en rendu/UI. Le moteur ne dépend pas du store.
- **RAW** : obscurité −20 = LDB 14 l.107 (déjà en place) ; heures de phase = paramétrables (canon muet, assumé).
- **Risque** : changement de signature `sceneCombatModifiers` (threader `gameTime`) — circonscrit, couvert par ses tests + golden-combat ; `IsoStage` est un fichier chaud (relire avant edit).
