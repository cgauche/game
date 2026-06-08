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

export type DiseaseSymptomKind = 'malaise' | 'blesse' | 'fievre' | 'persistant' | 'toxine';

export interface DiseaseSymptom {
  kind: DiseaseSymptomKind;
  /** Fièvre (Grave) → alitement/Inconscient (l.136). */
  severity?: 'grave';
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
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && hasSymptom(d, 'blesse')).length;
}

/** Pénalités de Caractéristique dues aux maladies (fièvre −10 aux Tests Physiques et de Sociabilité,
 *  l.135) — injectées dans le pool « pire pénalité » de `effectiveChar` (non-cumul, LDB l.168). */
const PHYSICAL_SOCIAL: CharKey[] = ['CC', 'CT', 'F', 'E', 'Ag', 'Dex', 'Soc'];
export function diseaseCharPenalties(c: Combatant, key: CharKey): number[] {
  if (c.ignoreCritMods) return [];
  const fever = (c.diseases ?? []).some((d) => d.phase === 'active' && hasSymptom(d, 'fievre'));
  return fever && PHYSICAL_SOCIAL.includes(key) ? [-10] : [];
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
      }
    }
    c.diseases = survivors;
  }
  c.diseases = [...c.diseases, ...contracted];
  return log;
}
