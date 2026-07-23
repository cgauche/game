import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import {
  normalizeText, readFrontmatter, readTomlStringField, transformGuide,
  transformSkillTree, validateRolePairs, validateHookParity, buildExpectedOutputs, collectDiffs,
} from './compat-core.mjs';
import { atomicWrite, runCompat } from './compat-cli.mjs';

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

test('décode les échappements TOML des strings basic mono et multiligne', () => {
  assert.equal(readTomlStringField('name = "co\\"deur\\\\"\n', 'name'), 'co"deur\\');
  assert.equal(readTomlStringField('developer_instructions = """\nl\\"igne\\\\\n"""', 'developer_instructions'), 'l"igne\\\n');
});

test('transforme le guide par table fermée', async () => {
  const out = transformGuide(await readFile(new URL('./fixtures/guide/CLAUDE.md', import.meta.url), 'utf8'));
  assert.match(out, /^<!-- GENERATED: agents:sync; source=CLAUDE\.md -->\n# AGENTS\.md/m);
  assert.doesNotMatch(out.replace(/^[^\n]*\n/, ''), /CLAUDE\.md|Claude Code|\.claude\/credo|~\/\.claude|claude\.ai\/code/);
});

test('adopte un legacy exact mais refuse un écrasement manuel', () => {
  const expected = buildExpectedOutputs(new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')]]));
  const generated = expected.files.get('AGENTS.md').toString('utf8');
  const legacy = generated.replace(/^<!-- GENERATED:[^\n]+ -->\n/, '');
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from(legacy)] ]))[0].safe, true);
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from(legacy.replace(/\n/g, '\r\n'))] ]))[0].type, 'unsafe-overwrite');
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from('# manuel\n')]]))[0].type, 'unsafe-overwrite');
});

test('produit un diagnostic parse pour UTF-8 invalide', () => {
  const invalid = Buffer.from([0xc3, 0x28]);
  const expected = buildExpectedOutputs(new Map([['CLAUDE.md', invalid]]));
  assert.equal(expected.diagnostics[0].type, 'parse');
  const valid = buildExpectedOutputs(new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')]]));
  assert.equal(collectDiffs(valid, new Map([['AGENTS.md', invalid]]))[0].type, 'parse');
});

test('réessaie atomiquement les verrous Windows avec un temporaire unique', async () => {
  const calls = [];
  let renames = 0;
  await atomicWrite('C:/repo', 'AGENTS.md', Buffer.from('guide'), {
    mkdir: async () => calls.push('mkdir'),
    writeFile: async (path) => calls.push(`write:${path}`),
    rename: async () => {
      renames += 1;
      if (renames === 1) throw Object.assign(new Error('busy'), { code: 'EPERM' });
      calls.push('rename');
    },
    rm: async () => calls.push('rm'),
    randomUUID: () => 'unique',
    sleep: async () => calls.push('sleep'),
  });
  assert.equal(renames, 2);
  assert.match(calls[1], /AGENTS\.md\.agents-sync-unique$/);
  assert.deepEqual([calls[0], calls[2], calls[3]], ['mkdir', 'sleep', 'rename']);
});

test('reconstruit les sorties attendues depuis le snapshot post-sync', async () => {
  const first = new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code un\n')]]);
  const second = new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code deux\n')],
    ['AGENTS.md', buildExpectedOutputs(first).files.get('AGENTS.md')],
  ]);
  let reads = 0;
  const diagnostics = await runCompat({ root: 'virtual', mode: 'sync' }, {
    snapshot: async () => (reads++ === 0 ? first : second),
    atomicWrite: async () => {},
  });
  assert.equal(diagnostics[0].type, 'content');
});

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
  const actual = new Map([['.agents/skills/intrus.txt', Buffer.from('manuel')]]);
  assert.equal(collectDiffs(expected, actual).find((d) => d.destination.endsWith('intrus.txt')).type, 'unsafe-delete');
});

test('valide noms, descriptions et références des rôles', () => {
  const claude = new Map([['codeur', '---\nname: codeur\ndescription: Exécute\n---\nLire CLAUDE.md et .claude/skills/demo/SKILL.md.\n']]);
  const codex = new Map([['codeur', 'name = "codeur"\ndescription = "Exécute"\ndeveloper_instructions = """\nLire AGENTS.md et .agents/skills/demo/SKILL.md.\n"""']]);
  assert.deepEqual(validateRolePairs(claude, codex), []);
  assert.equal(validateRolePairs(claude, new Map())[0].type, 'missing');
});

test('génère seulement le credo Codex et partage la mémoire Claude', () => {
  const expected = buildExpectedOutputs(new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\n')],
    ['.claude/credo.md', Buffer.from('Lire .claude/memory/MEMORY.md\n')],
    ['.claude/memory/MEMORY.md', Buffer.from('Guide CLAUDE.md\n')],
  ]));
  assert.match(expected.files.get('.codex/credo.md').toString(), /\.claude\/memory/);
  assert.equal(expected.files.has('.codex/memory/MEMORY.md'), false);
});

test('normalise la parité et rejette les commandes shell', () => {
  const good = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node scripts/hooks/inject-project-credo.mjs claude', timeout: 10 }] }] } };
  const codex = structuredClone(good);
  codex.hooks.SessionStart[0].hooks[0].command = 'node scripts/hooks/inject-project-credo.mjs codex';
  assert.deepEqual(validateHookParity(good, codex), []);
  codex.hooks.SessionStart[0].hooks[0].command = 'cat .codex/credo.md';
  assert.equal(validateHookParity(good, codex)[0].type, 'reference');
});

test('réfute toute référence de profil qui diverge après normalisation', () => {
  const claude = new Map([['artiste', '---\nname: artiste\ndescription: Art\n---\nLire `.claude/skills/demo/SKILL.md` et `.claude/credo.md`.\n']]);
  const codex = new Map([['artiste', 'name = "artiste"\ndescription = "Art"\ndeveloper_instructions = """\nLire `.Codex/skills/demo/SKILL.md` et `.codex/credo.md`.\n"""']]);
  assert.equal(validateRolePairs(claude, codex)[0].type, 'reference');
});

test('refuse l’écrasement d’un skill manuel non marqué', () => {
  const expected = buildExpectedOutputs(new Map([['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')]]));
  const actual = new Map([['.agents/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nManuel\n')]]);
  assert.equal(collectDiffs(expected, actual).find((item) => item.destination.endsWith('demo/SKILL.md')).type, 'unsafe-overwrite');
});

test('reconnaît la bannière après frontmatter et son ressource orpheline', () => {
  const skill = Buffer.from('---\nname: demo\ndescription: Démo\n---\n<!-- GENERATED: agents:sync; source=.claude/skills/demo/SKILL.md -->\nCorps\n');
  const expected = buildExpectedOutputs(new Map());
  const actual = new Map([
    ['.agents/skills/demo/SKILL.md', skill],
    ['.agents/skills/demo/assets/icon.bin', Buffer.from([1])],
  ]);
  assert.ok(collectDiffs(expected, actual).filter((item) => item.destination.startsWith('.agents/skills/')).every((item) => item.safe));
});

test('sync supprime seulement les orphelins générés avant le resnapshot', async () => {
  const source = ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')];
  const generated = transformSkillTree(new Map([source])).get('.agents/skills/demo/SKILL.md');
  const files = new Map([source, ['.agents/skills/demo/SKILL.md', generated], ['.agents/skills/demo/assets/icon.bin', Buffer.from([1])]]);
  const removed = [];
  await runCompat({ root: 'virtual', mode: 'sync' }, {
    snapshot: async () => new Map(files),
    atomicWrite: async () => {},
    rm: async (path) => { removed.push(path); files.delete('.agents/skills/demo/assets/icon.bin'); },
  });
  assert.deepEqual(removed.map((path) => path.replaceAll('\\', '/')), ['virtual/.agents/skills/demo/assets/icon.bin']);
});
