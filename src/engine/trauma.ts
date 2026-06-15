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
import { isPainless } from './traits/dispatch';

export type TraumaKind = 'dechirure' | 'fracture';
export type TraumaSeverity = 'mineur' | 'majeur';

const LEG: HitLocation[] = ['jambeG', 'jambeD'];

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

/** `opts.be` (Bonus d'Endurance) + `opts.d10` (1d10 des fractures) → durée de convalescence `recoveryDays`.
 *  Omis (tests/legacy) ⇒ pas de décompte (trauma permanent jusqu'à traitement explicite). */
export function traumaFromKind(
  kind: TraumaKind,
  severity: TraumaSeverity,
  location: HitLocation,
  opts?: { be?: number; d10?: number },
): Trauma {
  const sev = severity === 'mineur' ? 'Mineure' : 'Majeure';
  const recoveryDays = opts?.be == null ? undefined : traumaRecoveryDays(kind, severity, opts.be, opts.d10 ?? 5);
  // Champs de convalescence à étapes (déchirure majeure mi-durée, fenêtre de pose d'une fracture, Test de fin).
  // Une fracture MAJEURE « peu probable de guérir sans intervention médicale » (l.305) exige la Chirurgie.
  const staged = { kind, severity, recoveryDays, recoveryTotal: recoveryDays, ...(kind === 'fracture' && severity === 'majeur' ? { needsSurgery: true } : {}) };
  if (kind === 'dechirure') {
    const onLeg = LEG.includes(location);
    // Jambe : −10 (mineure) / −20 (majeure) aux Tests de mobilité/Esquive (LDB 18 l.315/324).
    const dodge = severity === 'mineur' ? -10 : -20;
    return {
      label: `Déchirure musculaire (${sev})`,
      location,
      ...(onLeg ? { movementHalved: true, dodgePenalty: dodge } : {}),
      ...staged,
      note: onLeg
        ? `Mouvement ÷2 + ${dodge} aux Tests de mobilité de la jambe. Guérison 30−BE jours.`
        : '−10/−20 aux Tests de la Localisation (non modélisé en combat). Guérison 30−BE jours.',
    };
  }
  // fracture
  if (location === 'corps') {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      charPenalty: { F: -30, Ag: -30 },
      ...staged,
      note: '−30 Force et Agilité, Mouvement ÷2. Guérison 30+1d10 jours.',
    };
  }
  if (LEG.includes(location)) {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      dodgePenalty: -20, // règle du Pied (l.369) : −20 aux Tests de mobilité, dont l'Esquive
      ...staged,
      note: 'Mouvement ÷2 + −20 aux Tests de mobilité/Esquive (règle du Pied). Guérison 30+1d10 jours.',
    };
  }
  return {
    label: `Fracture (${sev})`,
    location,
    ...staged,
    note: location === 'tete'
      ? '−30 aux Tests de Langue, régime liquide (non modélisé en combat). Guérison 30+1d10 jours.'
      : 'membre inutilisable (latéralité non modélisée en combat). Guérison 30+1d10 jours.',
  };
}

/** Une déchirure musculaire MAJEURE de jambe guérit en DEUX temps (LDB 18 l.326) : après la 1ʳᵉ moitié
 *  (recoveryTotal/2), la pénalité de mobilité passe de −20 à −10 ; la 2ᵉ moitié achève la guérison. */
function downgradeTornMuscle(t: Trauma, leftDays: number): string | null {
  if (t.kind !== 'dechirure' || t.severity !== 'majeur' || t.dodgePenalty !== -20 || t.recoveryTotal == null) return null;
  if (leftDays > t.recoveryTotal / 2) return null; // pas encore à la mi-durée
  t.dodgePenalty = -10; // rémission partielle (l.326)
  return `la déchirure (${t.location}) entre en rémission partielle (−10).`;
}

/**
 * Séquelle PERMANENTE d'une fracture mal ressoudée (LDB 18 l.300/309) : à la fin de la convalescence, un
 * Test de Résistance raté laisse −5 (mineure) / −10 (majeure) en Agilité (Bras/Jambe/Torse) — la Tête
 * (−5/−10 Langue, compétence) est journalisée sans pénalité chiffrée (hors modèle charPenalty).
 */
function fractureSequela(t: Trauma): Trauma | null {
  const pen = t.severity === 'majeur' ? -10 : -5;
  if (t.location === 'tete') return { label: `Fracture mal ressoudée (${t.location})`, location: t.location, skillPenalty: { langue: pen }, note: `${pen} permanent aux Tests de Langue (mâchoire mal ressoudée).` };
  return { label: `Fracture mal ressoudée (${t.location})`, location: t.location, charPenalty: { Ag: pen }, note: `${pen} permanent en Agilité (os mal ressoudé).` };
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

const PROSTHESIS_MERVEILLE = { name: "Merveille d'ingénierie", cancels: 'all' as const };

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
  const isFinger = (t: Trauma) => !!t.label?.startsWith('Doigts amputés');
  const isTeeth = (t: Trauma) => t.label === 'Dents perdues';
  if (!traumas.some((t) => isFinger(t) || isTeeth(t))) return log;
  const kept = traumas.filter((t) => !isFinger(t) && !isTeeth(t));
  for (const loc of ['brasG', 'brasD'] as const) {
    const grp = traumas.filter((t) => isFinger(t) && t.location === loc);
    if (!grp.length) continue;
    const total = grp.reduce((s, t) => s + (t.count ?? 1), 0);
    const dominant = loc === 'brasD';
    if (total >= 4) {
      if (grp.length > 1) log.push(`${c.name} : 4+ doigts perdus (${loc}) → règle de la main tranchée.`);
      if (!kept.some((t) => t.label?.startsWith('Main/bras amputé') && t.location === loc)) {
        kept.push({ label: `Main/bras amputé (${loc})`, location: loc, noTwoHanded: true, ...(dominant ? { charPenalty: { CC: -20, CT: -20 } } : {}), prosthesis: [PROSTHESIS_MERVEILLE], note: `${total} doigts perdus (${loc}) → règle de la main (pas d'arme à 2 mains${dominant ? ', −20 Tests d’Arme' : ''}).` });
      }
    } else {
      kept.push({ label: `Doigts amputés (${loc})`, location: loc, count: total, ...(dominant ? { charPenalty: { CC: -5 * total, CT: -5 * total } } : {}), prosthesis: [PROSTHESIS_MERVEILLE], note: `${total} doigt(s) (${loc}) → −${5 * total} aux Tests d'Arme (main principale).` });
    }
  }
  const teeth = traumas.filter(isTeeth);
  if (teeth.length) {
    const total = teeth.reduce((s, t) => s + (t.count ?? 1), 0);
    const soc = -Math.floor(total / 2);
    kept.push({ label: 'Dents perdues', location: 'tete', count: total, ...(soc < 0 ? { charPenalty: { Soc: soc } } : {}), prosthesis: [{ name: 'Dents en bois', cancels: 'all' }], note: `${total} dents perdues → ${soc} Sociabilité (−1 par paire). Prothèse : Dents en bois.` });
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
  const eyes = (c.traumas ?? []).filter((t) => t.sense === 'vue').length;
  const ears = (c.traumas ?? []).filter((t) => t.sense === 'ouie').length;
  if (eyes >= 2 && !(c.traumas ?? []).some((t) => t.label === 'Cécité')) {
    c.traumas = [...(c.traumas ?? []), { label: 'Cécité', location: 'tete', charPenalty: { CC: -30, CT: -30 }, dodgePenalty: -30, skillPenalty: { chevaucher: -30 }, note: 'perte des DEUX yeux — −30 aux Tests liés à la vue (Arme, Esquive, Chevaucher).' }];
    log.push(`${c.name} perd la vue (cécité) — −30 aux Tests liés à la vue.`);
  }
  if (ears >= 2 && !(c.traumas ?? []).some((t) => t.label === 'Surdité')) {
    c.traumas = [...(c.traumas ?? []), { label: 'Surdité', location: 'tete', skillPenalty: { perception: -20 }, note: 'perte des DEUX oreilles — −20 aux Tests de Perception auditive.' }];
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
  if ((c.items ?? []).some((i) => i.name === 'Crochet' && i.equipped && i.prosthesisTrained)) return false;
  return (c.traumas ?? []).some((t) => t.noTwoHanded && !prosthesisCancels(c, t, 'all'));
}

/** La main `hand` est-elle PERDUE (amputation non compensée par une prothèse « tout », Merveille, LDB 73) ?
 *  Convention droitier : main directrice = brasD, secondaire = brasG. Une main perdue ne peut tenir ni arme ni
 *  bouclier → `recomputeLoadout` vide le slot de loadout correspondant. (Un Crochet fournit sa PROPRE arme à
 *  part, dérivée séparément.) */
export function handAmputated(c: Combatant, hand: 'main' | 'off'): boolean {
  const loc = hand === 'main' ? 'brasD' : 'brasG';
  return (c.traumas ?? []).some((t) => t.noTwoHanded && t.location === loc && !prosthesisCancels(c, t, 'all'));
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
    const worn = (c.items ?? []).find((i) => i.name === p.name && i.equipped);
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

/** Un trauma réduit-il le Mouvement de moitié ? (Détermination « ignorer modifs de critique » → non, LDB 17 l.64 ;
 *  une prothèse portée — Fausse jambe / Merveille — annule la séquelle de jambe, LDB 73.) */
export function traumaMovementHalved(c: Combatant): boolean {
  if (c.ignoreCritMods) return false;
  return (c.traumas ?? []).some((t) => t.movementHalved === true && !prosthesisCancels(c, t, 'movement') && !painlessIgnores(c, t));
}

/** Pénalités de Caractéristique dues aux traumatismes (valeurs négatives, pour le pool « pire pénalité »).
 *  Une prothèse qui annule TOUT (Nez doré, Œil de verre, Merveille…, LDB 73) lève la pénalité de sa séquelle. */
export function traumaCharPenalties(c: Combatant, key: CharKey): number[] {
  if (c.ignoreCritMods) return []; // Détermination : modificateurs de critique ignorés ce Round (LDB 17 l.64)
  return (c.traumas ?? [])
    .filter((t) => !prosthesisCancels(c, t, 'all') && !painlessIgnores(c, t))
    .map((t) => t.charPenalty?.[key] ?? 0)
    .filter((p) => p < 0);
}

/** Pire pénalité de mobilité/Esquive due aux traumatismes de jambe (≤ 0 ; non-cumul, LDB l.20). Une prothèse
 *  qui annule TOUT (Merveille d'ingénierie, LDB 73) lève aussi l'Esquive (la Fausse jambe ne rend PAS l'Esquive
 *  sans 200 PX, non modélisé → son −20 subsiste). */
export function traumaDodgePenalty(c: Combatant): number {
  if (c.ignoreCritMods) return 0; // Détermination : modificateurs de critique ignorés ce Round (LDB 17 l.64)
  const pens = (c.traumas ?? [])
    .filter((t) => !prosthesisCancels(c, t, 'all') && !painlessIgnores(c, t))
    .map((t) => t.dodgePenalty ?? 0)
    .filter((p) => p < 0);
  return pens.length ? Math.min(...pens) : 0;
}

/** Pire pénalité permanente à une Compétence nommée due aux traumatismes (séquelle de fracture, LDB 18
 *  l.300/309 — ex. −5/−10 « Langue » après une fracture à la Tête). Non-cumul (l.20) ; ≤ 0. */
export function traumaSkillPenalty(c: Combatant, skill?: string): number {
  if (!skill || c.ignoreCritMods) return 0;
  const low = skill.toLowerCase();
  const pens = (c.traumas ?? [])
    .filter((t) => !prosthesisCancels(c, t, 'all') && !painlessIgnores(c, t))
    .map((t) => {
      const sp = t.skillPenalty;
      if (!sp) return 0;
      const key = Object.keys(sp).find((k) => low === k || low.startsWith(k)); // « langue (reikspiel) » → « langue »
      return key ? sp[key] : 0;
    })
    .filter((p) => p < 0);
  return pens.length ? Math.min(...pens) : 0;
}
