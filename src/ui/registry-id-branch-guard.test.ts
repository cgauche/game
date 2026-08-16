import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanRegistryIdBranch, isRegistryIdBranchExcluded, SCAN_DIRS, SCAN_EXTS } from '../../scripts/guards/lib/registryIdBranch.mjs';

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
 */
const KNOWN: Record<string, number> = {
  'scripts/_qc-decor-sheet.mts': 2,
  'scripts/arene/generate.mjs': 1, // for…of démasqué : `REST_OFFERS[s.id]` — table de repos par id de scène
  'scripts/data/lib/obtainabilityGraph.ts': 1, // `talentId === 'invocation'|'beni'|'magie-du-chaos'` → famille
  'scripts/gen-toise-gallery.mts': 1, // for…of démasqué : `t.id === 'taille'` (outil de galerie QC)
  'scripts/loup-et-saumure/generate.mjs': 1, // for…of démasqué : `REST_OFFERS[s.id]` (même patron qu'arène)
  'scripts/qc/mesure-volume.mts': 1,
  'scripts/qc/opera-furniture-check.mts': 2, // for…of démasqué : `FLOATING.has(e.ref)` + `e.ref !== 'siege'`
  'scripts/raw/reconcile.mjs': 1, // `book` démasqué : `c.book === 'LDB'` (garde de couverture RAW)
  'src/engine/careerSlots.ts': 1, // for…of démasqué : `t.talentId !== 'magie-des-arcanes'`
  'src/engine/combat.ts': 1,
  'src/engine/conjuredWeapons.ts': 2, // +1 for…of démasqué : `s.skillId === 'corps-a-corps'`
  'src/engine/creation.ts': 1, // `book` + for…of démasqués : `s.source.book === 'nuits-agitees-…'` (gate Gnome)
  'src/engine/creatureEquip.ts': 2,
  'src/engine/critical.ts': 4,
  'src/engine/exposure.ts': 1, // for…of démasqué : `e.effectId === 'exposition-froid'|'-chaleur'`
  'src/engine/groups.ts': 4, // +1 for…of démasqué : `t.talentId === 'beni'`
  'src/engine/items.ts': 1,
  'src/engine/mountTravel.ts': 2,
  'src/engine/persistence.ts': 2,
  'src/engine/polymorph.ts': 1, // for…of démasqué : `t.id !== 'bestial'`
  'src/engine/skills.ts': 2,
  'src/engine/trauma.ts': 2,
  'src/gameIso/rig/parts/injuries.ts': 2, // for…of démasqué : `t.traumaId === 'membre-inferieur-ampute'|'nez-ampute'`
  'src/gameIso/rig/skeletons.ts': 1, // for…of démasqué : `WAIST_BONES.includes(id)`
  'src/state/combatFlow.ts': 2, // +1 for…of démasqué : `MISCAST_TABLE_CATEGORIES[id]`
  'src/state/combatManeuvers.ts': 1,
  'src/state/massBattleFlow.ts': 1,
  'src/state/seaVoyageFlow.ts': 2,
  'src/ui/CharacterSheet.tsx': 3, // for…of démasqué : `it.trappingId === 'crochet'|'fausse-jambe'` (prothèses)
  'src/ui/CityHubScreen.tsx': 1,
  'src/ui/CouncilModal.tsx': 2,
  'src/ui/CrewTestModal.tsx': 1,
  'src/ui/InterludeScreen.tsx': 1,
  'src/ui/PartyScreen.tsx': 2,
  'src/ui/PortView.tsx': 1,
  'src/ui/compendium/registry.ts': 2,
  'src/ui/creator/CharacterCreator.tsx': 1, // `book` + for…of démasqués : même gate Gnome que creation.ts
  'src/ui/creator/draft.ts': 1,
};

/** Plafond GLOBAL du jour (= somme de `KNOWN`), destiné à tomber à 0. */
const CEILING = Object.values(KNOWN).reduce((s, n) => s + n, 0);

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
});
