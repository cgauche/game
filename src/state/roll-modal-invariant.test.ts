import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « une situation = une modale » (invariante projet), v2 — DÉTECTEUR de jets cachés.
 *
 * Règle : aucun point d'entrée JOUEUR ne résout un jet aléatoire en silence. Un jet est soit
 *  1. DIFFÉRÉ : une modale `pending*` (fabrique rollFlow — Lancer/Chance/Pacte/Résilience) ;
 *  2. RÉVÉLÉ : un jet SUBI montré après coup (pendingReveals, NightEntry du Repos, recap de
 *     Voyage jour par jour, journal d'entretien) — listé ici avec sa JUSTIFICATION ;
 *  3. AMBIANT : le monde tire sans Test de héros (réassort marchand, génération de créature).
 *
 * Ce que le scan COUVRE (statique, sur le texte source) :
 *  - le corps direct de chaque action du store ;
 *  - le corps direct de chaque fonction EXPORTÉE des modules de flux délégués ;
 *  - les DÉLÉGATIONS À UN NIVEAU : une action du store non-résolveur qui APPELLE une fonction
 *    de flux qui tire (c'est le trou qui a caché medicFlow autrefois).
 *  Limite assumée : profondeur 1 (un helper appelé par un helper n'est pas suivi) — les
 *  primitives du moteur restent confinées aux specs `rollFlows.ts` par la règle `FLOWS.`.
 */
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const read = (f: string) => readFileSync(here(f), 'utf8');

/** Modules de flux DÉLÉGUÉS par le store (points d'entrée joueur) — tous scannés. */
const FLOW_MODULES: Record<string, string> = {
  combatFlow: read('./combatFlow.ts'),
  combatGeometry: read('./combatGeometry.ts'), // helpers géométrie extraits de combatFlow
  combatEffects: read('./combatEffects.ts'), // effets de scène/campagne extraits de combatFlow
  consumableFlow: read('./consumableFlow.ts'), // runner de consommable (#50 — Flow cadence-aware)
  combatManeuvers: read('./combatManeuvers.ts'), // résolveurs de manœuvres extraits de combatFlow
  medicFlow: read('./medicFlow.ts'),
  partyFlow: read('./partyFlow.ts'),
  merchantFlow: read('./merchantFlow.ts'),
  restFlow: read('./restFlow.ts'),
  travelFlow: read('./travelFlow.ts'),
  corruptionFlow: read('./corruptionFlow.ts'),
  encounterPsychFlow: read('./encounterPsychFlow.ts'),
  interludeFlow: read('./interludeFlow.ts'),
  upkeep: read('./upkeep.ts'),
  outOfCombatUpkeep: read('./outOfCombatUpkeep.ts'),
  spawn: read('./spawn.ts'),
};
const STORE = read('./store.ts');

/** Primitives qui TIRENT (RNG / résolution de Test / application d'un jet) — regex mot-entier. */
const PRIM_RE =
  /\b(battleRng|rollTest|rollOups|rollMiscast|rollCritical|rollContraction|rollRandomTalent|rollMeleeDefender|resolveAttack|resolveTrample|resolveFocus|resolveBackstabAttack|resolveMelee|resolveMeleePassive|resolveRanged|resolveCasting|resolveMagicMissile|resolveRun|resolveFrenzyEntry|resolvePeurTest|resolveTerreurTest|resolveCalmeSimple|opposedTest|applyAttackResult|applyTrample|applyMiscast|focusSpell|makeRNG|d10|d100)\s*\(|\bFLOWS\.|\bdefaultRNG\b|\bMath\.random\b|\.int\(/;

const offendersOf = (body: string): string[] => {
  const m = body.match(new RegExp(PRIM_RE, 'g'));
  return m ? [...new Set(m.map((x) => x.trim()))] : [];
};

// Les RÉSOLVEURS de modale (le jet différé lui-même) : convention de suffixe.
// `*Resolve` : résolveurs aussi (resolveTest ; la psy de combat/rencontre passe par FLOWS.cascade).
// `*Resist` : Résistance (Menace), LDB 10 — auto-succès du MÊME mécanisme que ForceSuccess (verbe rollFlow).
const RESOLVER = /(Roll|Reroll|BonusSL|ForceSuccess|SetForcedRoll|Confirm|Cancel|DarkPact|Resolve|Resist)$/;

/**
 * Liste blanche JUSTIFIÉE — chaque entrée dit OÙ le jet est montré au joueur (catégories 2/3).
 * Ajouter un nom ici sans justification vérifiable = refusé en revue. Le test d'hygiène en bas
 * refuse toute entrée qui ne correspond plus à une action du store / fonction de flux réelle.
 */
const JUSTIFIED: Record<string, string> = {
  // ── Résolveurs hors-suffixe (la modale est ouverte, le jet en est une conséquence acquittée) ──
  resolveTest: 'résolveur de la modale de Test de scène',
  resolveCorruption: 'résolveur « Continuer » de la modale d’exposition ; le Test de seuil est révélé (pendingReveals kind mutation)',
  disengageConfirmA: 'option « Sacrifier l’Avantage » de la modale de Désengagement (aucun jet de héros : choix acquitté)',
  disengageFlee: 'option « Fuir » de la modale : coup dans le dos SUBI (resolveBackstabAttack) montré INLINE ; le Test de Calme du fuyard passe désormais par la cascade pending* (flux `flee` — fleeRoll/fleeConfirm influençables, suffixe RESOLVER)',
  dismissReveal: 'acquittement de la file de révélation (le jet a DÉJÀ été montré)',
  medicAct: 'infirmerie : ouvre pendingHeal (modale) — l’acte payant ne tire pas lui-même',
  surgeryNext: 'Chirurgie : APPLIQUE la passe (le Test de Médecine du chirurgien est différé en modale pendingSurgery, influençable). Le Test d’infection du patient (Résistance +20) est désormais une ÉTAPE de cascade INFLUENÇABLE (`combatEndDisease` — Chance/Résilience + auto-succès Résistance (Menace : Maladie)), sa contraction appliquée à la validation. Le seul RNG restant est le 1d10 PB SUBI de la passe (dégât de l’opération montré dans la ligne de journal, pas un Test de héros)',
  startDisengage: 'OUVRE pendingDisengage : le jet du foe est tiré et FIGÉ pour la modale (pattern Défense — montré dans la ligne adverse)',
  resolveDualSecond: '2ᵉ frappe du Maniement : jet IMPOSÉ (d100 inversé) AFFICHÉ dans la modale d’attaque (dualSecond)',
  applyCounterspell: 'Contre-sort : Test opposé du contre-lanceur, issue affichée dans la modale d’incantation (et déclaré pendant le jet ennemi)',
  battleManeuverArea: 'Hurlement : pas de jet d’attaquant — 1d10 + Test de Résistance des cibles (jets SUBIS) montrés au feed, pas de modale différable (LDB 85 l.135). Les autres manœuvres (Souffle/Vomi/Langue/Regard/Étreinte) OUVRENT pendingManeuver (modale du jet d’attaquant) — plus de résolution inline',
  // ── Moteur appelé par les points d'entrée (le jet aval est différé/révélé/IA) ──
  applyEffects: 'Effets d’AUTEUR (éditeur) : `test` OUVRE pendingTest ; inflictTrauma/inflictDisease/zoneBlast poussent une RÉVÉLATION témoin 📜 (souffle = dégâts SUBIS tirés, montrés au journal)',
  applyFall: 'Chute (LDB 15) appliquée à un combattant : Dégâts + À Terre SUBIS (chute involontaire, aucun Test de héros influençable). Brique consommée par l’Effet `fall` (journal/révélation) et l’effondrement de passerelle en combat (feed) — le jet est montré là, pas une modale différable',
  applyZoneCrossings: 'traversée de zones (feu…) : jets SUBIS — feed de combat + flottants FX (L11)',
  advanceTurn: 'fin de tour : IA ennemie (instantanée par design) + entretien de fin de Round en file de révélation témoin',
  // ── Jets d’ENTRETIEN / monde — subis et RÉVÉLÉS (catégorie 2) ou ambiants (catégorie 3) ──
  startCombat: 'Initiative (I+1d10) en début de combat — lue dans la frise d’initiative (R2)',
  advanceTime: 'cascade quotidienne #T3 : franchissement de jour → RÉVÉLATION témoin « Entretien quotidien » (lignes du bilan)',
  fireScheduledEffects: 'échéances programmées (Lot 0) franchies par advanceTime (horloge) : effet différé (flow) OU reconstitution AMBIANTE d’une créature à l’échéance (Gardien éternel → applySummon, comme spawnEnemy : génération de monde, pas un Test de héros), RÉVÉLÉE au journal',
  restParty: 'repos hors modale (scénarios/recette) — même bilan de nuit (NightEntry) que la modale de Repos',
  runDailyUpkeep: 'entretien QUOTIDIEN (rations/maladies/convalescence) — RENVOIE ses lignes, chaque appelant les AFFICHE (révélation/bilan de nuit/recap de voyage)',
  outOfCombatUpkeep: 'États récurrents hors combat (Hémorragique…) — rejoue endOfRound, journalisé',
  sleepParty: 'source UNIQUE de la nuit : chaque jet devient une NightEntry LISTÉE (modale de Repos / recap) + journal',
  restSleep: 'résolveur « Dormir » du Repos : délègue à sleepParty — NightEntry visibles',
  startTravel: 'voyage #T2 : Tests de route (marche forcée, Survie, Perception) NARRÉS jour par jour dans le TravelRecapModal (🎲 jet/cible affichés)',
  resumeTravel: 'reprise du voyage interrompu — mêmes jets narrés dans le recap',
  continueTravelAfterNight: 'reprise après la halte de nuit — mêmes jets narrés dans le recap',
  continueTravelDayAfterCascade: 'clôture de la cascade du JOUR terrestre : la marche forcée EAGER (arrivée/interruption, pas de halte où la présenter) est le MÊME jet narré dans le recap qu’avant — les jets d’Étape/péripétie du jour, eux, sont désormais des étapes influençables de la cascade `travelDay` (pending*)',
  openMerchant: 'ouverture de boutique : réassort/Disponibilité (LDB 59) — le monde tire, pas un Test de héros',
  searchAvailability: 'recherche active de Disponibilité (LDB 59 l.50) : une JOURNÉE écoulée aux marchés — le Test de Ragot du groupe est un jet SUBI/RÉVÉLÉ (résultat journalisé « Ragot <roll> » la même action, comme le recap de Voyage) puis le réassort AMBIANT en découle ; pas une décision interactive différable',
  spawnEnemy: 'génération de créature (caractéristiques/PB) — ambiant, hors Test',
  gainCorruption: 'seuil de Corruption : Test DIFFÉRÉ en modale (pendingCorruption kind seuil, cycle Chance/Pacte) pour un héros ; repli auto-résolu + révélation témoin (PNJ, gains en rafale)',
  applyMutation: 'mutation tirée sur les Tableaux de Corruption (LDB 19) — RÉVÉLÉE (pendingReveals kind mutation, révélation 🧬)',
  startInterlude: 'ouvre l’interlude : tirage d’Événement (d100 par héros) affiché sur la carte du héros (🎲 + libellé) et journalisé',
  interludeEnd: 'clôture d’interlude : Revenus restants auto-résolus, journalisés',
  openCatalogActivity: 'ouverture d’une Activité à jet (chemin UNIQUE data-driven) : le seul tirage est le PRIX du tuteur d’Apprentissage (2d10 pa / 100 PX, monde ambiant, LDB 23) — affiché avant de payer ; le Test lui-même est différé en modale',
  confirmActivity: 'résolveur « Appliquer » de la modale d’Activité : le TEST a eu lieu en modale ; les dés de Statut (montant des Revenus, LDB 08) et les fausses Particularités (Identification, ADE2) sont la conséquence affichée',
  bankDeposit: 'placement en interlude : l’Indice d’intérêts est tiré par le monde (ambiant) et AFFICHÉ (gains/risque de faillite)',
  openSkillTest: 'ouvre pendingTest (modale) ; le 1d10 « réaction au Statut » (option LDB 08 l.54/90, monde ambiant) est tiré UNE fois et appliqué comme MODIFICATEUR du Test révélé dans la modale',
  scheduleDelayedOps: 'op `delayed` (#50) : le RNG ne résout que les FORMULES DE DÉLAI/DURÉE (« au bout de 2-3 h », « pendant 21 h » — horloge du monde, pas un Test de héros) ; les ops différées elles-mêmes sont RÉVÉLÉES à l’échéance (fireScheduledEffects → runFlow → journal), et tout Test qu’elles porteraient ouvre sa modale',
  runConsumable: 'runner de consommable (#50) : le RNG ne résout que la DURÉE de l’objet (« 2d10 minutes », LDB 71 — horloge, pas un Test) ; un nœud `test` du Flow OUVRE pendingTest (scène, restreint au buveur — walker privé runSceneConsumableFlow → openSkillTest) ou une étape de cascade influençable (combat, runCombatFlow) ; les feuilles sont JOURNALISÉES (applyLeafOps → log)',
  usePartyItem: 'consommation depuis la fiche : journalisée + délègue à runConsumable (les jets aval sont différés/révélés)',
  battleConsumeItem: 'consommation en combat (une Action) : délègue à runConsumable (voie cadence-aware) ; le journal différé est déversé dans le log de bataille',
};

/** Extrait `nom: (args) => corps` des actions du store. */
function storeActions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^ {2}(\w+):\s*\([^)]*\)\s*=>\s*(\{)?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (m[2]) {
      let depth = 1, i = re.lastIndex;
      while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
      out.push({ name, body: src.slice(re.lastIndex, i) });
    } else {
      out.push({ name, body: src.slice(re.lastIndex, src.indexOf('\n', re.lastIndex)) });
    }
  }
  return out;
}

/** Fonctions exportées d'un MODULE de flux : `export function nom(...) { corps }`. */
function moduleActions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^export (?:async )?function (\w+)\(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let p = 1, j = re.lastIndex;
    while (j < src.length && p > 0) { if (src[j] === '(') p++; else if (src[j] === ')') p--; j++; }
    const open = src.indexOf('{', j);
    let depth = 1, i = open + 1;
    while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    out.push({ name: m[1], body: src.slice(open + 1, i) });
  }
  return out;
}

describe('Invariante « une situation = une modale » (détecteur de jets cachés, v2)', () => {
  // ── 1. Carte des fonctions de flux qui TIRENT (directement) ──
  const rollers = new Map<string, string>(); // nom → module
  const flowFns = new Map<string, { module: string; body: string }>();
  for (const [mod, src] of Object.entries(FLOW_MODULES)) {
    for (const { name, body } of moduleActions(src)) {
      flowFns.set(name, { module: mod, body });
      if (offendersOf(body).length) rollers.set(name, mod);
    }
  }

  // ── 2. Actions du store : ni primitive en ligne, ni APPEL d'une fonction de flux qui tire ──
  const actions = storeActions(STORE);
  it('extrait un nombre plausible d’actions du store', () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  for (const { name, body } of actions) {
    const allowed = RESOLVER.test(name) || name in JUSTIFIED;
    it(`store.${name} ne résout pas de jet en ligne${name in JUSTIFIED ? ` (justifié : ${JUSTIFIED[name]})` : ''}`, () => {
      if (allowed) return;
      const direct = offendersOf(body);
      // Délégation à UN niveau : `fn(...)` ou `module.fn(...)` vers une fonction de flux qui tire.
      const called = [...body.matchAll(/\b(?:\w+\.)?(\w+)\(/g)].map((x) => x[1]);
      const viaFlow = [...new Set(called.filter((c) => rollers.has(c) && !RESOLVER.test(c) && !(c in JUSTIFIED)))];
      const all = [...direct, ...viaFlow.map((c) => `${rollers.get(c)}.${c}()`)];
      expect(all, `${name} cache un jet (${all.join(', ')}) — différer en modale pending* / pousser une révélation / justifier dans JUSTIFIED`).toEqual([]);
    });
  }

  // ── 3. Fonctions de flux exportées qui tirent : résolveur ou justifiées, sinon violation ──
  for (const [name, mod] of rollers) {
    const allowed = RESOLVER.test(name) || name in JUSTIFIED;
    it(`${mod}.${name} (tire) est un résolveur ou est justifié${name in JUSTIFIED ? ` (${JUSTIFIED[name]})` : ''}`, () => {
      // combatFlow / combatManeuvers = moteur du combat : leurs helpers (IA instantanée par design +
      // résolveurs `applyMan<X>` appelés PAR `FLOWS.maneuver`/les wrappers IA) sont couverts par la
      // règle « FLOWS./primitives interdites aux actions non-résolveur » côté store — pas un point
      // d'entrée joueur. Le jet d'attaquant influençable passe par `FLOWS.maneuver` (modale différée).
      if (mod === 'combatFlow' || mod === 'combatManeuvers') return;
      expect(allowed, `${mod}.${name} tire un jet sans être un résolveur de modale — le différer/révéler, ou le JUSTIFIER ici`).toBe(true);
    });
  }

  // ── 4. Hygiène de la liste blanche : toute entrée doit pointer un nom RÉEL (action du store
  // ou fonction de flux exportée) — sinon l'entrée est morte/mensongère et doit partir. ──
  it('la liste blanche JUSTIFIED ne contient que des noms réels', () => {
    const known = new Set([...actions.map((a) => a.name), ...flowFns.keys()]);
    const stale = Object.keys(JUSTIFIED).filter((n) => !known.has(n));
    expect(stale, `entrées JUSTIFIED sans action/fonction correspondante : ${stale.join(', ')}`).toEqual([]);
  });
});
