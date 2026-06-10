/**
 * Maladies et infections — Livre de base, « Maladies et infections » (20-Maladies et infections.md).
 * Moteur PUR, sur le modèle de `trauma.ts` : on NE modélise QUE ce que la source quantifie, sans rien
 * inventer. Cycle d'import évité comme pour les traumas — `characteristics.ts` importe `diseaseCharPenalties`
 * d'ici, donc ce module n'importe NI `characteristics` NI `conditions` (les valeurs — Résistance — sont
 * passées par l'appelant). Il ne dépend que de `tests`/`dice`.
 *
 * Cycle de vie (l.10-24) : Contraction (Test raté) → Incubation (jours) → symptômes ACTIFS → Durée (jours)
 * → résolution (symptôme « persistant » : Test de fin, sinon guérison naturelle). Décompté JOUR PAR JOUR
 * pendant le repos (`rest.ts`).
 *
 * Symptômes modélisés (ceux des maladies câblées) :
 *  - malaise (l.152)   : État Exténué tant que la maladie n'est pas guérie → géré par l'appelant (rest).
 *  - blessé (l.110)    : bloque la guérison d'1 PB par symptôme + Test de Résistance Accessible (+20)
 *                        journalier ou Blessure Purulente.
 *  - fièvre (l.135)    : −10 aux Tests Physiques et de Sociabilité (via `diseaseCharPenalties`) ;
 *                        (Grave) → Inconscient (journalisé, alitement).
 *  - persistant (X) (l.162) : à la fin de la Durée, Test de Résistance (difficulté X). Échec minime → +1d10
 *                        jours ; échec (−2) → Blessure Purulente ; échec stupéfiant (−6) → Infection du Sang.
 *  - toxine (l.172)    : Test de Résistance Très Facile (+60) journalier (conséquence létale laissée au-delà
 *                        du MVP — texte source tronqué, on n'invente pas).
 */
import { Combatant, CharKey, Difficulty } from './types';
import { RNG, defaultRNG, roll } from './dice';
import { rollTest } from './tests';

export type DiseaseSymptomKind =
  | 'malaise' | 'blesse' | 'fievre' | 'persistant' | 'toxine'
  // Compléments LDB 20 (« Symptômes », l.99-200) :
  | 'bubons' // −10 Tests Physiques et de Sociabilité ; percement par Chirurgie (l.114-119)
  | 'convulsions' // −10 Tests Physiques ; (Modérée) −20 ; (Grave) incapacité totale (l.121-124)
  | 'demangeaisons' // −10 Tests de Sociabilité (l.126-129)
  | 'gangrene' // Test de Résistance +20/jour ; échecs > BE → Localisation perdue (Amputation) ; −10 Soc + blessé + toxine (l.135+)
  | 'intoxication' // épisodes MJ ; (Grave) −1 PB par épisode — journalisé (l.150+)
  | 'nausee' // Test de déplacement raté → vomit → Sonné (l.170+)
  | 'touxEternuements'; // contagion : exposition de l'entourage, Test par heure (l.185+)

export interface DiseaseSymptom {
  kind: DiseaseSymptomKind;
  /** Fièvre (Grave) → alitement/Inconscient (l.136) ; Convulsions/Intoxication (Modérée/Grave). */
  severity?: 'moderee' | 'grave';
  /** Difficulté du Test de fin d'un symptôme « persistant » (l.162). */
  difficulty?: Difficulty;
}

interface Dice {
  n: number;
  d: number;
  plus?: number;
}

export interface DiseaseDef {
  name: string;
  /** Difficulté du Test de Contraction (pour mémoire/journal — la contraction est déclenchée par l'appelant). */
  contractDifficulty: Difficulty;
  incubation: Dice;
  duration: Dice;
  symptoms: DiseaseSymptom[];
  /** Vérole Urticante (l.97) : « vous ne pouvez pas l'attraper une seconde fois » — immunité après guérison. */
  immuneAfterCure?: boolean;
}

/** Instance de maladie portée par un personnage. */
export interface Disease {
  name: string;
  symptoms: DiseaseSymptom[];
  phase: 'incubation' | 'active';
  /** Jours restants dans la phase courante (incubation, puis durée active). */
  daysLeft: number;
  /** Durée active (mémorisée pendant l'incubation pour la basculer une fois l'incubation finie). */
  durationDays: number;
  /** Difficulté du Test « persistant » de fin de durée (dérivée des symptômes). */
  persistDifficulty?: Difficulty;
  /** Gangrène (l.135+) : échecs cumulés du Test journalier — au-delà du BE, la Localisation est perdue. */
  gangreneFails?: number;
  /** Gangrène : la Localisation est devenue inutilisable (Amputation requise — journalisé). */
  gangreneLost?: boolean;
  /** Bénédiction de Convalescence reçue (LDB 41 : « une fois par maladie et par personne ») —
   *  approximation : une fois par maladie. */
  convalescenceBlessed?: boolean;
}

function rollDice(dc: Dice, rng: RNG): number {
  return roll(dc.n, dc.d, rng) + (dc.plus ?? 0);
}

// Registre des maladies CÂBLÉES (sourcées verbatim de LDB 20). D'autres maladies de la « Litanie de la
// Pestilence » (Courante Galopante, Fièvre du Rongeur, Peste Noire…) s'ajoutent ici par une entrée.
export const DISEASE_DEFS: Record<string, DiseaseDef> = {
  // l.69-72 — contraction sur Résistance Très Facile (+60) ratée après un combat où l'on a subi un critique.
  'Infection Mineure': {
    name: 'Infection Mineure',
    contractDifficulty: 'tresFacile',
    incubation: { n: 1, d: 10 },
    duration: { n: 1, d: 10 },
    symptoms: [{ kind: 'blesse' }, { kind: 'malaise' }, { kind: 'persistant', difficulty: 'facile' }],
  },
  // l.29-34 — coupure infectée (Trait Infecté / développée depuis une Infection Mineure).
  'Blessure Purulente': {
    name: 'Blessure Purulente',
    contractDifficulty: 'facile',
    incubation: { n: 1, d: 10 },
    duration: { n: 1, d: 10 },
    symptoms: [
      { kind: 'fievre' },
      { kind: 'persistant', difficulty: 'intermediaire' },
      { kind: 'malaise' },
      { kind: 'blesse' },
    ],
  },
  // l.64-67 — développement d'une autre maladie OU après une Blessure critique ; mortelle si non traitée.
  'Infection du Sang': {
    name: 'Infection du Sang',
    contractDifficulty: 'tresFacile',
    incubation: { n: 0, d: 1, plus: -1 }, // instantanée (l.67)
    duration: { n: 1, d: 10 },
    symptoms: [{ kind: 'fievre', severity: 'grave' }, { kind: 'malaise' }, { kind: 'toxine' }],
  },
  // l.39-44 — « sur un échec d'un Test d'Endurance Facile (+40) après avoir ingurgité de la matière
  // infectée. Incubation : 1d10 heures » → active le jour même (échelle journalière du repos).
  'Courante Galopante': {
    name: 'Courante Galopante',
    contractDifficulty: 'facile',
    incubation: { n: 0, d: 1 }, // 1d10 HEURES — symptômes déclarés le jour même
    duration: { n: 1, d: 10 },
    symptoms: [{ kind: 'intoxication', severity: 'moderee' }, { kind: 'malaise' }, { kind: 'nausee' }],
  },
  // l.46-55 — Résistance Accessible (+20) après un combat contre des RONGEURS Infectés (skavens compris).
  'Fièvre du Rongeur': {
    name: 'Fièvre du Rongeur',
    contractDifficulty: 'accessible',
    incubation: { n: 3, d: 10, plus: 5 },
    duration: { n: 3, d: 10, plus: 10 },
    symptoms: [
      { kind: 'blesse' }, { kind: 'convulsions' }, { kind: 'demangeaisons' },
      { kind: 'fievre' }, { kind: 'malaise' }, { kind: 'persistant', difficulty: 'accessible' },
    ],
  },
  // l.57-62 — Endurance Facile (+40) après ingestion de matière infectée.
  'Flux Sanglant': {
    name: 'Flux Sanglant',
    contractDifficulty: 'facile',
    incubation: { n: 2, d: 10 },
    duration: { n: 1, d: 10 },
    symptoms: [
      { kind: 'fievre' }, { kind: 'intoxication', severity: 'grave' }, { kind: 'malaise' },
      { kind: 'nausee' }, { kind: 'persistant', difficulty: 'intermediaire' },
    ],
  },
  // l.74-83 — Résistance Accessible (+20) par heure en zone infectée. Incubation 1d10 minutes → immédiate.
  'Peste Noire': {
    name: 'Peste Noire',
    contractDifficulty: 'accessible',
    incubation: { n: 0, d: 1 }, // 1d10 MINUTES — immédiate à l'échelle du jour
    duration: { n: 3, d: 10 },
    symptoms: [{ kind: 'bubons' }, { kind: 'fievre' }, { kind: 'gangrene' }, { kind: 'malaise' }, { kind: 'toxine', severity: 'moderee' }],
  },
  // l.85-88 — Résistance Facile (+40) après contact avec un animal/peau/cadavre infecté.
  'Vérole du Tanneur': {
    name: 'Vérole du Tanneur',
    contractDifficulty: 'facile',
    incubation: { n: 1, d: 10 },
    duration: { n: 5, d: 10 },
    symptoms: [{ kind: 'demangeaisons' }, { kind: 'persistant', difficulty: 'intermediaire' }],
  },
  // l.90-97 — Résistance Accessible (+20) au contact / toux d'un contagieux (Test par heure).
  // « vous ne pouvez pas l'attraper une seconde fois » → immunité après guérison.
  'Vérole Urticante': {
    name: 'Vérole Urticante',
    contractDifficulty: 'accessible',
    incubation: { n: 1, d: 10 },
    duration: { n: 1, d: 10, plus: 7 },
    symptoms: [{ kind: 'demangeaisons' }, { kind: 'touxEternuements' }],
    immuneAfterCure: true,
  },
};

/** Construit une instance de maladie (tire incubation/durée). `opts.incubation`/`opts.duration` figent les
 *  jets (tests, ou contraction « instantanée » depuis un autre symptôme — l.32). Renvoie `null` si inconnue. */
export function contractDisease(
  name: string,
  rng: RNG = defaultRNG,
  opts?: { incubation?: number; duration?: number },
): Disease | null {
  const def = DISEASE_DEFS[name];
  if (!def) return null;
  const incub = Math.max(0, opts?.incubation ?? rollDice(def.incubation, rng));
  const dur = Math.max(1, opts?.duration ?? rollDice(def.duration, rng));
  const persist = def.symptoms.find((s) => s.kind === 'persistant')?.difficulty;
  return {
    name,
    symptoms: def.symptoms,
    phase: incub > 0 ? 'incubation' : 'active',
    daysLeft: incub > 0 ? incub : dur,
    durationDays: dur,
    persistDifficulty: persist,
  };
}

function hasSymptom(dz: Disease, kind: DiseaseSymptomKind): boolean {
  return dz.symptoms.some((s) => s.kind === kind);
}

/**
 * Test de CONTRACTION d'une maladie (LDB 20) : un Test de Résistance `difficulty` raté la fait contracter
 * (dédoublonnée par nom). `resistVal` = Résistance effective, passée par l'appelant (cycle évité). Mute
 * `c.diseases`, renvoie le journal. Sert au post-critique (Très Facile +60, l.72) ET à la Chirurgie
 * (Accessible +20, talent Chirurgie / l.365). Réussite ou maladie déjà présente → rien.
 */
export function rollContraction(
  c: Combatant,
  diseaseName: string,
  resistVal: number,
  difficulty: Difficulty,
  rng: RNG = defaultRNG,
): string[] {
  if ((c.diseases ?? []).some((d) => d.name === diseaseName)) return [];
  // Vérole Urticante (l.97) : « vous ne pouvez pas l'attraper une seconde fois ».
  if ((c.diseaseImmunities ?? []).includes(diseaseName)) return [];
  if (rollTest(resistVal, difficulty, rng).success) return [];
  const dz = contractDisease(diseaseName, rng);
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [`${c.name} contracte : ${diseaseName} (Test de Résistance raté).`];
}

/** Maladies ACTIVES portant le symptôme « malaise » (l.152) — chacune impose un Exténué « collant »
 *  (non dissipé par le repos tant que la maladie dure). Lu par `rest.ts` pour gérer l'État Exténué. */
export function activeMalaiseCount(c: Combatant): number {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && hasSymptom(d, 'malaise')).length;
}

/** Nombre de symptômes « blessé » actifs (l.110) — chacun bloque la guérison d'1 Point de Blessure. */
export function diseaseBlesseCount(c: Combatant): number {
  // Gangrène : « vous subissez le symptôme Blessé » (l.140) → compte aussi.
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && (hasSymptom(d, 'blesse') || hasSymptom(d, 'gangrene'))).length;
}

/** Pénalités de Caractéristique dues aux maladies (fièvre −10 aux Tests Physiques et de Sociabilité,
 *  l.135) — injectées dans le pool « pire pénalité » de `effectiveChar` (non-cumul, LDB l.168). */
const PHYSICAL_SOCIAL: CharKey[] = ['CC', 'CT', 'F', 'E', 'Ag', 'Dex', 'Soc'];
const PHYSICAL: CharKey[] = ['CC', 'CT', 'F', 'E', 'Ag', 'Dex'];
export function diseaseCharPenalties(c: Combatant, key: CharKey): number[] {
  if (c.ignoreCritMods) return [];
  const out: number[] = [];
  const active = (c.diseases ?? []).filter((d) => d.phase === 'active');
  const has = (k: DiseaseSymptomKind) => active.some((d) => d.symptoms.some((sy) => sy.kind === k));
  const sev = (k: DiseaseSymptomKind) => active.flatMap((d) => d.symptoms.filter((sy) => sy.kind === k)).some((sy) => sy.severity === 'moderee' || sy.severity === 'grave');
  // Fièvre (l.135) et Bubons (l.114) : −10 aux Tests Physiques ET de Sociabilité.
  if ((has('fievre') || has('bubons')) && PHYSICAL_SOCIAL.includes(key)) out.push(-10);
  // Convulsions (l.121) : −10 Tests Physiques ; (Modérée/Grave) −20.
  if (has('convulsions') && PHYSICAL.includes(key)) out.push(sev('convulsions') ? -20 : -10);
  // Démangeaisons (l.126) et Gangrène (l.135+) : −10 aux Tests de Sociabilité.
  if ((has('demangeaisons') || has('gangrene')) && key === 'Soc') out.push(-10);
  return out;
}

/** Le combattant souffre-t-il du symptôme `kind` (maladie ACTIVE) ? — pour les câblages d'État
 *  (Nausée → Sonné sur Test de déplacement raté, Toux → contagion, l.170/185). */
export function hasActiveSymptom(c: Combatant, kind: DiseaseSymptomKind): boolean {
  return (c.diseases ?? []).some((d) => d.phase === 'active' && d.symptoms.some((sy) => sy.kind === kind));
}

/** Maladies ACTIVES contagieuses (symptôme « toux et éternuements », l.185) — pour la contagion au repos. */
export function contagiousDiseases(c: Combatant): Disease[] {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && d.symptoms.some((sy) => sy.kind === 'touxEternuements'));
}

/**
 * Décompte de `days` jours de maladie pour `c` (appelé jour par jour par le repos). Mute `c.diseases`,
 * renvoie le journal. `resistVal` = Résistance effective (passée par l'appelant, cycle évité). Par jour :
 *  - incubation : −1 jour ; à 0 → symptômes ACTIFS (durée mémorisée) ;
 *  - active : symptôme « blessé » → Test de Résistance Accessible (+20) ou Blessure Purulente (l.110) ;
 *             symptôme « toxine » → Test de Résistance Très Facile (+60) journalier (l.172, conséquence non modélisée) ;
 *             −1 jour ; à 0 → résolution du symptôme « persistant » (l.162), sinon guérison naturelle.
 */
export function tickDisease(c: Combatant, days: number, rng: RNG = defaultRNG, resistVal = 0): string[] {
  if (!c.diseases?.length || days <= 0) return [];
  const log: string[] = [];
  // On boucle jour par jour ; les nouvelles maladies (Blessure Purulente / Infection du Sang) sont
  // accumulées puis ajoutées en fin de tick (elles n'évoluent qu'aux jours suivants).
  const contracted: Disease[] = [];
  const contractOnce = (name: string) => {
    if (c.diseases!.some((d) => d.name === name) || contracted.some((d) => d.name === name)) return false;
    const dz = contractDisease(name, rng, { incubation: 0 }); // « instantanée » depuis un autre symptôme (l.32)
    if (dz) {
      contracted.push(dz);
      log.push(`${c.name} développe : ${name}.`);
    }
    return true;
  };

  for (let day = 0; day < days; day++) {
    const survivors: Disease[] = [];
    for (const dz of c.diseases) {
      if (dz.phase === 'incubation') {
        dz.daysLeft -= 1;
        if (dz.daysLeft <= 0) {
          dz.phase = 'active';
          dz.daysLeft = dz.durationDays;
          log.push(`${c.name} : les symptômes de « ${dz.name} » se déclarent.`);
        }
        survivors.push(dz);
        continue;
      }
      // active
      if (hasSymptom(dz, 'blesse')) {
        const res = rollTest(resistVal, 'accessible', rng); // l.110 : Résistance Accessible (+20)
        if (!res.success) contractOnce('Blessure Purulente');
      }
      if (hasSymptom(dz, 'toxine')) {
        rollTest(resistVal, 'tresFacile', rng); // l.172 : Résistance Très Facile (+60) journalier (conséquence non modélisée)
      }
      // Gangrène (l.135+) : Test de Résistance Accessible (+20) journalier ; plus d'échecs que le
      // Bonus d'Endurance → la Localisation est PERDUE (règles d'Amputation — journalisé, MJ/Chirurgie).
      if (hasSymptom(dz, 'gangrene') && !dz.gangreneLost) {
        if (!rollTest(resistVal, 'accessible', rng).success) {
          dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
          const be = Math.floor(resistVal / 10); // approximation BE ≈ Endurance/10 (resistVal = E + avances)
          if (dz.gangreneFails > be) {
            dz.gangreneLost = true;
            log.push(`${c.name} : la Gangrène a gagné — la Localisation atteinte est inutilisable (Amputation requise, LDB 20).`);
          } else log.push(`${c.name} : la Gangrène progresse (${dz.gangreneFails} échec(s)).`);
        }
      }
      dz.daysLeft -= 1;
      if (dz.daysLeft > 0) {
        survivors.push(dz);
        continue;
      }
      // Fin de Durée — résolution.
      if (dz.persistDifficulty) {
        const res = rollTest(resistVal, dz.persistDifficulty, rng); // l.162
        if (res.success) {
          log.push(`${c.name} guérit de : ${dz.name}.`);
          if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; // Vérole Urticante (l.97)
        } else if (res.sl <= -6) {
          log.push(`${c.name} : ${dz.name} dégénère (échec stupéfiant).`);
          contractOnce('Infection du Sang');
        } else if (res.sl <= -2) {
          log.push(`${c.name} : ${dz.name} s'infecte (échec).`);
          contractOnce('Blessure Purulente');
        } else {
          const extra = roll(1, 10, rng); // échec minime → +1d10 jours (l.163)
          dz.daysLeft = extra;
          log.push(`${c.name} : ${dz.name} persiste (+${extra} jours).`);
          survivors.push(dz);
        }
      } else {
        log.push(`${c.name} guérit de : ${dz.name}.`);
        if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; // Vérole Urticante (l.97)
      }
    }
    c.diseases = survivors;
  }
  c.diseases = [...c.diseases, ...contracted];
  return log;
}
