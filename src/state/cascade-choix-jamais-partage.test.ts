/**
 * GARDE — « `options` et `groupOwner` JAMAIS sur la même étape » (#1262).
 *
 * `groupOwner` fait rendre l'owner `'*'` par l'arbitre (`modalArbiter`, entrée `cascade`) : chaque
 * siège voit la fenêtre où se tient SA rangée. Un CHOIX (`options`), lui, se pose au niveau de
 * l'ÉTAPE (`setCascadeChoice`) et n'a pas de porteur — sur une étape de groupe, n'importe quel siège
 * trancherait la voie d'autrui. Deux barrières indépendantes :
 *   (1) COMPORTEMENT : `startCascade` refuse une telle étape (DEV : throw) ;
 *   (2) STRUCTURE : registre FAIL-CLOSED des fichiers de `src/state` qui posent `groupOwner` — un
 *       producteur de plus force à venir vérifier ici qu'il ne pose pas aussi de choix.
 *
 * COUVERTURE, dite : (2) mesure QUI pose `groupOwner`, pas la composition de chaque étape (un
 * `groupOwner` posé par épandage `...spec` lui échapperait) ; (1) mord à l'OUVERTURE de séquence, donc
 * pas sur les deux BASCULES a posteriori (`combatFlow.ts:4225`, `combatSlice.ts:637`), qui ne marquent
 * qu'une étape `jet:'cast'`/`jet:'disengage'` — jamais une étape à `options`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useGame } from './store';
import { startCascade } from './cascade';
import type { CascadeStep } from './pendings';

const STATE_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Fichiers de `src/state` (hors tests) qui POSENT `groupOwner` sur une étape — mesuré, pas supposé.
 *  Une entrée = un producteur relu : il ne pose AUCUN `options` sur la même étape.
 *
 *  #1262 V2 L4 : plus AUCUN de ces sites ne monte une étape à la main — ils DÉCLARENT `groupOwner` à un
 *  MINT (`rollSeam.hostStep` : `combatFlow` cast partagé, `combatSlice` désengagement à deux joués,
 *  `store` enfoncement de porte ; `rollSeam` lui-même l'expose et le POSE, `bandStep` le dérivant du
 *  nombre de porteurs). Le registre ne mesure donc plus que la surface de DÉCLARATION. */
const PRODUCTEURS_GROUP_OWNER = ['combatFlow.ts', 'combatSlice.ts', 'rollSeam.ts', 'store.ts'];

/** Retire commentaires de bloc et de ligne : une réf à `groupOwner:true` en prose n'est pas un site. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

function sources(dir = STATE_DIR, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...sources(`${dir}/${ent.name}`, p));
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(p);
  }
  return out;
}

const etape = (over: Partial<CascadeStep>): CascadeStep =>
  ({ id: 'e', kind: 'sonde-choix', label: 'Étape', result: null, ...over }) as CascadeStep;

describe('#1262 — une étape de CHOIX n’est jamais une étape de GROUPE', () => {
  beforeEach(() => {
    useGame.setState({ pendingCascade: null, suspendedCascades: [] } as never);
  });

  it('startCascade REFUSE une étape qui porte `options` ET `groupOwner`', () => {
    const step = etape({ groupOwner: true, options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] });
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [step] }))
      .toThrow(/options.*groupOwner|groupOwner/);
  });

  it('les deux formes SÉPARÉES passent (choix MONO, bande de groupe) — la garde ne mord que la combinaison', () => {
    const choix = etape({ id: 'choix', options: [{ key: 'a', label: 'A' }] });
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [choix] })).not.toThrow();
    useGame.setState({ pendingCascade: null, suspendedCascades: [] } as never);
    const bande = etape({ id: 'bande', groupOwner: true, aggregate: 'none', participants: [] });
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [bande] })).not.toThrow();
  });

  it('registre FAIL-CLOSED : les fichiers de src/state qui posent `groupOwner` sont exactement ceux relus', () => {
    const trouves = sources().filter((f) => /\bgroupOwner\s*:/.test(stripComments(readFileSync(`${STATE_DIR}/${f}`, 'utf8'))));
    expect(
      trouves.sort(),
      'producteur de `groupOwner` non inscrit : le relire (aucun `options` sur la même étape) puis l’inscrire',
    ).toEqual([...PRODUCTEURS_GROUP_OWNER].sort());
  });

  it('aucun fichier inscrit n’a disparu (entrée morte du registre)', () => {
    const tous = new Set(sources());
    expect(PRODUCTEURS_GROUP_OWNER.filter((f) => !tous.has(f))).toEqual([]);
  });
});

/**
 * GARDE DE PALIER (#1262 V2 L4) — « une étape à RANGÉES DÉCLARE sa possession ».
 *
 * Toutes les fabriques passent par `bandStep`, qui la POSE (plusieurs porteurs → `groupOwner`, un seul
 * → SON `actorId`). La garde ferme la FORME à la frontière : une bande sans possession rendrait la
 * fenêtre à l'hôte seul (`modalArbiter` → `undefined`), et le siège du porteur ne verrait jamais sa
 * rangée. Elle lit l'ÉTAPE, jamais un call-site (leçon #1271 : pas de regex de site).
 */
describe('#1262 V2 L4 — une bande DÉCLARE sa possession', () => {
  beforeEach(() => {
    useGame.setState({ pendingCascade: null, suspendedCascades: [] } as never);
  });

  const bande = (over: Partial<CascadeStep>): CascadeStep =>
    ({ id: 'b', kind: 'sonde-bande', label: 'Bande', aggregate: 'none', ...over }) as CascadeStep;
  const rangee = (id: string) => ({ id, interactive: true, label: 'Résistance', base: 40, target: 40, result: null });
  const ouvrir = (st: CascadeStep) => () => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [st] });

  it('DEUX porteurs sans `groupOwner` → REFUSÉE (la fenêtre échoirait à l’hôte seul)', () => {
    expect(ouvrir(bande({ participants: [rangee('h1'), rangee('h2')] }))).toThrow(/possession/);
  });

  it('UN porteur sans `actorId` ni `groupOwner` → REFUSÉE (son siège ne verrait pas sa rangée)', () => {
    expect(ouvrir(bande({ participants: [rangee('h1')] }))).toThrow(/possession/);
  });

  it('les deux formes POSÉES passent : `groupOwner` à plusieurs, `actorId` à un seul', () => {
    expect(ouvrir(bande({ id: 'multi', groupOwner: true, participants: [rangee('h1'), rangee('h2')] }))).not.toThrow();
    useGame.setState({ pendingCascade: null, suspendedCascades: [] } as never);
    expect(ouvrir(bande({ id: 'solo', actorId: 'h1', participants: [rangee('h1')] }))).not.toThrow();
  });

  it('une étape SANS rangées n’est pas concernée (mono, choix, affichage)', () => {
    expect(ouvrir(bande({ id: 'mono', actorId: 'h1', rollLabel: 'Résistance', target: 40 }))).not.toThrow();
    useGame.setState({ pendingCascade: null, suspendedCascades: [] } as never);
    expect(ouvrir(bande({ id: 'affichage' }))).not.toThrow();
  });
});
