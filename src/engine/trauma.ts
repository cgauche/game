/**
 * Traumatismes — Livre de base, « Traumatisme » (18-Traumatisme.md). Factory unique
 * kind+sévérité+localisation → effets en-combat modélisés, partagée par les Blessures critiques
 * et les Maladresses. On ne modélise que ce qui est quantifié et câblable sans inventer :
 *   - Déchirure musculaire sur Jambe → Mouvement ÷2 (l.315).
 *   - Fracture Torse → Force/Agilité −30 + Mouvement ÷2 (l.298).
 *   - Fracture Jambe → Mouvement ÷2 (règle du Pied, l.298).
 * Bras/Tête et Amputations : effet de combat journalisé (latéralité non modélisée ; amputation =
 * post-combat/Chirurgie → Jalon 5). Le trauma est enregistré (label+note) même sans effet modélisé.
 */
import { Combatant, CharKey, HitLocation, Trauma, Difficulty, UpkeepDeferTest } from './types';
import { rollTest } from './tests';
import { RNG, defaultRNG } from './dice';
import { isPainless, traitPassiveMods } from './traits/dispatch';
import { findConditionById, findPsychologyById } from '../data';
import { talentPassiveMods } from './talentEffects';
import { diseaseCharPenalties } from './disease';
import { hungerCharPenalties } from './provisions';
import { wornSocialMod, qualityWearMods } from './wearPenalty';
import type { GameOp, PassiveKind, PassiveMod } from './ops';
import traumasJson from '../data/traumas.json';

export type TraumaKind = 'dechirure' | 'fracture';
export type TraumaSeverity = 'mineur' | 'majeur';

const LEG: HitLocation[] = ['jambeG', 'jambeD'];

/**
 * Fiche de Traumatisme (registre `traumas.json`, app-owned) : mécanique = `ops` (GameOp[]), `desc` =
 * texte canon LDB 18 VERBATIM (DISPLAY-ONLY, jamais parsé). Couvre déchirures/fractures par localisation
 * et toutes les séquelles permanentes d'amputation (+ Cécité/Surdité agrégées). `kind`/`severity` portés
 * pour la convalescence à étapes ; `prosthesis` = annulateurs (LDB 73).
 */
export interface TraumaFiche {
  id: string;
  label: string;
  desc: string;
  ops?: GameOp[];
  kind?: TraumaKind;
  severity?: TraumaSeverity;
  prosthesis?: { trappingId: string; cancels: 'all' | 'movement' }[];
  needsSurgery?: boolean;
}

const FICHES = traumasJson as TraumaFiche[];
const FICHE_BY_ID = new Map(FICHES.map((f) => [f.id, f]));

/** Fiche de Traumatisme par id STABLE (`traumas.json`). Lève si l'id est inconnu (réf cassée = bug data). */
export function traumaFicheById(id: string): TraumaFiche {
  const f = FICHE_BY_ID.get(id);
  if (!f) throw new Error(`Trauma fiche inconnue : ${id}`);
  return f;
}

/** Ops PASSIVES d'une séquelle (lecteur UNIQUE de `t.ops` — vocab GameOp partagé). */
function traumaOps(t: Trauma): GameOp[] {
  return t.ops ?? [];
}
/** Filtre typé d'une liste d'ops par type d'op (narrowing — `.char`/`.skill`/`.hands` accessibles). */
function opsOfType<K extends GameOp['op']>(ops: GameOp[], op: K): Extract<GameOp, { op: K }>[] {
  return ops.filter((o): o is Extract<GameOp, { op: K }> => o.op === op);
}

/**
 * Durée de convalescence d'un trauma en JOURS (LDB 18) : déchirure mineure 30−BE (l.317) ; déchirure
 * majeure 2×(30−BE), deux périodes (l.326) ; fracture 30+1d10 (l.300), +10 jours si majeure (l.309).
 * `be` = Bonus d'Endurance, `d10` = 1d10 (fractures). Plancher 1 jour.
 */
export function traumaRecoveryDays(kind: TraumaKind, severity: TraumaSeverity, be: number, d10 = 5): number {
  if (kind === 'dechirure') {
    const base = Math.max(1, 30 - be);
    return severity === 'majeur' ? base * 2 : base;
  }
  return 30 + d10 + (severity === 'majeur' ? 10 : 0);
}

/** Résout la fiche de déchirure/fracture (`traumas.json`) pour un `{kind,severity,location}` — utilisé
 *  par `rollCritical` (refs déjà résolues dans `criticals.json`) et l'éditeur (`inflictTrauma`). */
export function dechirureFractureFicheId(kind: TraumaKind, severity: TraumaSeverity, location: HitLocation): string {
  const onLeg = LEG.includes(location);
  const sevW = severity === 'majeur' ? 'majeure' : 'mineure';
  if (kind === 'dechirure') return onLeg ? `dechirure-jambe-${sevW}` : `dechirure-autre-${sevW}`;
  const zone = location === 'corps' ? 'torse' : onLeg ? 'jambe' : location === 'tete' ? 'tete' : 'bras';
  return `fracture-${zone}-${sevW}`;
}

/** Instancie un `Trauma` POSÉ depuis une fiche `traumas.json` (mécanique = `ops`, `desc` = canon
 *  DISPLAY-ONLY) à la `location` du coup. `opts.be` (Bonus d'Endurance) + `opts.d10` (1d10 des fractures)
 *  → durée de convalescence `recoveryDays` COMPUTÉE par la formule (jamais stockée). La sévérité est
 *  portée par la fiche (déchirures ET fractures sont désormais des fiches par localisation+sévérité).
 *  Omis (tests/legacy) ⇒ pas de décompte (séquelle permanente jusqu'à traitement explicite). */
export function traumaById(id: string, opts?: { be?: number; d10?: number }, location?: HitLocation): Trauma {
  const f = traumaFicheById(id);
  const out: Trauma = {
    label: f.label,
    traumaId: f.id,
    location: location ?? 'corps',
    desc: f.desc,
    ...(f.ops ? { ops: f.ops.map((o) => ({ ...o })) } : {}),
    ...(f.prosthesis ? { prosthesis: f.prosthesis.map((p) => ({ ...p })) } : {}),
  };
  // Convalescence à étapes (déchirure/fracture seules). Une fracture MAJEURE « peu probable de guérir
  // sans intervention médicale » (l.305) exige la Chirurgie ; la formule garde le 1d10 seedé chez l'appelant.
  if (f.kind) {
    const sev: TraumaSeverity = f.severity ?? 'mineur';
    const recoveryDays = opts?.be == null ? undefined : traumaRecoveryDays(f.kind, sev, opts.be, opts.d10 ?? 5);
    out.kind = f.kind;
    out.severity = sev;
    out.label = `${f.label} (${sev === 'majeur' ? 'Majeure' : 'Mineure'})`; // libellé canon avec sévérité
    if (recoveryDays != null) { out.recoveryDays = recoveryDays; out.recoveryTotal = recoveryDays; }
    if (f.kind === 'fracture' && sev === 'majeur') out.needsSurgery = true;
  }
  if (f.needsSurgery) out.needsSurgery = true;
  return out;
}

/** Une déchirure musculaire MAJEURE de jambe guérit en DEUX temps (LDB 18 l.326) : après la 1ʳᵉ moitié
 *  (recoveryTotal/2), la pénalité de mobilité passe de −20 à −10 ; la 2ᵉ moitié achève la guérison. */
function downgradeTornMuscle(t: Trauma, leftDays: number): string | null {
  const esq = opsOfType(t.ops ?? [], 'skillMod').find((o) => o.skill === 'esquive');
  if (t.kind !== 'dechirure' || t.severity !== 'majeur' || esq?.mod !== -20 || t.recoveryTotal == null) return null;
  if (leftDays > t.recoveryTotal / 2) return null; // pas encore à la mi-durée
  esq.mod = -10; // rémission partielle (l.326)
  return `la déchirure (${t.location}) entre en rémission partielle (−10).`;
}

/**
 * Séquelle PERMANENTE d'une fracture mal ressoudée (LDB 18 l.300/309) : à la fin de la convalescence, un
 * Test de Résistance raté laisse −5 (mineure) / −10 (majeure) en Agilité (Bras/Jambe/Torse) — la Tête
 * (−5/−10 Langue, compétence) est journalisée sans pénalité chiffrée (hors modèle charPenalty).
 */
function fractureSequela(t: Trauma): Trauma | null {
  const pen = t.severity === 'majeur' ? -10 : -5;
  if (t.location === 'tete') return { label: `Fracture mal ressoudée (${t.location})`, location: t.location, ops: [{ op: 'skillMod', skill: 'langue', mod: pen }], desc: 'Sur un échec, vous subirez une pénalité permanente à tous vos Tests de Langue s’il s’agit d’une blessure à la tête mal guérie.' };
  return { label: `Fracture mal ressoudée (${t.location})`, location: t.location, ops: [{ op: 'charMod', char: 'Ag', mod: pen }], desc: 'Sur un échec, vous subirez une pénalité permanente à tous vos Tests d’Agilité pour une blessure au Bras, à la Jambe ou au Torse.' };
}

/** Difficulté du Test de fin de fracture (LDB 18 l.300/309) selon la sévérité. */
export function fractureEndDifficulty(severity: string): Difficulty {
  return severity === 'majeur' ? 'intermediaire' : 'accessible';
}

/**
 * Applique le RÉSULTAT du Test de fin de fracture (séparé du jet pour différer/influencer en cascade) :
 * un échec laisse une SÉQUELLE permanente (−5/−10 Ag, l.300/309), une réussite ressoude proprement.
 * Mute `c.traumas` (ajoute la séquelle) ; renvoie le journal. La fracture résolue a déjà été retirée
 * (et `criticalWounds` décrémenté) par `tickTraumaRecovery`. Partagé eager ⊥ cascade — zéro duplication.
 */
export function applyFractureEnd(c: Combatant, success: boolean, severity: string, location: string, label: string): string[] {
  if (success) return [`${c.name} : ${label} ressoudée proprement.`];
  const seq = fractureSequela({ kind: 'fracture', severity, location, label } as Trauma);
  if (!seq) return [];
  c.traumas = [...(c.traumas ?? []), seq];
  return [`${c.name} : ${label} mal ressoudée — séquelle permanente.`];
}

/**
 * Convalescence : décompte `days` jours sur chaque trauma à durée. Étapes (LDB 18) :
 *  - déchirure majeure → rémission partielle (−20→−10) au passage de la mi-durée (l.326) ;
 *  - fracture atteignant 0 → Test de Résistance de fin (Accessible mineure / Intermédiaire majeure, l.300/309)
 *    SAUF si la fracture a été « réduite » (bandée, `fractureSet`, l.302) ; un échec laisse une séquelle
 *    permanente (−5/−10 Ag). Sinon le trauma disparaît (pénalités levées) + `criticalWounds`−−.
 * `resistVal` = valeur de Résistance effective de `c` (passée par l'appelant pour éviter le cycle d'import).
 * Pur ; mute `c`, renvoie le journal.
 */
export function tickTraumaRecovery(c: Combatant, days: number, rng: RNG = defaultRNG, resistVal = 0, defer?: UpkeepDeferTest): string[] {
  if (!c.traumas?.length || days <= 0) return [];
  const log: string[] = [];
  const remaining: Trauma[] = [];
  const fractureTests: { severity: string; location: string; label: string }[] = [];
  for (const t of c.traumas) {
    if (t.recoveryDays == null) { remaining.push(t); continue; }
    const left = t.recoveryDays - days;
    if (left > 0) {
      const next = { ...t, recoveryDays: left };
      const msg = downgradeTornMuscle(next, left);
      if (msg) log.push(`${c.name} : ${msg}`);
      remaining.push(next);
      continue;
    }
    // Résolu : la fracture/déchirure est retirée, la Blessure critique décomptée (l.317).
    if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1);
    if (t.kind === 'fracture' && !t.fractureSet) fractureTests.push({ severity: t.severity ?? 'mineur', location: t.location ?? '', label: t.label });
    else log.push(`${c.name} guérit de : ${t.label} (${t.location}).`);
  }
  c.traumas = remaining;
  // Test de fin de fracture (l.300/309) : DIFFÉRÉ en étape de cascade si `defer`, sinon roulé ici.
  for (const f of fractureTests) {
    if (defer) {
      defer({ kind: 'traumaFracture', label: `Convalescence — ${f.label}`, base: resistVal, difficulty: fractureEndDifficulty(f.severity),
        meta: { severity: f.severity, location: f.location, traumaLabel: f.label } });
    } else {
      const res = rollTest(resistVal, fractureEndDifficulty(f.severity), rng);
      log.push(...applyFractureEnd(c, res.success, f.severity, f.location, f.label));
    }
  }
  return log;
}

/**
 * Guérison MIRACULEUSE de Blessures critiques (Jalon 2.6 — Larmes de Shallya, LDB 42 : « vous
 * guérissez la cible d'1 Blessure Critique. Pour chaque +2 DR, +1 […] jamais une amputation ») :
 * retire jusqu'à `n` traumas de CONVALESCENCE (déchirures/fractures — `kind` posé ; les
 * amputations et leurs séquelles, sans `kind`, sont exclues) avec leurs pénalités, et décrémente
 * `criticalWounds`. Mute `c`, renvoie le journal.
 */
export function cureCriticalWounds(c: Combatant, n: number): string[] {
  if (!c.traumas?.length || n <= 0) return [];
  const log: string[] = [];
  let left = n;
  const kept: Trauma[] = [];
  for (const t of c.traumas) {
    if (left > 0 && t.kind != null) {
      left -= 1;
      if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1);
      log.push(`${c.name} : ${t.label} (${t.location}) guérit miraculeusement.`);
    } else kept.push(t);
  }
  c.traumas = kept;
  return log;
}

/** Le personnage porte-t-il un trauma exigeant de la Chirurgie (amputation, fracture majeure, l.305/398) ? */
export function hasSurgeryTrauma(c: Combatant): boolean {
  return (c.traumas ?? []).some((t) => t.needsSurgery);
}

/**
 * Fusionne les séquelles CUMULATIVES par comptage (LDB 18) en UN trauma agrégé (≠ modèle non-cumul : ici le
 * RAW est explicitement cumulatif). Mute `c.traumas`, renvoie le journal. Idempotent. Appelé après l'ajout
 * d'une séquelle d'amputation (combat) :
 *  - Doigts par bras (l.341) : −5 aux Tests d'Arme PAR doigt (main principale = brasD) ; **4+ doigts → règle
 *    de la main tranchée** (l.344 : `noTwoHanded` + −20).
 *  - Dents (l.338) : −1 Sociabilité PAR PAIRE perdue (1 dent = 0, 3 = −1, 4 = −2…).
 * `dominant = brasD` (tout le monde droitier). Prothèses : Merveille (doigts/main), Dents en bois (dents).
 */
export function consolidateAmputations(c: Combatant): string[] {
  const log: string[] = [];
  const traumas = c.traumas ?? [];
  const isFinger = (t: Trauma) => t.traumaId === 'doigt-ampute';
  const isTeeth = (t: Trauma) => t.traumaId === 'dents-perdues';
  if (!traumas.some((t) => isFinger(t) || isTeeth(t))) return log;
  const kept = traumas.filter((t) => !isFinger(t) && !isTeeth(t));
  const fingerFiche = traumaFicheById('doigt-ampute');
  const handFiche = traumaFicheById('main-bras-ampute');
  const teethFiche = traumaFicheById('dents-perdues');
  for (const loc of ['brasG', 'brasD'] as const) {
    const grp = traumas.filter((t) => isFinger(t) && t.location === loc);
    if (!grp.length) continue;
    const total = grp.reduce((s, t) => s + (t.count ?? 1), 0);
    const dominant = loc === 'brasD';
    if (total >= 4) {
      if (grp.length > 1) log.push(`${c.name} : 4+ doigts perdus (${loc}) → règle de la main tranchée.`);
      if (!kept.some((t) => t.traumaId === 'main-bras-ampute' && t.location === loc)) {
        const ops: GameOp[] = [{ op: 'maxWeaponHands', hands: 1 }];
        if (dominant) ops.push({ op: 'charMod', char: 'CC', mod: -20 }, { op: 'charMod', char: 'CT', mod: -20 });
        kept.push({ label: `${handFiche.label} (${loc})`, traumaId: handFiche.id, location: loc, ops, prosthesis: handFiche.prosthesis!.map((p) => ({ ...p })), desc: handFiche.desc });
      }
    } else {
      const ops: GameOp[] = dominant ? [{ op: 'charMod', char: 'CC', mod: -5 * total }, { op: 'charMod', char: 'CT', mod: -5 * total }] : [];
      kept.push({ label: `${fingerFiche.label} (${loc})`, traumaId: fingerFiche.id, location: loc, count: total, ...(ops.length ? { ops } : {}), prosthesis: fingerFiche.prosthesis!.map((p) => ({ ...p })), desc: fingerFiche.desc });
    }
  }
  const teeth = traumas.filter(isTeeth);
  if (teeth.length) {
    const total = teeth.reduce((s, t) => s + (t.count ?? 1), 0);
    const soc = -Math.floor(total / 2);
    const ops: GameOp[] = soc < 0 ? [{ op: 'charMod', char: 'Soc', mod: soc }] : [];
    kept.push({ label: teethFiche.label, traumaId: teethFiche.id, location: 'tete', count: total, ...(ops.length ? { ops } : {}), prosthesis: teethFiche.prosthesis!.map((p) => ({ ...p })), desc: teethFiche.desc });
  }
  c.traumas = kept;
  return log;
}

/**
 * Cumul de pertes sensorielles (LDB 18 l.360/363) : perdre le SECOND œil/oreille agrège une séquelle —
 * Cécité (−30 aux Tests liés à la vue : Arme, Esquive, Chevaucher) ou Surdité (−20 Perception auditive,
 * approximée à toute la Perception). Mute `c.traumas`, renvoie le journal ; idempotent. Appelé après l'ajout
 * d'une séquelle d'amputation (combat). Non annulable par prothèse (yeux/oreilles de remplacement = cosmétiques).
 */
export function escalateSensoryLoss(c: Combatant): string[] {
  const log: string[] = [];
  const hasSense = (t: Trauma, s: 'vue' | 'ouie') => traumaOps(t).some((o) => o.op === 'senseLoss' && o.sense === s);
  const eyes = (c.traumas ?? []).filter((t) => hasSense(t, 'vue')).length;
  const ears = (c.traumas ?? []).filter((t) => hasSense(t, 'ouie')).length;
  if (eyes >= 2 && !(c.traumas ?? []).some((t) => t.traumaId === 'cecite')) {
    c.traumas = [...(c.traumas ?? []), traumaById('cecite', undefined, 'tete')];
    log.push(`${c.name} perd la vue (cécité) — −30 aux Tests liés à la vue.`);
  }
  if (ears >= 2 && !(c.traumas ?? []).some((t) => t.traumaId === 'surdite')) {
    c.traumas = [...(c.traumas ?? []), traumaById('surdite', undefined, 'tete')];
    log.push(`${c.name} perd l'ouïe (surdité) — −20 Perception auditive.`);
  }
  return log;
}

/** Le personnage ne peut PAS manier d'arme à deux mains (amputation de main/bras, LDB 18 l.352) — sauf
 *  prothèse qui annule tout (Merveille d'ingénierie, LDB 73). Lu par `recomputeLoadout` via `weaponHands`
 *  — le marqueur « (2M) » de la donnée est UNIFORME mêlée ET distance (Arc/Arbalète/Arquebuse/Tromblon),
 *  donc les armes à distance bimanuelles SONT couvertes. */
export function cannotWieldTwoHanded(c: Combatant): boolean {
  // Crochet PORTÉ et ENTRAÎNÉ (400 PX, LDB 73) : rachète entièrement la pénalité « deux mains ».
  if ((c.items ?? []).some((i) => i.trappingId === 'crochet' && i.equipped && i.prosthesisTrained)) return false;
  return pmods(c, 'maxWeaponHands').some((o) => o.hands < 2);
}

/** La main `hand` est-elle PERDUE (amputation non compensée par une prothèse « tout », Merveille, LDB 73) ?
 *  Convention droitier : main directrice = brasD, secondaire = brasG. Une main perdue ne peut tenir ni arme ni
 *  bouclier → `recomputeLoadout` vide le slot de loadout correspondant. (Un Crochet fournit sa PROPRE arme à
 *  part, dérivée séparément.) */
export function handAmputated(c: Combatant, hand: 'main' | 'off'): boolean {
  const loc = hand === 'main' ? 'brasD' : 'brasG';
  return (c.traumas ?? []).some((t) => t.location === loc && !prosthesisCancels(c, t, 'all') && opsOfType(traumaOps(t), 'maxWeaponHands').some((o) => o.hands < 2));
}

/** Retire un trauma chirurgical (opération réussie) ; décrémente `criticalWounds`. Mute `c`, renvoie le journal.
 *  Les DÉGÂTS de l'opération (1d10 + Hémorragique) et le risque d'Infection sont appliqués par l'appelant
 *  (le store) — ils dépendent de `loseWounds`/`addCondition`, hors de ce module pur (cycle d'import évité). */
/** Les Blessures Critiques d'un personnage qui nécessitent la Chirurgie (amputation, fracture majeure). */
export function surgeryTraumas(c: Combatant): Trauma[] {
  return (c.traumas ?? []).filter((t) => t.needsSurgery);
}

/** Retire le trauma chirurgical d'INDICE `idx` PARMI les blessures chirurgicales (le joueur choisit
 *  quelle Blessure Critique opérer s'il y en a plusieurs ; défaut = la première). */
export function removeSurgicalTrauma(c: Combatant, idx = 0): string[] {
  const surg = surgeryTraumas(c);
  const t = surg[idx] ?? surg[0];
  if (!t) return [`${c.name} : aucune blessure ne relève de la chirurgie.`];
  c.traumas = (c.traumas ?? []).filter((x) => x !== t);
  if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1);
  return [`${c.name} : ${t.label} (${t.location}) réparée par chirurgie.`];
}

/** Le personnage a-t-il un trauma que la Compétence Guérison peut encore traiter ?
 *  Déchirure ou fracture dans sa fenêtre de pose (l.302), dont le jet unique (l.317) n'a pas été employé. */
export function hasTreatableTrauma(c: Combatant): boolean {
  return (c.traumas ?? []).some(eligibleForHeal);
}

function eligibleForHeal(t: Trauma): boolean {
  // Un seul jet de Guérison par trauma (l.317 : « une seule fois ») — l'échec consomme aussi le jet.
  if (t.recoveryDays == null || t.healAccelerated) return false;
  if (t.kind === 'dechirure') return true;
  // fracture : la pose (bandage) doit intervenir dans la SEMAINE suivant la fracture (l.302).
  return t.kind === 'fracture' && !t.fractureSet && t.recoveryTotal != null && t.recoveryDays > t.recoveryTotal - 7;
}

/**
 * Soin assisté d'un trauma par la Compétence Guérison (LDB 18). Le JET est consommé, réussi ou
 * non (l.317 : « vous ne pouvez obtenir cet avantage qu'une seule fois ») — sans quoi, sans MJ,
 * on relancerait gratuitement jusqu'au succès. Sur un succès :
 *  - déchirure (l.317) → raccourcit la convalescence de **1 jour + 1 par DR** ;
 *  - fracture dans la semaine (l.302) → « réduite » (bandée) ⟹ pas de Test de Résistance de fin.
 * La déchirure majeure n'est PAS accélérée (l.326 : la Guérison ne fait qu'informer — laissé en dette).
 */
export function treatTrauma(c: Combatant, dr: number, success = true): string[] {
  const t = (c.traumas ?? []).find(eligibleForHeal);
  if (!t) return [`${c.name} : aucun trauma que la Guérison puisse traiter pour l'instant.`];
  t.healAccelerated = true; // ce trauma a eu son jet de Guérison (l.317)
  if (!success) return [`${c.name} : le traitement de ${t.label} échoue — le mal suivra son cours.`];
  if (t.kind === 'fracture') {
    t.fractureSet = true;
    return [`${c.name} : la fracture (${t.location}) est réduite et bandée — elle ressoudera proprement.`];
  }
  if (t.severity === 'majeur') { // déchirure majeure : Guérison sans effet d'accélération (l.326)
    return [`${c.name} : la Guérison ne peut qu'accompagner la déchirure majeure (rémission en deux temps, l.326).`];
  }
  const cut = 1 + Math.max(0, dr);
  t.recoveryDays = Math.max(0, (t.recoveryDays ?? 0) - cut);
  return [`${c.name} : la Guérison raccourcit la convalescence de ${t.label} de ${cut} jour(s) (reste ${t.recoveryDays}).`];
}

/** Une prothèse ÉQUIPÉE (portée — `items` avec `equipped`, LDB 73 « Enc 0 quand portées ») annule-t-elle
 *  l'`aspect` de la séquelle `t` ? `'movement'` est couvert par une prothèse `'movement'` OU `'all'` ; `'all'`
 *  exige une prothèse `'all'`. La simple POSSESSION (objet au sac, non porté) ne suffit pas. */
function prosthesisCancels(c: Combatant, t: Trauma, aspect: 'movement' | 'all'): boolean {
  if (!t.prosthesis?.length) return false;
  return t.prosthesis.some((p) => {
    const worn = (c.items ?? []).find((i) => i.trappingId === p.trappingId && i.equipped);
    if (!worn) return false;
    const eff = worn.prosthesisTrained ? 'all' : p.cancels; // 200 PX → Esquive réapprise (Fausse jambe, LDB 73)
    return aspect === 'movement' ? true : eff === 'all';
  });
}


/** Insensible à la douleur (LDB 85 p.340) : les pénalités de Blessures Critiques NE DÉCOULANT PAS
 *  d'amputations sont ignorées (les États restent subis). Pur — lit le trait sur `c.traits`. */
function painlessIgnores(c: Combatant, t: Trauma): boolean {
  return isPainless(c.traits) && !/amputation|cécité|surdité/i.test(t.label);
}

/** Quels « annulateurs » neutralisent chaque `kind` d'effet passif — TABLE de la fondation unifiée
 *  (LDB 17 Détermination / 85 Insensible / 73 prothèse). Le `kind` (flag de typage) → ses annulateurs. */
const PASSIVE_CANCELLERS: Record<PassiveKind, ('determination' | 'painless' | 'prosthesis-all' | 'prosthesis-move')[]> = {
  douleur: ['determination', 'painless', 'prosthesis-all'],
  mobilité: ['determination', 'painless', 'prosthesis-move'],
  structurel: ['prosthesis-all'],
  sensoriel: [],
  maladie: ['determination'],
  faim: [], // annulé par `noHunger` (flag de sort) — géré à la source Faim (P2), pas par une prothèse de séquelle
  magique: [], // sort actif : rien ne l'annule (il expire), mais il se combine en POOL non-cumul (≠ intrinsèque additif)
  etat: [], // État (LDB 16) : annulé NON PAS ici mais par le flag de combat `ignoreStatePenalties` (au consommateur) ; pool non-cumul
  intrinsèque: [],
};

/** Le `kind` est-il ADDITIF (sommé dans la base : mutation/qualité, corps/équipement permanent) plutôt que
 *  combiné en POOL non-cumul (trauma/maladie/faim/sort) ? Seuls les `charMod`/`skillMod` distinguent les deux. */
function isAdditiveKind(kind: PassiveKind | undefined): boolean {
  return (kind ?? 'intrinsèque') === 'intrinsèque';
}

/** `kind` DÉRIVÉ d'une op de séquelle (P0 : par type d'op ; la donnée pourra le surcharger plus tard). */
function traumaOpKind(op: GameOp): PassiveKind {
  if (op.op === 'maxWeaponHands') return 'structurel';
  if (op.op === 'senseLoss') return 'sensoriel';
  if (op.op === 'moveScale') return 'mobilité';
  return 'douleur'; // charMod / skillMod
}

/** Un effet passif SURVIT-il à l'état du combattant (Détermination/Insensible/prothèse), selon son `kind` ?
 *  `t` (la séquelle porteuse) n'est requis que pour les annulateurs liés au porteur (Insensible/prothèse) ;
 *  les sources SANS séquelle (maladie/faim — gating par Détermination seule) l'omettent. */
function modSurvives(c: Combatant, kind: PassiveKind, t?: Trauma): boolean {
  for (const canc of PASSIVE_CANCELLERS[kind]) {
    if (canc === 'determination' && (c.activeEffects ?? []).some((e) => e.ignoreCritMods)) return false;
    if (canc === 'painless' && t && painlessIgnores(c, t)) return false;
    if (canc === 'prosthesis-all' && t && prosthesisCancels(c, t, 'all')) return false;
    if (canc === 'prosthesis-move' && t && prosthesisCancels(c, t, 'movement')) return false;
  }
  return true;
}

/**
 * Collecteur UNIQUE des ops PASSIVES (`charMod`/`skillMod`/`moveScale`/`maxWeaponHands`/`senseLoss`) de TOUTES
 * les sources — POINT DE LECTURE pour effectiveChar/testValue/defenseValue/effectiveMovement/recomputeLoadout
 * (via les helpers ci-dessous), filtré par type d'op. Gating UNIFORME par `kind` (table `PASSIVE_CANCELLERS`) :
 *  - séquelle : `kind` dérivé du type d'op (`traumaOpKind`) ;
 *  - sort (ActiveEffect) : kind `intrinsèque` (expire, non annulable) ;
 *  - à terme trait/mutation/objet : poussent leurs `PassiveMod` (kind explicite) au point d'extension.
 * Le charMod de SORT reste lu par effectiveChar (e.char/e.bonus) → non émis ici (pas de double comptage).
 */
/** Multiplie la magnitude d'une op d'État par le nombre de pions (perStack — Exténué −10/pion). Seul
 *  `testMod` (la pénalité par pion) est concerné aujourd'hui ; les autres ops d'État ne sont pas perStack. */
function scaleEtatOp(op: GameOp, mult: number): GameOp {
  if (mult === 1 || op.op !== 'testMod') return op;
  return { ...op, amount: op.amount * mult };
}

export function passiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of c.traumas ?? []) {
    for (const o of traumaOps(t)) { const kind = traumaOpKind(o); if (modSurvives(c, kind, t)) out.push({ op: o, kind }); }
  }
  // Maladies (kind `maladie`, annulée par Détermination — comme l'ex-gating de `diseaseCharPenalties`) +
  // Faim (kind `faim`, non annulée : `noHunger` purge l'état à l'entretien, pas ici). Pénalités de
  // Caractéristique → pool non-cumul. Producteurs SANS cycle (disease/provisions n'importent ni trauma ni
  // characteristics). Gating UNIFORME sans `t` ; sauté en bloc si annulé (perf : pas de boucle par clé).
  if (c.diseases?.length && modSurvives(c, 'maladie')) {
    for (const key of Object.keys(c.characteristics) as CharKey[]) for (const mod of diseaseCharPenalties(c, key)) out.push({ op: { op: 'charMod', char: key, mod }, kind: 'maladie' });
  }
  if (c.hunger && modSurvives(c, 'faim')) {
    for (const key of Object.keys(c.characteristics) as CharKey[]) for (const mod of hungerCharPenalties(c, key)) out.push({ op: { op: 'charMod', char: key, mod }, kind: 'faim' });
  }
  // États (LDB 16) : leur `passive: GameOp[]` (pénalité de Test → `testMod`, bonus à l'attaquant →
  // `incomingAttackMod`, échelle de Mouvement…) émis kind `etat` (pool NON-CUMUL, le pire seul, l.20).
  // VIDE aujourd'hui (migration des 12 États en cours — cf. docs/combat-events-coherence.md, Lot 4) :
  // inerte tant qu'aucun État ne porte de `passive`. L'échelle par stacks (Exténué) et le gating de
  // combat (`ignoreStatePenalties`) sont traités au moment de la migration de chaque État concerné.
  for (const cond of c.conditions ?? []) {
    const ed = findConditionById(cond.name);
    if (!ed?.passive?.length) continue;
    const mult = ed.perStack ? Math.max(1, cond.value ?? 1) : 1; // Exténué −10/pion (LDB 16 l.89)
    for (const op of ed.passive) out.push({ op: scaleEtatOp(op, mult), kind: 'etat' });
  }
  // États PSYCHOLOGIQUES (LDB 21, `psychology.json`) : leur `passive` (Frénésie → `sbBonus +1`) émis dans le
  // MÊME pool `etat` que les États — MÊME folding générique, zéro chemin parallèle. Inerte sans `passive`.
  for (const p of c.psychState ?? [])
    for (const op of findPsychologyById(p.type)?.passive ?? []) out.push({ op, kind: 'etat' });
  // Mutations de Corruption (LDB 19) : modifs PERMANENTES du corps → leur `passive: GameOp[]` (vocab unifié,
  // `mutations.json`) émis tel quel en kind `intrinsèque`, COMME les traits. (L'armure naturelle apAll/
  // apLocations est lue à part par recomputeLoadout.) Lu inline (la donnée `c.mutations` est sur le Combatant).
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) out.push({ op, kind: 'intrinsèque' });
  // Qualités d'objet équipées (LDB 60), producteurs sans cycle (wearPenalty est une feuille) : objet Laid →
  // −Soc aux Tests sociaux (testMod char-qualifié) ; port d'armure → −N% par compétence (skillMod, intrinsèque).
  const soc = wornSocialMod(c);
  if (soc) out.push({ op: { op: 'testMod', amount: soc, char: 'Soc' }, kind: 'intrinsèque' });
  out.push(...qualityWearMods(c));
  // Traits à modificateur de PROFIL appliqués en DIRECT (LDB 85 : Élite/Coriace/Brutal/Rapide… facultatifs,
  // statbloc d'éditeur, traits accordés) — leurs `PassiveMod` (vocab GameOp unifié, `TraitData.passive`) émis
  // TELS QUELS. Les traits INHÉRENTS d'un profil bestiaire FINAL ne sont PAS dans `liveTraits` (déjà cuits dans
  // `characteristics`/`movement`) → zéro double-compte. Les consommateurs (passiveCharSum/passiveMoveMod) somment.
  if (c.liveTraits?.length) out.push(...traitPassiveMods(c.liveTraits));
  // Talents POSSÉDÉS (LDB 10) : leur `passive: GameOp[]` (Coup puissant, Dur à cuire… ou Frénésie →
  // grantFreeAttack) émis kind `intrinsèque`, par niveau — comme les traits. Disjoint → zéro double-compte.
  out.push(...talentPassiveMods(c));
  for (const e of c.activeEffects ?? []) {
    if (e.skillMods) for (const [skill, mod] of Object.entries(e.skillMods)) out.push({ op: { op: 'skillMod', skill, mod }, kind: 'magique' });
    if (e.moveScale) out.push({ op: { op: 'moveScale', num: e.moveScale.num, den: e.moveScale.den }, kind: 'magique' });
    if (e.moveMod) out.push({ op: { op: 'moveMod', mod: e.moveMod }, kind: 'magique' });
    if (e.maxWeaponHands != null) out.push({ op: { op: 'maxWeaponHands', hands: e.maxWeaponHands }, kind: 'magique' });
  }
  return out;
}

/** Ops PASSIVES de type `op` collectées (kind aplati), filtrées par mode de combinaison quand il importe :
 *  `additive===false` → POOL non-cumul (trauma/maladie/sort) ; `additive===true` → Σ (mutation/qualité) ;
 *  absent → toutes (pour les op-types dont la combinaison ne dépend pas du kind : moveScale/maxWeaponHands). */
function pmods<K extends GameOp['op']>(c: Combatant, op: K, additive?: boolean): Extract<GameOp, { op: K }>[] {
  return passiveMods(c)
    .filter((m) => m.op.op === op && (additive == null || isAdditiveKind(m.kind) === additive))
    .map((m) => m.op as Extract<GameOp, { op: K }>);
}

/** Le Mouvement est-il réduit de moitié (séquelle de jambe ou autre source `moveScale`) ? Lu par `effectiveMovement`. */
export function traumaMovementHalved(c: Combatant): boolean {
  return pmods(c, 'moveScale').length > 0;
}

/** Σ des modificateurs PASSIFS du Bonus de Force employé aux DÉGÂTS (`sbBonus`) — Frénésie : +1 (LDB 21
 *  l.34). Lu par le calcul des dégâts (`combat.ts`) à l'endroit du `sb`, en remplacement du drapeau
 *  `frenzied ? 1 : 0` codé en dur — la donnée vient de `psychology.json` via `passiveMods`. */
export function damageSBBonus(c: Combatant): number {
  return pmods(c, 'sbBonus').reduce((n, o) => n + o.amount, 0);
}

/** Σ des `charMod` ADDITIFS (mutation/qualité, kind `intrinsèque`) pour la Caractéristique `key` — sommés
 *  dans la BASE par `effectiveChar` (un corps transformé n'est pas un bonus magique : hors pool non-cumul). */
export function passiveCharSum(c: Combatant, key: CharKey): number {
  return pmods(c, 'charMod', true).filter((o) => o.char === key).reduce((s, o) => s + o.mod, 0);
}

/** Σ de TOUS les `moveMod` (modif ADDITIVE de Mouvement — mutation `intrinsèque` + sort `magique`), additifs
 *  par nature quel que soit le kind. Lu par `effectiveMovement` (sommé avant tout demi-Mouvement). */
export function passiveMoveMod(c: Combatant): number {
  return pmods(c, 'moveMod').reduce((s, o) => s + o.mod, 0);
}

/** Σ des `skillMod` ADDITIFS (mutation/qualité/port d'armure, kind `intrinsèque`) s'appliquant au Test `skill`
 *  (skillId STABLE) — match EXACT par id. Lu par `testValue` ; distinct du POOL non-cumul des séquelles
 *  (`traumaSkillPenalty`). */
export function passiveSkillSum(c: Combatant, skill?: string): number {
  if (!skill) return 0;
  return pmods(c, 'skillMod', true).filter((o) => o.skill === skill).reduce((s, o) => s + o.mod, 0);
}

/** Σ des modificateurs de TEST char-qualifiés (`testMod{char}`, kind `intrinsèque`) pour la Caractéristique
 *  `charKey` — mutation (Visage inversé −20 Soc) + objet équipé (Laid). N'altère PAS la Caractéristique
 *  (≠ charMod, donc hors stats dérivées) : s'ajoute au seul Test. Lu par `testValue`. */
export function passiveTestMod(c: Combatant, charKey: CharKey): number {
  return pmods(c, 'testMod', true).filter((o) => o.char === charKey).reduce((s, o) => s + o.amount, 0);
}

/** Pénalités de Caractéristique PASSIVES non-`intrinsèque` (valeurs négatives, pour le pool « pire pénalité ») :
 *  traumatismes (LDB 18), maladies (LDB 20) et faim (LDB 18 l.422), toutes sources confondues via le collecteur.
 *  Le gating (Détermination/Insensible/prothèse selon le `kind`) est déjà appliqué par `passiveMods`. */
export function traumaCharPenalties(c: Combatant, key: CharKey): number[] {
  // `passiveMods` applique déjà le gating séquelle (Détermination/Insensible/prothèse). Le charMod de SORT
  // est lu à part par effectiveChar (e.char/e.bonus) → non émis par passiveMods. `additive=false` exclut les
  // charMods de mutation/qualité (intrinsèque, sommés dans la base par effectiveChar) → pas de double comptage.
  return pmods(c, 'charMod', false).filter((o) => o.char === key).map((o) => o.mod).filter((p) => p < 0);
}

/** Pire pénalité de mobilité/Esquive due aux traumatismes de jambe (≤ 0 ; non-cumul, LDB l.20). Une prothèse
 *  qui annule TOUT (Merveille d'ingénierie, LDB 73) lève aussi l'Esquive (la Fausse jambe ne rend PAS l'Esquive
 *  sans 200 PX, non modélisé → son −20 subsiste). */
export function traumaDodgePenalty(c: Combatant): number {
  const pens = pmods(c, 'skillMod', false)
    .filter((o) => o.skill.toLowerCase() === 'esquive' && o.mod < 0)
    .map((o) => o.mod);
  return pens.length ? Math.min(...pens) : 0;
}

/** Pire pénalité permanente à une Compétence nommée due aux traumatismes (séquelle de fracture, LDB 18
 *  l.300/309 — ex. −5/−10 « Langue » après une fracture à la Tête). Non-cumul (l.20) ; ≤ 0. */
export function traumaSkillPenalty(c: Combatant, skill?: string): number {
  if (!skill) return 0;
  // Esquive est porté par traumaDodgePenalty (defenseValue) → EXCLU ici pour préserver la séparation historique.
  const pens = pmods(c, 'skillMod', false)
    .filter((o) => o.skill !== 'esquive' && o.skill === skill && o.mod < 0)
    .map((o) => o.mod);
  return pens.length ? Math.min(...pens) : 0;
}
