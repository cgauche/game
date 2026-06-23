/**
 * Hooks de DÉBUT DE TOUR ENNEMI (`turnStart`) enregistrés sur la couture `combatHooks`. Module FEUILLE
 * chargé par effet de bord depuis combatFlow (comme roundHooks/restFlow peuplent leurs registres) : la
 * séquence de début de tour de l'IA (anciennement 4 appels inline en tête de `runEnemyAI`) vit ICI,
 * chaque étape étant un hook ordonné par `order`. N'importe RIEN de combatFlow → pas de cycle (les
 * fonctions déplacées ne dépendent que des modules feuilles `engine/*`, `combatLog`, `combatGeometry`,
 * `lineOfSight`, `battleRng`). combatFlow ré-exporte ces fonctions (baril) pour les tests existants.
 *
 * DÉPENDANCE D'ORDRE RAW (commentée à l'origine dans `runEnemyAI`, encodée ici par `order`) : fin de
 * Frénésie (10) → Rage (20) → tentative de Frénésie IA (30) AVANT la psychologie (40) — la Frénésie
 * rend immunisé au test psy, donc elle doit être résolue d'abord. Le golden `turnStart.golden.test.ts`
 * fige l'ordre + les tirages RNG byte-pour-byte.
 *
 * Ces hooks ne tournent que pour l'ENNEMI actif (`runEnemyAI` est enemy-only) ; les fonctions ont en
 * plus leurs propres gardes `kind`/capacité internes (no-op pour un héros), comportement conservé.
 */
import { registerCombatHook } from '../combatHooks';
import { battleRng } from '../battleRng';
import { ev, evLines } from '../combatLog';
import { effectiveChar } from '../../engine/characteristics';
import { isOutOfAction, addCondition, COND } from '../../engine/conditions';
import { losClear } from '../lineOfSight';
import { smokeOf } from '../combatGeometry';
import { groupMatch } from '../../engine/groups';
import {
  fearSourceFor, sansPeurVs, resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, isFrenzied, isPsychImmune,
  resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple, suppressSupersededPsych, CIBLE_TYPES,
} from '../../engine/psychology';
import { psychologyLabel } from '../../data';
import { isColdBlooded, hasRage } from '../../engine/traits/dispatch';
import { fireTriggers, hasFoeInLoS } from '../triggeredEffects';
import { t } from '../../i18n';
import type { Combatant } from '../../engine/types';
import type { Get, Set as SetFn } from '../flowTypes';

/** Effets « début de tour » authorés du combattant qui DEVIENT actif (`onTurnStart`) — point unique
 *  appelé par `advanceTurn` (tour suivant du Round) ET `confirmRoundStart` (1ᵉʳ combattant du Round),
 *  pour ne pas dupliquer le déclenchement. Inerte tant qu'aucune donnée ne porte un effet `onTurnStart`.
 *  Journalisé en `detail` (kind agnostique — l'IA comme le héros). No-op si hors d'action. */
export function fireTurnStartTriggers(get: Get, set: SetFn, c: Combatant | undefined): void {
  fireTurnEdgeTriggers(get, set, c, 'onTurnStart');
}

/** Effets « fin de tour » authorés du combattant qui CESSE d'être actif (`onTurnEnd`) — appelé par
 *  `advanceTurn` au passage au combattant suivant. Même canal/garde que `onTurnStart`. */
export function fireTurnEndTriggers(get: Get, set: SetFn, c: Combatant | undefined): void {
  fireTurnEdgeTriggers(get, set, c, 'onTurnEnd');
}

/** Point UNIQUE de déclenchement des effets de bord de tour (début/fin) — kind agnostique, journalisé
 *  en `detail`, no-op hors d'action. Inerte tant qu'aucune donnée ne porte l'effet correspondant. */
function fireTurnEdgeTriggers(get: Get, set: SetFn, c: Combatant | undefined, trigger: 'onTurnStart' | 'onTurnEnd'): void {
  if (!c || isOutOfAction(c)) return;
  const battle = get().battle;
  if (!battle) return;
  for (const line of fireTriggers(get, c, trigger, { rng: battleRng(), set })) battle.log.push(ev('detail', line, c.id));
}

// ============================================================================================
// Fonctions de cycle de tour ennemi, déplacées ISO-COMPORTEMENT depuis combatFlow (corps copiés tel
// quel). combatFlow les ré-exporte via le baril pour ses importeurs/tests (frenzy.test, frenzy-ia.test,
// psych-ia.test, psych-cible.test). Elles journalisent ELLES-MÊMES (kinds `frenzy`/`fear` via `ev`) —
// le `sink` du ctx n'est pas requis ici (contrairement à roundHooks).
// ============================================================================================

/** L'IA tente d'entrer en Frénésie au début de son tour (LDB 21 l.32) : combattant capable, pas déjà
 *  frénétique ni immunisé à la Psychologie, avec un adversaire vivant en Ligne de Vue → Test de Force
 *  Mentale ; sur un succès, il entre en Frénésie (état psy `frenesie` posé en `psychState`). La SORTIE est
 *  un effet déclenché `onTurnStart` en DONNÉES (`psychology.json`) — plus de hook `end-frenzy` par-nom. */
export function aiMaybeFrenzy(get: Get, set: SetFn, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isFrenzied(enemy) || enemy.psychImmune || isOutOfAction(enemy) || !isFrenzyCapable(enemy)) return;
  if (!hasFoeInLoS(get, enemy)) return; // adversaire vivant en Ligne de Vue (primitive partagée, sens acteur→foe)
  if (resolveFrenzyEntry(effectiveChar(enemy, 'FM'), battleRng()).success) {
    (enemy.psychState ??= []).push({ type: 'frenesie' });
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenzy', t('turn.frenzyEnter', { name: enemy.name }), enemy.id)] } });
  }
}

/** Psychologie d'un ENNEMI (IA) au début de son tour (LDB 21) : teste Peur/Terreur des sources
 *  adverses en Ligne de Vue. Terreur ratée → Brisé ; Peur → Test étendu de Calme (cumul). Instantané
 *  et JOURNALISÉ (pas de modale/révélation pour l'IA — le joueur voit l'État Brisé). */
export function resolvePsychAI(get: Get, set: SetFn, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  // Belliqueux (LDB 85 p.338) : immunité psy tant qu'il a plus d'Avantages que son adversaire ENGAGÉ.
  const engagedFoesAdv = (enemy.engagedWith ?? [])
    .map((id) => battle.combatants.find((x) => x.id === id))
    .filter((e): e is Combatant => !!e && e.kind !== enemy.kind && !isOutOfAction(e))
    .map((e) => e.advantage ?? 0);
  if (isPsychImmune(enemy, engagedFoesAdv.length ? Math.max(...engagedFoesAdv) : undefined)) return; // Immunité (Psychologie) / Frénésie / Détermination temp / Belliqueux
  enemy.psychState ??= [];
  const log: string[] = [];
  // Nouvelles sources de peur/terreur en Ligne de Vue (non encore rencontrées).
  for (const foe of battle.combatants) {
    if (foe.kind === enemy.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (!losClear(scene, enemy.pos, foe.pos, smokeOf(battle))) continue;
    const src = fearSourceFor(enemy, foe);
    if (!src || enemy.psychState.some((p) => p.sourceId === foe.id)) continue;
    const sansPeur = sansPeurVs(enemy, foe); // Sans Peur (Ennemi, LDB 10 l.864) : Test de Calme +20 à la rencontre
    if (src.kind === 'terreur') {
      const r = resolveTerreurTest(calmeValue(enemy), src.indice, battleRng(), isColdBlooded(enemy.traits), sansPeur); // À sang-froid : inverse un raté (LDB 85)
      if (!r.success) {
        addCondition(enemy, COND.brise, r.brise);
        log.push(t('turn.terrified', { name: enemy.name, foe: foe.name, brise: r.brise }));
      }
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: r.success ? 0 : r.devientPeur, calmeDR: 0, lastTestRound: battle.round }); // Terreur → Peur (ignorée si Sans Peur réussit)
    } else if (sansPeur) {
      // Sans Peur : UN seul Test de Calme Accessible (+20) à la rencontre ; réussi → Peur ignorée d'emblée.
      const r = resolvePeurTest(calmeValue(enemy), src.indice, 0, battleRng(), isColdBlooded(enemy.traits), true);
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: r.calmeDR, lastTestRound: battle.round });
      log.push(r.vaincue ? t('turn.fearVanquished', { name: enemy.name, foe: foe.name }) : t('turn.fear', { name: enemy.name, foe: foe.name }));
    } else {
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: 0, lastTestRound: battle.round });
      log.push(t('turn.fear', { name: enemy.name, foe: foe.name }));
    }
  }
  // Test ÉTENDU de Calme des Peur actives (calmeDR < indice) — UNE fois par Round.
  for (const p of enemy.psychState) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 0) || p.lastTestRound === battle.round) continue;
    const r = resolvePeurTest(calmeValue(enemy), p.indice ?? 1, p.calmeDR ?? 0, battleRng(), isColdBlooded(enemy.traits)); // À sang-froid (LDB 85)
    p.calmeDR = r.calmeDR;
    p.lastTestRound = battle.round;
    if (r.vaincue) log.push(t('turn.fearOvercome', { name: enemy.name }));
  }
  // ── Traits psy CIBLÉS (Animosité/Haine/… — LDB 21), instantané pour l'IA ──
  const visible = battle.combatants.filter((v) => v.id !== enemy.id && v.pos && !isOutOfAction(v) && losClear(scene, enemy.pos!, v.pos, smokeOf(battle)));
  for (const p of enemy.psychState) {
    // Re-test (fin de Round) des afflictions ciblées actives, tant qu'un membre du groupe est visible.
    if (!p.active || !CIBLE_TYPES.has(p.type) || !p.cible || p.lastTestRound === battle.round) continue;
    if (!visible.some((v) => groupMatch(p.cible!, v.groups ?? []))) continue;
    p.lastTestRound = battle.round;
    if (resolveCalmeSimple(calmeValue(enemy), battleRng()).success) { p.active = false; log.push(t('turn.recompose', { name: enemy.name, type: p.type })); }
  }
  const tt = targetedTrigger(enemy, visible); // nouveau Trait ciblé déclenché par un membre du groupe visible
  if (tt) {
    const r = resolveCalmeSimple(calmeValue(enemy), battleRng());
    enemy.psychState.push({ type: tt.type, cible: tt.cible, sourceId: tt.sourceId, active: !r.success, lastTestRound: battle.round });
    if (!r.success) log.push(t('turn.afflictionGrip', { name: enemy.name, type: tt.type, cible: tt.cible }));
  }
  // Immunités croisées (LDB 21) : Animosité/Préjugé cèdent dès qu'on tombe sous un effet psy dominant (Peur/…).
  for (const tp of suppressSupersededPsych(enemy)) log.push(t('turn.psychSuperseded', { name: enemy.name, psych: psychologyLabel(tp) }));
  if (log.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'fear', enemy.id)] } });
}

// ============================================================================================
// Hooks `turnStart` : la séquence RAW de début de tour ennemi, migrée ISO-COMPORTEMENT depuis la tête
// de `runEnemyAI`. Les `order` encodent la dépendance d'ordre (Frénésie/Rage AVANT la psychologie).
// Chaque `run()` appelle au RUNTIME la fonction/le bloc correspondant (pas de souci de cycle à l'import).
// ============================================================================================

// Sortie de Frénésie (LDB 21 l.36) : plus de hook `end-frenzy` par-nom — c'est un effet déclenché
// `onTurnStart` en DONNÉES (`psychology.json` : Sonné/Inconscient ∨ plus d'ennemi en LdV → Exténué),
// diffusé UNIFORMÉMENT (héros + IA) par `fireTurnStartTriggers` AVANT les hooks d'entrée ci-dessous.
registerCombatHook({
  id: 'rage', // Rage (LDB 85 p.341) : « dépenser tous ses Avantages (minimum 3) pour entrer en Frénésie »
  phase: 'onTurnStart',
  order: 20,
  run: ({ get, set, battle, self }) => {
    const enemy = self;
    if (!enemy || !hasRage(enemy.traits) || isFrenzied(enemy) || (enemy.advantage ?? 0) < 3) return;
    enemy.advantage = 0;
    (enemy.psychState ??= []).push({ type: 'frenesie' });
    battle.log.push(ev('frenzy', t('turn.rageEnter', { name: enemy.name }), enemy.id));
    set({ battle: { ...battle } });
  },
});
registerCombatHook({
  id: 'ai-maybe-frenzy', // l'IA tente d'entrer en Frénésie (LDB 21 l.32) AVANT le test psy (la Frénésie en rend immunisé)
  phase: 'onTurnStart',
  order: 30,
  run: ({ get, set, self }) => { if (self) aiMaybeFrenzy(get, set, self); },
});
registerCombatHook({
  id: 'resolve-psych-ai', // Peur/Terreur de l'IA au début de son tour (instantané, journalisé)
  phase: 'onTurnStart',
  order: 40,
  run: ({ get, set, self }) => { if (self) resolvePsychAI(get, set, self); },
});
