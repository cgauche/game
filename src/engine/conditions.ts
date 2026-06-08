/**
 * États (conditions) — Livre de base, chapitre « États ».
 * Gestion minimale pour le combat tactique : ajout, empilement, retrait.
 */
import { Combatant } from './types';
import { bonus, effectiveChar } from './characteristics';
import { d10, d100, RNG, defaultRNG } from './dice';
import { rollTest, isDoubleRoll } from './tests';

/** Nombre de pions (cumul) d'un État donné. */
export const stacks = (c: Combatant, name: string) => c.conditions.find((x) => x.name === name)?.value ?? 0;

/** Retrait d'États « 1 + DR » borné au nombre de pions présents (LDB 16 : Empêtré l.61,
 *  En flammes l.77, Empoisonné l.70, Sonné l.125, arrêt d'Hémorragie l.107). Un Test raté n'en retire aucun. */
export function recoveredStacks(dr: number, stacks: number, success: boolean): number {
  if (!success || stacks <= 0) return 0;
  return Math.min(stacks, 1 + Math.max(0, dr));
}

export function addCondition(c: Combatant, name: string, value = 1): void {
  c.advantage = 0; // « Si vous subissez un État quel qu'il soit, vous perdez immédiatement tout Avantage » (LDB 16 l.15)
  const existing = c.conditions.find((x) => x.name === name);
  if (existing) existing.value += value;
  else c.conditions.push({ name, value });
}

export function removeCondition(c: Combatant, name: string, value = 1): void {
  const existing = c.conditions.find((x) => x.name === name);
  if (!existing) return;
  existing.value -= value;
  if (existing.value <= 0) c.conditions = c.conditions.filter((x) => x.name !== name);
}

export function hasCondition(c: Combatant, name: string): boolean {
  return c.conditions.some((x) => x.name === name);
}

/**
 * Pénalité aux Tests de COMBAT due aux États (LDB ch.16). Non-cumul (l.20) : on
 * applique la pénalité d'UN SEUL État (la plus forte), mais un même État empile
 * (Exténué×3 = -30). Aveuglé/Brisé/Empoisonné/Sonné = -10 ; Exténué = -10/point.
 * (À Terre/Assourdi/Empêtré ne touchent que les Tests de déplacement/audition.)
 */
export function combatTestPenalty(c: Combatant): number {
  const cand: number[] = [];
  if (hasCondition(c, 'Aveuglé')) cand.push(-10);
  if (hasCondition(c, 'Brisé')) cand.push(-10);
  if (hasCondition(c, 'Empoisonné')) cand.push(-10);
  if (hasCondition(c, 'Sonné')) cand.push(-10);
  const ext = stacks(c, 'Exténué');
  if (ext > 0) cand.push(-10 * ext);
  return cand.length ? Math.min(...cand) : 0;
}

/**
 * Pénalité d'États aux Tests HORS COMBAT (LDB ch.16). Non-cumul (l.20 : la PIRE pénalité seule).
 * Couvre les États « à tous les Tests » : Empoisonné (l.66) / Sonné (l.123) −10, Exténué (l.89) −10/pion,
 * Brisé (l.55) −10 SAUF un Test de course (Athlétisme) ou de dissimulation (Discrétion). Les États à
 * portée sensorielle/déplacement (Aveuglé=vue, Assourdi=audition, À Terre/Empêtré=déplacement) ne sont
 * PAS appliqués ici faute de classification du Test (rare hors combat ; raffinement futur).
 */
const BRISE_EXEMPT = /athl[ée]tisme|discr[ée]tion/i; // course / dissimulation (LDB 16 l.55)
const MOVEMENT_SKILL = /athl[ée]tisme|esquive|escalade|acrobat|[ée]quitation|nage/i; // Tests « impliquant un déplacement »
export function testStatePenalty(c: Combatant, skill?: string): number {
  if (!c.conditions?.length) return 0;
  const cand: number[] = [];
  if (hasCondition(c, 'Empoisonné')) cand.push(-10);
  if (hasCondition(c, 'Sonné')) cand.push(-10);
  const ext = stacks(c, 'Exténué');
  if (ext > 0) cand.push(-10 * ext);
  if (hasCondition(c, 'Brisé') && !BRISE_EXEMPT.test(skill ?? '')) cand.push(-10);
  // À Terre / Empêtré : pénalité aux Tests impliquant un déplacement (LDB 16 l.37 / l.85).
  if (MOVEMENT_SKILL.test(skill ?? '')) {
    if (hasCondition(c, 'À Terre')) cand.push(-20);
    if (hasCondition(c, 'Empêtré')) cand.push(-10);
  }
  return cand.length ? Math.min(...cand) : 0;
}

/**
 * Bonus pour TOUCHER en mêlée une cible affectée (LDB ch.16). Non-cumul : meilleur
 * bonus d'un seul État. À Terre/Surpris +20, Aveuglé +10. (Assourdi +10 par le
 * flanc/derrière : non modélisé — l'orientation des combattants n'est pas suivie.)
 */
export function meleeAttackerBonus(target: Combatant): number {
  const cand: number[] = [];
  if (hasCondition(target, 'À Terre')) cand.push(20);
  if (hasCondition(target, 'Surpris')) cand.push(20);
  if (hasCondition(target, 'Aveuglé')) cand.push(10);
  return cand.length ? Math.max(...cand) : 0;
}

/** Une cible Surprise (LDB ch.16 l.132) ou Inconscient (l.112 « rien faire de votre tour »)
 *  ne peut pas se défendre lors d'un Test opposé. */
export function cannotDefend(c: Combatant): boolean {
  return hasCondition(c, 'Surpris') || hasCondition(c, 'Inconscient');
}

/** Sonné : « vous êtes incapable d'effectuer votre Action » (LDB États l.123). Le combattant
 *  peut encore se déplacer (à demi-Mouvement, cf. effectiveMovement) mais ne peut pas agir. */
export function canTakeAction(c: Combatant): boolean {
  return !hasCondition(c, 'Sonné');
}

/**
 * Fin de Round : dégâts périodiques (Hémorragique/Empoisonné/En flammes) et
 * dissipation des États temporaires (LDB ch.16). Retourne un journal.
 */
export function endOfRound(c: Combatant, rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  // Hémorragique : 1 Blessure par point, en ignorant les modificateurs (l.104).
  const bleed = stacks(c, 'Hémorragique');
  if (bleed) {
    loseWounds(c, bleed); // perte de PB centralisée (perte d'Avantage + À Terre à 0)
    log.push(`${c.name} subit ${bleed} Blessure(s) (Hémorragique).`);
  }
  // Empoisonné : 1 Blessure par point, en ignorant les modificateurs (l.66).
  const poison = stacks(c, 'Empoisonné');
  if (poison) {
    loseWounds(c, poison);
    log.push(`${c.name} subit ${poison} Blessure(s) (Empoisonné).`);
    // Test de Résistance en fin de Round → retire 1 + DR États ; une fois tous retirés, 1 Exténué (l.70-72).
    // (Difficulté « dictée par le poison » non modélisée → Intermédiaire +0 par défaut.)
    const resistVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    const res = rollTest(resistVal, 'intermediaire', rng, combatTestPenalty(c));
    if (res.success) {
      const removed = Math.min(poison, 1 + Math.max(0, res.sl));
      removeCondition(c, 'Empoisonné', removed);
      log.push(`${c.name} : ${removed} État(s) Empoisonné éliminé(s) (Résistance réussie).`);
      if (!hasCondition(c, 'Empoisonné')) { addCondition(c, 'Exténué'); log.push(`${c.name} est Exténué (poison surmonté).`); }
    }
  }
  // En flammes : 1d10 − BE − PA de la localisation la moins protégée (min 1), +1 par État en plus (l.77).
  const fire = stacks(c, 'En flammes');
  if (fire) {
    const minPA = Math.min(...Object.values(c.armour));
    // « 1d10+2 si 3 États » (l.77) : le +1/État en plus s'ajoute aux Dégâts AVANT la
    // réduction BE+PA et le plancher de 1 — pas après.
    const dmg = Math.max(1, d10(rng) + (fire - 1) - bonus(effectiveChar(c, 'E')) - minPA);
    loseWounds(c, dmg);
    log.push(`${c.name} subit ${dmg} Blessure(s) (En flammes).`);
  }
  // Sonné : Test de Résistance Intermédiaire (+0) en fin de Round ; sur un succès, retire
  // 1 État + 1 par DR ; une fois tous retirés, on gagne 1 Exténué (LDB États l.125-127).
  // Le « -10 à tous les Tests » du Sonné s'applique au jet (l.123, via combatTestPenalty).
  const sonne = stacks(c, 'Sonné');
  if (sonne) {
    const resistVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    const res = rollTest(resistVal, 'intermediaire', rng, combatTestPenalty(c));
    if (res.success) {
      const removed = Math.min(sonne, 1 + Math.max(0, res.sl));
      removeCondition(c, 'Sonné', removed);
      log.push(`${c.name} : ${removed} État(s) Sonné dissipé(s) (Résistance réussie).`);
      if (!hasCondition(c, 'Sonné') && !hasCondition(c, 'Exténué')) {
        addCondition(c, 'Exténué');
        log.push(`${c.name} est Exténué (après avoir surmonté le dernier État Sonné).`);
      }
    } else {
      log.push(`${c.name} reste Sonné (Résistance ratée).`);
    }
  }
  // Dissipation en fin de Round : Aveuglé (l.48), Assourdi (l.32), Surpris (l.136).
  for (const n of ['Aveuglé', 'Assourdi', 'Surpris']) {
    if (hasCondition(c, n)) {
      removeCondition(c, n, 1);
      log.push(`${c.name} : un État ${n} se dissipe.`);
    }
  }
  // Effets magiques temporisés (Bénédictions, Sorts de bonus).
  if (c.activeEffects?.length) {
    for (const e of c.activeEffects) e.roundsLeft -= 1;
    const expired = c.activeEffects.filter((e) => e.roundsLeft <= 0);
    for (const e of expired) log.push(`${c.name} : ${e.label} se dissipe.`);
    c.activeEffects = c.activeEffects.filter((e) => e.roundsLeft > 0);
  }
  return log;
}

/**
 * Cauchemars (trauma psychologique, LDB 21 l.92) : chaque nuit, un Personnage marqué effectue un
 * Test de **Calme Facile (+40)** ; sur un échec, il est en proie à de terribles cauchemars et gagne
 * un État **Exténué**. Pur ; mute `c`, renvoie le journal.
 */
export function nightmareCheck(c: Combatant, rng: RNG = defaultRNG): string[] {
  const calme = effectiveChar(c, 'FM') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0);
  const res = rollTest(calme, 'facile', rng); // Calme Facile (+40), palier canonique
  if (res.success) return [`${c.name} dort d'un sommeil sans rêve.`];
  addCondition(c, 'Exténué');
  return [`${c.name} est en proie à de terribles cauchemars (Calme +40 raté) et gagne Exténué.`];
}

/**
 * Mort par Hémorragique (LDB 16-États l.105) : « À la fin du Round, vous avez 10 % de chance de mourir
 * par État Hémorragique que vous possédez » (3 pions → mort sur 1-30). « Si vous faites un double sur ce
 * jet, vos blessures coagulent un peu et vous perdez 1 État Hémorragique » — le double prime (pas de mort,
 * mais coagulation). Pur ; renvoie `died` (la finalisation — sauvetage par Destin — revient à l'appelant).
 */
export function bleedDeathRoll(c: Combatant, rng: RNG = defaultRNG): { died: boolean; log: string[] } {
  const n = stacks(c, 'Hémorragique');
  if (n <= 0) return { died: false, log: [] };
  const r = d100(rng);
  if (isDoubleRoll(r)) {
    removeCondition(c, 'Hémorragique', 1); // coagulation (le double prime sur la mort)
    const log = [`${c.name} : une plaie coagule (${r === 100 ? '00' : r}, double) — un État Hémorragique en moins.`];
    if (!hasCondition(c, 'Hémorragique')) { addCondition(c, 'Exténué'); log.push(`${c.name} est Exténué (dernière plaie refermée, LDB 16 l.109).`); } // tous retirés → 1 Exténué
    return { died: false, log };
  }
  if (r <= 10 * n) return { died: true, log: [`${c.name} succombe à l'hémorragie (${r} ≤ ${10 * n}).`] };
  return { died: false, log: [] };
}

/** Un figurant (non-héros, non-important) sort directement à 0 PB (Mort Subite, LDB 18 l.51-54). */
export function usesSuddenDeath(c: Combatant): boolean {
  return c.kind !== 'hero' && !c.important;
}

/** Hors de combat : mort, ou Inconscient, ou figurant tombé à 0 PB (Mort Subite). Un héros à 0 PB
 *  reste actif (À Terre) — il n'est PAS hors de combat (LDB 18-Traumatisme l.28). */
export function isOutOfAction(c: Combatant): boolean {
  return c.dead === true || c.outOfRencontre === true || hasCondition(c, 'Inconscient') || (usesSuddenDeath(c) && c.wounds.current <= 0);
}

/** Condition de mort lente (LDB 18-Traumatisme l.48-49) : Inconscient + 0 PB + (Blessures
 *  critiques > Bonus d'Endurance), et pas déjà mort/éjecté. */
export function inDeathCondition(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  const be = bonus(effectiveChar(c, 'E'));
  return hasCondition(c, 'Inconscient') && c.wounds.current <= 0 && (c.criticalWounds ?? 0) > be;
}

/** À 0 PB : gagne l'État À Terre (LDB 18 l.28). À appeler quand un coup non-critique amène à 0. */
export function applyZeroWounds(c: Combatant): void {
  if (c.wounds.current <= 0 && !hasCondition(c, 'À Terre')) addCondition(c, 'À Terre');
}

/**
 * Perte de Blessures CENTRALISÉE avec ses conséquences RAW — à utiliser partout où l'on retire des PB
 * (hors flux d'attaque principal, qui gère déjà l'Avantage et la nuance Critique pour l'À Terre) :
 *  - perdre ≥1 PB → on perd TOUT l'Avantage (LDB 15-Déplacement l.40) ;
 *  - tomber à 0 PB → État À Terre (LDB 18 l.28), sauf déjà Inconscient/mort.
 * Retourne le nombre de PB réellement perdus.
 */
export function loseWounds(c: Combatant, amount: number): number {
  if (amount <= 0 || c.wounds.current <= 0) return 0;
  const lost = Math.min(amount, c.wounds.current);
  c.wounds.current -= lost;
  c.advantage = 0; // perdre une Blessure → perdre tout l'Avantage (LDB 15 l.40)
  if (c.wounds.current <= 0 && !c.dead && !hasCondition(c, 'Inconscient')) applyZeroWounds(c);
  return lost;
}

/**
 * Upkeep de mort en fin de Round (LDB 18 l.28, l.48-49) — héros/importants seulement :
 *  - à 0 PB non soigné : roundsAtZero++ ; après (Bonus d'Endurance) Rounds → Inconscient ;
 *  - Inconscient + 0 PB + (criticalWounds > BE) → mort.
 * Retourne le journal. (`_rng` réservé pour de futurs Tests ; non utilisé ici.)
 */
export function tickDeath(c: Combatant, _rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  if (c.dead || c.outOfRencontre || usesSuddenDeath(c)) return log;
  const be = bonus(effectiveChar(c, 'E'));
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    return log;
  }
  c.roundsAtZero = (c.roundsAtZero ?? 0) + 1;
  if (c.roundsAtZero > be && !hasCondition(c, 'Inconscient')) {
    addCondition(c, 'Inconscient');
    log.push(`${c.name} perd connaissance (0 PB depuis ${c.roundsAtZero} Rounds).`);
  }
  return log; // la mort (dead) est finalisée par le store (avec sauvetage par Destin)
}
