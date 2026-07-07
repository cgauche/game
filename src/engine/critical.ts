/**
 * Résolution des Blessures critiques — Livre de base, « Traumatisme » (18-Traumatisme.md).
 * Jet 1d100 sur la table de la localisation ; -20 si l'overkill dépasse le Bonus d'Endurance
 * (l.30, min 01) ; PB perdus en ignorant BE+PA ; États appliqués + Test de Résistance auto-résolu.
 */
import { d100, d10, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { hitLocationByShape, locationLabel } from './combat';
import { BodyShape, Combatant, HitLocation, Trauma } from './types';
import { CRITICAL_TABLES } from '../data/criticals';
import { traumaById, traumaFicheById, stampCriticalEscalation } from './trauma';
import { rule } from './policy';
import { resolveAACritical } from './aaCritical';
import type { GameOp } from './ops';

/**
 * Séquelles PERMANENTES d'une amputation (LDB 18 l.335-370) — distinctes de la plaie chirurgicale : elles
 * survivent à la Chirurgie (le membre reste absent). Instanciées depuis les `sequels` (ids de fiche
 * `traumas.json`) DÉCLARÉS STRUCTURELLEMENT sur le critique (`entry.amputation.sequels`) — plus aucune
 * lecture du texte. La latéralité (brasG/brasD, jambeG/jambeD) provient de la `location` réelle du coup —
 * hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD). Les fiches « par comptage »
 * (doigts l.341, dents l.338) reçoivent leur effet/comptage variable ICI (cumulé ensuite par
 * `consolidateAmputations`) ; la perte du SECOND œil/oreille est agrégée par `escalateSensoryLoss`.
 */
export function permanentAmputations(sequels: string[], location: HitLocation, rng: RNG = defaultRNG): Trauma[] {
  return sequels.map((id) => {
    const t = traumaById(id, undefined, location);
    if (id === 'doigt-ampute') {
      // 1 doigt par critique ; cumulé par consolidateAmputations. Pénalité −5/doigt = CONTEXTUELLE À L'ARME
      // (`amputationCombatPenalty`, LDB 18 l.251) — plus de charMod CC/CT global ici.
      t.count = 1;
    } else if (id === 'main-bras-ampute') {
      // −20 (LDB 18 l.263) = contextuel à l'arme (`amputationCombatPenalty`) ; ICI seul l'interdit d'arme à 2 mains.
      t.ops = [{ op: 'maxWeaponHands', hands: 1 }];
    } else if (id === 'dents-perdues') {
      const n = location === 'tete' ? d10(rng) : 1; // « 1d10 dents » (la perte structurelle est multiple ; sinon 1).
      t.count = n;
      const soc = -Math.floor(n / 2); // −1 Sociabilité par PAIRE (l.338) : 1 dent = 0, 3 dents = −1, 4 = −2…
      if (soc < 0) t.ops = [{ op: 'charMod', char: 'Soc', mod: soc }];
    }
    return t;
  });
}

export interface CriticalResolved {
  location: HitLocation;
  name: string;
  /** Effet IMMÉDIAT RÉSOLU (PB ignorant BE+PA + États immédiats + onFail du Test de Résistance/Amputation),
   *  appliqué par `applyOps` chez l'appelant — valeurs littérales (RNG déjà consommé ici). */
  ops: GameOp[];
  lethal: boolean;
  /** Traumatismes posés (LDB 18), à la localisation du critique. */
  traumas: Trauma[];
  /** Texte canon (LONG TERME), DISPLAY-ONLY — jamais parsé pour de la mécanique. */
  desc: string;
  /** Jet d100 effectif (après -20 éventuel). */
  roll: number;
  log: string;
}

/** Récapitulatif d'AFFICHAGE d'un effet immédiat (PB totaux + États) extrait des `ops` — pour la
 *  révélation de Coup Critique (modale enrichie), SANS dupliquer la donnée. */
export function critImmediateSummary(ops: GameOp[]): { woundsLost: number; conditions: { name: string; value: number }[] } {
  let woundsLost = 0;
  const conditions: { name: string; value: number }[] = [];
  for (const o of ops) {
    if (o.op === 'wounds' && typeof o.amount === 'number') woundsLost += o.amount;
    else if (o.op === 'condition') conditions.push({ name: o.name, value: typeof o.value === 'number' ? o.value : 1 });
  }
  return { woundsLost, conditions };
}

/** Localisation d'un Coup Critique : 1d100 lu directement sur le Tableau de Localisation de la forme
 *  du corps (humanoïde p.159 / Localisations Alternatives p.312). */
export function critLocationRoll(rng: RNG = defaultRNG, shape: BodyShape = 'humanoide'): HitLocation {
  return hitLocationByShape(d100(rng), shape);
}

/** LDB 18 l.53 : la Localisation d'un Coup Critique est un 1d100 FRAIS (jamais l'inversion de la touche),
 *  SAUF `override` — le Critique déjà montré (Déviation) ou la loc choisie (« Je ne faillirai pas ! »,
 *  LDB 17 l.73). SOURCE UNIQUE de la règle : mêlée, défense opposée et tir/magie en dérivent, puis
 *  passent le résultat à `applyCriticalToTarget` qui ne re-tire JAMAIS → le double tirage est impossible. */
export function critWoundLocation(rng: RNG, bodyShape: BodyShape = 'humanoide', override?: HitLocation): HitLocation {
  return override ?? critLocationRoll(rng, bodyShape);
}

/**
 * Résout une Blessure critique sur `target` à la `location`. `overkill` = PB perdus au-delà des
 * PB courants (0 pour un Coup Critique sans overkill). Le Test de Résistance d'une entrée est
 * auto-résolu (RNG seedé) : sur un échec, les États `onFail` sont ajoutés à `conditions`.
 */
export function rollCritical(
  target: Combatant,
  location: HitLocation,
  rng: RNG = defaultRNG,
  overkill = 0,
  twice = false, // Bénédiction de Sauvagerie (LDB 41) : « deux lancers, choisissez le meilleur » (l'attaquant veut le plus sévère)
): CriticalResolved {
  // BIFURCATION du système ALTERNATIF Aux Armes (l.2441-2627) : tables + décalage +10/Blessure propres.
  // `twice` (Sauvagerie) reste au chemin LDB (l'Atout ne coexiste pas avec la variante AA).
  if (!twice && rule('combat-aa-blessures') === 'aa') return resolveAACritical(target, location, rng, overkill);
  const be = bonus(effectiveChar(target, 'E'));
  const reduction = overkill > be ? 20 : 0; // l.30 : overkill > BE → -20 (résultat moins sévère)
  const raw = twice ? Math.max(d100(rng), d100(rng)) : d100(rng);
  const roll = Math.max(1, raw - reduction);
  const entry = findTableEntry(CRITICAL_TABLES[location], roll);
  const resistVal =
    effectiveChar(target, 'E') +
    (target.skills.find((s) => s.skillId === 'resistance')?.advances ?? 0);
  const ops: GameOp[] = [...(entry.ops ?? [])];
  if (entry.resist) {
    const res = rollTest(resistVal, entry.resist.difficulty, rng);
    if (!res.success) ops.push(...entry.resist.onFail);
  }
  // Durée de convalescence (Jalon 5) : BE déjà calculé ; 1d10 tiré seulement pour les fractures (RAW 30+1d10)
  // afin de ne pas décaler le flux RNG des critiques sans fracture. Les refs d'id de fiche (`traumas.json`)
  // portent leur `kind` → on instancie à la localisation du coup.
  const traumas = (entry.traumas ?? []).map((id) =>
    traumaById(id, { be, d10: traumaFicheById(id).kind === 'fracture' ? d10(rng) : undefined }, location));
  // Amputation (LDB 18 l.328-333) : DÉCLARÉE STRUCTURELLEMENT (`entry.amputation`, plus de regex sur le texte).
  // Test de Résistance ou À Terre ; échec −2 DR → +Sonné ; échec −4 DR → +Inconscient. Le membre perdu
  // exige la Chirurgie (l.333/401) : trauma `needsSurgery` (opérable via le Talent Chirurgie). Roll placé
  // en DERNIER (rien ne tire après) pour ne décaler le flux RNG que des critiques d'amputation.
  if (!entry.lethal && entry.amputation) {
    const res = rollTest(resistVal, entry.amputation.difficulty, rng);
    if (!res.success) {
      ops.push({ op: 'condition', name: 'a-terre', value: 1 });
      if (res.sl <= -2) ops.push({ op: 'condition', name: 'sonne', value: 1 });
      if (res.sl <= -4) ops.push({ op: 'condition', name: 'inconscient', value: 1 });
    }
    // Plaie chirurgicale (l.333/401) : retirée par la Chirurgie ; bloque la guérison jusqu'à l'opération.
    traumas.push({
      label: 'Amputation', // localisation portée par `t.location`, rendue shape-aware à l'affichage (pas bakée)
      location,
      needsSurgery: true,
      desc: 'Toutes les amputations nécessitent d’être traitées par la chirurgie, ce qui signifie qu’une Blessure ne peut pas être soignée tant que vous n’êtes pas passé entre les mains d’un chirurgien.',
    });
    // Séquelle(s) PERMANENTE(S) (membre absent) : survivent à la Chirurgie (l.335-370). Une tête peut en cumuler
    // (la perte de dents tire 1d10 — placé après le Test de Résistance d'amputation pour ne pas décaler le reste).
    traumas.push(...permanentAmputations(entry.amputation.sequels, location, rng));
  }
  // Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du pied sans
  // Chirurgie sous 1d10 jours) — stampée SUR la plaie chirurgicale. Roll placé en DERNIER (ne décale que
  // les critiques à escalade). Même patron que le chemin AA (`resolveAACritical`).
  stampCriticalEscalation(traumas, entry.escalation, rng);
  return {
    location,
    name: entry.name,
    ops,
    lethal: !!entry.lethal,
    traumas,
    desc: entry.desc,
    roll,
    log: `Blessure critique (${locationLabel(location, target.bodyShape)}) — ${entry.name}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}
