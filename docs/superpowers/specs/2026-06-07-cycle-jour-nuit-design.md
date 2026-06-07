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
- **7 phases d'affichage** (riches, équilibrées sur le jour — pas seulement le soir/nuit) : `aube`, `matin`, `midi`, `apresmidi`, `crepuscule`, `soir`, `nuit`. **Affichage DÉCOUPLÉ de la mécanique** : la granularité des phases n'alourdit pas le combat.
- **Obscurité = seuil binaire séparé et paramétrable** (`isNight`), indépendant du nombre de phases. Défaut : obscurité = phase `nuit` (22:00–05:00). RAW : seule la nuit donne −20 (LDB 14 l.107) ; aube/matin/midi/après-midi/crépuscule/soir = clair.
- **Seuils des phases paramétrables** (canon muet sur l'heure exacte du lever/coucher — règle projet « si canon muet, paramétrer ») ; défauts contigus sur 24 h : aube 05–08 · matin 08–11 · midi 11–14 · après-midi 14–18 · crépuscule 18–20 · soir 20–22 · **nuit 22–05**.
- **Durée du jour fixe** (pas de variation saisonnière) — noté hors périmètre (le calendrier a déjà les solstices/équinoxes si on l'ajoute un jour).
- **Éditeur** inclus mais **séquencé après** le cœur (combat/rendu/HUD).

## Architecture & composants

Découpage respectant la discipline du repo (moteur pur → état → rendu/UI) :

### 1. `src/engine/clock.ts` — phases pures (paramétrable, testé)
Ajouts purs, sans état :
```ts
export type DayPhaseKey = 'aube' | 'matin' | 'midi' | 'apresmidi' | 'crepuscule' | 'soir' | 'nuit';
export interface DayPhase { key: DayPhaseKey; label: string; icon: string; isNight: boolean; }
// Table ordonnée des phases : début (minutes-de-jour) + libellé FR + icône. 'nuit' enjambe minuit.
export const DAY_PHASES: { key: DayPhaseKey; start: number; label: string; icon: string }[] = [
  { key: 'aube',       start:  5*60, label: 'Aube',        icon: '🌅' },
  { key: 'matin',      start:  8*60, label: 'Matin',       icon: '🌄' },
  { key: 'midi',       start: 11*60, label: 'Midi',        icon: '☀️' },
  { key: 'apresmidi',  start: 14*60, label: 'Après-midi',  icon: '🌤️' },
  { key: 'crepuscule', start: 18*60, label: 'Crépuscule',  icon: '🌇' },
  { key: 'soir',       start: 20*60, label: 'Soir',        icon: '🌆' },
  { key: 'nuit',       start: 22*60, label: 'Nuit',        icon: '🌙' }, // jusqu'à 05:00 (enjambe minuit)
];
// Fenêtre d'OBSCURITÉ mécanique, paramétrable et DÉCOUPLÉE des phases d'affichage [début,fin) en minutes-de-jour.
export const NIGHT_WINDOW = { start: 22*60, end: 5*60 } as const; // 22:00 → 05:00
export function dayPhase(minutes: number): DayPhase; // phase d'affichage depuis l'heure du jour
export function isNight(minutes: number): boolean;    // obscurité : heure du jour ∈ NIGHT_WINDOW (enjambe minuit)
```
- `dayPhase` = affichage (7 phases) ; `isNight` = **unique seuil mécanique** (obscurité), basé sur `NIGHT_WINDOW`, réglable sans toucher les phases.
- `DayPhase.isNight` (champ) = `isNight(minutes)` (commodité d'affichage : icône nuit ⇔ obscurité).

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

- `clock.test.ts` : `dayPhase` aux 7 frontières (04:59→nuit, 05:00→aube, 08:00→matin, 11:00→midi, 14:00→après-midi, 18:00→crépuscule, 20:00→soir, 22:00→nuit) ; `isNight` découplé (22:00–04:59 vrai ; 05:00–21:59 faux ; enjambe minuit) ; `minutesUntilNext` (cible plus tard aujourd'hui ; cible déjà passée → demain ; cible == maintenant → 0).
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
- **Cohérence** : une seule dérivation `sceneIsDark` partagée combat/rendu ; `ambiance` resserré + normalisation rétro-compat (zéro casse données) ; `isNight` (via `NIGHT_WINDOW` paramétrable) = seul seuil mécanique, **découplé** des 7 phases d'affichage.
- **Discipline repo** : `clock.ts` pur (phases), `sceneRules`/`store` en état, `IsoStage`/éditeur en rendu/UI. Le moteur ne dépend pas du store.
- **RAW** : obscurité −20 = LDB 14 l.107 (déjà en place) ; heures de phase = paramétrables (canon muet, assumé).
- **Risque** : changement de signature `sceneCombatModifiers` (threader `gameTime`) — circonscrit, couvert par ses tests + golden-combat ; `IsoStage` est un fichier chaud (relire avant edit).
