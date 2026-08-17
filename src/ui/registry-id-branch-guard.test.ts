import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanRegistryIdBranch, scanRawIdEqualities, isRegistryIdBranchExcluded, SCAN_DIRS, SCAN_EXTS } from '../../scripts/guards/lib/registryIdBranch.mjs';

/**
 * Garde-fou « branchement par IDENTITÉ dans du code GÉNÉRIQUE » (#842).
 *
 * Doctrine utilisateur (2026-07-26, verbatim) : « "if (id=" n'est jamais une solution. Si je veux
 * rajouter d'autres options, je ne veux pas voir une suite d'id. Soit la cadence n'a rien a faire
 * dans policy, soit faut lui mettre un flag ». Un code qui itère un registre et traite N entrées de
 * façon uniforme ne teste JAMAIS l'identité d'une entrée : le comportement particulier est un
 * ATTRIBUT DÉCLARÉ sur l'entrée, lu comme n'importe quel autre champ.
 *
 * Mécanique (AST TypeScript, structurelle) : `scripts/guards/lib/registryIdBranch.mjs`. Elle vise
 * quatre formes — égalité, `switch`, appartenance à une liste fermée, table littérale à clé ouverte —
 * TOUJOURS conditionnées à une liaison GÉNÉRIQUE (entrée reçue en paramètre, itérée, ou prop de
 * composant). Un lookup par id stable (`skills.find((s) => s.skillId === 'resistance')`) et la
 * lecture d'un champ déclaré (`def.kind === 'flag'`) restent hors de portée : ce sont les formes
 * saines.
 *
 * CLIQUET : `CEILING`/`KNOWN` figent la MESURE du jour. Ce plafond est fait pour DESCENDRE jusqu'à
 * zéro, lot de correction après lot de correction — ce n'est pas une liste d'exceptions permanentes.
 * Le test échoue dans les DEUX sens : un site de plus, ou un site de moins sans abaisser le plafond.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/ui/ → ../../ = racine du projet

/**
 * Compte de sites par fichier, mesuré au 2026-07-26 sur `SCAN_DIRS` (élargi ce jour-là à `src/gameIso`,
 * `src/data` et `scripts`, et à l'identité nommée `ref`/`xxxRef`). Chaque entrée est un site à TRAITER
 * (attribut déclaré sur l'entrée) ou à réfuter par une correction de la mécanique — jamais à conserver
 * telle quelle.
 *
 * RE-MESURE 2026-08-16 (#1318 V6) : 39 → 60. Deux corrections du DÉTECTEUR ont démasqué des sites
 * qui existaient déjà (aucune régression de code, aucun site corrigé dans ce lot) :
 *  - le trou `for…of` (la variable de boucle, déclarée GÉNÉRIQUE, était aussitôt redéclarée VALEUR
 *    par la re-visite de l'initialiseur : AUCUNE boucle n'était vue) ;
 *  - l'identité `book` ajoutée à `ID_NAME_RX` (`source.book`, sigle de livre).
 * Les entrées neuves portent leur motif NOMINATIF ci-dessous : stock avoué, à faire DÉCROÎTRE.
 * Descente mesurée depuis : 60 → 58 (lots E4/C0+C1, `bc54767e`), puis 58 → 54 (lot E4/C2+C3,
 * 2026-08-17) — `creation.ts` et `CharacterCreator.tsx` (gate d'espèce passé au champ
 * `SpeciesData.gatedByRule`), `combat.ts` et `draft.ts` (tables `Record<union fermée, …>`), puis
 * 54 → 50 (lot E4/C4-groups, 2026-08-17) — `groups.ts` sort de la liste : l'appartenance à un
 * Groupe est DÉCLARÉE en donnée (`grantGroups` d'espèce/carrière/classe/culte/créature,
 * `matchesAll`/`exceptGroups` du Groupe joker), puis 50 → 46 (lot E4/C4-δ1, 2026-08-17) —
 * `persistence.ts` et `exposure.ts` sortent de la liste (persistance d'État déclarée par
 * `EtatData.persistsAfterCombat`, dissipation au répit par `ActiveEffect.expiresOnRespite`) et
 * `seaVoyageFlow.ts` passe de 2 à 1 (`DiseaseDef.contaminatesWaterBarrel`), puis 46 → 37 (lot E4/C4-δ2,
 * 2026-08-17) — `creatureEquip.ts`, `polymorph.ts`, `items.ts`, `conjuredWeapons.ts`, `skills.ts` et
 * `careerSlots.ts` sortent de la liste : Trait exclu d'un octroi en masse
 * (`TraitData.nonTransferable`), Mains nues / Arme improvisée (`TrappingData.unarmed`/`improvised`),
 * Domaine arcanique octroyé (`TalentData.grantsArcaneDomain`) et caractéristique alternative sous règle
 * (`SkillData.altChar`) sont DÉCLARÉS sur l'entrée ; l'armement de créature et « une Compétence de
 * Corps à corps » se lisent, eux, sur le `specsSource` que l'entrée déclarait DÉJÀ (aucun champ neuf
 * à tenir synchrone : `weaponFromTrait` passe cette source telle quelle à son résolveur de catalogue),
 * puis 37 → 27 (lot E4/C4-δ3, 2026-08-17) — la couche ACTIVITÉS/UI : `mountTravel.ts`, `massBattleFlow.ts`,
 * `seaVoyageFlow.ts`, `CityHubScreen.tsx`, `CouncilModal.tsx`, `CrewTestModal.tsx` et `InterludeScreen.tsx`
 * sortent de la liste, `combatFlow.ts` passe de 2 à 1. Ce que l'entrée DÉCLARE désormais : la séquelle
 * d'un Incident de monte (`mount.riderTest`/`ridingPenalty`/`forcedAllure`/`preventsMount`/
 * `notHealedByCare`), le réservoir de modificateur qu'un Test dépense (`testModFrom`) et la difficulté
 * DÉRIVÉE d'un écart d'armées (`difficultyFrom`), le Test d'équipage qui coûte du Moral sur DR négatif
 * (`moraleOnNegativeDR`) et celui qui DIRIGE le navire (`steering`), le choix de paie mis en avant
 * (`recommendedPay`), l'écran vers lequel un service PORTE (`opensScreen`), et la catégorie Codex de
 * chaque table de Maladresse (`codexCategory`, `miscast.json` déclarant désormais ses tables), puis
 * 27 → 20 (lot E4/C4-δ4, 2026-08-17) — l'OUTILLAGE `scripts/` : les deux compilateurs de campagne
 * déclarent l'offre de couchage à l'AUTHORING (`scene({ rest })` → `MapSpec.rest`, les deux tables
 * `REST_OFFERS[s.id]` supprimées), `obtainabilityGraph` lit la famille de Sort qu'un Talent ouvre sur
 * son entrée (`combat.castingKind`), `gen-toise-gallery` passe par la primitive `sizeFromTraits`, la
 * planche `_qc-decor-sheet` prend sa liste de mise en avant EN ARGUMENT (`--new=id1,id2`) et
 * `reconcile.mjs` lit le sigle du livre PIVOT au registre (`PIVOT_ABBR`, dérivé de `books.json`), puis
 * 20 → 9 (lot E4/C-γ, 2026-08-17) — le cluster AMPUTATION/comptage : `critical.ts`, `trauma.ts`,
 * `injuries.ts` et `CharacterSheet.tsx` sortent de la liste. Ce que l'entrée DÉCLARE désormais : la règle
 * de COMPTAGE d'une séquelle cumulative (`TraumaFiche.cumul` — portée, unité, effet par palier, seuil
 * d'escalade `remplace`/`ajoute`), son routage d'APPARENCE sur le rig (`TraumaFiche.rig`), les PALIERS
 * d'entraînement d'une prothèse (`TrappingData.prosthesisTraining`) et les deux escalades de Blessure
 * critique, chacune en AXE paramétré (`escalation.perRound`/`apresDelai` : séquelle visée + cadence/délai).
 */
const KNOWN: Record<string, number> = {
  // JUSTIFIÉS NOMINATIFS (outillage de LECTURE/QC, pas de la logique de règle) — leur forme saine
  // exigerait un champ déclaré sur le CATALOGUE DE DÉCOR (`src/gameIso/catalog/decor/`) ou sur le
  // registre d'os, hors du périmètre du lot δ4 :
  'scripts/qc/mesure-volume.mts': 1, // `id === 'torse'` — masque de mesure du harnais de volume
  'scripts/qc/opera-furniture-check.mts': 2, // `FLOATING.has(e.ref)` (lustre SUSPENDU) + `e.ref !== 'siege'` (prop admis sur le parterre) : deux propriétés du prop, à déclarer sur sa def
  'src/gameIso/rig/skeletons.ts': 1, // for…of démasqué : `WAIST_BONES.includes(id)`
  'src/state/combatFlow.ts': 1,
  'src/state/combatManeuvers.ts': 1,
  'src/ui/PartyScreen.tsx': 2,
  'src/ui/compendium/registry.ts': 1, // `CONSTRUCTION_TRAIT_LABEL[t.id]` — libellés de Trait de coque sans champ `label` en donnée
};

/** Plafond GLOBAL du jour (= somme de `KNOWN`), destiné à tomber à 0. */
const CEILING = Object.values(KNOWN).reduce((s, n) => s + n, 0);

/**
 * SECOND CLIQUET — la forme BRUTE « <champ d'identité> === '<littéral>' », sans aucune condition de
 * liaison (`scanRawIdEqualities`). Il ne mesure PAS la doctrine : les formes que le garde principal
 * laisse hors champ à raison (lookup par id stable dans un `.find`/`.some`, entrée tenue par une
 * constante de module) sont ici comptées, et y figurer n'est pas une faute. Ce qu'il verrouille, c'est
 * l'ÉVASION : `if (id === 'x')` réécrit en `xs.some((t) => t.id === 'x')` éteint le garde principal
 * sans rien assainir — le compte brut, lui, ne bouge pas et la fuite se voit.
 *
 * SA COUVERTURE, ET RIEN DE PLUS : le seul critère est le NOM du champ (`id`/`xxxId`/`ref`/`xxxRef`/
 * `book`) sur un nœud d'ÉGALITÉ. Un alias RENOMMÉ (`const cle = t.id; cle === 'x'`) échappe aux DEUX
 * gardes — angle mort mesuré et ASSERTÉ en test ci-dessous, avec les autres (destructuration
 * renommée, `switch`/`includes`, `Object.is`, gabarit à substitution, champ hors convention). Ce
 * cliquet borne l'évasion la plus PROBABLE (déplacer le site dans un prédicat), pas toutes.
 *
 * Deux sens, comme le plafond principal : une hausse est nominative (un branchement brut de plus),
 * une baisse non répercutée est « périmée » (le compte doit descendre dans ce fichier). Ce compte NE
 * DOIT JAMAIS MONTER, et chaque lot d'assainissement doit le faire DESCENDRE.
 * Mesure du 2026-08-17 (#1318 E4/C0-a), par NŒUD (deux comparaisons sur une même ligne pèsent 2) :
 * 169 au moment de la pose du cliquet, 165 après le lot C1 (marqueurs de cargaison passés en donnée —
 * `registry.ts` et `PortView.tsx` sortent de la liste), 163 après le lot C2 (gate d'espèce en champ
 * déclaré : `creation.ts` sort de la liste, `CharacterCreator.tsx` passe de 8 à 7), 160 après le lot
 * C4-groups (appartenance de Groupe déclarée en donnée : `groups.ts` sort de la liste), 158 après le
 * lot C4-δ1 (politique de dissipation déclarée sur l'effet : `exposure.ts` sort de la liste), 146 après
 * le lot C4-δ2 (Trait intransférable, Mains nues / Arme improvisée, Domaine arcanique octroyé et
 * caractéristique alternative déclarés sur l'entrée ; armement de créature et « Compétence de Corps à
 * corps » lus sur le `specsSource` déjà déclaré : `creatureEquip.ts`, `polymorph.ts`, `items.ts`,
 * `conjuredWeapons.ts`, `skills.ts` et `combat.ts` sortent de la liste, `careerSlots.ts` passe de 2 à 1
 * et `CharacterCreator.tsx` de 7 à 6), 136 après le lot C4-δ3 (couche activités/UI : `mountTravel.ts`,
 * `massBattleFlow.ts`, `CityHubScreen.tsx`, `CouncilModal.tsx` et `CrewTestModal.tsx` sortent de la liste,
 * `seaVoyageFlow.ts` passe de 6 à 4, `combatSlice.ts` de 3 à 2 et `InterludeScreen.tsx` de 3 à 2),
 * 131 après le lot C4-δ4 (outillage : `obtainabilityGraph.ts`, `gen-toise-gallery.mts` et
 * `reconcile.mjs` sortent de la liste — famille de Sort lue sur le Talent, Taille lue par
 * `sizeFromTraits`, sigle du livre pivot lu au registre `books.json`), 113 après le lot E4/C-γ (cluster
 * amputation/comptage : `CharacterSheet.tsx` et `partyFlow.ts` sortent de la liste — paliers de prothèse
 * déclarés au catalogue —, `critical.ts` passe de 5 à 1, `trauma.ts` de 10 à 4 et `injuries.ts` de 5 à 2).
 */
const RAW_KNOWN: Record<string, number> = {
  'scripts/gen-bestiary-gallery.mts': 1,
  'scripts/gen-creature-attacks-gallery.mts': 2,
  'scripts/qc/mesure-volume.mts': 1,
  'scripts/qc/opera-furniture-check.mts': 1,
  'src/engine/aaCritical.ts': 1,
  'src/engine/activities.ts': 1,
  'src/engine/careerSlots.ts': 1, // reste `s.skillId === 'focalisation'` (lookup par id stable)
  'src/engine/conditions.ts': 1,
  'src/engine/corruption.ts': 2,
  'src/engine/crewedWeapon.ts': 1,
  'src/engine/critical.ts': 1, // reste `s.skillId === 'resistance'` (lookup par id stable)
  'src/engine/drunkenness.ts': 1,
  'src/engine/engagement.ts': 2,
  'src/engine/equipCompare.ts': 2,
  'src/engine/healing.ts': 1,
  'src/engine/magic.ts': 3,
  'src/engine/menace.ts': 1,
  'src/engine/provisions.ts': 1,
  'src/engine/psychology.ts': 3,
  'src/engine/rest.ts': 1,
  'src/engine/riverNavigation.ts': 3,
  'src/engine/seaNavigation.ts': 1,
  'src/engine/trauma.ts': 4, // pénalité de combat PAR MAIN (doigts/main) + crochet entraîné : axe NON couvert par `cumul`
  'src/engine/weaponDamage.ts': 1,
  'src/engine/windsOfMagic.ts': 1,
  'src/gameIso/rig/mountedRig.ts': 1,
  'src/gameIso/rig/parts/career.ts': 3,
  'src/gameIso/rig/parts/equipment.ts': 1,
  'src/gameIso/rig/parts/injuries.ts': 2, // reste le canal APPARENCE (œil remplacé en place), hors `rig` (calques)
  'src/gameIso/stage/Ambiance.tsx': 1,
  'src/gameIso/stage/CrewTooltip.tsx': 1,
  'src/gameIso/stage/highlightLayer.tsx': 1,
  'src/gameIso/tokenBodyKind.tsx': 1,
  'src/state/aiSpellValue.ts': 2,
  'src/state/bourseFlow.ts': 1,
  'src/state/combatEffects.ts': 3,
  'src/state/combatFlow.ts': 4,
  'src/state/combatGeometry.ts': 1,
  'src/state/combatManeuvers.ts': 4,
  'src/state/combatSlice.ts': 2,
  'src/state/devtools.ts': 1,
  'src/state/interludeFlow.ts': 4,
  'src/state/mount.ts': 1,
  'src/state/restFlow.ts': 1,
  'src/state/riverVoyageFlow.ts': 4,
  'src/state/seaVoyageFlow.ts': 4,
  'src/state/store.ts': 1,
  'src/state/travelFlow.ts': 6,
  'src/state/travelPostes.ts': 2,
  'src/state/vision.ts': 1,
  'src/ui/ActiveModal.tsx': 1,
  'src/ui/HealModal.tsx': 2,
  'src/ui/InterludeScreen.tsx': 2,
  'src/ui/MedicModal.tsx': 2,
  'src/ui/MerchantPanel.tsx': 1,
  'src/ui/PartyScreen.tsx': 2,
  'src/ui/creator/CharacterCreator.tsx': 6,
  'src/ui/editor/StatblockEditor.tsx': 1,
  'src/ui/gallery/registry.tsx': 4,
};

/** Plafond BRUT global du jour (= somme de `RAW_KNOWN`). */
const RAW_CEILING = Object.values(RAW_KNOWN).reduce((s, n) => s + n, 0);

/**
 * Lecture TOLÉRANTE d'un fichier LISTÉ à l'étape précédente : entre le listage et la lecture, un
 * fichier peut avoir disparu — un autre worker de la suite écrit puis supprime des fichiers de
 * travail sous `src/` (pipeline d'atelier). Un ENOENT y désigne donc un fichier TRANSITOIRE, sauté
 * en silence (`statSync` du walker compris). ANGLE MORT ASSUMÉ : une suppression concurrente d'un
 * fichier RÉEL du dépôt serait sautée pareillement — le scan mesurerait un corpus incomplet sans
 * le dire.
 */
const TRANSITOIRE = (e: unknown): boolean => (e as NodeJS.ErrnoException)?.code === 'ENOENT';
function lireSiPresent(f: string): string | null {
  try { return readFileSync(f, 'utf8'); }
  catch (e) { if (TRANSITOIRE(e)) return null; throw e; }
}

function scanFiles(dirs: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules') continue;
      const p = join(dir, e);
      let dossier: boolean;
      try { dossier = statSync(p).isDirectory(); }
      catch (err) { if (TRANSITOIRE(err)) continue; throw err; }
      if (dossier) walk(p);
      else if (SCAN_EXTS.some((x: string) => e.endsWith(x))) files.push(p);
    }
  };
  for (const d of dirs) walk(isAbsolute(d) ? d : join(ROOT, d));
  return files;
}

function findingsIn(dirs: string[]): { rel: string; line: number; detail: string; rule: string }[] {
  const out: { rel: string; line: number; detail: string; rule: string }[] = [];
  for (const f of scanFiles(dirs)) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (isRegistryIdBranchExcluded(rel)) continue;
    const raw = lireSiPresent(f);
    if (raw === null) continue;
    for (const fd of scanRegistryIdBranch(rel, raw)) out.push({ rel, ...fd });
  }
  return out;
}

/** MÊME corpus, MÊMES exclusions, détecteur BRUT (`scanRawIdEqualities`) — le cliquet anti-évasion. */
function rawFindingsIn(dirs: string[]): { rel: string; line: number; detail: string }[] {
  const out: { rel: string; line: number; detail: string }[] = [];
  for (const f of scanFiles(dirs)) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (isRegistryIdBranchExcluded(rel)) continue;
    const raw = lireSiPresent(f);
    if (raw === null) continue;
    for (const fd of scanRawIdEqualities(rel, raw)) out.push({ rel, ...fd });
  }
  return out;
}

const rules = (src: string, name = 'fixture.ts') => scanRegistryIdBranch(name, src).map((f) => f.rule);

describe('garde-fou « branchement par identité dans du code générique » (#842)', () => {
  it('MORSURE : le branchement sur l’identité d’une entrée reçue est détecté', () => {
    // Cas PLANTÉS = les DEUX motifs réels du panneau « Règles maison » — un panneau dont l'en-tête
    // proclame qu'il « ne connaît aucune règle en dur » : la reprise de cadence branchée sur l'id
    // dans le gestionnaire générique, et le bouton de Chance branché sur l'id de l'entrée rendue.
    const handler = [
      'const change = (id: string, v: RuleValue) => {',
      "  if (id === 'combat-cadence') resumeCadence();",
      '  setHouseRule(id, v);',
      '};',
    ].join('\n');
    expect(rules(handler)).toEqual(['id-equality']);

    const row = [
      'function HouseRuleRow({ def }: { def: OptionalRule }) {',
      "  return def.id === 'fortune-mid-session' ? <FortuneButton /> : null;",
      '}',
    ].join('\n');
    expect(rules(row, 'fixture.tsx')).toEqual(['id-equality']);
  });

  it('MORSURE : les trois autres formes (switch, liste fermée, table à clé ouverte)', () => {
    const sw = ['function render(entry: Entry) {', '  switch (entry.id) {', "    case 'a': return 1;", '  }', '}'].join('\n');
    expect(rules(sw)).toEqual(['id-switch']);

    const membership = [
      "const PERSISTENTS = new Set(['hemorragique', 'aveugle']);",
      'export function keep(list: Cond[]) {',
      '  return list.filter((x) => PERSISTENTS.has(x.id));',
      '}',
    ].join('\n');
    expect(rules(membership)).toEqual(['id-membership']);

    const record = [
      "const LABELS: Record<string, string> = { renforce: 'Renforcé', solide: 'Solide' };",
      'export function row(t: Trait) { return LABELS[t.id] ?? t.id; }',
    ].join('\n');
    expect(rules(record)).toEqual(['id-record']);
  });

  it('MORSURE : un ALIAS d’identité est suivi par sa LIAISON, quel que soit son nom', () => {
    const alias = [
      'function row(def: OptionalRule) {',
      '  const k = def.id;',
      "  return k === 'combat-cadence';",
      '}',
    ].join('\n');
    expect(rules(alias)).toEqual(['id-equality']);

    const aliasSwitch = [
      'function row(def: OptionalRule) {',
      '  const k = def.id;',
      '  switch (k) {',
      "    case 'a': return 1;",
      '  }',
      '}',
    ].join('\n');
    expect(rules(aliasSwitch)).toEqual(['id-switch']);
  });

  it('CONTRE-ÉPREUVE : les formes SAINES restent vertes', () => {
    const sain = [
      // (1) lire un CHAMP DÉCLARÉ sur l'entrée — la forme que la doctrine demande.
      "function Row({ def }: { def: OptionalRule }) { return def.kind === 'flag' ? <Check /> : <Select />; }",
      // (2) comparer à une VARIABLE : une sélection, pas un branchement en dur.
      'const active = tabs.find((t) => t.id === tabKey);',
      // (3) lookup PAR ID STABLE dans un prédicat de sélection.
      "const sk = c.skills.find((s) => s.skillId === 'resistance');",
      "const has = c.talents.some((t) => t.talentId === 'frenesie');",
      // (4) sentinelle de vide.
      "function pick(id: string) { return id === '' ? null : byId.get(id); }",
      // (5) table EXHAUSTIVE par type : la clé est une union fermée, le compilateur exige l'entrée.
      "const META: Record<StepId, string> = { species: 'Race', career: 'Carrière' };",
      'export function stepLabel(id: StepId) { return META[id]; }',
      // (6) index CALCULÉ : il suit le registre au lieu de le figer.
      'const byId = new Map(REGISTRY.map((e) => [e.id, e]));',
      'export function get(id: string) { return byId.get(id); }',
      // (7) DISCRIMINANT d'union de type : du polymorphisme, pas une identité de registre.
      "function area(a: Area) { return a.kind === 'disc' ? a.r : a.w; }",
      "function paint(el: El) { return el.kind === 'roof' ? roof(el) : wall(el); }",
      // (8) SQUELETTE `Partial<Record<Union, …>>` : clé FERMÉE déclarée en type — l'indexer par un os
      //     reçu n'est pas une table de valeurs par entrée de registre.
      'const SK: Partial<Record<BoneId, Bone>> = { tronc: b1, croupe: b2 };',
      'export function zOf(id: BoneId) { return SK[id]!.z; }',
    ].join('\n');
    expect(rules(sain, 'fixture.tsx')).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : un nom déclaré littéral ICI et calculé LÀ n’accuse plus le second', () => {
    // La pré-passe des tables littérales est à PLAT (tout le fichier) : sans levée d’ambiguïté, le
    // `sk` CALCULÉ de la seconde fonction héritait du `sk` littéral de la première.
    const collision = [
      'function build(p: P) {',
      '  const sk = { corps: bone(p), tete: bone(p) };',
      '  return sk;',
      '}',
      'export function draw(p: P, ids: string[]) {',
      '  const sk = build(p);',
      '  return ids.map((id) => sk[id].z);',
      '}',
    ].join('\n');
    expect(rules(collision)).toEqual([]);
  });

  it('MORSURE : l’identité nommée `ref`/`xxxRef` est vue comme un `id`', () => {
    const byRef = [
      'export function decor(el: SceneEntity) {',
      "  return el.ref === 'tonneau' ? tonneauArt() : genericArt(el);",
      '}',
    ].join('\n');
    expect(rules(byRef)).toEqual(['id-equality']);

    const bySuffix = ["export function place(e: Ent) {", "  switch (e.encRef) {", "    case 'embuscade': return 1;", '  }', '}'].join('\n');
    expect(rules(bySuffix)).toEqual(['id-switch']);
  });

  it('MORSURE : la variable d’une boucle `for…of` est GÉNÉRIQUE, dedans comme dehors (#1318 V6)', () => {
    // Le trou historique : la déclaration GÉNÉRIQUE de la variable de boucle était écrasée par la
    // re-visite de l'initialiseur — aucune boucle du dépôt n'était vue. Même faute, hors boucle
    // (déjà mordue) et dans la boucle (démasquée) : les deux DOIVENT mordre.
    const horsBoucle = "export function f(s: Sp) {\n  return s.source.book === 'nadj';\n}";
    expect(rules(horsBoucle)).toEqual(['id-equality']);

    const dansBoucle = [
      'export function g(all: Sp[]) {',
      '  for (const s of all) {',
      "    if (s.source.book === 'nadj') continue;",
      '  }',
      '}',
    ].join('\n');
    expect(rules(dansBoucle)).toEqual(['id-equality']);

    const dansBoucleParId = "export function h(all: E[]) {\n  for (const e of all) {\n    if (e.id === 'gnome') return e;\n  }\n}";
    expect(rules(dansBoucleParId)).toEqual(['id-equality']);
  });

  it('MORSURE : l’identité d’un LIVRE source (`source.book`) est vue comme un `id` (#1318 V6)', () => {
    const byBook = [
      'export function eligible(s: SpeciesData) {',
      "  return s.source.book === 'nuits-agitees-et-dures-journees';",
      '}',
    ].join('\n');
    expect(rules(byBook)).toEqual(['id-equality']);
  });

  it('MORSURE : l’outillage `scripts/**` en `.mjs` est parsable et scanné', () => {
    const mjs = ["export function compile(entry) {", "  if (entry.ref === 'auberge') return special();", '  return generic(entry);', '}'].join('\n');
    expect(rules(mjs, 'scripts/arene/probe.mjs')).toEqual(['id-equality']);
  });

  it('CÂBLAGE : le scan de CORPUS consomme réellement le détecteur (sur fixture DISQUE)', () => {
    // Preuve de câblage, pas un test du détecteur : `findingsIn` est la MÊME fonction que le cliquet
    // ci-dessous. Si la ligne qui appelle `scanRegistryIdBranch` disparaît de `findingsIn`, ce test
    // rougit — alors que le cliquet, lui, verrait simplement zéro site et resterait sous le plafond.
    const tmp = mkdtempSync(join(tmpdir(), 'registry-id-branch-wiring-'));
    try {
      writeFileSync(join(tmp, 'probe.ts'), "export function probe(entry: E) {\n  return entry.id === 'sonde-cablage';\n}\n");
      expect(findingsIn([tmp]).map((f) => f.detail)).toContain("return entry.id === 'sonde-cablage';");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('CLIQUET : aucun site NOUVEAU, et tout site assaini abaisse le plafond', () => {
    const findings = findingsIn(SCAN_DIRS);
    const perFile: Record<string, number> = {};
    for (const f of findings) perFile[f.rel] = (perFile[f.rel] ?? 0) + 1;

    const worse = Object.entries(perFile)
      .filter(([rel, n]) => n > (KNOWN[rel] ?? 0))
      .map(([rel, n]) => `${rel}: ${n} (plafond ${KNOWN[rel] ?? 0})\n` + findings.filter((f) => f.rel === rel).map((f) => `    ${f.rel}:${f.line} [${f.rule}] ${f.detail}`).join('\n'));
    expect(
      worse,
      'Branchement par IDENTITÉ dans du code générique — le comportement particulier se déclare en ' +
        "CHAMP sur l'entrée du registre (lu comme `def.kind`), jamais en test d'id :\n" + worse.join('\n'),
    ).toEqual([]);

    const better = Object.entries(KNOWN).filter(([rel, n]) => (perFile[rel] ?? 0) < n).map(([rel, n]) => `${rel}: ${perFile[rel] ?? 0} < ${n}`);
    expect(
      better,
      "Sites assainis : abaisser leur compte dans KNOWN (le plafond descend, il ne remonte jamais) :\n" + better.join('\n'),
    ).toEqual([]);
    expect(findings.length).toBe(CEILING);
  });

  it('MORSURE BRUTE : les liaisons hors champ du garde principal sont comptées, `.startsWith` non', () => {
    // Ce que le garde principal laisse hors champ À RAISON (lookup par id stable, constante de
    // module) : le compte brut, lui, les voit — c'est ce qui rend l'évasion visible.
    const evasions = [
      "const has = c.talents.some((t) => t.talentId === 'frenesie');",
      "const sk = c.skills.find((s) => s.skillId === 'resistance');",
      "const isFortune = FORTUNE.id === 'fortune-mid-session';",
      "const noyau = REGISTRE[0];\nconst estCadence = noyau.id === 'combat-cadence';",
    ].join('\n');
    expect(scanRegistryIdBranch('fixture.ts', evasions)).toEqual([]);
    expect(scanRawIdEqualities('fixture.ts', evasions)).toHaveLength(4);

    // Hors périmètre du détecteur brut : ce n'est pas une ÉGALITÉ, ou pas un champ d'identité.
    const horsPerimetre = [
      "const fam = def.id.startsWith('combat-');",
      "const sel = tabs.find((t) => t.id === tabKey);",
      "const kind = def.kind === 'flag';",
      "const vide = id === '';",
    ].join('\n');
    expect(scanRawIdEqualities('fixture.ts', horsPerimetre)).toEqual([]);
  });

  it('MORSURE BRUTE : deux comparaisons sur UNE ligne pèsent DEUX (compte par nœud)', () => {
    // Le garde principal déduplique par ligne : n'en éteindre qu'une n'y changerait rien. Ici si.
    const uneLigne = "const l = (id: string) => id === 'commerce' ? 'A' : id === 'minimum-vital' ? 'B' : id;";
    expect(scanRegistryIdBranch('fixture.ts', uneLigne)).toHaveLength(1);
    expect(scanRawIdEqualities('fixture.ts', uneLigne)).toHaveLength(2);
  });

  it('ANGLES MORTS ASSERTÉS : ce que les deux gardes ne voient PAS, écrit noir sur blanc', () => {
    // Un détecteur ne mesure que SA COUVERTURE. Les formes ci-dessous rendent 0/0 ou 1/0 : c'est un
    // ANGLE MORT CONNU, pas une couverture. Elles sont assertées TELLES QUELLES pour qu'aucune
    // relecture ne les redécouvre comme une garantie, et pour qu'un élargissement futur du détecteur
    // rougisse ICI et se déclare. Format : [principal, brut].
    const mesure = (src: string): [number, number] =>
      [scanRegistryIdBranch('fixture.ts', src).length, scanRawIdEqualities('fixture.ts', src).length];

    // (1) ALIAS RENOMMÉ dans un prédicat : l'évasion COMPLÈTE — le nom porteur a changé, les deux
    //     détecteurs sont aveugles. C'est la limite haute de ce cliquet, assumée.
    expect(mesure("const has = (defs: E[]) => defs.some((t) => {\n  const cle = t.id;\n  return cle === 'commerce';\n});")).toEqual([0, 0]);
    // (2) …et hors prédicat, même aveuglement.
    expect(mesure("const noyau = REG[0];\nconst cle = noyau.id;\nconst x = cle === 'commerce';")).toEqual([0, 0]);
    // (3) DESTRUCTURATION RENOMMÉE — 0/0 ; la destructuration DIRECTE garde le nom et mord (1/1).
    expect(mesure("function f({ id: cle }: E) { return cle === 'commerce'; }")).toEqual([0, 0]);
    expect(mesure("function f({ id }: E) { return id !== 'commerce'; }")).toEqual([1, 1]);
    // (4) `switch` et appartenance : vus par le garde principal, HORS de la mesure brute (égalités seules).
    expect(mesure("function f(e: E) { switch (e.id) { case 'commerce': return 1; } }")).toEqual([1, 0]);
    expect(mesure("const L = ['commerce', 'subsistance'];\nfunction f(e: E) { return L.includes(e.id); }")).toEqual([1, 0]);
    // (5) Comparaisons qui ne sont pas un nœud d'égalité, ou dont le littéral n'en est pas un.
    expect(mesure("function f(e: E) { return Object.is(e.id, 'commerce'); }")).toEqual([0, 0]);
    expect(mesure('function f(e: E, p: string) { return e.id === `${p}commerce`; }')).toEqual([0, 0]);
    expect(mesure('function f(e: E) { return e.id === `commerce`; }')).toEqual([1, 1]); // gabarit SANS substitution : vu
    expect(mesure("function f(e: E) { return e.id.startsWith('commerce'); }")).toEqual([0, 0]);
    // (6) Champ d'identité hors convention de nom : le seul critère du scan brut est ce nom.
    expect(mesure("function f(e: E) { return e.cle === 'commerce'; }")).toEqual([0, 0]);
    // (7) VARIABLE d'identité hors convention : un id de registre transporté par un paramètre nommé
    //     `decision`/`choix`/`kind` échappe aux DEUX gardes — angle mort MESURÉ sur le terrain
    //     (`shipCrew.resolveVesselWeek(…, decision)` nommait 'pas-de-paie' sans jamais être compté ;
    //     assaini à la main sous #1318 E4/C4-δ3, pas par le détecteur). Élargir `ID_NAME_RX` à ces
    //     noms est un choix OUVERT : il rougirait ICI d'abord, et se déclarerait.
    expect(mesure("function paie(decision: string) { return decision === 'pas-de-paie'; }")).toEqual([0, 0]);
    expect(mesure("function svc(s: S) { return s.kind === 'auberge'; }")).toEqual([0, 0]);
  });

  it('CLIQUET BRUT : la forme « id === littéral » ne monte jamais, et toute baisse se répercute', () => {
    const findings = rawFindingsIn(SCAN_DIRS);
    const perFile: Record<string, number> = {};
    for (const f of findings) perFile[f.rel] = (perFile[f.rel] ?? 0) + 1;

    const worse = Object.entries(perFile)
      .filter(([rel, n]) => n > (RAW_KNOWN[rel] ?? 0))
      .map(([rel, n]) => `${rel}: ${n} (plafond ${RAW_KNOWN[rel] ?? 0})\n` + findings.filter((f) => f.rel === rel).map((f) => `    ${f.rel}:${f.line} ${f.detail}`).join('\n'));
    expect(
      worse,
      'Comparaison BRUTE d’un champ d’identité à un littéral — ce compte ne monte jamais : un site ' +
        'déplacé dans un `.find`/`.some` pour échapper au garde principal reste compté ICI :\n' + worse.join('\n'),
    ).toEqual([]);

    const better = Object.entries(RAW_KNOWN).filter(([rel, n]) => (perFile[rel] ?? 0) < n).map(([rel, n]) => `${rel}: ${perFile[rel] ?? 0} < ${n}`);
    expect(
      better,
      'Mesure brute PÉRIMÉE : abaisser ces comptes dans RAW_KNOWN (le plafond descend, jamais l’inverse) :\n' + better.join('\n'),
    ).toEqual([]);
    expect(findings.length).toBe(RAW_CEILING);
  });
});
