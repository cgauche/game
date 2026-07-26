import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  scanLabelLogic, collectIdParamFunctions, scanLabelAsIdArg, collectIdParamFnsAcrossDirs, effectiveIdParamFns,
  scanLabelLiteralCompare, labelLiteralStockDrift, LABEL_LITERAL_STOCK,
  STRICT_DIRS, RATCHET_DIRS, RATCHET_EXCEPTIONS,
} from '../../scripts/guards/lib/labelLogic.mjs';

/**
 * Garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc agents) : toute LOGIQUE est
 * keyée par `id` STABLE — le `label` est de l'AFFICHAGE (multilangue). Scanne `src/engine` + `src/state`
 * (moteur/store, #142) + `src/gameIso` + `src/ui` (#289, rendu iso + UI) récursif, `.ts`/`.tsx`, HORS
 * `*.test.*` : ÉCHEC si le code (commentaires retirés) porte, sur `.label`, l'une de CINQ formes —
 * une carte par label (`XXX_BY_LABEL`/`byLabel`), une comparaison D'ÉGALITÉ (`x.label === …` /
 * `… === x.label`), un PRÉDICAT (regex `.test(x.label)`, méthode de chaîne `x.label.startsWith(…)`,
 * `switch (x.label)`), un champ d'AFFICHAGE en CLÉ (`display-key`/`collection-key`), ou `.label`
 * passé en ARGUMENT à un appel dont le PARAMÈTRE de déclaration s'appelle `id` (`label-as-id-arg`,
 * LOT 5 — `bodyShapeOf(sb.label)` : le paramètre attend un id STABLE, `.label` est de l'affichage).
 *
 * `src/engine`/`src/state` restent TOLÉRANCE ZÉRO, AUCUNE exception (l'instance de référence,
 * `creatureEquip.ts` SHAPE_BY_LABEL/RELOAD_BY_LABEL, est déjà migrée — rien ne justifie un répit
 * dans le moteur/store).
 *
 * `src/gameIso`/`src/ui` (#289, élargissement) portent un ratchet à EXCEPTIONS JUSTIFIÉES
 * (patron `no-emoji-affordance.test.ts`/LOT 4) : un `fichier:ligne` par site, chacun un pattern
 * DIFFÉRENT du FK-par-label originel (#142) — recherche/diagnostic, pas persistance de logique :
 *  - diagnostic DEV qui détecte PRÉCISÉMENT un mésusage label-au-lieu-d'id (comparer par id
 *    annulerait le diagnostic) ;
 *  - saisie/recherche UI par texte tapé (le label EST la clé de recherche humaine, motif `RefField`
 *    freeText déjà sanctionné) sur un type qui ne porte PAS d'id (aucune régression possible) ;
 *  - auto-liage de PROSE par texte (Codex) — matching textuel, pas une FK.
 * Chaque exception se justifie ligne par ligne ; une migration mécanique retire son entrée (CLIQUET).
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
// `STRICT_DIRS`/`RATCHET_DIRS`/`RATCHET_EXCEPTIONS` : SOURCE UNIQUE `scripts/guards/lib/labelLogic.mjs`
// (importés ci-dessus), consommée à l'identique par le hook pre-commit — plus de copie locale ici.

// `src/data/index.ts` = couture label→id tolérée au CHARGEMENT (conversion depuis du texte) — hors
// périmètre du garde-fou, aucune LOGIQUE keyée par label. (`instanceIdMigration.ts` est SCANNÉ comme
// tout fichier state : sa migration de renommage teste la PRÉSENCE de clé `'label' in o`, pas une
// comparaison de libellé.)
const EXCLUDED = (rel: string) =>
  /\.test\.[tj]sx?$/.test(rel) || rel === 'src/data/index.ts';

// Mécanique de scan (stripComments + BY_LABEL_RX/LABEL_EQ_RX + scanLabelLogic) :
// `scripts/guards/lib/labelLogic.mjs` (module .mjs pur), partagé avec le hook pre-commit
// (`scripts/git-hooks/pre-commit.mjs`) — la composition « map globale de déclarations id-param +
// résolution du shadowing » (`collectIdParamFnsAcrossDirs`/`effectiveIdParamFns`, #142 LOT 6bis) est
// EXPORTÉE par la lib, consommée à l'identique par ce test ET par le hook, sans copie.

function scanFiles(dirs: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of dirs) walk(isAbsolute(d) ? d : join(ROOT, d));
  return files;
}

const ALL_DIRS = [...STRICT_DIRS, ...RATCHET_DIRS];
// Fonctions à paramètre `id` (5ᵉ forme, LOT 5) — collecte GLOBALE sur src/engine+state+gameIso+ui
// (déclaration et appel peuvent vivre dans des fichiers différents, ex. `bodyShapeOf` déclarée dans
// `state/spawn.ts`, appelée depuis le même module).
const ID_PARAM_FNS = collectIdParamFnsAcrossDirs(ROOT, ALL_DIRS);

function findingsIn(dirs: string[]): { rel: string; line: number; detail: string }[] {
  const out: { rel: string; line: number; detail: string }[] = [];
  for (const f of scanFiles(dirs)) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const contenu = readFileSync(f, 'utf8');
    for (const finding of scanLabelLogic(rel, contenu)) out.push({ rel, line: finding.line, detail: finding.detail });
    for (const finding of scanLabelAsIdArg(rel, contenu, effectiveIdParamFns(contenu, ID_PARAM_FNS))) out.push({ rel, line: finding.line, detail: finding.detail });
  }
  return out;
}

describe('garde-fou « logique par label interdite » (#142)', () => {
  it('src/engine + src/state : TOLÉRANCE ZÉRO, aucune carte/comparaison par label', () => {
    const offenders = findingsIn(STRICT_DIRS).map((f) => `${f.rel}:${f.line}: ${f.detail}`);
    expect(
      offenders,
      'Logique par LABEL détectée dans src/engine ou src/state — doctrine : `id` stable pour la logique, ' +
        '`label` = affichage seul. Migrer vers un keying par id (cf. `src/data/index.ts` pour la seule ' +
        'couture label→id tolérée, au CHARGEMENT).',
    ).toEqual([]);
  });

  it('src/gameIso + src/ui (#289) : aucune régression hors des exceptions justifiées', () => {
    const offenders: string[] = [];
    for (const f of findingsIn(RATCHET_DIRS)) {
      // `f.rel` est relatif à la racine (`src/gameIso/...`/`src/ui/...`) ; les clés d'exception omettent `src/`.
      const shortKey = `${f.rel.replace(/^src\//, '')}:${f.line}`;
      if (!(shortKey in RATCHET_EXCEPTIONS)) offenders.push(`${f.rel}:${f.line}: ${f.detail}`);
    }
    expect(
      offenders,
      "Logique par LABEL non-exceptée dans src/gameIso/src/ui — migrer vers un keying par id, ou ajouter " +
        'une entrée JUSTIFIÉE à RATCHET_EXCEPTIONS (label-logic-guard.test.ts) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute exception dont le site a bougé/disparu doit être RETIRÉE ou re-justifiée', () => {
    const findings = findingsIn(RATCHET_DIRS);
    const present = new Set(findings.map((f) => `${f.rel.replace(/^src\//, '')}:${f.line}`));
    const stale = Object.keys(RATCHET_EXCEPTIONS).filter((k) => !present.has(k));
    expect(stale, 'Exception(s) PÉRIMÉE(s) (site déplacé ou assaini) — retirer/re-pointer ces entrées de RATCHET_EXCEPTIONS :\n' + stale.join('\n')).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE interpolé dans une CLÉ (#598)', () => {
    // Cas PLANTÉ = le motif EXACT qui vivait en `state/triggeredEffects.ts` (Atouts d'arme keyés par
    // LIBELLÉ, corrigé en `weaponIdentity`) : la garde `.label` d'origine n'en voyait NI le champ
    // `name`, NI la construction de clé par littéral de gabarit — c'est ce trou qui l'a laissé vivre.
    const src = [
      'out.push({ effects: w.onHitEffects, cap: 1, key: `weapon:${weapon.name}`, label: weapon.name });',
      'const key = `zone-${zone.label}-${t.x}`;',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2]);
    expect(findings.map((f) => f.rule)).toEqual(['display-key', 'display-key']);
  });

  it('scanLabelLogic : détecte une IDENTITÉ dérivée du label (slugId(x.label), #637)', () => {
    // Cas PLANTÉ = le motif EXACT qui vivait au rig (`TENUE_BY_ID` keyé par `slugId(d.label)`) et en
    // moteur (`uid: { prefix: nat-${slugId(op.label)} }`) : re-dériver un `id` du libellé d'affichage
    // multilangue au runtime. La CONTRE-ÉPREUVE `slugId(p.name)` (fragment TEXTE saisi en éditeur,
    // couture label→id d'authoring) NE doit PAS être flaguée — le détecteur vise `.label` seulement.
    const src = [
      'export const defId = (c) => c.id ?? slugId(c.label);',
      'const id = findTalent(p.name)?.id ?? slugId(p.name);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1]);
    expect(findings.map((f) => f.rule)).toEqual(['label-logic']);
  });

  it('scanLabelLogic : ne flague PAS la LECTURE d’affichage d’un libellé (interpolation de journal)', () => {
    // Contre-épreuve indispensable : ~700 interpolations d'AFFICHAGE existent dans src/ (`${c.name} touche
    // ${d.name}`). Les flaguer rendrait la garde inutilisable — seule la construction d'une CLÉ est visée.
    const src = [
      'log: `${attacker.name} manque ${defender.name}.`,',
      'lines.push(`${f.label} : ${rolled} Moral.`);',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE en CLÉ DE COLLECTION (#602)', () => {
    // Cas PLANTÉ = les motifs EXACTS du ticket #602 — `owned` (Set de talents possédés) keyé par LIBELLÉ
    // concret faute d'identité de spécialisation (`engine/character.ts`, corrigé en `refKey(id, spec)`),
    // et un repli d'UI keyé par le nom d'un sous-groupe (`compendium/CompendiumScreen.tsx`).
    const src = [
      'const free = specs.filter((s) => !owned.has(concreteLabel(entry.label, s)));',
      'if (!owned.has(entry.label)) return entry.label;',
      'const open = manualOpen[cl.name] ?? hasActive;',
      'seen.delete(other.label);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
    expect(findings.map((f) => f.rule)).toEqual(['collection-key', 'collection-key', 'collection-key', 'collection-key']);
  });

  it('scanLabelLogic : ne flague NI la résolution par id NI la CONSTRUCTION d’un index de texte (#602)', () => {
    // Contre-épreuves : (1) lire le libellé d'un lookup PAR ID est l'usage légitime du label (~50 sites
    // dans src/data) ; (2) REMPLIR un index depuis du texte est la conversion label→id tolérée
    // (CLAUDE.md) — auto-liage de prose, import de statbloc —, seule l'INTERROGATION est une décision.
    const src = [
      'return DISEASE_BY_ID.get(id)?.label ?? id;',
      'const l = byId.get(mm.entityId)?.label ?? byId.get(mm.entityId)?.ref;',
      'idx.exact.set(it.label, it);',
      'teamOf.set(named[i].name, named[i].kind === \'hero\' ? \'ally\' : \'enemy\');',
      'roots.add(e.label);',
      'NAME_TO_GROUP[norm(t.label)] = t.subType;',
      '(acc[it.name] ??= { name: it.name, uids: [] }).uids.push(it.uid);',
      '...Object.fromEntries(TRAVEL_VEHICLES.map((v) => [v.id, v.label])),',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte les prédicats sur `.label` (regex .test, méthode de chaîne, switch)', () => {
    const src = [
      "const isOgre = /ogre/i.test(sp.label);",
      "const isPermanent = !/amputation|cécité|surdité/i.test(t.label);",
      "const isAffaler = eff.label.startsWith('Affaler');",
      "switch (x.label) { case 'A': break; }",
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
  });

  it('collectIdParamFunctions + scanLabelAsIdArg : détecte `.label` passé où le paramètre déclaré est `id` (LOT 5)', () => {
    // Cas PLANTÉ = le motif EXACT de #142 LOT 5 (`state/spawn.ts` avant correction) : `bodyShapeOf`
    // déclare un paramètre `id: string` — lui passer `sb.label` fait résoudre par un libellé d'auteur,
    // pas une identité stable.
    const decl = 'export function bodyShapeOf(id: string): BodyShape {\n  return rec.appearance.species;\n}';
    const idParamFns = collectIdParamFunctions(decl);
    expect(idParamFns.get('bodyShapeOf')).toBe(0);
    const bad = 'bodyShape: bodyShapeOf(sb.label), // BUG';
    const ok = 'bodyShape: bodyShapeOf(creature.id),';
    expect(scanLabelAsIdArg('fixture.ts', bad, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    expect(scanLabelAsIdArg('fixture.ts', ok, idParamFns)).toEqual([]);
  });

  it('collectIdParamFunctions : repère le paramètre `id` quel que soit son rang positionnel', () => {
    const decl = 'function findEntry(list, id: string, fallback) {}';
    expect(collectIdParamFunctions(decl).get('findEntry')).toBe(1);
    const findings = scanLabelAsIdArg('fixture.ts', 'findEntry(all, e.label, def)', collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('CÂBLAGE : le scan de CORPUS (findingsIn) consomme réellement scanLabelAsIdArg, pas juste le détecteur isolé (#142 LOT 6)', () => {
    // Preuve de câblage, PAS un test du détecteur : on invoque `findingsIn` — la MÊME fonction que
    // les 2 assertions de corpus ci-dessus (STRICT_DIRS/RATCHET_DIRS) — sur un dossier de fixtures
    // réel sur disque. Si la ligne qui appelle `scanLabelAsIdArg` dans `findingsIn` disparaît, ce
    // test devient rouge alors que les 2 tests de corpus resteraient VERTS (ils assèrent `[]` sur
    // le vrai corpus, qui n'en contient plus). Contre `applyOps`-forgé (#541) : ceci exécute le
    // MÊME pipeline (scanFiles → findingsIn) que la vraie assertion, sans ctx forgé à la main.
    const tmp = mkdtempSync(join(tmpdir(), 'label-logic-wiring-'));
    try {
      // Déclaration ET appel dans le MÊME fichier (câblage sur `effectiveIdParamFns` local, sans
      // dépendre du `ID_PARAM_FNS` global figé au chargement du module sur le VRAI corpus).
      writeFileSync(
        join(tmp, 'probe.ts'),
        'export function wiringProbeId(id: string): string {\n' +
          '  return id;\n' +
          '}\n' +
          'export const x = wiringProbeId(sb.label);\n',
      );
      const findings = findingsIn([tmp]);
      expect(findings.map((f) => f.detail)).toContain('export const x = wiringProbeId(sb.label);');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('collectIdParamFunctions : couvre aussi un paramètre `*Id` (creatureId/entityId/refId…), pas seulement `id` (LOT 6)', () => {
    const decl = 'function resolve(list: unknown[], creatureId: string, fallback: unknown) {}';
    expect(collectIdParamFunctions(decl).get('resolve')).toBe(1);
    const findings = scanLabelAsIdArg('fixture.ts', 'resolve(all, e.label, def)', collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('collectIdParamFunctions : const fléchée ASYNC, générique, et paramètre `id` APRÈS un callback (LOT 6)', () => {
    const asyncArrow = 'const loadThing = async (id: string) => fetchThing(id);';
    expect(collectIdParamFunctions(asyncArrow).get('loadThing')).toBe(0);

    const generic = 'function pick<T>(id: string, list: T[]): T | undefined { return list[0]; }';
    expect(collectIdParamFunctions(generic).get('pick')).toBe(0);

    const afterCallback = 'function withCb(onDone: (n: number) => void, id: string) {}';
    expect(collectIdParamFunctions(afterCallback).get('withCb')).toBe(1);
  });

  it('collectIdParamFunctions : méthode de CLASSE et d’objet littéral (raccourci sans `function`) (LOT 6)', () => {
    const classBody = 'class Repo {\n  findById(id: string): unknown {\n    return this.map.get(id);\n  }\n}';
    expect(collectIdParamFunctions(classBody).get('findById')).toBe(0);

    const objLiteral = 'const helpers = {\n  bodyShapeOf(id: string) {\n    return id;\n  },\n};';
    expect(collectIdParamFunctions(objLiteral).get('bodyShapeOf')).toBe(0);
  });

  it('scanLabelAsIdArg : appel MULTILIGNE (le scan porte sur le corps entier, pas ligne par ligne) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(id: string) { return id; }\n';
    const call = 'const shape = bodyShapeOf(\n  sb.label,\n);\n';
    const findings = scanLabelAsIdArg('fixture.ts', decl + call, collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('scanLabelAsIdArg : enrobages triviaux (`??`, template, String(...), `as`, `!`, méthode de chaîne) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(id: string) { return id; }\n';
    const idParamFns = collectIdParamFunctions(decl);
    const cases = [
      'bodyShapeOf(sb.label ?? "");',
      'bodyShapeOf(`${sb.label}`);',
      'bodyShapeOf(String(sb.label));',
      'bodyShapeOf(sb.label as string);',
      'bodyShapeOf(sb.label!);',
      'bodyShapeOf(sb.label.toLowerCase());',
    ];
    for (const line of cases) {
      expect(scanLabelAsIdArg('fixture.ts', decl + line, idParamFns).map((f) => f.rule), line).toEqual(['label-as-id-arg']);
    }
  });

  it('scanLabelAsIdArg : découpage d’arguments robuste aux `<`/`>` de comparaison (pas des génériques) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(a: unknown, id: string, b: unknown) { return id; }\n';
    const idParamFns = collectIdParamFunctions(decl);
    const withComparison = 'bodyShapeOf(a < b, sb.label, d);';
    expect(scanLabelAsIdArg('fixture.ts', decl + withComparison, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    const withCallback = 'bodyShapeOf(() => 1, sb.label, d);';
    expect(scanLabelAsIdArg('fixture.ts', decl + withCallback, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('scanLabelAsIdArg : appel de MÉTHODE dont le nom n’est PAS une méthode de collection connue reste un candidat (LOT 6)', () => {
    const decl = 'const helpers = {\n  bodyShapeOf(id: string) {\n    return id;\n  },\n};\n';
    const idParamFns = collectIdParamFunctions(decl);
    const via = 'helpers.bodyShapeOf(sb.label);';
    expect(scanLabelAsIdArg('fixture.ts', decl + via, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    // Contre-épreuve documentée : un nom de méthode COLLISIONNANT avec l'API Map/Set/Array reste
    // exclu, receveur inconnu ou pas — limite ASSUMÉE, cf. `COLLECTION_METHOD_NAMES` (labelLogic.mjs).
    const setDecl = 'function set(id: string) { return id; }\n';
    const setFns = collectIdParamFunctions(setDecl);
    expect(scanLabelAsIdArg('fixture.ts', 'teamOf.set(sb.label);', setFns)).toEqual([]);
  });
});

/**
 * Deuxième volet (#142 LOT 7) : un LIBELLÉ ne vit pas que dans un champ `label`. `weapon.reach ===
 * 'Très longue'` a vécu dans `src/engine` — zone à tolérance zéro — sans qu'aucune garde ne le voie,
 * parce que toutes ne regardaient que `label`/`name`. Le critère porte donc sur la FORME du LITTÉRAL
 * (majuscule initiale, accent ou espace = texte d'affichage, jamais un id slug de ce dépôt), quel que
 * soit le nom du champ. La dette héritée est un STOCK PAR FICHIER (`LABEL_LITERAL_STOCK`), à cliquet
 * strict dans les deux sens — pas une liste de sites exemptés.
 */
describe('garde-fou « logique par LIBELLÉ hors du champ label » (#142 LOT 7)', () => {
  const literalFindings = () => {
    const counts = new Map<string, number>();
    for (const f of scanFiles(ALL_DIRS)) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel)) continue;
      const n = scanLabelLiteralCompare(rel, readFileSync(f, 'utf8')).length;
      if (n > 0 || rel in LABEL_LITERAL_STOCK) counts.set(rel, n);
    }
    return counts;
  };

  it('CLIQUET : aucune logique par libellé NEUVE, aucune dette soldée non retirée du stock', () => {
    const drift = labelLiteralStockDrift(literalFindings());
    expect(
      drift,
      'Logique par LIBELLÉ (champ hors `label`) hors stock — toute LOGIQUE est keyée par `id` STABLE, le\n' +
        'libellé est de l’AFFICHAGE (multilangue) :\n' + drift.join('\n'),
    ).toEqual([]);
  });

  it('ANTI-VACANCE : échoue sur la faute d’Allonge reconstituée, y compris portée par une variable', () => {
    // Le motif EXACT qui vivait en `engine/engagement.ts` avant migration (`REACH_ORDER` + comparaisons
    // au libellé accentué) — et sa variante par ALIAS, invisible à un scan ligne à ligne.
    const direct = "export const reachTiles = (w: Weapon) => (w.reach === 'Très longue' ? 2 : 1);";
    expect(scanLabelLiteralCompare('engagement.ts', direct).map((f) => f.rule)).toEqual(['label-literal']);
    const viaAlias = 'function f(w: Weapon) {\n  const band = w.reach;\n  return band === \'Considérable\' ? 3 : 1;\n}';
    expect(scanLabelLiteralCompare('engagement.ts', viaAlias).map((f) => f.rule)).toEqual(['label-literal']);
    const table = "const REACH_ORDER = { 'Très courte': 0, 'Moyenne': 1, 'Très longue': 2 };";
    expect(scanLabelLiteralCompare('engagement.ts', table).map((f) => f.rule)).toEqual(['label-record']);
    const aiguillage = "function g(w: Weapon) {\n  switch (w.reach) {\n    case 'Très longue': return 2;\n    default: return 1;\n  }\n}";
    expect(scanLabelLiteralCompare('engagement.ts', aiguillage).map((f) => f.rule)).toEqual(['label-switch']);
  });

  it('CONTRE-ÉPREUVES : discriminant d’union, champ d’affichage rendu, vocabulaire DOM, comparaison à une variable', () => {
    const src = [
      "if (area.kind === 'disc') return radius;", // discriminant d'union en slug ASCII
      "const melee = w.type === 'melee';",
      'return <span className="chip">{item.label}</span>;', // RENDU d'un libellé = son usage légitime
      "if (e.key === 'Enter' || e.code === 'Space') act();", // vocabulaire W3C, aucun id possible
      "if (tag === 'INPUT') return;", // alias de `el.tagName`, même vocabulaire W3C
      'if (a.reach === b.reach) return 0;', // comparaison à une VARIABLE : aucun libellé figé
      "const ids = { 'tres-longue': 2, 'considérable': 3 };", // table keyée par ids (minuscules)
    ].join('\n');
    expect(scanLabelLiteralCompare('fixture.tsx', 'const tag = el.tagName;\n' + src)).toEqual([]);
  });
});
