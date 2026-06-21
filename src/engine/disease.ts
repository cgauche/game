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
import { Combatant, CharKey, Difficulty, UpkeepDeferTest } from './types';
import { RNG, defaultRNG, roll, type DiceSpec, rollDice } from './dice';
import { rollTest } from './tests';
import { maladies, diseaseLabel } from '../data';

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

export interface DiseaseDef {
  /** id STABLE (slug du nom) — clé de `maladies.json`, cible de `Disease.name` et des refs. */
  id: string;
  /** Nom d'affichage (français) — résolu via `diseaseLabel` ; ≠ id. */
  name: string;
  /** Difficulté du Test de Contraction (pour mémoire/journal — la contraction est déclenchée par l'appelant). */
  contractDifficulty: Difficulty;
  incubation: DiceSpec;
  duration: DiceSpec;
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
  /** Cascade de nuit : le Test « persistant » de fin de durée est DIFFÉRÉ (étape influençable) ; la
   *  maladie reste en attente de résolution jusqu'à la validation de l'étape (`applyDiseasePersist`). */
  endTestPending?: boolean;
}


// Registre des maladies CÂBLÉES — DÉRIVÉ de `maladies.json` (data app-owned, éditable au Codex), keyé
// par `id`. Les valeurs verbatim (LDB 20) vivent désormais dans la donnée ; le COMPORTEMENT (cycle,
// symptômes) reste ici. Ajouter une maladie = une entrée dans `maladies.json`.
export const DISEASE_DEFS: Record<string, DiseaseDef> = Object.fromEntries(
  (maladies as DiseaseDef[]).map((m) => [m.id, m]),
);
/** ids des maladies CANONIQUES (LDB 20) référencées par le moteur (cascade persistant, contagions). Pas de
 *  chaîne magique. Garde-fou de synchro `DISEASES`⇄`maladies.json` : `refs-migrated.test`. */
export const DISEASES = {
  infectionMineure: 'infection-mineure', blessurePurulente: 'blessure-purulente', infectionDuSang: 'infection-du-sang',
  couranteGalopante: 'courante-galopante', fievreDuRongeur: 'fievre-du-rongeur', fluxSanglant: 'flux-sanglant',
  pesteNoire: 'peste-noire', veroleDuTanneur: 'verole-du-tanneur', veroleUrticante: 'verole-urticante',
} as const;

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
/** Un Test de Contraction de `diseaseName` tomberait-il pour `c` ? (Non si déjà porteur ou immunisé.)
 *  Sépare la DÉCISION du jet (pour différer en cascade) de sa résolution. */
export function contractionDue(c: Combatant, diseaseName: string): boolean {
  if ((c.diseases ?? []).some((d) => d.name === diseaseName)) return false;
  return !(c.diseaseImmunities ?? []).includes(diseaseName); // Vérole Urticante (l.97) : pas deux fois
}

/** Applique le RÉSULTAT d'un Test de Contraction DIFFÉRÉ : échec → contracte la maladie. Mute `c.diseases`. */
export function applyContraction(c: Combatant, diseaseName: string, success: boolean, rng: RNG = defaultRNG): string[] {
  if (success || !contractionDue(c, diseaseName)) return [];
  const dz = contractDisease(diseaseName, rng);
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [`${c.name} contracte : ${diseaseLabel(diseaseName)}.`];
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
  if (!contractionDue(c, diseaseName)) return [];
  return applyContraction(c, diseaseName, rollTest(resistVal, difficulty, rng).success, rng);
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
  // Producteur PUR : le gating par Détermination (`ignoreCritMods`) est appliqué par le collecteur passif
  // unifié (kind `maladie`, table `PASSIVE_CANCELLERS`) — plus ici, pour éviter le double-gating.
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

/** Contracte une maladie « instantanée » (depuis un autre symptôme, l.32) si pas déjà présente.
 *  Mute `c.diseases` directement (appelé HORS itération — par les applicateurs de cascade). */
export function contractDiseaseOnce(c: Combatant, name: string, rng: RNG = defaultRNG): string[] {
  if ((c.diseases ?? []).some((d) => d.name === name)) return [];
  const dz = contractDisease(name, rng, { incubation: 0 });
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [`${c.name} développe : ${diseaseLabel(name)}.`];
}

/** Conséquence d'un Test de symptôme « blessé » DIFFÉRÉ (l.110) : échec → Blessure Purulente. */
export function applyDiseaseBlesse(c: Combatant, success: boolean, rng: RNG = defaultRNG): string[] {
  return success ? [] : contractDiseaseOnce(c, 'blessure-purulente', rng);
}

/** Conséquence d'un Test de Gangrène DIFFÉRÉ (l.135+) : échec → +1 échec ; au-delà du BE → Localisation perdue. */
export function applyDiseaseGangrene(c: Combatant, diseaseName: string, success: boolean, be: number): string[] {
  if (success) return [];
  const dz = (c.diseases ?? []).find((d) => d.name === diseaseName && d.phase === 'active');
  if (!dz) return [];
  dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
  if (dz.gangreneFails > be) {
    dz.gangreneLost = true;
    return [`${c.name} : la Gangrène a gagné — la Localisation atteinte est inutilisable (Amputation requise).`];
  }
  return [`${c.name} : la Gangrène progresse (${dz.gangreneFails} échec(s)).`];
}

/** Conséquence du Test « persistant » de fin de durée DIFFÉRÉ (l.162) : réussite → guérison ;
 *  DR ≤ −6 → Infection du Sang ; ≤ −2 → Blessure Purulente ; sinon → +1d10 jours. La maladie en
 *  attente (`endTestPending`) est retirée (ou prolongée). Mute `c.diseases`. */
export function applyDiseasePersist(c: Combatant, diseaseName: string, success: boolean, sl: number, rng: RNG = defaultRNG): string[] {
  const dz = (c.diseases ?? []).find((d) => d.name === diseaseName && d.endTestPending);
  if (!dz) return [];
  dz.endTestPending = undefined;
  const log: string[] = [];
  const remove = () => { c.diseases = (c.diseases ?? []).filter((d) => d !== dz); };
  const cure = () => { remove(); log.push(`${c.name} guérit de : ${diseaseLabel(dz.name)}.`); if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; };
  if (success) cure();
  else if (sl <= -6) { remove(); log.push(`${c.name} : ${diseaseLabel(dz.name)} dégénère (échec stupéfiant).`); log.push(...contractDiseaseOnce(c, 'infection-du-sang', rng)); }
  else if (sl <= -2) { remove(); log.push(`${c.name} : ${diseaseLabel(dz.name)} s'infecte (échec).`); log.push(...contractDiseaseOnce(c, 'blessure-purulente', rng)); }
  else { const extra = roll(1, 10, rng); dz.daysLeft = extra; log.push(`${c.name} : ${diseaseLabel(dz.name)} persiste (+${extra} jours).`); }
  return log;
}

/**
 * Décompte de `days` jours de maladie pour `c` (appelé jour par jour par le repos). Mute `c.diseases`,
 * renvoie le journal. `resistVal` = Résistance effective (E + augmentations de Résistance) ; `beForGangrene`
 * = Bonus d'Endurance SEUL (seuil de Gangrène, ≠ resistVal). Tous deux passés par l'appelant (cycle évité). Par jour :
 *  - incubation : −1 jour ; à 0 → symptômes ACTIFS (durée mémorisée) ;
 *  - active : symptôme « blessé » → Test de Résistance Accessible (+20) ou Blessure Purulente (l.110) ;
 *             symptôme « toxine » → Test de Résistance Très Facile (+60) journalier JOURNALISÉ (l.172, RAW tronqué : conséquence laissée au MJ) ;
 *             −1 jour ; à 0 → résolution du symptôme « persistant » (l.162), sinon guérison naturelle.
 *
 * `defer` (CASCADE de nuit, journée unique) : les Tests de Résistance (blessé/gangrène/persistant)
 * sont COLLECTÉS en étapes influençables au lieu d'être roulés ici ; l'état avance (incubation/durée),
 * la maladie en fin de durée reste `endTestPending` jusqu'à la validation de son étape. Les
 * conséquences vivent dans `applyDiseaseBlesse/Gangrene/Persist` (réutilisées par la cascade).
 */
export function tickDisease(c: Combatant, days: number, rng: RNG = defaultRNG, resistVal = 0, defer?: UpkeepDeferTest, beForGangrene = Math.floor(resistVal / 10)): string[] {
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
      log.push(`${c.name} développe : ${diseaseLabel(name)}.`);
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
          log.push(`${c.name} : les symptômes de « ${diseaseLabel(dz.name)} » se déclarent.`);
        }
        survivors.push(dz);
        continue;
      }
      // active
      if (hasSymptom(dz, 'blesse')) {
        if (defer) defer({ kind: 'diseaseBlesse', label: `Symptôme « blessé » (${diseaseLabel(dz.name)})`, base: resistVal, difficulty: 'accessible', meta: { diseaseName: dz.name } });
        else { const res = rollTest(resistVal, 'accessible', rng); if (!res.success) contractOnce('blessure-purulente'); } // l.110
      }
      if (hasSymptom(dz, 'toxine') && !defer) {
        // LDB 20 l.172-173 : Test de Résistance Très Facile (+60) journalier. Le texte source est TRONQUÉ
        // (la conséquence d'échec n'y figure pas — coupure de page) → on roule le Test prescrit et on le
        // JOURNALISE ; la conséquence est laissée au MJ (rien d'inventé).
        const t = rollTest(resistVal, 'tresFacile', rng);
        log.push(`${c.name} : symptôme « toxine » (${diseaseLabel(dz.name)}) — Résistance ${t.roll}/${t.target} → ${t.success ? 'résisté' : 'échec (conséquence arbitrée par le MJ — RAW tronqué)'}.`);
      }
      // Gangrène (l.135+) : Test de Résistance Accessible (+20) journalier ; plus d'échecs que le
      // Bonus d'Endurance → la Localisation est PERDUE (règles d'Amputation — journalisé, MJ/Chirurgie).
      if (hasSymptom(dz, 'gangrene') && !dz.gangreneLost) {
        if (defer) defer({ kind: 'diseaseGangrene', label: 'Gangrène', base: resistVal, difficulty: 'accessible', meta: { diseaseName: dz.name, be: beForGangrene } });
        else if (!rollTest(resistVal, 'accessible', rng).success) {
          dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
          if (dz.gangreneFails > beForGangrene) {
            dz.gangreneLost = true;
            log.push(`${c.name} : la Gangrène a gagné — la Localisation atteinte est inutilisable (Amputation requise).`);
          } else log.push(`${c.name} : la Gangrène progresse (${dz.gangreneFails} échec(s)).`);
        }
      }
      dz.daysLeft -= 1;
      if (dz.daysLeft > 0) {
        survivors.push(dz);
        continue;
      }
      // Fin de Durée — résolution (DIFFÉRÉE en cascade : la maladie reste en attente).
      if (dz.persistDifficulty) {
        if (defer) {
          dz.endTestPending = true;
          defer({ kind: 'diseasePersist', label: `Fin de « ${diseaseLabel(dz.name)} »`, base: resistVal, difficulty: dz.persistDifficulty, meta: { diseaseName: dz.name } });
          survivors.push(dz);
        } else {
          const res = rollTest(resistVal, dz.persistDifficulty, rng); // l.162
          if (res.success) {
            log.push(`${c.name} guérit de : ${diseaseLabel(dz.name)}.`);
            if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; // Vérole Urticante (l.97)
          } else if (res.sl <= -6) {
            log.push(`${c.name} : ${diseaseLabel(dz.name)} dégénère (échec stupéfiant).`);
            contractOnce('infection-du-sang');
          } else if (res.sl <= -2) {
            log.push(`${c.name} : ${diseaseLabel(dz.name)} s'infecte (échec).`);
            contractOnce('blessure-purulente');
          } else {
            const extra = roll(1, 10, rng); // échec minime → +1d10 jours (l.163)
            dz.daysLeft = extra;
            log.push(`${c.name} : ${diseaseLabel(dz.name)} persiste (+${extra} jours).`);
            survivors.push(dz);
          }
        }
      } else {
        log.push(`${c.name} guérit de : ${diseaseLabel(dz.name)}.`);
        if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; // Vérole Urticante (l.97)
      }
    }
    c.diseases = survivors;
  }
  c.diseases = [...c.diseases, ...contracted];
  return log;
}
