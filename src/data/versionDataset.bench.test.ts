/**
 * LE PRIX D'UNE LECTURE VIVE (#1692) — le banc que le solde du lot annonçait sans le committer.
 *
 * Un index VIF (`indexParId`/`memoParVersion`, `versionDataset.ts`) coûte, par lecture, un contrôle
 * de fraîcheur de plus qu'une `Map` figée à l'import. La revue de palier a mesuré ce contrôle à
 * +31 ns/lecture (×4,4) sur une copie du module : le témoin était une CHAÎNE fabriquée à CHAQUE
 * lecture (`cles.map(versionDuDataset).join('/')`) — une allocation par lecture, plus une recherche
 * par chaîne dans une `Map` par clé. Le témoin est depuis un NOMBRE lu dans une cellule capturée.
 *
 * Deux bornes, toutes deux en RATIO mesuré dans la MÊME passe (patron `state/wallIndex.test.ts`) —
 * jamais un temps absolu, qui ne dit rien d'une machine à l'autre :
 *  1. lecture VIVE vs lecture FIGÉE, à profondeur d'appel ÉGALE, sur 1e6 lectures ;
 *  2. la part MAJORÉE de ce surcoût dans un bake réel (les scènes de la Diligence), l'usage qui
 *     motivait l'annonce « chemin chaud < 1 % ».
 * Les deux redeviennent rouges dès que le contrôle de fraîcheur réalloue à la lecture.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { props } from './index';
import { indexParId } from './versionDataset';
import { setDataset } from './overrides';
import { parseProject } from '../state/worldMap';
import { buildFloors } from '../gameIso/builders/floors';
import { buildProps } from '../gameIso/builders/props';
import type { Scene } from '../state/scene';

/** Meilleure de trois passes : la machine partagée ajoute du bruit, jamais du travail — le PLANCHER
 *  est le seul temps comparable, et il l'est ici entre deux chemins mesurés dans la même passe. */
const plancher = (passe: () => number): number => Math.min(passe(), passe(), passe());

const chrono = (travail: () => number): number => {
  const t0 = performance.now();
  const utile = travail();
  const ms = performance.now() - t0;
  if (utile < 0) throw new Error('travail optimisé hors de la mesure');
  return ms;
};

const ids = (): string[] => props.map((p) => p.id);

/** Les deux chemins comparés : un accesseur d'index VIF et un accesseur de `Map` FIGÉE, tous deux
 *  frais (aucune lecture manquée dans leur histoire, qui polymorphiserait un seul des deux sites) et
 *  appelés à la MÊME profondeur — sans quoi le ratio mesurerait une trame d'appel, pas la fraîcheur. */
const passes = (n: number) => {
  const cles = ids();
  const vif = indexParId('props', props);
  const FIGE = new Map(props.map((p) => [p.id, p] as const));
  const fige = (id: string) => FIGE.get(id);
  return {
    vive: () => chrono(() => { let k = 0; for (let i = 0; i < n; i++) if (vif(cles[i % cles.length])) k++; return k; }),
    figee: () => chrono(() => { let k = 0; for (let i = 0; i < n; i++) if (fige(cles[i % cles.length])) k++; return k; }),
  };
};

describe('#1692 — le prix d’une lecture d’index VIF', () => {
  it('l’index vif rend la MÊME entrée que la Map figée (sans quoi le ratio compare deux travaux)', () => {
    const cles = ids();
    const vif = indexParId('props', props);
    const FIGE = new Map(props.map((p) => [p.id, p] as const));
    expect(cles.length).toBeGreaterThan(50);
    for (const id of cles) expect(vif(id)).toBe(FIGE.get(id));
    expect(vif('rien-de-tel')).toBeUndefined();
  });

  it('l’index vif se RECONSTRUIT à l’écriture au seam (le banc ne mesure pas un mémo mort)', () => {
    const vif = indexParId('props', props);
    const livres = [...props];
    const premier = vif(livres[0].id);
    try {
      setDataset('props', [...livres, { ...livres[0], id: '__banc-1692__' }]);
      expect(vif('__banc-1692__')?.id).toBe('__banc-1692__');
      expect(vif(livres[0].id)).toBe(premier);
    } finally {
      setDataset('props', livres);
    }
    expect(vif('__banc-1692__')).toBeUndefined();
  });

  // Borne à 3 : mesuré 1,39 au calme et 2,1 sous la charge d'une suite voisine (machine partagée) ; le
  // `join` par lecture qu'elle refuse donnait 7,34 — la marge sépare le bruit de la régression.
  it('1e6 lectures : l’index vif coûte moins du TRIPLE d’une Map figée', () => {
    const N = 1_000_000;
    const { vive, figee } = passes(N);
    vive(); figee(); // chauffe (index bâti, JIT chaud des deux chemins)
    const msVif = plancher(vive);
    const msFige = plancher(figee);
    const ns = (ms: number) => ((ms * 1e6) / N).toFixed(2);
    expect(
      msVif / msFige,
      `vif ${ns(msVif)} ns/lecture, figé ${ns(msFige)} ns/lecture (surcoût ${ns(msVif - msFige)} ns)`,
    ).toBeLessThanOrEqual(3);
  });
});

describe('#1692 — la part du contrôle de fraîcheur dans un bake réel (Diligence)', () => {
  const doc = parseProject(JSON.parse(readFileSync(new URL('../scenes/diligence/diligence-projet.json', import.meta.url), 'utf8')));
  const scenes: Scene[] = doc.scenes;

  const bake = () => chrono(() => {
    let emis = 0;
    for (const s of scenes) { emis += buildFloors(s).length; emis += buildProps(s).length; }
    return emis;
  });
  /** Éléments de décor RÉELLEMENT émis par le bake (décor authoré + décor de tuile) : chacun coûte un
   *  nombre BORNÉ de lectures de l'index `props` (recette, volume, matières) — 4 est un majorant. */
  const emisDeDecor = scenes.reduce((n, s) => n + buildProps(s).length, 0);
  const LECTURES_PAR_ELEMENT = 4;

  it('la Diligence donne bien du travail au bake (sans quoi le banc ne mesure rien)', () => {
    expect(scenes.length).toBeGreaterThan(0);
    expect(emisDeDecor).toBeGreaterThan(15);
  });

  it('le surcoût de fraîcheur pèse moins d’un MILLIÈME du bake', () => {
    const M = 200_000;
    const { vive, figee } = passes(M);
    bake(); vive(); figee();
    const msBake = plancher(bake);
    const nsSurcout = ((plancher(vive) - plancher(figee)) * 1e6) / M;
    const part = (emisDeDecor * LECTURES_PAR_ELEMENT * nsSurcout) / (msBake * 1e6);
    expect(
      part,
      `bake ${msBake.toFixed(1)} ms sur ${scenes.length} scènes / ${emisDeDecor} éléments de décor ; surcoût ${nsSurcout.toFixed(2)} ns/lecture → ${(part * 100).toFixed(4)} % du bake`,
    ).toBeLessThan(0.001);
  });
});
