/**
 * Tests du plugin Vite `wfrp:prose-source` (`scripts/source/prose-source-plugin.mjs`) — la prose
 * ADRESSÉE est matérialisée dans le module JSON servi à l'application.
 *
 * Le corpus est une FIXTURE hors dépôt (`os.tmpdir()`) : le plugin reçoit un accès au corpus par
 * injection, ce qui laisse ces tests indépendants de l'état du `Source/` réel — l'invariant testé est
 * le CÂBLAGE du plugin (filtre d'id, injection, fail-closed, rechargement), pas le corpus. Les chemins
 * de chapitre y prennent la FORME DE PRODUCTION : relatifs à la racine, séparateurs Windows.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, resolve } from 'node:path';
import { createServer } from 'vite';
import { parseChapitre, empreinteDe, type ChapitreParse, type FragmentBlocs } from './decoupe.ts';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { proseSource } from '../../../scripts/source/prose-source-plugin.mjs';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vite.config.ts`
import { materialiser } from '../../../scripts/source/resoudre.mjs';

const CHAPITRE = `# Peur

<span data-folio="190"></span>

La Peur est une réaction à quelque chose de perturbant ou d'effrayant, un texte assez long pour être adressable sans ambiguïté.

# Terreur

La Terreur est une réaction à quelque chose d'horrible, un second passage tout aussi long et parfaitement distinct du premier.
`;

const LIVRE = 'livre-de-base';
const CH = '21';

const racines: string[] = [];
/**
 * Deux dossiers DISJOINTS : la racine servie par Vite, et le corpus. C'est la disposition réelle
 * (`Source/` n'est pas dans le graphe de modules) — et sans elle, le corpus serait surveillé par la
 * seule surveillance de racine, ce qui rendrait la mise sous surveillance du plugin indémontrable.
 */
function fixture(): { racine: string; chapitre: string } {
  const racine = mkdtempSync(join(tmpdir(), 'prose-racine-'));
  const corpus = mkdtempSync(join(tmpdir(), 'prose-corpus-'));
  racines.push(racine, corpus);
  mkdirSync(join(corpus, LIVRE), { recursive: true });
  mkdirSync(join(racine, 'src', 'data'), { recursive: true });
  const absolu = join(corpus, LIVRE, '21 - Psychologie.md');
  writeFileSync(absolu, CHAPITRE, 'utf8');
  // FORME DE PRODUCTION du chemin de chapitre : relatif à la racine (`chapterFile` compose depuis le
  // `dir` de `books.json`) et à séparateurs Windows — c'est cette forme que chokidar rend, et c'est
  // sur elle que l'index de dépendance du plugin doit s'apparier.
  return { racine, chapitre: relative(process.cwd(), absolu) };
}
afterAll(() => { for (const r of racines) rmSync(r, { recursive: true, force: true }); });

/** Accès au corpus de la fixture, à l'interface que le plugin consomme — mémoire par `livre|chapitre`,
 *  comme le lecteur partagé (`lecteur-fs.mjs`) que la production lui passe. */
function corpusDe(chapitre: string) {
  const cache = new Map<string, ChapitreParse>();
  const vise = (book: string, ch: string) => book === LIVRE && ch === CH;
  return {
    chemin: (book: string, ch: string) => (vise(book, ch) ? chapitre : null),
    dossiers: () => [dirname(chapitre)],
    lire: (book: string, ch: string) => {
      if (!vise(book, ch)) return null;
      const clef = `${book}|${ch}`;
      if (!cache.has(clef)) cache.set(clef, parseChapitre(readFileSync(chapitre, 'utf8')));
      return cache.get(clef)!;
    },
    oublier: (book: string, ch: string) => cache.delete(`${book}|${ch}`),
  };
}

/** Adresse du premier bloc d'une section du chapitre de fixture, empreinte POSÉE. */
function adresseDe(chapitre: string, titre: string): { book: string; ch: string; parts: FragmentBlocs[] } {
  const parse = parseChapitre(readFileSync(chapitre, 'utf8'));
  const section = parse.sections.find((s) => s.title === titre);
  if (!section) throw new Error(`fixture sans section « ${titre} »`);
  const frag: FragmentBlocs = { kind: 'blocs', sec: section.slug, secOcc: section.occ, b0: 0, b1: 0, sum: '' };
  const sum = empreinteDe(parse, frag);
  if (typeof sum !== 'string') throw new Error(`fixture non résoluble : ${sum.error} — ${sum.detail}`);
  return { book: LIVRE, ch: CH, parts: [{ ...frag, sum }] };
}

/** Le `this` que Rollup donne à un hook : `error` LÈVE (c'est ce qui rend le module rouge). */
function contexte() {
  const erreurs: string[] = [];
  return {
    erreurs,
    hook: {
      error(message: unknown) {
        erreurs.push(String(message));
        throw new Error(String(message));
      },
    },
  };
}

const ID = '/depot/src/data/psychology.json';

describe('plugin `wfrp:prose-source` — transform', () => {
  it('injecte le `desc` que l’adresse résout, et laisse `descRef` en place', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'terreur', descRef: adresseDe(chapitre, 'Terreur') }]);
    const out = plugin.transform.call(contexte().hook, code, ID);
    const entree = JSON.parse(out.code)[0];
    expect(entree.desc).toContain('La Terreur est une réaction à quelque chose d\'horrible');
    expect(entree.descRef.parts).toHaveLength(1);
  });

  it('laisse INTACT un module sans adresse (aucune matérialisation = module byte-identique)', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'peur', desc: 'prose écrite dans l’entrée' }]);
    expect(plugin.transform.call(contexte().hook, code, ID)).toBeNull();
  });

  it('ne touche pas un id à QUERY : `?raw` sert la FORME DISQUE', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'terreur', descRef: adresseDe(chapitre, 'Terreur') }]);
    expect(plugin.transform.call(contexte().hook, code, `${ID}?raw`)).toBeNull();
  });

  it('FAIL-CLOSED : une empreinte divergente fait échouer le module, nommément', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const adresse = adresseDe(chapitre, 'Terreur');
    adresse.parts[0].sum = '0000000000000000';
    const ctx = contexte();
    expect(() => plugin.transform.call(ctx.hook, JSON.stringify([{ id: 'terreur', descRef: adresse }]), ID)).toThrow();
    expect(ctx.erreurs.join('\n')).toContain('empreinte-divergente');
    expect(ctx.erreurs.join('\n')).toContain('prose-source');
  });

  it('est BYTE-STABLE : deux passes rendent le même module', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'terreur', descRef: adresseDe(chapitre, 'Terreur') }]);
    const a = plugin.transform.call(contexte().hook, code, ID);
    const b = plugin.transform.call(contexte().hook, code, ID);
    expect(a.code).toBe(b.code);
  });
});

describe('plugin `wfrp:prose-source` — serveur de dev', () => {
  /**
   * Serveur Vite RÉEL (transform réel, `moduleGraph` réel, `ws` réel) sur la fixture. Le `change` est
   * ÉMIS sur le watcher réel plutôt qu'attendu du système de fichiers : sous un worker vitest, un
   * chokidar créé par Vite n'émet RIEN (mesuré — même code, même fixture : sous Node nu le `change`
   * arrive et le `full-reload` part ; sous vitest, ni en natif ni en scrutation, alors que
   * `fs.watch`/`fs.watchFile` bruts fonctionnent dans le worker). Tout ce que le PLUGIN fait est donc
   * vérifié ici ; l'unique maillon laissé à Vite est la remontée chokidar, dont la condition — le
   * dossier du livre mis sous surveillance par le plugin — est vérifiée juste en dessous.
   */
  it('un chapitre RÉÉCRIT invalide les modules JSON qui en dépendent et fait recharger la page', async () => {
    const { racine, chapitre } = fixture();
    const fichierJson = join(racine, 'src', 'data', 'psychology.json');
    writeFileSync(fichierJson, JSON.stringify([{ id: 'terreur', descRef: adresseDe(chapitre, 'Terreur') }]), 'utf8');

    const server = await createServer({
      configFile: false,
      root: racine,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [proseSource({ corpus: corpusDe(chapitre) })],
    });
    const messages: { type?: string }[] = [];
    const ws = server.ws as unknown as { send: (...a: unknown[]) => void };
    const envoi = ws.send.bind(server.ws);
    ws.send = (...a: unknown[]) => { messages.push(a[0] as { type?: string }); envoi(...a); };
    try {
      const avant = await server.transformRequest('/src/data/psychology.json');
      expect(avant?.code).toContain('La Terreur est une réaction');
      const module = [...server.moduleGraph.idToModuleMap.values()]
        .find((m) => String(m.id).includes('src/data/psychology.json'));
      expect(module?.transformResult, 'le module JSON doit être en cache avant la modification').toBeTruthy();

      // Le dossier du chapitre est SOUS SURVEILLANCE : sans ce `add`, aucun `change` ne viendrait.
      // (chokidar prend ses répertoires de façon asynchrone — d'où l'attente bornée ; la comparaison
      // passe par `resolve` parce que chokidar rend ses clés dans la forme qu'on lui a donnée.)
      const dossier = resolve(dirname(chapitre));
      const surveille = () => Object.keys(server.watcher.getWatched()).map((d) => resolve(d));
      expect(await attendre(() => surveille().includes(dossier)),
        `le plugin n’a pas mis le dossier du livre sous surveillance — surveillés : ${surveille().join(', ')}`).toBe(true);

      writeFileSync(chapitre, CHAPITRE.replace('quelque chose d\'horrible', 'quelque chose de RÉÉCRIT'), 'utf8');
      server.watcher.emit('change', chapitre);

      expect(messages.map((m) => m?.type), 'aucun `full-reload` envoyé au navigateur').toContain('full-reload');
      expect(module?.transformResult, 'le module JSON est resté en cache : il servirait l’ancien texte').toBeNull();
      // Le chapitre est RELU (le cache du corpus a été oublié) : le texte a bougé sous l'adresse, donc
      // l'empreinte diverge et le module est ROUGE NOMMÉ — une dérive de source est bruyante, jamais
      // un texte approchant servi en silence. Sans l'oubli, l'ancien chapitre resservirait, muet.
      await expect(server.transformRequest('/src/data/psychology.json'))
        .rejects.toThrow('empreinte-divergente');
    } finally {
      await server.close();
    }
  });
});

/** Attend qu'une condition devienne vraie (prise de répertoire asynchrone), bornée. */
async function attendre(condition: () => boolean, plafondMs = 8_000): Promise<boolean> {
  const fin = Date.now() + plafondMs;
  while (Date.now() < fin) {
    if (condition()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return condition();
}

describe('`materialiser` — pendant Node du transform', () => {
  it('une racine sans adresse traverse à l’IDENTIQUE (copie profonde, zéro matérialisation)', () => {
    const racine = { id: 'psychology', entries: [{ id: 'peur', desc: 'inline', tags: ['a', 'b'] }] };
    const res = materialiser(racine);
    expect(res.materialises).toBe(0);
    expect(JSON.stringify(res.racine)).toBe(JSON.stringify(racine));
  });

  it('la prose d’un nœud ADRESSÉ vient de l’adresse, quelle que soit la clé `desc` de la donnée', () => {
    // Un `desc` NON-CHAÎNE échappe au refus de `resoudreProse` (qui ne mord que sur la paire de
    // chaînes) : s'il était recopié, il écraserait la prose matérialisée — en silence, et seulement
    // quand il SUIT `descRef` dans l'ordre des clés.
    const { chapitre } = fixture();
    const racine = [{ id: 'terreur', descRef: adresseDe(chapitre, 'Terreur'), desc: null }];
    const res = materialiser(racine, { lecteur: corpusDe(chapitre).lire, chemin: () => null });
    expect(res.materialises).toBe(1);
    expect(res.racine[0].desc).toContain('La Terreur est une réaction à quelque chose d\'horrible');
  });
});
