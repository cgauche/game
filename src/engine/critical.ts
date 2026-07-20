/**
 * Résolution des Blessures critiques — Livre de base, « Traumatisme » (LDB 18).
 * Jet 1d100 sur la table de la localisation ; -20 si l'overkill dépasse le Bonus d'Endurance
 * (LDB 18 l.16, min 01) ; PB perdus en ignorant BE+PA ; États appliqués + Test de Résistance auto-résolu.
 */
import { d100, d10, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { hitLocationByShape, locationLabel } from './combat';
import { BodyShape, Combatant, HitLocation, Trauma } from './types';
import { CRITICAL_TABLES, criticalTableFor, type Amputation, type CritEntry } from '../data/criticals';
import { traumaById, traumaFicheById, stampCriticalEscalation, fireCritTriggers, consolidateAmputations, AMPUTATION_WOUND_DESC } from './trauma';
import { rule } from './policy';
import { resolveAACritical } from './aaCritical';
import { applyOps, type GameOp } from './ops';
import aaCriticalsJson from '../data/aa-criticals.json';

/**
 * Séquelles PERMANENTES d'une amputation (LDB 18 l.233-286) — distinctes de la plaie chirurgicale : elles
 * survivent à la Chirurgie (le membre reste absent). Instanciées depuis les `sequels` (ids de fiche
 * `traumas.json`) DÉCLARÉS STRUCTURELLEMENT sur le critique (`entry.amputation.sequels`) — plus aucune
 * lecture du texte. La latéralité (brasG/brasD, jambeG/jambeD) provient de la `location` réelle du coup —
 * hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD). Les fiches « par comptage »
 * (doigts l.251, dents l.247) reçoivent leur effet/comptage variable ICI (cumulé ensuite par
 * `consolidateAmputations`) ; la perte du SECOND œil/oreille est agrégée par `escalateSensoryLoss`.
 */
export function permanentAmputations(sequels: string[], location: HitLocation, rng: RNG = defaultRNG, toeCount = 1): Trauma[] {
  return sequels.map((id) => {
    const t = traumaById(id, undefined, location);
    if (id === 'doigt-ampute') {
      // 1 doigt par critique ; cumulé par consolidateAmputations. Pénalité −5/doigt = CONTEXTUELLE À L'ARME
      // (`amputationCombatPenalty`, LDB 18 l.251) — plus de charMod CC/CT global ici.
      t.count = 1;
    } else if (id === 'orteil-ampute') {
      // « Pour chaque orteil perdu, −1 Ag et −1 CC » (LDB 18 l.281) : les traumas d'orteil s'ADDITIONNENT (pas de
      // consolidation par paire comme les dents) → `toeCount` orteils = charMods ×`toeCount`. « Pied écrasé »
      // (l.180) : 1 orteil + 1 par DR en dessous de 0 (`amputation.loss.perDR`).
      t.count = toeCount;
      t.ops = (t.ops ?? []).map((o) => (o.op === 'charMod' ? { ...o, mod: -toeCount } : o));
    } else if (id === 'main-bras-ampute') {
      // −20 (LDB 18 l.263) = contextuel à l'arme (`amputationCombatPenalty`) ; ICI seul l'interdit d'arme à 2 mains.
      t.ops = [{ op: 'maxWeaponHands', hands: 1 }];
    } else if (id === 'dents-perdues') {
      const n = location === 'tete' ? d10(rng) : 1; // « 1d10 dents » (la perte structurelle est multiple ; sinon 1).
      t.count = n;
      const soc = -Math.floor(n / 2); // −1 Sociabilité par PAIRE (LDB 18 l.247) : 1 dent = 0, 3 dents = −1, 4 = −2…
      if (soc < 0) t.ops = [{ op: 'charMod', char: 'sociabilite', mod: soc }];
    }
    return t;
  });
}

/** Valeur de Résistance d'un Coup Critique (LDB 18) : Endurance effective + Avances de Résistance. SOURCE UNIQUE. */
export function critResistValue(c: Combatant): number {
  return effectiveChar(c, 'endurance') + (c.skills.find((s) => s.skillId === 'resistance')?.advances ?? 0);
}

/**
 * Résout une Amputation (LDB 18 l.237) — SOURCE UNIQUE partagée par `rollCritical` (LDB), `resolveAACritical`
 * (Aux Armes) et la résolution post-rencontre. Renvoie l'effet immédiat (`ops` : États À Terre/Sonné/Inconscient)
 * et les `traumas` (plaie chirurgicale `needsSurgery` + séquelles permanentes). RNG consommé :
 *  - `loss.difficulty` présent → 1 Test SÉPARÉ (gate) D'ABORD : sa RÉUSSITE annule TOUT (ni séquelle, ni plaie, ni
 *    États). Sinon on continue (« Coupure à l'orteil » : gate Intermédiaire).
 *  - puis le Test de Résistance `difficulty` (États par DR). Sans `loss.difficulty`, un `loss` sans gate propre fait
 *    de CE Test le déterminant de la perte (« Pied écrasé » : un seul Test Accessible gate ET États).
 *  - `loss.perDR` → orteils = 1 + DR en dessous de 0 du Test qui gate la perte.
 * Sans `loss` : séquelle TOUJOURS (membre tranché — pied sectionné, tendon coupé…).
 */
export function resolveAmputation(amp: Amputation, location: HitLocation, resistVal: number, rng: RNG = defaultRNG): { ops: GameOp[]; traumas: Trauma[] } {
  const ops: GameOp[] = [];
  const traumas: Trauma[] = [];
  let toeCount = 1;
  if (amp.loss?.difficulty) {
    const gate = rollTest(resistVal, amp.loss.difficulty, rng);
    if (gate.success) return { ops, traumas }; // Test gate réussi → pas d'amputation du tout
    if (amp.loss.perDR) toeCount = 1 + Math.max(0, -gate.sl);
  }
  const res = rollTest(resistVal, amp.difficulty, rng);
  if (!res.success) {
    ops.push({ op: 'condition', id: 'a-terre', value: 1 });
    if (res.sl <= -2) ops.push({ op: 'condition', id: 'sonne', value: 1 });
    if (res.sl <= -4) ops.push({ op: 'condition', id: 'inconscient', value: 1 });
  }
  if (amp.loss && !amp.loss.difficulty) {
    // Pas de gate séparé : le Test de Résistance ci-dessus détermine LUI-MÊME la perte (succès → pas d'amputation).
    if (res.success) return { ops, traumas };
    if (amp.loss.perDR) toeCount = 1 + Math.max(0, -res.sl);
  }
  traumas.push({ label: 'Amputation', location, needsSurgery: true, desc: AMPUTATION_WOUND_DESC });
  traumas.push(...permanentAmputations(amp.sequels, location, rng, toeCount));
  return { ops, traumas };
}

/**
 * Résout à la FIN de la rencontre (LDB 18) les amputations DIFFÉRÉES (`Trauma.pendingAmputation`, posé par
 * `rollCritical` pour un `amputation.timing === 'postEncounter'`, ex. « Coupure à l'orteil »). Retire les
 * marqueurs, applique les États résultants et pose les séquelles/plaie, puis consolide (orteils cumulés).
 * Mute `c` ; renvoie le journal. Appelé au foyer de fin de combat (`state/combatFlow.ts`).
 */
export function resolvePostEncounterAmputations(c: Combatant, rng: RNG = defaultRNG): string[] {
  const pending = (c.traumas ?? []).filter((t) => t.pendingAmputation);
  if (!pending.length) return [];
  const resistVal = critResistValue(c);
  c.traumas = (c.traumas ?? []).filter((t) => !t.pendingAmputation);
  const log: string[] = [];
  for (const t of pending) {
    const r = resolveAmputation(t.pendingAmputation!, t.location, resistVal, rng);
    applyOps(c, r.ops, { rng });
    c.traumas = [...(c.traumas ?? []), ...r.traumas];
    log.push(r.traumas.length > 1 ? `${c.label} : ${t.label} — amputation confirmée après la rencontre.` : `${c.label} : ${t.label} — sans séquelle après la rencontre.`);
  }
  consolidateAmputations(c);
  return log;
}

export interface CriticalResolved {
  location: HitLocation;
  /** id STABLE de l'entrée de table (`criticals.json`/`aa-criticals.json`) — appendé à `critEntriesSuffered`
   *  par `applyCriticalToTarget` pour l'historique d'occurrence (escalade `onRepeat`). */
  entryId: string;
  label: string;
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
export function critImmediateSummary(ops: GameOp[]): { woundsLost: number; conditions: { id: string; value: number }[] } {
  let woundsLost = 0;
  const conditions: { id: string; value: number }[] = [];
  for (const o of ops) {
    if (o.op === 'wounds' && typeof o.amount === 'number') woundsLost += o.amount;
    else if (o.op === 'condition') conditions.push({ id: o.id, value: typeof o.value === 'number' ? o.value : 1 });
  }
  return { woundsLost, conditions };
}

/** Table de rattachement d'un Coup Critique (bras/jambe couvrent les DEUX côtés — LDB 18 : une SEULE
 *  table par membre, projetée sur `brasG`/`brasD` et `jambeG`/`jambeD`, cf. `CRITICAL_TABLES`). */
export type CritTableKey = 'tete' | 'bras' | 'corps' | 'jambe';

const AA_T = aaCriticalsJson as unknown as { tete: CritEntry[]; bras: CritEntry[]; corps: CritEntry[]; jambe: CritEntry[] };

/** Catégorie Codex EXACTE (`registry.ts`) d'un Coup Critique, par table + système actif (LDB/Aux Armes). */
export function critEntryCodexCategory(table: CritTableKey, kind: 'ldb' | 'aa'): string {
  const seg = table === 'tete' ? 'Tete' : table === 'bras' ? 'Bras' : table === 'corps' ? 'Corps' : 'Jambe';
  return `${kind === 'aa' ? 'aaCriticals' : 'criticals'}${seg}`;
}

/** Retrouve l'entrée de Coup Critique (catalogue LDB ou Aux Armes) portant cet id STABLE — un id de
 *  `critEntriesSuffered` (`Combatant`) n'a PAS de localisation attachée (compteur d'occurrence pour
 *  l'escalade `onRepeat` seulement, LDB 18 l.71) : `bras`/`jambe` regroupent les deux côtés, on ne peut
 *  donc afficher que la TABLE (« Bras »/« Jambe »), pas le côté précis (G/D). SOURCE UNIQUE de lecture
 *  d'un id de `critEntriesSuffered` — l'onglet État (rendu du journal des Blessures critiques subies)
 *  et tout futur point d'affichage passent par ici. */
export function findCritEntrySuffered(id: string): { entry: CritEntry; table: CritTableKey; kind: 'ldb' | 'aa' } | undefined {
  const ldbTables: [CritTableKey, CritEntry[]][] = [
    ['tete', CRITICAL_TABLES.tete],
    ['bras', CRITICAL_TABLES.brasG],
    ['corps', CRITICAL_TABLES.corps],
    ['jambe', CRITICAL_TABLES.jambeG],
  ];
  for (const [table, entries] of ldbTables) {
    const entry = entries.find((e) => e.id === id);
    if (entry) return { entry, table, kind: 'ldb' };
  }
  const aaTables: [CritTableKey, CritEntry[]][] = [
    ['tete', AA_T.tete],
    ['bras', AA_T.bras],
    ['corps', AA_T.corps],
    ['jambe', AA_T.jambe],
  ];
  for (const [table, entries] of aaTables) {
    const entry = entries.find((e) => e.id === id);
    if (entry) return { entry, table, kind: 'aa' };
  }
  return undefined;
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
  const be = bonus(effectiveChar(target, 'endurance'));
  const reduction = overkill > be ? 20 : 0; // LDB 18 l.16 : overkill > BE → -20 (résultat moins sévère)
  const raw = twice ? Math.max(d100(rng), d100(rng)) : d100(rng);
  const roll = Math.max(1, raw - reduction);
  const entry = findTableEntry(criticalTableFor(location), roll); // repli Bras (LDB 76 l.21) si loc sans table dédiée
  const resistVal = critResistValue(target);
  const ops: GameOp[] = [...(entry.ops ?? [])];
  if (entry.resist) {
    const res = rollTest(resistVal, entry.resist.difficulty, rng);
    if (!res.success) ops.push(...entry.resist.onFail);
  }
  // Occurrence-count PAR ID D'ENTRÉE (LDB 18 l.71 : « Si vous tombez une seconde fois sur cette blessure… ») :
  // la MÊME entrée déjà subie → effet ALTERNATIF `escalation.onRepeat` (séquelles REMPLACÉES, ops immédiates
  // AJOUTÉES). L'effet IMMÉDIAT de base (PB, États) reste appliqué (le coup blesse toujours).
  const repeated = (target.critEntriesSuffered ?? []).includes(entry.id);
  const repeat = repeated ? entry.escalation?.onRepeat : undefined;
  if (repeat?.ops) ops.push(...repeat.ops.map((o) => ({ ...o })));
  const traumaRefs = repeat?.traumas ?? entry.traumas ?? [];
  // Durée de convalescence (Jalon 5) : BE déjà calculé ; 1d10 tiré seulement pour les fractures (RAW 30+1d10)
  // afin de ne pas décaler le flux RNG des critiques sans fracture. Les refs d'id de fiche (`traumas.json`)
  // portent leur `kind` → on instancie à la localisation du coup.
  const traumas = traumaRefs.map((id) =>
    traumaById(id, { be, d10: traumaFicheById(id).kind === 'fracture' ? d10(rng) : undefined }, location));
  // Amputation (LDB 18 l.237) : DÉCLARÉE STRUCTURELLEMENT (`entry.amputation`, plus de regex sur le texte).
  // Résolue par `resolveAmputation` (SOURCE UNIQUE LDB/AA/post-rencontre). Placée en DERNIER (rien ne tire
  // après) pour ne décaler le flux RNG que des critiques d'amputation. `timing: 'postEncounter'` (« Coupure à
  // l'orteil », l.171 : « Une fois la rencontre terminée… ») → aucun jet ICI : marqueur `pendingAmputation`
  // résolu au foyer de fin de combat (`resolvePostEncounterAmputations`).
  if (!entry.lethal && entry.amputation) {
    if (entry.amputation.timing === 'postEncounter') {
      traumas.push({ label: entry.label, location, pendingAmputation: entry.amputation });
    } else {
      const amp = resolveAmputation(entry.amputation, location, resistVal, rng);
      ops.push(...amp.ops);
      traumas.push(...amp.traumas);
    }
  }
  // Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du pied sans
  // Chirurgie sous 1d10 jours ; « Épaule luxée »/« Genou démis » : membre désactivé jusqu'au Test étendu de
  // Guérison) — placée en DERNIER (ne décale que les critiques à escalade). Même patron que le chemin AA.
  stampCriticalEscalation(traumas, entry.escalation, location, rng, target.traumas ?? []);
  // Déclencheurs armés par un critique ANTÉRIEUR (« Commotion cérébrale » : autre critique tête pendant
  // Exténué, LDB 18 l.74) — lus sur `target.traumas` (jamais la séquelle stampée à l'instant : elle n'est pas
  // encore sur la cible). En DERNIER pour ne décaler le flux RNG que des critiques qui font effectivement feu.
  ops.push(...fireCritTriggers(target, location, resistVal, rng));
  return {
    location,
    entryId: entry.id,
    label: entry.label,
    ops,
    lethal: !!entry.lethal,
    traumas,
    desc: entry.desc,
    roll,
    log: `Blessure critique (${locationLabel(location, target.bodyShape)}) — ${entry.label}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}
