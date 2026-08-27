/**
 * GARDE — la GRAPHIE de la prose de scène, mesurée sur le CODE qui AUTHORE.
 *
 * QUESTION : un producteur de document de scène (générateur de campagne, scénario de test, fixture)
 * écrit-il encore l'ancienne graphie que `sceneSchema`/`effectSchema` ont retirée au lot #1467 L1b
 * V-P2 (`scenes[].description`, `DialogueNode.text`, `DialogueChoice.text`, et le `text` des effets
 * `journal`/`document`/`setObjective`) ?
 *
 * POURQUOI ELLE EXISTE : le contrat de donnée (`schema-contract.test.ts`) ne voit que les documents
 * COMMITTÉS. Un générateur resté à l'ancienne graphie est invisible pour lui — jusqu'au jour où un
 * auteur le relance et produit un document que `parseProject` REFUSE. C'est exactement le trou par
 * lequel `scripts/loup-et-saumure/generate.mjs` et `scripts/barge-du-sel/generate.mjs` sont passés :
 * migrés au geste du même lot, ils n'étaient gardés par rien.
 *
 * PÉRIMÈTRE : `src/**` et `scripts/**`, tests COMPRIS (une fixture de test est un producteur comme
 * un autre — trois d'entre elles ont été trouvées à l'ancienne graphie par ce même lot).
 *
 * ANGLE MORT DÉCLARÉ : la détection est TEXTUELLE et ancrée sur des formes d'AUTHORING littérales
 * (`type: 'journal', text:`, `description:` d'une scène, `choices: [{ text:`). Un document construit
 * par épissure (`{ ...noeud, text }`) ou par une clé calculée lui échappe — le contrat de donnée et
 * le typecheck restent les filets pour ces formes-là.
 */
import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/** Racines d'AUTHORING balayées — le code qui PRODUIT des documents de scène. */
const RACINES = ['src', 'scripts'];
const EXTS = ['.ts', '.tsx', '.mjs', '.mts', '.js'];

/**
 * EXEMPTIONS au SITE, nominatives et MESURÉES :
 *  - `scripts/**\/*.workflow.js` — des scénarios d'agents/navigateur : leur `meta.description` décrit
 *    le WORKFLOW (`scripts/raw/atlas-domain.workflow.js:3`) et leur `text:` est une option de
 *    sélecteur DOM. Aucun de ces fichiers ne produit de document de scène ;
 *  - CE fichier — il PORTE les formes surveillées (motifs et texte forgé du contrôle de morsure) :
 *    s'auto-mesurer le rendrait rouge par construction ;
 *  - `src/state/projet-migration-3-vers-4.test.ts` — sa fixture est GELÉE au format antérieur À
 *    DESSEIN : c'est le document que `PROJECT_MIGRATIONS[3]` doit savoir charger. La migrer viderait
 *    cette garde-là de son sujet.
 */
const EXEMPTS = [
  /\.workflow\.js$/,
  /^src\/data\/scene-prose-graphie-guard\.test\.ts$/,
  /^src\/state\/projet-migration-3-vers-4\.test\.ts$/,
];

/** Les formes d'authoring RETIRÉES par #1467 L1b V-P2, chacune avec sa cible. */
const FORMES: readonly { motif: RegExp; quoi: string; cible: string }[] = [
  { motif: /type:\s*'(?:journal|document|setObjective)'[^\n]*?,\s*text:/g, quoi: "effet `journal`/`document`/`setObjective` à `text`", cible: 'desc' },
  { motif: /choices:\s*\[\s*\{\s*text:/g, quoi: '`DialogueChoice.text`', cible: 'label' },
  { motif: /(?<![A-Za-z0-9_$])description:/g, quoi: '`description` de scène/projet', cible: 'desc' },
];

describe('graphie de la prose de scène — aucun producteur ne réécrit la forme retirée (#1467 L1b)', () => {
  const corpus = readCorpus(RACINES, { exts: EXTS, tests: true }).filter((f) => !EXEMPTS.some((x) => x.test(f.rel)));

  it('le corpus balayé est NON VIDE et couvre les deux racines (sans quoi la garde serait un no-op vert)', () => {
    expect(corpus.length).toBeGreaterThan(500);
    expect(corpus.some((f) => f.rel.startsWith('src/'))).toBe(true);
    expect(corpus.some((f) => f.rel.startsWith('scripts/'))).toBe(true);
  });

  it('la garde MORD : chaque forme surveillée est reconnue sur un texte forgé', () => {
    const forge = [
      "flowOf([{ type: 'journal', text: 'x' }])",
      "choices: [{ text: 'Revenir', next: 'a' }]",
      "description: 'une scène',",
    ];
    for (const [i, f] of FORMES.entries()) {
      f.motif.lastIndex = 0;
      expect(new RegExp(f.motif.source, 'g').test(forge[i]), `la forme « ${f.quoi} » n'est plus détectée`).toBe(true);
    }
  });

  it('aucun site à l’ancienne graphie dans `src/**` ni `scripts/**`', () => {
    const trouves: string[] = [];
    for (const f of corpus) {
      for (const forme of FORMES) {
        const re = new RegExp(forme.motif.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(f.text)) !== null) {
          const ligne = f.text.slice(0, m.index).split('\n').length;
          trouves.push(`${f.rel}:${ligne} — ${forme.quoi} → migrer en \`${forme.cible}\``);
        }
      }
    }
    expect(trouves.sort()).toEqual([]);
  });
});
