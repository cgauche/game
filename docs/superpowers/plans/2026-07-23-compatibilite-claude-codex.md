# Claude Code · Codex Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fournir un pont déterministe, committé et multiplateforme qui génère les contenus communs Claude Code/Codex, valide leurs différences de schéma et bloque toute dérive.

**Architecture:** `scripts/agents/compat-core.mjs` contient uniquement les transformations et validations pures ; `scripts/agents/compat-cli.mjs` découvre les fichiers, agrège les diagnostics et effectue les écritures atomiques en mode `sync`, tandis que `check` reste strictement non mutatif. `CLAUDE.md`, `.claude/skills/`, `.claude/credo.md` et `.claude/memory/` sont les sources initiales ; les profils et configurations de hooks restent propres à chaque produit mais sont validés par paires.

**Tech Stack:** Node.js >=22, modules ESM, `node:test`, `node:assert/strict`, API standard `node:fs`, `node:path`, `node:url`, `node:child_process`; aucune dépendance TOML externe.

## Global Constraints

- Node.js `>=22`, conformément à `package.json`.
- Aucun changement sous `src/`, `server/` ou `src/data/`.
- Sorties générées committées, encodées en UTF-8 avec fins de ligne LF.
- Aucun parseur TOML externe : seuls les scalaires string requis du schéma connu sont lus.
- `CLAUDE.md` et `.claude/skills/` sont les sources initiales de `AGENTS.md` et `.agents/skills/`.
- `.claude/credo.md` et `.claude/memory/` sont les sources initiales de `.codex/credo.md` et `.codex/memory/`.
- `.claude/agents/*.md` et `.codex/agents/*.toml` restent manuels ; leur parité est validée, jamais générée.
- Une sortie non marquée n'est adoptée que si elle égale exactement la sortie attendue après retrait de sa bannière ; sinon diagnostic `unsafe-overwrite` ou `unsafe-delete`.
- Les hooks sont des commandes Node sans `CLAUDE_PROJECT_DIR`, `cat`, redirection ni opérateur de shell.
- `scripts/git-hooks/pre-commit.mjs`, `.github/workflows/ci.yml` et `.github/workflows/canari.yml` ne sont modifiés qu'à la tâche 5.

---

## File Structure

- `scripts/agents/compat-core.mjs` — fonctions pures, types JSDoc, transformations, validations et calcul des écarts.
- `scripts/agents/compat-cli.mjs` — lecture du dépôt, modes `sync`/`check`, diagnostics agrégés et remplacements atomiques.
- `scripts/agents/compat.test.mjs` — tests unitaires et intégration du pont.
- `scripts/agents/fixtures/**` — dépôts miniatures Claude/Codex, cas LF/CRLF, TOML et sorties dangereuses.
- `scripts/hooks/inject-project-credo.mjs` — injection du credo résolue depuis `import.meta.url`.
- `scripts/hooks/inject-project-credo.test.mjs` — exécution depuis un autre répertoire courant.
- `CLAUDE.md`, `.claude/skills/**`, `.claude/credo.md`, `.claude/memory/**` — sources manuelles.
- `AGENTS.md`, `.agents/skills/**`, `.codex/credo.md`, `.codex/memory/**` — sorties générées.
- `.claude/agents/*.md`, `.codex/agents/*.toml` — profils manuels validés.
- `.claude/settings.json`, `.codex/hooks.json` — configurations manuelles de hooks validées.
- `package.json`, `scripts/git-hooks/pre-commit.mjs`, `.github/workflows/ci.yml`, `.github/workflows/canari.yml` — commandes et gates.

### Task 1: Moteur pur, CLI et guide généré

**Files:**
- Create: `scripts/agents/compat-core.mjs`
- Create: `scripts/agents/compat-cli.mjs`
- Create: `scripts/agents/compat.test.mjs`
- Create: `scripts/agents/fixtures/guide/CLAUDE.md`
- Modify: `package.json`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `CLAUDE.md` UTF-8 et un snapshot `ReadonlyMap<string, Buffer>`.
- Produces:
  - `normalizeText(text: string): string`
  - `readFrontmatter(text: string, sourcePath?: string): { attributes: ReadonlyMap<string,string>, body: string }`
  - `readTomlStringField(text: string, field: string, sourcePath?: string): string`
  - `transformGuide(text: string): string`
  - `buildExpectedOutputs(snapshot: ReadonlyMap<string,Buffer>): { files: Map<string,Buffer>, managedRoots: Set<string>, diagnostics: Diagnostic[] }`
  - `collectDiffs(expected: BuildResult, actual: ReadonlyMap<string,Buffer>): Diagnostic[]`
  - `runCompat({ root: string, mode: 'sync'|'check' }): Promise<Diagnostic[]>`
  - `Diagnostic = { family: 'guide'|'skill'|'hook'|'agent'|'credo'|'memory', source?: string, destination: string, type: 'missing'|'orphan'|'content'|'parse'|'reference'|'unsafe-delete'|'unsafe-overwrite', message: string, safe?: boolean }`.

- [ ] **Step 1: Écrire les fixtures et les tests rouges du socle**

```markdown
<!-- scripts/agents/fixtures/guide/CLAUDE.md -->
# CLAUDE.md — Fixture

Guide pour Claude Code. Lire `.claude/credo.md`, `.claude/memory/` et `Foundry/CLAUDE.md`.
Mémoire locale : `~/.claude/projects/…/memory`. Session cloud : `claude.ai/code`.
```

```js
// scripts/agents/compat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  normalizeText, readFrontmatter, readTomlStringField, transformGuide,
  buildExpectedOutputs, collectDiffs,
} from './compat-core.mjs';

test('normalise CRLF et termine par un seul LF', () => {
  assert.equal(normalizeText('a\r\nb\r\n'), 'a\nb\n');
});

test('lit frontmatter et corps sans le modifier', () => {
  const parsed = readFrontmatter('---\r\nname: demo\r\ndescription: Démo\r\n---\r\nCorps\r\n', 'demo.md');
  assert.equal(parsed.attributes.get('name'), 'demo');
  assert.equal(parsed.body, 'Corps\n');
});

test('lit les quatre formes string TOML requises', () => {
  assert.equal(readTomlStringField('name = "codeur"\r\n', 'name'), 'codeur');
  assert.equal(readTomlStringField("name = 'codeur'\n", 'name'), 'codeur');
  assert.equal(readTomlStringField('developer_instructions = """\r\nligne\r\n"""', 'developer_instructions'), 'ligne\n');
  assert.equal(readTomlStringField("developer_instructions = '''\nligne\n'''", 'developer_instructions'), 'ligne\n');
});

test('transforme le guide par table fermée', () => {
  const out = transformGuide('# CLAUDE.md\nClaude Code `.claude/credo.md` `.claude/memory/` Foundry/CLAUDE.md ~/.claude/projects/…/memory claude.ai/code\n');
  assert.match(out, /^<!-- GENERATED: agents:sync; source=CLAUDE\.md -->\n# AGENTS\.md/m);
  assert.doesNotMatch(out, /CLAUDE\.md|Claude Code|\.claude\/credo|\.claude\/memory|~\/\.claude|claude\.ai\/code/);
});

test('adopte un legacy exact mais refuse un écrasement manuel', () => {
  const expected = buildExpectedOutputs(new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')]]));
  const generated = expected.files.get('AGENTS.md').toString('utf8');
  const legacy = generated.replace(/^<!-- GENERATED:[^\n]+ -->\n/, '');
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from(legacy)] ]))[0].safe, true);
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from('# manuel\n')]]))[0].type, 'unsafe-overwrite');
});
```

- [ ] **Step 2: Vérifier l'échec ciblé**

Run: `node --test scripts/agents/compat.test.mjs`  
Expected: FAIL avec `ERR_MODULE_NOT_FOUND` pour `scripts/agents/compat-core.mjs`.

- [ ] **Step 3: Implémenter les primitives pures du guide et les signatures du moteur**

```js
// scripts/agents/compat-core.mjs
import { Buffer } from 'node:buffer';

export const GENERATED_PREFIX = '<!-- GENERATED: agents:sync; source=';
const replacements = [
  ['Foundry/CLAUDE.md', 'Foundry/AGENTS.md'],
  ['# CLAUDE.md', '# AGENTS.md'],
  ['Claude Code', 'Codex'],
  ['.claude/credo.md', '.codex/credo.md'],
  ['.claude/memory/', '.codex/memory/'],
  ['~/.claude/projects/…/memory', '~/.codex/projects/…/memory'],
  ['claude.ai/code', 'Codex cloud'],
];

export function normalizeText(text) {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n+$/g, '')}\n`;
}

export function readFrontmatter(text, sourcePath = '<memory>') {
  const value = normalizeText(text);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(value);
  if (!match) throw new Error(`${sourcePath}: frontmatter Markdown invalide`);
  const attributes = new Map();
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`${sourcePath}: champ frontmatter invalide: ${line}`);
    attributes.set(field[1], field[2]);
  }
  return { attributes, body: match[2] };
}

export function readTomlStringField(text, field, sourcePath = '<memory>') {
  const value = text.replace(/\r\n?/g, '\n');
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assignment = new RegExp(`^${escaped}\\s*=\\s*`, 'm').exec(value);
  if (!assignment) throw new Error(`${sourcePath}: champ TOML absent: ${field}`);
  const start = assignment.index + assignment[0].length;
  for (const quote of ['"""', "'''"]) {
    if (value.startsWith(quote, start)) {
      const bodyStart = start + 3 + (value[start + 3] === '\n' ? 1 : 0);
      const end = value.indexOf(quote, bodyStart);
      if (end < 0) throw new Error(`${sourcePath}: string TOML multiligne non fermée: ${field}`);
      return value.slice(bodyStart, end);
    }
  }
  const quote = value[start];
  if (quote !== '"' && quote !== "'") throw new Error(`${sourcePath}: ${field} doit être une string TOML`);
  const end = value.indexOf(quote, start + 1);
  if (end < 0) throw new Error(`${sourcePath}: string TOML non fermée: ${field}`);
  return quote === '"' ? JSON.parse(value.slice(start, end + 1)) : value.slice(start + 1, end);
}

function adapt(text) {
  return replacements.reduce((value, [from, to]) => value.split(from).join(to), normalizeText(text));
}

export function transformGuide(text) {
  const body = adapt(text);
  if (/CLAUDE\.md|Claude Code|\.claude\/(?:credo|memory)|~\/\.claude|claude\.ai\/code/.test(body))
    throw new Error('guide: référence Claude résiduelle');
  return `${GENERATED_PREFIX}CLAUDE.md -->\n${body}`;
}

export function transformSkillTree() { return new Map(); }
export function validateRolePairs() { return []; }
export function validateHookParity() { return []; }

export function buildExpectedOutputs(snapshot) {
  const files = new Map();
  const diagnostics = [];
  const source = snapshot.get('CLAUDE.md');
  if (!source) diagnostics.push({ family: 'guide', destination: 'AGENTS.md', type: 'missing', message: 'CLAUDE.md absent' });
  else files.set('AGENTS.md', Buffer.from(transformGuide(source.toString('utf8'))));
  return { files, managedRoots: new Set(['AGENTS.md']), diagnostics };
}

function withoutBanner(value) {
  return value.replace(/^<!-- GENERATED:[^\n]+ -->\n/, '');
}

export function collectDiffs(expected, actual) {
  const diagnostics = [...expected.diagnostics];
  for (const [destination, wanted] of expected.files) {
    const found = actual.get(destination);
    if (!found) diagnostics.push({ family: 'guide', destination, type: 'missing', message: 'sortie absente', safe: true });
    else if (!found.equals(wanted)) {
      const current = normalizeText(found.toString('utf8'));
      const legacy = withoutBanner(wanted.toString('utf8'));
      const marked = current.startsWith(GENERATED_PREFIX);
      diagnostics.push({ family: 'guide', destination, type: marked || current === legacy ? 'content' : 'unsafe-overwrite', message: 'contenu divergent', safe: marked || current === legacy });
    }
  }
  return diagnostics;
}
```

- [ ] **Step 4: Implémenter le CLI non mutatif/atomique et les scripts npm**

```js
// scripts/agents/compat-cli.mjs
import { readdir, readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExpectedOutputs, collectDiffs } from './compat-core.mjs';

async function snapshot(root) {
  const files = new Map();
  async function visit(rel) {
    const abs = join(root, rel);
    for (const entry of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      const child = join(rel, entry.name);
      if (entry.isDirectory()) await visit(child);
      else files.set(child.replaceAll('\\', '/'), await readFile(join(root, child)));
    }
  }
  for (const rel of ['CLAUDE.md', 'AGENTS.md']) {
    const data = await readFile(join(root, rel)).catch(() => null);
    if (data) files.set(rel, data);
  }
  return files;
}

async function atomicWrite(root, rel, data) {
  const destination = join(root, rel);
  const temporary = `${destination}.agents-sync-${process.pid}`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(temporary, data);
  await rename(temporary, destination).catch(async (error) => {
    await rm(temporary, { force: true });
    throw error;
  });
}

export async function runCompat({ root, mode }) {
  if (!['sync', 'check'].includes(mode)) throw new Error(`mode invalide: ${mode}`);
  const actual = await snapshot(root);
  const expected = buildExpectedOutputs(actual);
  const diagnostics = collectDiffs(expected, actual);
  if (mode === 'sync') {
    const unsafe = diagnostics.filter((item) => item.safe === false || item.type.startsWith('unsafe-'));
    if (unsafe.length) return diagnostics;
    for (const item of diagnostics.filter((entry) => entry.safe)) {
      const data = expected.files.get(item.destination);
      if (data) await atomicWrite(root, item.destination, data);
    }
    return collectDiffs(expected, await snapshot(root));
  }
  return diagnostics;
}

const invoked = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (invoked) {
  const mode = process.argv[2];
  const root = resolve(process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const diagnostics = await runCompat({ root, mode });
  if (diagnostics.length) {
    process.stderr.write(`${diagnostics.map((d) => `${d.family}:${d.type}:${d.destination}: ${d.message}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}
```

Add to `package.json`:

```json
"agents:sync": "node scripts/agents/compat-cli.mjs sync",
"agents:check": "node scripts/agents/compat-cli.mjs check",
"test:agents": "node --test scripts/agents/compat.test.mjs"
```

- [ ] **Step 5: Vérifier, générer et committer**

Run: `npm run test:agents`  
Expected: PASS pour normalisation, frontmatter, TOML, guide et adoption legacy.

Run: `npm run agents:sync`  
Expected: exit 0 et `AGENTS.md` porte la bannière générée.

Run: `npm run agents:check`  
Expected: exit 0 sans écriture.

```powershell
git add -- package.json scripts/agents/compat-core.mjs scripts/agents/compat-cli.mjs scripts/agents/compat.test.mjs scripts/agents/fixtures/guide/CLAUDE.md AGENTS.md
git commit -m "feat: generate Codex guide from Claude source"
```

### Task 2: Miroir récursif des skills

**Files:**
- Modify: `scripts/agents/compat-core.mjs`
- Modify: `scripts/agents/compat-cli.mjs`
- Modify: `scripts/agents/compat.test.mjs`
- Create: `scripts/agents/fixtures/skills/.claude/skills/demo/SKILL.md`
- Create: `scripts/agents/fixtures/skills/.claude/skills/demo/assets/icon.bin`
- Generate: `.agents/skills/**` depuis `.claude/skills/**`

**Interfaces:**
- Consumes: `transformSkillTree(sourceFiles: ReadonlyMap<string,Buffer>): Map<string,Buffer>`.
- Produces: bannière après frontmatter dans chaque `SKILL.md`, ressources inchangées à l'octet, inventaire récursif et diagnostics `missing`, `orphan`, `unsafe-delete`, `unsafe-overwrite`.

- [ ] **Step 1: Ajouter les tests rouges skills**

```js
test('préserve le frontmatter, adapte le corps et copie les ressources', () => {
  const source = new Map([
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nLire CLAUDE.md et .claude/credo.md.\n')],
    ['.claude/skills/demo/assets/icon.bin', Buffer.from([0, 255, 1])],
  ]);
  const out = transformSkillTree(source);
  assert.match(out.get('.agents/skills/demo/SKILL.md').toString(), /^---[\s\S]+---\n<!-- GENERATED:/);
  assert.deepEqual(out.get('.agents/skills/demo/assets/icon.bin'), Buffer.from([0, 255, 1]));
});

test('refuse orphelin manuel et accepte ressource sous skill marqué', () => {
  const expected = buildExpectedOutputs(new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\n')],
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')],
  ]));
  const actual = new Map([
    ['.agents/skills/intrus.txt', Buffer.from('manuel')],
  ]);
  assert.equal(collectDiffs(expected, actual).find((d) => d.destination.endsWith('intrus.txt')).type, 'unsafe-delete');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test --test-name-pattern="skills|orphelin" scripts/agents/compat.test.mjs`  
Expected: FAIL car `transformSkillTree` renvoie une map vide.

- [ ] **Step 3: Implémenter la transformation et étendre snapshot/diffs**

```js
export function transformSkillTree(sourceFiles) {
  const outputs = new Map();
  for (const [source, bytes] of sourceFiles) {
    if (!source.startsWith('.claude/skills/')) continue;
    const destination = source.replace(/^\.claude\/skills\//, '.agents/skills/');
    if (!source.endsWith('/SKILL.md')) outputs.set(destination, Buffer.from(bytes));
    else {
      const parsed = readFrontmatter(bytes.toString('utf8'), source);
      const frontmatter = normalizeText(bytes.toString('utf8')).match(/^---\n[\s\S]*?\n---\n/)[0];
      const body = adapt(parsed.body)
        .split('.claude/skills/').join('.agents/skills/');
      outputs.set(destination, Buffer.from(`${frontmatter}${GENERATED_PREFIX}${source} -->\n${body}`));
    }
  }
  return outputs;
}
```

Dans `buildExpectedOutputs`, fusionner `transformSkillTree(snapshot)` dans `files` et ajouter `.agents/skills` à `managedRoots`. Dans le CLI, faire visiter récursivement `.claude/skills` et `.agents/skills`. Dans `collectDiffs`, classifier tout chemin réel sous un `managedRoot` absent de `expected.files` : suppression sûre uniquement si le fichier porte `GENERATED_PREFIX` ou si son `SKILL.md` ancêtre réel porte cette marque ; sinon `unsafe-delete`.

- [ ] **Step 4: Vérifier l'idempotence, générer et committer**

Run: `npm run test:agents`  
Expected: PASS, y compris octets binaires, orphelins et adoption sûre.

Run:

```powershell
npm run agents:sync
npm run agents:sync
npm run agents:check
```

Expected: trois exits 0 ; le second `sync` n'écrit aucun octet.

```powershell
git add -- scripts/agents/compat-core.mjs scripts/agents/compat-cli.mjs scripts/agents/compat.test.mjs scripts/agents/fixtures/skills .agents/skills
git commit -m "feat: mirror project skills for Codex"
```

### Task 3: Hooks Node multiplateformes et parité

**Files:**
- Create: `scripts/hooks/inject-project-credo.mjs`
- Create: `scripts/hooks/inject-project-credo.test.mjs`
- Modify: `scripts/agents/compat-core.mjs`
- Modify: `scripts/agents/compat.test.mjs`
- Create: `scripts/agents/fixtures/hooks/claude-settings.json`
- Create: `scripts/agents/fixtures/hooks/codex-hooks.json`
- Modify: `.claude/settings.json`
- Modify: `.codex/hooks.json`

**Interfaces:**
- Consumes: JSON de hooks et argument CLI `claude|codex`.
- Produces:
  - `validateHookParity(claudeSettings: unknown, codexHooks: unknown): Diagnostic[]`
  - `resolveCredoPath(surface: 'claude'|'codex', scriptUrl?: string): string`
  - `injectProjectCredo(surface: 'claude'|'codex', scriptUrl?: string, output?: NodeJS.WritableStream): Promise<void>`.

- [ ] **Step 1: Écrire les tests rouges d'injection et de parité**

```js
// scripts/hooks/inject-project-credo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectProjectCredo } from './inject-project-credo.mjs';

test('résout le credo depuis le script, indépendamment du cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'credo-'));
  const scriptUrl = new URL(`file:///${join(root, 'scripts/hooks/inject-project-credo.mjs').replaceAll('\\', '/')}`);
  await mkdir(join(root, '.codex'), { recursive: true });
  await writeFile(join(root, '.codex/credo.md'), 'Credo Codex\n');
  let value = '';
  await injectProjectCredo('codex', scriptUrl.href, { write: (chunk) => { value += chunk; } });
  assert.equal(value, 'Credo Codex\n');
});
```

```js
test('normalise la parité et rejette les commandes shell', () => {
  const good = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node scripts/hooks/inject-project-credo.mjs claude', timeout: 10 }] }] } };
  const codex = structuredClone(good);
  codex.hooks.SessionStart[0].hooks[0].command = 'node scripts/hooks/inject-project-credo.mjs codex';
  assert.deepEqual(validateHookParity(good, codex), []);
  codex.hooks.SessionStart[0].hooks[0].command = 'cat .codex/credo.md';
  assert.equal(validateHookParity(good, codex)[0].type, 'reference');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test scripts/hooks/inject-project-credo.test.mjs scripts/agents/compat.test.mjs`  
Expected: FAIL pour module absent et validateur vide.

- [ ] **Step 3: Implémenter le hook et le validateur**

```js
// scripts/hooks/inject-project-credo.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveCredoPath(surface, scriptUrl = import.meta.url) {
  if (!['claude', 'codex'].includes(surface)) throw new Error(`surface inconnue: ${surface}`);
  const root = join(dirname(fileURLToPath(scriptUrl)), '..', '..');
  return join(root, surface === 'claude' ? '.claude' : '.codex', 'credo.md');
}

export async function injectProjectCredo(surface, scriptUrl = import.meta.url, output = process.stdout) {
  const path = resolveCredoPath(surface, scriptUrl);
  const credo = await readFile(path, 'utf8');
  if (!credo.trim()) throw new Error(`${path}: credo vide`);
  output.write(credo);
}

if (fileURLToPath(import.meta.url) === process.argv[1])
  injectProjectCredo(process.argv[2]).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
```

```js
export function validateHookParity(claudeSettings, codexHooks) {
  const forbidden = /CLAUDE_PROJECT_DIR|\bcat\b|\/dev\/null|[<>]|\|\||&&/;
  const flatten = (value, surface) => Object.entries(value.hooks ?? {}).flatMap(([phase, groups]) =>
    groups.flatMap((group, groupIndex) => (group.hooks ?? []).map((hook, hookIndex) => {
      const path = `${surface}.hooks.${phase}[${groupIndex}].hooks[${hookIndex}]`;
      const script = /scripts[\\/]hooks[\\/]([\w.-]+\.mjs)/.exec(hook.command ?? '')?.[1];
      return { phase, matcher: group.matcher ?? '', script, timeout: hook.timeout, path, command: hook.command ?? '' };
    })));
  const left = flatten(claudeSettings, '.claude/settings.json');
  const right = flatten(codexHooks, '.codex/hooks.json');
  const diagnostics = [...left, ...right].filter((hook) => forbidden.test(hook.command) || !hook.script)
    .map((hook) => ({ family: 'hook', destination: hook.path, type: 'reference', message: `commande non portable: ${hook.command}` }));
  const key = (hook) => `${hook.phase}|${hook.matcher}|${hook.script}|${hook.timeout}`;
  const normalizeSession = (hook) => hook.script === 'inject-project-credo.mjs' ? `${hook.phase}|${hook.matcher}|${hook.script}|${hook.timeout}` : key(hook);
  for (const value of new Set([...left.map(normalizeSession), ...right.map(normalizeSession)]))
    if (!left.some((hook) => normalizeSession(hook) === value) || !right.some((hook) => normalizeSession(hook) === value))
      diagnostics.push({ family: 'hook', destination: value, type: 'content', message: 'hook absent sur une surface' });
  return diagnostics;
}
```

Remplacer les commandes existantes des deux JSON par cette liste exacte :

```text
node scripts/hooks/new-src-file-guard.mjs
node scripts/hooks/data-edit-guard.mjs
node scripts/hooks/enterine-guard.mjs
node scripts/hooks/exception-add-guard.mjs
node scripts/hooks/git-destructive-guard.mjs
node scripts/hooks/solde-ticket-guard.mjs
node scripts/hooks/issue-label-guard.mjs
node scripts/hooks/poison-postcheck.mjs
node scripts/hooks/agent-return-judge-reminder.mjs
```

Pour `SessionStart`, utiliser `node scripts/hooks/inject-project-credo.mjs claude` dans `.claude/settings.json` et `node scripts/hooks/inject-project-credo.mjs codex` dans `.codex/hooks.json`.

- [ ] **Step 4: Vérifier et committer**

Run: `node --test scripts/hooks/inject-project-credo.test.mjs scripts/agents/compat.test.mjs`  
Expected: PASS et aucune commande interdite signalée.

```powershell
git add -- scripts/hooks/inject-project-credo.mjs scripts/hooks/inject-project-credo.test.mjs scripts/agents/compat-core.mjs scripts/agents/compat.test.mjs scripts/agents/fixtures/hooks .claude/settings.json .codex/hooks.json
git commit -m "feat: make agent hooks portable"
```

### Task 4: Profils manuels, credo et mémoire projet

**Files:**
- Modify: `scripts/agents/compat-core.mjs`
- Modify: `scripts/agents/compat-cli.mjs`
- Modify: `scripts/agents/compat.test.mjs`
- Create: `scripts/agents/fixtures/roles/.claude/agents/codeur.md`
- Create: `scripts/agents/fixtures/roles/.codex/agents/codeur.toml`
- Validate unchanged: `.claude/agents/{artiste,codeur,juge,lecteur,recetteur,verif-mecanique}.md`
- Validate unchanged: `.codex/agents/{artiste,codeur,juge,lecteur,recetteur,verif-mecanique}.toml`
- Generate: `.codex/credo.md`
- Generate: `.codex/memory/**`

**Interfaces:**
- Consumes: profils manuels, `.claude/credo.md`, `.claude/memory/**`.
- Produces: `validateRolePairs(claudeProfiles: ReadonlyMap<string,string>, codexProfiles: ReadonlyMap<string,string>): Diagnostic[]`, plus sorties contexte dans `buildExpectedOutputs`.

- [ ] **Step 1: Ajouter les tests rouges**

```js
test('valide noms, descriptions et références des rôles', () => {
  const claude = new Map([['codeur', '---\nname: codeur\ndescription: Exécute\n---\nLire CLAUDE.md et .claude/skills/demo/SKILL.md.\n']]);
  const codex = new Map([['codeur', 'name = "codeur"\ndescription = "Exécute"\ndeveloper_instructions = """\nLire AGENTS.md et .agents/skills/demo/SKILL.md.\n"""']]);
  assert.deepEqual(validateRolePairs(claude, codex), []);
  assert.equal(validateRolePairs(claude, new Map())[0].type, 'missing');
});

test('génère credo et mémoire avec chemins Codex', () => {
  const expected = buildExpectedOutputs(new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\n')],
    ['.claude/credo.md', Buffer.from('Lire .claude/memory/MEMORY.md\n')],
    ['.claude/memory/MEMORY.md', Buffer.from('Guide CLAUDE.md\n')],
  ]));
  assert.match(expected.files.get('.codex/credo.md').toString(), /\.codex\/memory/);
  assert.match(expected.files.get('.codex/memory/MEMORY.md').toString(), /AGENTS\.md/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test --test-name-pattern="rôles|credo|mémoire" scripts/agents/compat.test.mjs`  
Expected: FAIL car les profils et le contexte ne sont pas encore calculés.

- [ ] **Step 3: Implémenter la validation et le miroir**

```js
export function validateRolePairs(claudeProfiles, codexProfiles) {
  const diagnostics = [];
  const names = new Set([...claudeProfiles.keys(), ...codexProfiles.keys()]);
  for (const role of names) {
    const md = claudeProfiles.get(role);
    const toml = codexProfiles.get(role);
    if (!md || !toml) {
      diagnostics.push({ family: 'agent', source: md ? `.claude/agents/${role}.md` : `.codex/agents/${role}.toml`, destination: role, type: 'missing', message: 'profil absent sur une surface' });
      continue;
    }
    const frontmatter = readFrontmatter(md, `${role}.md`);
    const codexName = readTomlStringField(toml, 'name', `${role}.toml`);
    const codexDescription = readTomlStringField(toml, 'description', `${role}.toml`);
    const instructions = readTomlStringField(toml, 'developer_instructions', `${role}.toml`);
    if (frontmatter.attributes.get('name') !== role || codexName !== role)
      diagnostics.push({ family: 'agent', destination: role, type: 'parse', message: 'name différent du nom de fichier' });
    if (frontmatter.attributes.get('description') !== codexDescription)
      diagnostics.push({ family: 'agent', destination: role, type: 'content', message: 'description fonctionnelle divergente' });
    const normalizedClaude = adapt(frontmatter.body).split('.claude/skills/').join('.agents/skills/');
    if (/CLAUDE\.md|\.claude\//.test(instructions) || !normalizedClaude.includes('AGENTS.md') !== !instructions.includes('AGENTS.md'))
      diagnostics.push({ family: 'agent', destination: role, type: 'reference', message: 'référence de surface divergente' });
  }
  return diagnostics;
}
```

Dans `buildExpectedOutputs`, transformer `.claude/credo.md` vers `.codex/credo.md` et chaque `.claude/memory/<rel>` vers `.codex/memory/<rel>` avec `adapt`, bannière Markdown et LF. Ajouter `.codex/credo.md` et `.codex/memory` à `managedRoots`. Étendre le CLI aux quatre arbres de profils/contexte, appeler `validateRolePairs`, `validateHookParity` et agréger leurs diagnostics avant toute écriture.

- [ ] **Step 4: Vérifier, synchroniser et committer**

Run:

```powershell
npm run test:agents
npm run agents:sync
npm run agents:check
```

Expected: trois exits 0 ; six paires de rôles valides ; credo et toutes les fiches mémoire présents sous `.codex/`.

```powershell
git add -- scripts/agents/compat-core.mjs scripts/agents/compat-cli.mjs scripts/agents/compat.test.mjs scripts/agents/fixtures/roles .codex/credo.md .codex/memory
git commit -m "feat: validate agent roles and mirror project context"
```

### Task 5: Gates dépôt et validation finale

**Files:**
- Modify: `package.json`
- Modify: `scripts/git-hooks/pre-commit.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/canari.yml`

**Interfaces:**
- Consumes: commandes vertes `agents:check`, `test:agents`, `test:hooks`.
- Produces: blocage local et CI avant les suites longues, sans mutation de `src/`, `server/` ou `src/data/`.

- [ ] **Step 1: Compléter la suite hooks**

Dans `package.json`, fixer exactement :

```json
"test:hooks": "node --test scripts/hooks/exception-add-guard.test.mjs scripts/hooks/solde-ticket-guard.test.mjs scripts/hooks/issue-label-guard.test.mjs scripts/hooks/inject-project-credo.test.mjs"
```

Run: `npm run test:hooks`  
Expected: PASS pour exception, solde-ticket, issue-label et injection du credo.

- [ ] **Step 2: Brancher le pré-commit après parité verte**

Ajouter avant le rendu final des diagnostics de `scripts/git-hooks/pre-commit.mjs` :

```js
try {
  execFileSync('npm', ['run', 'agents:check'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} catch {
  offenders.push('agents:check en échec (adaptateurs Claude/Codex divergents — lancer `npm run agents:sync`)');
}
```

Run: `node scripts/git-hooks/pre-commit.mjs package.json`  
Expected: exit 0 avec `agents:check` vert.

- [ ] **Step 3: Ajouter les gates CI et canari avant les suites longues**

Dans les deux workflows, immédiatement après `npm ci` :

```yaml
      - run: npm run agents:check
      - run: npm run test:agents
      - run: npm run test:hooks
      - name: Idempotence des adaptateurs agents
        run: |
          set -e
          npm run agents:sync
          git diff --exit-code -- AGENTS.md .agents/skills .codex/credo.md .codex/memory
```

Expected: un adaptateur modifié manuellement fait échouer `agents:check`; une génération non idempotente fait échouer `git diff --exit-code`.

- [ ] **Step 4: Exécuter tous les gates finaux**

Run, dans cet ordre :

```powershell
npm run agents:check
npm run test:agents
npm run test:hooks
npm run typecheck
npm run lint
npm test
npm run build
npm run docs:check
npm run test:raw
```

Expected: chaque commande sort avec le code 0 ; `agents:check` n'écrit rien ; aucun fichier sous `src/`, `server/` ou `src/data/` n'est modifié.

- [ ] **Step 5: Contrôler les sorties et committer**

Run:

```powershell
npm run agents:sync
npm run agents:check
```

Expected: deux exits 0 et aucune différence après le second calcul.

```powershell
git add -- package.json scripts/git-hooks/pre-commit.mjs .github/workflows/ci.yml .github/workflows/canari.yml
git commit -m "ci: enforce Claude Codex compatibility"
```

Plan complete and saved to `docs/superpowers/plans/2026-07-23-compatibilite-claude-codex.md`. Two execution options:

1. Subagent-Driven (recommended) — use `superpowers:subagent-driven-development`, one fresh worker and review cycle per task.
2. Inline Execution — use `superpowers:executing-plans`, execute task batches with checkpoints.
