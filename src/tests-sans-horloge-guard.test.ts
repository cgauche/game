import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { codeSeul } from '../scripts/guards/lib/codeSeul.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estSuiteVitest, EST_SUITE_VITEST } from '../scripts/guards/lib/fichierVitest.mjs';

/**
 * TESTS SANS HORLOGE (#1788) — un test de `src/` prouve un CONTRAT DE TRAVAIL, jamais une durée.
 * La classe : un test qui lit l'horloge mesure l'ORDONNANCEUR de la machine qui le joue, pas le
 * travail que le code a fait ou refusé de faire ; il rougit sous charge et verdit sur une machine
 * rapide qui a pourtant régressé. Ce que le contrat voulait dire se lit sur l'ARTEFACT (tampons,
 * `version` d'attribut, index, compteurs d'appels), qui est déterministe.
 *
 * PÉRIMÈTRE = LE CORPUS DE `npm test`, jamais une liste à nous : les `include` de `vite.config.ts`
 * (`src/**`, `server/src/**`, `scripts/map/**`) sont EXACTEMENT ce que la suite joue, donc
 * exactement ce dont la baseline ZÉRO parle — la garde ne porte AUCUNE liste de sites tolérés (une
 * garde qui nomme ses tolérés valide des défauts). Ces tests prouvent du code PUR (moteur, état,
 * rendu, worker) : aucun n'a un délai pour sujet. Les tests de `scripts/**` HORS `scripts/map`
 * exercent des processus, des sockets et des délais d'attente, où une durée EST le sujet légitime
 * du contrat (`scripts/guards/lib/spawnResilient.test.mjs`, `scripts/recette/lib.test.mjs` en
 * portent) — et `npm test` ne les joue pas : ils sortent du périmètre par la MÊME règle, sans
 * énumération. Les `include` ne sont pas recopiés : ils sont DÉRIVÉS de `vite.config.ts` à
 * l'exécution (`includeDeVite`), et la garde ne porte donc AUCUNE liste — ni de sites, ni de globs.
 *
 * Ce fichier est DANS le corpus qu'il scanne : son motif n'y apparaît qu'ÉCLATÉ (alternance de la
 * regex, concaténation des cas vivants), donc la garde ne s'exempte pas — elle ne se matche pas.
 */

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'Quel test joué par `npm test` lit une HORLOGE au lieu de prouver un contrat de travail ? ' +
    'Réponse attendue : ' +
    'aucun — baseline ZÉRO, sans aucune liste de sites tolérés.',
  primitive:
    'La regex `HORLOGE` appliquée LIGNE À LIGNE à la vue CODE SEUL ' +
    '(`scripts/guards/lib/codeSeul.mjs`) du corpus de `readCorpus` ' +
    '(`scripts/guards/lib/sourceCorpus.mjs`, `tests: true`) — aucun parcours de ' +
    'dossiers local, aucun blanchiment local : commentaires et littéraux de chaîne sont de la prose ' +
    'et de la donnée, seul le CODE est mesuré.',
  perimetre:
    'Le corpus de `npm test`, DÉRIVÉ des `include` de la section `test` de `vite.config.ts` — aucune ' +
    'liste de globs ici : fichiers de test ET le harnais `src/test-setup.ts` qui court avant chacun ' +
    'd’eux. Les tests de `scripts/**` hors `scripts/map` ' +
    'pilotent des processus et des sockets, où un délai est le SUJET du contrat — et `npm test` ne ' +
    'les joue pas. Le code de PRODUCTION est hors périmètre : une boucle de rendu a le droit de ' +
    'dater ses images.',
  angleMort: [
    'La garde mesure un TEXTE, pas une sémantique : un test qui passe par un alias (`const maintenant = ' +
      'globalThis.performance.now` capturé ailleurs, un utilitaire de chronométrage importé) lui échappe.',
    'Les autres sources de non-déterminisme temporel ne sont pas couvertes : `new Date()`, ' +
      '`process.hrtime`, `setTimeout` avec assertion sur le réveil.',
    'Le blanchiment de `codeSeul` est LEXICAL, pas grammatical : un `/` classé en division là où une ' +
      'regexp s’ouvrait ferait traverser en code une chaîne ouverte dans cette regexp (couverture dite ' +
      'en tête de `scripts/guards/lib/codeSeul.mjs`).',
    'Hors des `.test.ts(x)`, un seul fichier de harnais est scanné (`src/test-setup.ts`, le ' +
      '`setupFiles` de la config) : un autre harnais porté par un fichier sans ce nom ' +
      '(`*.helpers.ts` d’un dossier de tests) n’est vu par aucun canal.',
  ],
  ticket: '#1788',
} as const;

/** Lecture d'horloge : appel de `now` sur `performance` ou sur `Date`, espaces tolérés autour du
 *  point et de la parenthèse. Le motif n'est écrit NULLE PART en clair dans ce fichier — il y
 *  entrerait par le corpus, et la garde devrait alors s'exempter elle-même. */
const HORLOGE = /\b(?:performance|Date)\s*\.\s*now\s*\(/;

/** Ce qui est SCANNÉ : les fichiers de test, et le HARNAIS qui s'exécute avant CHACUN d'eux
 *  (`src/test-setup.ts`, `setupFiles` de `vite.config.ts`). Une horloge dans le harnais est une
 *  horloge dans tous les tests à la fois — et celle-là n'apparaît dans aucun d'eux. */
const EST_TEST = (rel: string): boolean => estSuiteVitest(rel) || rel.endsWith('/test-setup.ts');

/**
 * Les `include` de la section `test` de `vite.config.ts` : CE QUE `npm test` joue. DÉRIVÉS, jamais
 * recopiés — aucune liste de globs ne vit dans cette garde, donc rien à tenir à jour quand la config
 * en gagne une.
 *
 * POURQUOI PAS L'IMPORT DU MODULE : `vite.config.ts` ÉVALUE `defineConfig(...)` au chargement, et
 * instancie ses plugins au passage (`registryGen()`, `proseSource()`, `react()`, `:27-28`) — un
 * import pour lire trois chaînes embarquerait ces effets dans le worker de test. Le scan lexical,
 * lui, n'exécute rien. Et l'autre canal (`vitest list --filesOnly`, `scripts/test/run.mjs:231-234`)
 * lance un processus : hors de portée d'un test.
 */
function includeDeVite(): string[] {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const sectionTest = /\btest:\s*\{/.exec(config);
  if (!sectionTest) throw new Error('tests-sans-horloge : section `test:` introuvable dans vite.config.ts');
  const bloc = /\binclude:\s*\[([^\]]*)\]/.exec(config.slice(sectionTest.index));
  if (!bloc) throw new Error('tests-sans-horloge : `include:` introuvable dans la section `test:` de vite.config.ts');
  const motifs = [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (motifs.length === 0) throw new Error('tests-sans-horloge : `include:` de vite.config.ts est VIDE — la garde mesurerait le vide');
  return motifs;
}

const INCLUDE_NPM_TEST = includeDeVite();

/** Le séparateur d'un glob de Vitest : ce qui précède est le DOSSIER, ce qui suit est la FIN de nom. */
const SEPARATEUR_GLOB = '/**/*';

/** Les FINS DE NOM qu'un motif d'`include` accepte — l'accolade dépliée en un nom par dialecte.
 *  Découpé au séparateur de glob : aucune forme de nom de test n'est RÉÉCRITE ici, c'est le glob
 *  qui la porte, et le test de concordance ci-dessous la confronte au prédicat partagé. */
const finsDuGlob = (motif: string): string[] => {
  const [dir, suffixe] = motif.split(SEPARATEUR_GLOB);
  if (!dir || !suffixe) throw new Error(`tests-sans-horloge : motif d'include non reconnu — ${motif}`);
  const accolade = /\{([a-z,]+)\}$/.exec(suffixe);
  return accolade ? accolade[1].split(',').map((d) => suffixe.replace(accolade[0], d)) : [suffixe];
};

/** Un motif d'`include` décrit un DOSSIER et des EXTENSIONS : c'est tout ce dont le corpus a besoin. */
const cibleDe = (motif: string): { dir: string; exts: string[] } => ({
  dir: motif.split(SEPARATEUR_GLOB)[0],
  exts: [...new Set(finsDuGlob(motif).map((fin) => `.${fin.split('.').pop()}`))],
});

/** Ce nom de fichier serait-il joué par ce motif d'`include` ? */
const accepteParLeGlob = (motif: string, nom: string): boolean => finsDuGlob(motif).some((fin) => nom.endsWith(fin));

/** Les six formes témoins de la concordance glob ↔ prédicat : les deux dialectes de suite joués, le
 *  dialecte de suite que seul `scripts/**` écrit, un BANC, une source de production, un suffixé. */
const NOMS_TEMOINS = ['a.test.ts', 'a.test.tsx', 'a.test.mjs', 'a.bench.ts', 'a.ts', 'x.test.ts.bak'];

describe('la SUITE se définit à UN endroit — le glob de vite.config.ts et le prédicat partagé concordent', () => {
  it('sur les dialectes que le glob NOMME, glob et `EST_SUITE_VITEST` acceptent et refusent les mêmes noms', () => {
    for (const motif of INCLUDE_NPM_TEST) {
      const { exts } = cibleDe(motif);
      for (const nom of NOMS_TEMOINS) {
        if (!exts.some((e) => nom.endsWith(e))) continue; // dialecte que CE glob ne nomme pas
        expect(accepteParLeGlob(motif, nom), `${motif} ↔ prédicat sur ${nom}`).toBe(EST_SUITE_VITEST.test(nom));
      }
    }
  });

  it('ÉCART MESURÉ : le prédicat couvre un dialecte de suite qu’aucun glob ne joue (`.test.mjs`)', () => {
    // Ce n'est pas un rouge à masquer, c'est le périmètre : le prédicat sert AUSSI `scripts/**`, dont
    // les suites sont en `.mjs` et tournent sous `node --test`, hors de `npm test`. La concordance
    // ci-dessus porte donc sur les dialectes que le glob NOMME, et l'écart est mesuré ici, pas tu.
    expect(INCLUDE_NPM_TEST.some((m) => accepteParLeGlob(m, 'a.test.mjs'))).toBe(false);
    expect(EST_SUITE_VITEST.test('a.test.mjs')).toBe(true);
  });

  it('un nom SUFFIXÉ n’est une suite pour personne', () => {
    expect(INCLUDE_NPM_TEST.some((m) => accepteParLeGlob(m, 'x.test.ts.bak'))).toBe(false);
    expect(EST_SUITE_VITEST.test('x.test.ts.bak')).toBe(false);
  });
});

describe('tests-sans-horloge-guard : aucun test joué par `npm test` ne lit l’horloge', () => {
  const tests = INCLUDE_NPM_TEST.flatMap((motif) => {
    const { dir, exts } = cibleDe(motif);
    return readCorpus([dir], { exts, tests: true }).filter((f) => EST_TEST(f.rel));
  });

  it('le corpus scanné est le RÉEL — sinon la garde mesurerait le vide', () => {
    expect(tests.length).toBeGreaterThan(100);
    expect(tests.map((f) => f.rel)).toContain('src/gameIso/backends/webgl/sceneTint.test.ts');
    expect(tests.map((f) => f.rel), 'le HARNAIS est dans le corpus — sinon sa graine échappe à la garde')
      .toContain('src/test-setup.ts');
    for (const motif of INCLUDE_NPM_TEST) {
      const { dir } = cibleDe(motif);
      expect(tests.some((f) => f.rel.startsWith(`${dir}/`)), `${dir} est représenté dans le corpus`).toBe(true);
    }
  });

  it('le périmètre DÉRIVÉ de `vite.config.ts` n’est pas vide, et porte bien `src/**`', () => {
    // La dérivation LIT la config : si sa forme change, `includeDeVite` lève en le disant. Ce qui se
    // vérifie ici est qu'elle rend quelque chose d'UTILISABLE — un périmètre vide, ou sans le dossier
    // où vivent les tests du jeu, rendrait la baseline ZÉRO vraie par vacuité.
    expect(INCLUDE_NPM_TEST.length, 'aucun `include` dérivé : la garde ne scannerait rien').toBeGreaterThan(0);
    expect(
      INCLUDE_NPM_TEST.some((motif) => motif.startsWith('src/**')),
      `aucun glob \`src/**\` dans le périmètre dérivé — reçu : ${INCLUDE_NPM_TEST.join(', ')}`,
    ).toBe(true);
  });

  it('aucune lecture d’horloge dans un test joué par `npm test`', () => {
    const sites = tests.flatMap(({ rel, text }) =>
      codeSeul(text)
        .split('\n')
        .map((ligne, i) => (HORLOGE.test(ligne) ? `${rel}:${i + 1}` : null))
        .filter((s): s is string => s !== null),
    );
    expect(sites, 'un test prouve un CONTRAT DE TRAVAIL, jamais une horloge (#1788)').toEqual([]);
  });

  /* Cas VIVANTS du détecteur. Les motifs sont ASSEMBLÉS à l'exécution : écrits en clair ils
   * entreraient dans le corpus que ce fichier scanne, et la garde devrait s'exempter elle-même. */
  describe('le détecteur MORD — cas vivants et contrôles négatifs', () => {
    const lecture = (objet: string, espaces = '') => `const t = ${objet}${espaces}.${espaces}now${espaces}();`;

    it.each([
      ['performance', '', 'forme compacte'],
      ['Date', '', 'horloge murale'],
      ['performance', ' ', 'espaces autour du point et de la parenthèse'],
    ])('HORLOGE matche %j%j (%s)', (objet, espaces) => {
      expect(HORLOGE.test(lecture(objet, espaces))).toBe(true);
    });

    it.each([
      ['const d = new Date(2026, 0, 1);', 'construction de date — aucune horloge lue'],
      ['const t = Date.parse(iso);', 'analyse d’une date littérale'],
      ['const n = compteur.nowhere;', 'identifiant qui CONTIENT now'],
    ])('HORLOGE ne matche PAS %j (%s)', (source) => {
      expect(HORLOGE.test(source)).toBe(false);
    });

    /* CONTRAT DE VIE du blanchiment (#1788) : la garde ne compte que du CODE. Formes NUES, jamais un
     * fichier du dépôt — un test qui prendrait l'arbre pour fixture mesurerait l'arbre du jour. */
    it.each([
      ['commentaire de ligne', (l: string) => `// on ne date rien ici : ${l}`],
      ['commentaire de bloc', (l: string) => `/* prose du bloc\n   ${l}\n */`],
      ['littéral de chaîne double quote', (l: string) => `const attendu = ${JSON.stringify(l)};`],
      ['chaîne simple quote', (l: string) => `const attendu = '${l.replace(/'/g, '')}';`],
      ['gabarit sans substitution', (l: string) => `const attendu = \`${l}\`;`],
    ] as const)('codeSeul blanchit le motif porté par un %s', (_libelle, enrobage) => {
      const texte = enrobage(lecture('performance'));
      expect(HORLOGE.test(texte), 'la forme nue porte bien le motif').toBe(true);
      expect(codeSeul(texte).split('\n').some((l) => HORLOGE.test(l))).toBe(false);
    });

    it('codeSeul préserve les LIGNES : le numéro rapporté désigne la même ligne à la source', () => {
      const texte = ['/* bloc', ' * prose', ' */', lecture('Date')].join('\n');
      const blanchi = codeSeul(texte);
      expect(blanchi.split('\n').length).toBe(texte.split('\n').length);
      expect(blanchi.split('\n').findIndex((l) => HORLOGE.test(l))).toBe(3);
    });

    it('un APPEL en code reste ROUGE après blanchiment — sinon la garde serait un tamis', () => {
      const appel = `${lecture('performance')}\nconst s = 'juste une chaîne';`;
      expect(codeSeul(appel).split('\n').some((l) => HORLOGE.test(l))).toBe(true);
    });

    it('une SUBSTITUTION de gabarit est du CODE — elle survit au blanchiment', () => {
      const texte = `const msg = \`durée ${'$'}{${lecture('performance').replace(/^const t = |;$/g, '')}}\`;`;
      expect(codeSeul(texte).split('\n').some((l) => HORLOGE.test(l))).toBe(true);
    });

    it('l’en-tête structuré nomme son ticket et sa baseline ZÉRO (#1475)', () => {
      expect(GARDE.ticket).toBe('#1788');
      expect(GARDE.question).toMatch(/baseline ZÉRO/);
      expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(4);
    });
  });
});
