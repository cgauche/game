/**
 * Résolution des Blessures critiques — LECTEUR UNIQUE des DEUX systèmes (#1657 B2a, #1682) :
 * le Livre de base (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07,
 * l.13-186), activée par la règle facultative `combat-aa-blessures = 'aa'`.
 *
 * Le SOCLE résout la séquence, la même pour les deux jeux : lookup `findTableEntry` → jet de la
 * rangée → `onRepeat` → `traumas` → `amputation` → `stampCriticalEscalation` → `fireCritTriggers`.
 * Les FEUILLES n'adressent que ce qui diffère, déclaré une fois dans `REGIMES` : le modificateur de
 * SÉVÉRITÉ du d100 (LDB 18 l.17 : −20 quand l'overkill dépasse le Bonus d'Endurance, minimum 01 /
 * AA 07 l.36 : +10 par Blessure au-delà de 0) et le libellé de journal.
 */
import { d100, d10, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { testValue } from './skills';
import { hitLocationByShape, locationLabel } from './combat';
import { BodyShape, Combatant, HitLocation, Trauma } from './types';
import {
  CRITIQUE_DOCS, critTableKeyFor, critiqueDoc, critiqueTable,
  type Amputation, type CritEntry, type CritTableKey, type CritTestNode, type JeuDeCritique,
} from '../data/criticals';
import { traumaById, traumaFicheById, stampCriticalEscalation, fireCritTriggers, consolidateAmputations, setTraumaCount, AMPUTATION_WOUND_DESC } from './trauma';
import { rule } from './policy';
import { spellOps } from './flowCore';
import { applyOps, resolveFormula, type GameOp } from './ops';

export type { CritTableKey, JeuDeCritique };

/**
 * Séquelles PERMANENTES d'une amputation (LDB 18 l.233-286) — distinctes de la plaie chirurgicale : elles
 * survivent à la Chirurgie (le membre reste absent). Instanciées depuis les `sequels` (ids de fiche
 * `traumas.json`) DÉCLARÉS STRUCTURELLEMENT sur le critique (`entry.amputation.sequels`) — plus aucune
 * lecture du texte. La latéralité (brasG/brasD, jambeG/jambeD) provient de la `location` réelle du coup —
 * hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD). Une séquelle CUMULATIVE
 * (`TraumaFiche.cumul`) reçoit ici le nombre d'unités que la LIGNE de Critique fait perdre (`units`,
 * résolu par `resolveAmputation` depuis `amputation.unites` — « Perdez 1d10 dents » — et
 * `amputation.loss.perDR` — « un orteil par DR en dessous de 0 »). Une séquelle NON cumulative l'ignore
 * (« perdez votre langue ET 1d10 dents »). L'agrégation et les seuils suivent (`consolidateAmputations`).
 */
export function permanentAmputations(sequels: string[], location: HitLocation, units = 1): Trauma[] {
  return sequels.map((id) => {
    const fiche = traumaFicheById(id);
    const t = traumaById(id, undefined, location);
    if (fiche.cumul) setTraumaCount(t, fiche, units);
    return t;
  });
}

/** Valeur de Résistance d'un Coup Critique (LDB 18) : Endurance effective + Avances de Résistance. SOURCE UNIQUE. */
export function critResistValue(c: Combatant): number {
  return effectiveChar(c, 'endurance') + (c.skills.find((s) => s.id === 'resistance')?.advances ?? 0);
}

/**
 * Valeur testée par un nœud de Critique. `test.skill` (AA 07 l.165 : Test d'Athlétisme, pas de
 * Résistance) passe par `testValue`, qui couvre déjà les compétences de base non entraînées ; sans
 * compétence nommée, le jet est le Test de Résistance du critique (`critResistValue`).
 */
function valeurTestee(target: Combatant, node: CritTestNode): number {
  const skill = node.test.skill;
  return skill ? testValue(target, skill.id, undefined, skill.spec) : critResistValue(target);
}

/**
 * Résout le nœud `test` d'une rangée (RNG seedé) et rend les ops de la branche empruntée. Lecture
 * PURE du Flow : `spellOps` extrait les `GameOp` des feuilles `EffectOp` de la branche — aucune
 * mécanique n'est déduite du texte, et une branche `success` non vide serait servie tout autant.
 */
function opsDuNoeud(target: Combatant, node: CritTestNode, rng: RNG): GameOp[] {
  const res = rollTest(valeurTestee(target, node), node.test.difficulty, rng);
  return spellOps(res.success ? node.success : node.fail, 'target').map((o) => ({ ...o }));
}

/**
 * Résout une Amputation (LDB 18 l.237) — SOURCE UNIQUE partagée par `resolveCritique` (les deux jeux)
 * et la résolution post-rencontre. Renvoie l'effet immédiat (`ops` : États À Terre/Sonné/Inconscient)
 * et les `traumas` (plaie chirurgicale `needsSurgery` + séquelles permanentes). RNG consommé :
 *  - `loss.difficulty` présent → 1 Test SÉPARÉ (gate) D'ABORD : sa RÉUSSITE annule TOUT (ni séquelle, ni plaie, ni
 *    États). Sinon on continue (« Coupure à l'orteil » : gate Intermédiaire).
 *  - puis le Test de Résistance `difficulty` (États par DR). Sans `loss.difficulty`, un `loss` sans gate propre fait
 *    de CE Test le déterminant de la perte (« Pied écrasé » : un seul Test Accessible gate ET États).
 *  - `loss.perDR` → nombre d'occurrences perdues = 1 + DR en dessous de 0 du Test qui gate la perte.
 * Sans `loss` : séquelle TOUJOURS (membre tranché — pied sectionné, tendon coupé…).
 */
export function resolveAmputation(amp: Amputation, location: HitLocation, resistVal: number, ref: Combatant, rng: RNG = defaultRNG): { ops: GameOp[]; traumas: Trauma[] } {
  const ops: GameOp[] = [];
  const traumas: Trauma[] = [];
  let units = 1;
  if (amp.loss?.difficulty) {
    const gate = rollTest(resistVal, amp.loss.difficulty, rng);
    if (gate.success) return { ops, traumas }; // Test gate réussi → pas d'amputation du tout
    if (amp.loss.perDR) units = 1 + Math.max(0, -gate.sl);
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
    if (amp.loss.perDR) units = 1 + Math.max(0, -res.sl);
  }
  // Quantité DÉCLARÉE par la ligne (« Perdez 1d10 dents ») — résolue ICI, après les Tests, pour ne
  // consommer le dé que sur les lignes qui en portent un.
  if (amp.unites != null) units = resolveFormula(amp.unites, ref, rng) + (units - 1);
  traumas.push({ label: 'Amputation', location, needsSurgery: true, desc: AMPUTATION_WOUND_DESC });
  traumas.push(...permanentAmputations(amp.sequels, location, units));
  return { ops, traumas };
}

/**
 * Résout à la FIN de la rencontre (LDB 18) les amputations DIFFÉRÉES (`Trauma.pendingAmputation`, posé par
 * `resolveCritique` pour un `amputation.timing === 'postEncounter'`, ex. « Coupure à l'orteil »). Retire les
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
    const r = resolveAmputation(t.pendingAmputation!, t.location, resistVal, c, rng);
    applyOps(c, r.ops, { rng });
    c.traumas = [...(c.traumas ?? []), ...r.traumas];
    log.push(r.traumas.length > 1 ? `${c.label} : ${t.label} — amputation confirmée après la rencontre.` : `${c.label} : ${t.label} — sans séquelle après la rencontre.`);
  }
  consolidateAmputations(c);
  return log;
}

export interface CriticalResolved {
  location: HitLocation;
  /** id STABLE de l'entrée de table (`criticals.json`) — appendé à `critEntriesSuffered`
   *  par `applyCriticalToTarget` pour l'historique d'occurrence (escalade `onRepeat`). */
  entryId: string;
  label: string;
  /** Effet IMMÉDIAT RÉSOLU (PB ignorant BE+PA + États immédiats + branche empruntée du nœud `test` +
   *  Amputation), appliqué par `applyOps` chez l'appelant — valeurs littérales (RNG déjà consommé ici). */
  ops: GameOp[];
  lethal: boolean;
  /** Traumatismes posés (LDB 18), à la localisation du critique. */
  traumas: Trauma[];
  /** Texte canon (LONG TERME), DISPLAY-ONLY — jamais parsé pour de la mécanique. */
  desc: string;
  /** Jet d100 effectif (après modificateur de sévérité). */
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

/** Catégorie Codex EXACTE (`registry.ts`) d'un Coup Critique, par table + jeu (LDB/Aux Armes). */
export function critEntryCodexCategory(table: CritTableKey, jeu: JeuDeCritique): string {
  const seg = table === 'tete' ? 'Tete' : table === 'bras' ? 'Bras' : table === 'corps' ? 'Corps' : 'Jambe';
  return `${jeu === 'aa' ? 'aaCriticals' : 'criticals'}${seg}`;
}

/** Retrouve l'entrée de Coup Critique portant cet id STABLE — un id de `critEntriesSuffered`
 *  (`Combatant`) n'a PAS de localisation attachée (compteur d'occurrence pour l'escalade `onRepeat`
 *  seulement, LDB 18 l.71) : `bras`/`jambe` regroupent les deux côtés, on ne peut donc afficher que la
 *  TABLE (« Bras »/« Jambe »), pas le côté précis (G/D). SOURCE UNIQUE de lecture d'un id de
 *  `critEntriesSuffered` — l'onglet État (rendu du journal des Blessures critiques subies) et tout
 *  futur point d'affichage passent par ici. UNE boucle sur les 8 documents : un 9ᵉ tableau y entre
 *  sans une ligne de plus. */
export function findCritEntrySuffered(id: string): { entry: CritEntry; table: CritTableKey; jeu: JeuDeCritique } | undefined {
  for (const doc of CRITIQUE_DOCS) {
    const entry = doc.entries.find((e) => e.id === id);
    if (entry) return { entry, table: doc.localisation, jeu: doc.jeu };
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
 *  LDB 17 l.68). SOURCE UNIQUE de la règle : mêlée, défense opposée et tir/magie en dérivent, puis
 *  passent le résultat à `applyCriticalToTarget` qui ne re-tire JAMAIS → le double tirage est impossible. */
export function critWoundLocation(rng: RNG, bodyShape: BodyShape = 'humanoide', override?: HitLocation): HitLocation {
  return override ?? critLocationRoll(rng, bodyShape);
}

/**
 * Réduction du d100 de SÉVÉRITÉ d'une Blessure critique — LDB 18 l.17 (verbatim : « vous ôtez -20 à
 * votre résultat sur le Tableau des Critiques avec un résultat minimum de 01 »), quand les PB négatifs
 * dépassent le Bonus d'Endurance. SOURCE UNIQUE du modificateur : le régime `ldb` l'applique à SON
 * lookup, la DÉCLARATION d'étape à table le porte en `mod` (négatif) — les deux lisent la même valeur.
 */
export function critSeverityReduction(target: Combatant, overkill: number): number {
  return overkill > bonus(effectiveChar(target, 'endurance')) ? 20 : 0;
}

/** Décalage AA du jet de Critique (AA 07 l.36) : +10 par Blessure au-delà de 0. PUR. */
export function aaCriticalOffset(overkill: number): number {
  return 10 * Math.max(0, overkill);
}

/** Ce qu'un JEU adresse — le reste de la résolution est au socle. */
interface RegimeCritique {
  /** Modificateur appliqué au d100 NATUREL avant le lookup (le plancher 01 est au socle). */
  severite(target: Combatant, overkill: number): number;
  /** En-tête de la ligne de journal. */
  journal: string;
}

/**
 * CE QUE COÛTE UN JEU DE PLUS — une DÉCLARATION ici, et rien d'autre : la séquence de résolution, le
 * lookup, la lecture des id subis et l'exposition Codex sont entièrement pilotés par la DONNÉE (les
 * documents-tables de `criticals.json`). Table ouverte à l'écriture pour que la morsure N+1
 * (`crit-n-plus-1.test.ts`) puisse en poser une et la retirer — le moteur, lui, ne l'écrit jamais.
 */
export const REGIMES_DE_CRITIQUE: Record<string, RegimeCritique> = {
  ldb: { severite: (target, overkill) => -critSeverityReduction(target, overkill), journal: 'Blessure critique' },
  aa: { severite: (_target, overkill) => aaCriticalOffset(overkill), journal: 'Blessure critique AA' },
};

/** Régime d'un jeu — FAIL-FAST NOMINATIF : un document-table dont le `jeu` n'a pas de régime déclaré
 *  se résoudrait sinon sur `undefined`, et le critique crasherait loin de sa cause. */
function regimeDe(jeu: JeuDeCritique): RegimeCritique {
  const regime = REGIMES_DE_CRITIQUE[jeu];
  if (!regime) {
    throw new Error(
      `resolveCritique : le jeu « ${jeu} » n'a pas de régime déclaré (REGIMES_DE_CRITIQUE : ${Object.keys(REGIMES_DE_CRITIQUE).join(', ')}) — un tableau de plus déclare SA sévérité et SON libellé de journal.`,
    );
  }
  return regime;
}

/**
 * Le JEU qui résout un Coup Critique : l'approche alternative d'Aux Armes quand la règle facultative
 * `combat-aa-blessures` vaut `aa`. `twice` (Bénédiction de Sauvagerie, LDB 41 l.170) reste au chemin
 * LDB — l'Atout ne coexiste pas avec la variante AA. SOURCE UNIQUE du choix : la couche combat le lit
 * pour ses propres décisions (trivialité, déclaration d'étape à table) plutôt que de le recalculer.
 */
export function jeuDeCritique(twice = false): JeuDeCritique {
  return !twice && rule('combat-aa-blessures') === 'aa' ? 'aa' : 'ldb';
}

/** Lignes de la table d'un (jeu, clé) — passées PAR RÉFÉRENCE au registre d'étapes (zéro duplication). */
export function critTableRows(jeu: JeuDeCritique, key: CritTableKey): CritEntry[] {
  return critiqueDoc(jeu, key).entries;
}

/**
 * Une Blessure critique est-elle TRIVIALE (« T », AA 07 l.79) — non comptée pour la mort par
 * accumulation ? DÉRIVÉE, jamais authorée : une rangée non létale qui ne fait perdre AUCUNE Blessure.
 * Lue par la couche combat pour ne pas incrémenter `criticalWounds`. PUR.
 */
export function critiqueTriviale(jeu: JeuDeCritique, location: HitLocation, roll: number): boolean {
  const entry = findTableEntry(critiqueTable(jeu, location), Math.max(1, roll));
  return !entry.lethal && !(entry.ops ?? []).some((o) => o.op === 'wounds');
}

/** Mort par accumulation de Blessures Critiques (AA 07 l.73) : un combattant Inconscient à 0 PB dont
 *  le nombre de Blessures Critiques dépasse son Bonus d'Endurance succombe en fin de Round. PUR. */
export function aaDeathByCriticalCount(inconscient: boolean, wounds: number, criticalWounds: number, be: number): boolean {
  return inconscient && wounds <= 0 && criticalWounds > be;
}

/** Ce que l'appelant peut moduler sur un Coup Critique — tout est optionnel, le socle a ses défauts. */
export interface OptionsCritique {
  /** PB perdus au-delà des PB courants (LDB 18 l.17 : réduction de sévérité ; AA 07 l.36 : +10 chacun). */
  overkill?: number;
  /** Bénédiction de Sauvagerie (LDB 41 l.170) : deux lancers, le porteur béni CHOISIT lequel. */
  twice?: boolean;
  /**
   * d100 de sévérité INJECTÉ (dé de l'étape à table, dé posé, test) : c'est le dé NATUREL — le
   * modificateur de sévérité du jeu reste appliqué ICI, comme sur un dé tiré. Il PRIME sur `twice`
   * (aucun dé n'est tiré) : les DEUX lancers de la Bénédiction de Sauvagerie (LDB 41 l.170 : « Quand
   * votre cible inflige par la suite des Blessures Critiques, effectuez deux lancers et choisissez le
   * meilleur résultat. ») sont alors déjà tranchés en amont — par l'étape à table (`keepHighest`, qui
   * retient un dé et l'affiche) ou par le dé que POSE le joueur (le résultat gardé que `LDB 41 l.170` /
   * `AA 13 l.57` lui confient, nommé directement).
   *
   * Le CHOIX que le RAW confie au porteur béni (« choisissez ») a pour référent l'ATTAQUANT ; sa
   * surface joueur est portée par #982 (le tirage rend ici un dé déjà arbitré).
   */
  forcedRoll?: number;
}

/**
 * Résout une Blessure critique sur `target` à la `location`, dans le `jeu` donné. Le nœud `test` de
 * l'entrée est auto-résolu (RNG seedé) : les ops de la branche empruntée s'ajoutent à l'effet.
 * La Localisation n'est JAMAIS re-tirée ici (LDB 18 l.53 / AA 07 l.32) — l'appelant la fournit.
 */
export function resolveCritique(
  jeu: JeuDeCritique,
  target: Combatant,
  location: HitLocation,
  rng: RNG = defaultRNG,
  options: OptionsCritique = {},
): CriticalResolved {
  const { overkill = 0, twice = false, forcedRoll } = options;
  const regime = regimeDe(jeu);
  const be = bonus(effectiveChar(target, 'endurance'));
  const raw = forcedRoll ?? (twice ? Math.max(d100(rng), d100(rng)) : d100(rng));
  const roll = Math.max(1, raw + regime.severite(target, overkill));
  const entry = findTableEntry(critiqueTable(jeu, location), roll); // repli Bras (LDB 76 l.21) si loc sans table dédiée
  const resistVal = critResistValue(target);
  const ops: GameOp[] = [...(entry.ops ?? [])];
  if (entry.test) ops.push(...opsDuNoeud(target, entry.test, rng));
  // Occurrence-count PAR ID D'ENTRÉE (LDB 18 l.71 : « Si vous tombez une seconde fois sur cette blessure… » ;
  // AA 07 l.96) : la MÊME entrée déjà subie → effet ALTERNATIF `escalation.onRepeat` (séquelles REMPLACÉES,
  // ops immédiates AJOUTÉES). L'effet IMMÉDIAT de base reste appliqué (le coup blesse toujours).
  const repeated = (target.critEntriesSuffered ?? []).includes(entry.id);
  const repeat = repeated ? entry.escalation?.onRepeat : undefined;
  if (repeat?.ops) ops.push(...repeat.ops.map((o) => ({ ...o })));
  const traumaRefs = repeat?.traumas ?? entry.traumas ?? [];
  // Durée de convalescence (Jalon 5) : BE déjà calculé ; 1d10 tiré seulement pour les fractures (RAW 30+1d10)
  // afin de ne pas décaler le flux RNG des critiques sans fracture. Les refs d'id de fiche (`traumas.json`)
  // portent leur `kind` → on instancie à la localisation du coup.
  const traumas = traumaRefs.map((id) =>
    traumaById(id, { be, d10: traumaFicheById(id).kind === 'fracture' ? d10(rng) : undefined }, location));
  // Amputation (LDB 18 l.237 ; AA 07 « voir Amputation en page 180 de WFJDR ») : DÉCLARÉE STRUCTURELLEMENT
  // (`entry.amputation`, jamais lue par regex sur le texte). Placée en DERNIER (rien ne tire après) pour ne
  // décaler le flux RNG que des critiques d'amputation. `timing: 'postEncounter'` (« Coupure à l'orteil »,
  // l.171 : « Une fois la rencontre terminée… ») → aucun jet ICI : marqueur `pendingAmputation` résolu au
  // foyer de fin de combat (`resolvePostEncounterAmputations`).
  if (!entry.lethal && entry.amputation) {
    if (entry.amputation.timing === 'postEncounter') {
      traumas.push({ label: entry.label, location, pendingAmputation: entry.amputation });
    } else {
      const amp = resolveAmputation(entry.amputation, location, resistVal, target, rng);
      ops.push(...amp.ops);
      traumas.push(...amp.traumas);
    }
  }
  // Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du pied sans
  // Chirurgie sous 1d10 jours ; « Épaule luxée »/« Genou démis » : membre désactivé jusqu'au Test étendu de
  // Guérison) — placée en DERNIER (ne décale que les critiques à escalade).
  stampCriticalEscalation(traumas, entry.escalation, location, target, rng, target.traumas ?? []);
  // Déclencheurs armés par un critique ANTÉRIEUR (« Commotion cérébrale » : autre critique tête pendant
  // Exténué, LDB 18 l.74) — lus sur `target.traumas` (jamais la séquelle stampée à l'instant : elle n'est pas
  // encore sur la cible), et kind-agnostiques (un critique LDB peut avoir armé ce qu'un critique AA fait
  // feu). En DERNIER pour ne décaler le flux RNG que des critiques qui font effectivement feu.
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
    log: `${regime.journal} (${locationLabel(location, target.bodyShape)}) — ${entry.label}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}

export { critTableKeyFor };
