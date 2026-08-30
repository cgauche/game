/**
 * COMPLÉTUDE de l'enjeu DÉRIVÉ (#1262 V2 L6d) — la garde qui remplace une dotation à la main.
 *
 * Arbitrage user 2026-08-12 (verbatim au ticket #1262) : « Le socle dérive l'enjeu de l'entité
 * porteuse ("ce qui se joue : [sort/objet X]" + renvoi Codex […]). Zéro saisie, les 74 nœuds sont
 * couverts par construction […]. Un auteur PEUT toujours surcharger par un texte authoré. »
 *
 * Ce que ce fichier mesure, sur la DONNÉE RÉELLE (jamais une liste recopiée) : CHAQUE nœud Flow
 * `kind:'test'` de `src/data/*.json` produit un enjeu RÉSOLU non vide, au bout du chemin de
 * production — `withDerivedStake` (les deux étages) → `simpleTriggeredTestStep` (le mint, qui exige
 * désormais l'enjeu au TYPE) → `resolveStake` (la porte unique de la surface).
 *
 * CE QU'ELLE VOIT (fail-closed sur l'avenir) : un fichier de données NEUF portant un `kind:'test'`
 * sans nature de source déclarée ici rougit — la table `KIND_PAR_FICHIER` est le seul endroit où une
 * famille d'entités se rattache à son `EffectSourceKind`, et l'oublier ne peut pas passer en silence.
 *
 * CE QU'ELLE NE PEUT PAS VOIR, et pourquoi (limite STRUCTURELLE, pas un manque de zèle) : la RÉF
 * PENDANTE. L'enjeu dérivé ne stocke aucun id authoré — il LIT celui de l'entrée qui porte le nœud
 * (`entree.id`). Renommer une entrée déplace donc l'entrée ET sa réf du même geste, et `findById` la
 * retrouve : aucune mutation de renommage ne peut rendre cette garde rouge. C'est le corollaire de la
 * forme choisie (dérivée, jamais authorée) — le risque de réf morte n'existe que pour les datasets
 * d'enjeux à `rule`/`entryId` authorés, où il est mesuré ailleurs (`data/stake-rule-ratchet.test.ts`,
 * volet « aucun renvoi MORT »). La mutation qui MORD ici est la dérivation débranchée, pas le renommage.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simpleTriggeredTestStep, withDerivedStake } from './combat/triggeredTest';
import { effectSourcesOf } from './triggeredEffects';
import { EMPTY_FLOW, type FlowTest } from './flow';
import { resolveStake, findById, combatStakeRef } from '../data';
import { applyOps } from '../engine/ops';
import { recomputeLoadout, parseDamage } from '../engine/items';
import type { TriggeredEffect } from '../engine/flowCore';
import { CATEGORY_BY_SOURCE_KIND, type EffectSourceKind, type Combatant, type ItemInstance } from '../engine/types';

const DATA = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');

/** NATURE de source de chaque famille de données qui porte des `FlowTest` (`EffectSourceKind`, table
 *  TOTALE côté Codex : `CATEGORY_BY_SOURCE_KIND`). Un fichier absent d'ici et porteur d'un `test`
 *  fait rougir la garde — c'est le point d'accrochage d'une famille NEUVE. */
const KIND_PAR_FICHIER: Record<string, EffectSourceKind> = {
  'spells.json': 'spell',
  'trappings.json': 'trapping',
  'etats.json': 'condition',
  'talents.json': 'talent',
  'traits.json': 'trait',
  'maneuvers.json': 'maneuver',
  'qualities.json': 'quality',
  'symptoms.json': 'symptom',
};

interface Noeud { fichier: string; entryId: string; ft: FlowTest }

/** Tous les nœuds `kind:'test'` de la base app-owned, avec l'ENTRÉE qui les porte (id STABLE). */
function noeudsDeTest(): Noeud[] {
  const out: Noeud[] = [];
  for (const fichier of readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
    let json: unknown;
    try { json = JSON.parse(readFileSync(join(DATA, fichier), 'utf8')); } catch { continue; }
    const entrees = Array.isArray(json) ? json : [json];
    for (const entree of entrees) {
      const id = (entree as { id?: string })?.id;
      if (!id) continue;
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (!n || typeof n !== 'object') return;
        const o = n as Record<string, unknown>;
        if (o.kind === 'test' && o.test) out.push({ fichier, entryId: id, ft: o.test as FlowTest });
        for (const v of Object.values(o)) walk(v);
      };
      walk(entree);
    }
  }
  return out;
}

const hero = (): Combatant => ({
  id: 'H1', label: 'Sonde', kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [], talents: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
} as unknown as Combatant);

const BRANCHES = { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW };

describe('#1262 V2 L6d — TOUT `FlowTest` de la donnée dit ce qui se joue', () => {
  const noeuds = noeudsDeTest();

  it('la sonde MESURE quelque chose (sinon elle serait verte à vide)', () => {
    expect(noeuds.length, 'aucun nœud `kind:test` trouvé : le scan de la donnée a glissé').toBeGreaterThanOrEqual(70);
  });

  it('chaque famille porteuse de `FlowTest` a sa NATURE de source déclarée', () => {
    const orphelines = [...new Set(noeuds.map((n) => n.fichier))].filter((f) => !KIND_PAR_FICHIER[f]);
    expect(orphelines, 'famille de données porteuse d’un jet sans nature de source : son enjeu ne pourrait pas se dériver').toEqual([]);
  });

  it('chaque nœud produit une étape MINTÉE dont l’enjeu se résout en texte + renvoi Codex', () => {
    const muets: string[] = [];
    for (const n of noeuds) {
      const kind = KIND_PAR_FICHIER[n.fichier];
      if (!kind) continue; // dit par le test précédent
      const ft = withDerivedStake(n.ft, { kind, id: n.entryId });
      const step = simpleTriggeredTestStep(hero(), ft, BRANCHES, EMPTY_FLOW, 'intermediaire');
      if (!step?.stake) { muets.push(`${n.fichier}:${n.entryId} — étape sans enjeu`); continue; }
      const resolu = resolveStake(step.stake);
      const label = findById(CATEGORY_BY_SOURCE_KIND[kind], n.entryId)?.label;
      if (!resolu.text?.trim()) muets.push(`${n.fichier}:${n.entryId} — enjeu résolu vide`);
      else if (label && !resolu.text.includes(label)) muets.push(`${n.fichier}:${n.entryId} — l’enjeu ne nomme pas l’entité (« ${resolu.text} »)`);
      if (!resolu.rule) muets.push(`${n.fichier}:${n.entryId} — aucun renvoi Codex`);
      else if (resolu.rule.id !== n.entryId) muets.push(`${n.fichier}:${n.entryId} — renvoi hors de sa propre fiche (${resolu.rule.category}:${resolu.rule.id})`);
    }
    expect(muets, ['Jet de donnée MUET — chaque `FlowTest` dit ce qui se joue :', ...muets].join('\n')).toEqual([]);
  });

  /** L'ENJEU DÉCLARÉ PRIME — l'étage 1 du contrat : la dérivation ne recouvre jamais ce que le
   *  producteur (dataset) ou l'auteur (document) a dit lui-même. */
  it('un enjeu DÉCLARÉ sur le nœud prime sur celui du porteur', () => {
    const declare = combatStakeRef('fatigue');
    const ft = withDerivedStake({ skill: { id: 'resistance' }, label: 'Résister', stake: declare }, { kind: 'condition', id: 'empoisonne' });
    expect(ft.stake, 'la dérivation a recouvert un enjeu déclaré').toBe(declare);

    const authore = { authored: 'Tenir la corniche, ou tomber.' };
    const ftA = withDerivedStake({ skill: { id: 'escalade' }, stake: authore }, { kind: 'spell', id: 'chute' });
    expect(ftA.stake).toBe(authore);
  });

  /** FAIL-CLOSED de la dérivation : sans porteur, ou avec un porteur qui ne nomme aucune fiche, on
   *  se TAIT (jamais une phrase qui nommerait un id brut ou renverrait vers un foyer mort). */
  it('sans porteur résoluble, la dérivation se tait (elle n’invente rien)', () => {
    expect(withDerivedStake({ skill: { id: 'resistance' }}, undefined).stake).toBeUndefined();
    expect(withDerivedStake({ skill: { id: 'resistance' }}, { kind: 'spell', id: 'sort-qui-n-existe-pas' }).stake).toBeUndefined();
  });
});

/**
 * PROVENANCE des effets FONDUS dans un objet (#1262 V2 L6d, verdict du juge G1) — un enjeu qui NOMME
 * la mauvaise entité est pire qu'un silence : il se lit comme une vérité.
 *
 * Cinq entités de donnée exigent un jet par un `onHitEffects`, en DEUX classes que ce volet sépare :
 *  · FONDUE par une op (`augmentWeapon`) — les sorts `morsure-de-l-hiver` / `epee-de-justice` et les
 *    poisons `lotus-noir` / `racine-des-tombes` (consommables qui enduisent la lame) : l'effet vit
 *    ensuite dans `weapon.onHitEffects` (`applyEnchants`, engine/weaponDamage) et le dispatcher
 *    (`effectSourcesOf`) tague au porteur ce qui n'a pas déjà de source. Sans provenance conservée,
 *    l'enjeu disait « ce qui se joue : Épée » ;
 *  · EN PROPRE sur l'objet (`TrappingData.onHitEffects`) — `dechireur-de-sociabilite` : là,
 *    l'attribution à l'objet est JUSTE, c'est bien lui qui exige le jet. Ce volet le fige aussi,
 *    pour qu'une « correction » ne le casse pas au passage.
 */
describe('#1262 V2 L6d — l’enjeu nomme l’entité qui EXIGE le jet, jamais l’arme qui la porte', () => {
  const arme = (): ItemInstance => ({ uid: 'w', label: 'Épée', kind: 'melee', damage: parseDamage('+BF+4'), reach: 'Moyenne', range: null, qualities: [], enc: 1, equipped: true } as unknown as ItemInstance);

  const porteur = (): Combatant => {
    const c = hero();
    (c as unknown as { items: ItemInstance[] }).items = [arme()];
    (c as unknown as { loadouts: unknown[] }).loadouts = [{ id: 'lo', main: 'w' }];
    (c as unknown as { activeLoadoutId: string }).activeLoadoutId = 'lo';
    recomputeLoadout(c);
    return c;
  };

  /** Le Test « à la touche » authoré par le sort (forme réelle de `morsure-de-l-hiver`). */
  const testOnHit = { trigger: 'onHit', on: 'victim', flow: { kind: 'test', test: { skill: 'resistance', difficulty: 'intermediaire' }, success: EMPTY_FLOW, fail: EMPTY_FLOW } } as unknown as TriggeredEffect;

  it('effet FONDU par un sort : l’enjeu nomme le SORT (jamais l’épée qui le porte)', () => {
    const c = porteur();
    applyOps(c, [{ op: 'augmentWeapon', onHitEffects: [testOnHit] }], { label: 'Morsure de l’hiver', source: { kind: 'spell', id: 'morsure-de-l-hiver' }, defaultDurationRounds: 4 });
    const src = effectSourcesOf(c, c.weapons[0]).find((s) => s.key.startsWith('weapon:'))!;
    const eff = src.effects[0];
    expect(eff.source, 'la provenance du sort est perdue en route').toEqual({ kind: 'spell', id: 'morsure-de-l-hiver' });
    const stake = withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake!;
    const texte = resolveStake(stake).text!;
    expect(texte).toContain(findById('spells', 'morsure-de-l-hiver')!.label);
    expect(texte, 'l’enjeu nomme l’ARME : il ment sur ce qui se joue').not.toContain('Épée');
    expect(resolveStake(stake).rule).toEqual({ category: 'spells', id: 'morsure-de-l-hiver' });
  });

  it('effet FONDU par un POISON bu : l’enjeu nomme le poison (même règle, autre nature de source)', () => {
    const c = porteur();
    applyOps(c, [{ op: 'augmentWeapon', onHitEffects: [testOnHit] }], { label: 'Lotus noir', source: { kind: 'trapping', id: 'lotus-noir' }, defaultDurationRounds: 4 });
    const eff = effectSourcesOf(c, c.weapons[0]).find((s) => s.key.startsWith('weapon:'))!.effects[0];
    const texte = resolveStake(withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake!).text!;
    expect(texte).toContain(findById('trappings', 'lotus-noir')!.label);
    expect(texte).not.toContain('Épée');
  });

  it('effet EN PROPRE de l’objet : l’enjeu nomme l’OBJET — c’est lui qui exige le jet', () => {
    const c = hero();
    const w = { label: 'Déchireur de sociabilité', trappingId: 'dechireur-de-sociabilite', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], onHitEffects: [testOnHit] } as unknown as Combatant['weapons'][number];
    const eff = effectSourcesOf(c, w).find((s) => s.key.startsWith('weapon:'))!.effects[0];
    expect(eff.source).toEqual({ kind: 'trapping', id: 'dechireur-de-sociabilite' });
    expect(resolveStake(withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake!).text)
      .toContain(findById('trappings', 'dechireur-de-sociabilite')!.label);
  });

  /** SANS provenance (op appliquée hors de tout contexte d'entité) : le socle SE TAIT — il ne se
   *  rabat pas sur l'arme. C'est la règle du lot : se taire plutôt que mentir. */
  it('effet fondu SANS provenance : la dérivation se tait plutôt que de nommer l’arme', () => {
    const c = porteur();
    applyOps(c, [{ op: 'augmentWeapon', onHitEffects: [testOnHit] }], { label: 'Enchantement anonyme', defaultDurationRounds: 4 });
    const eff = effectSourcesOf(c, c.weapons[0]).find((s) => s.key.startsWith('weapon:'))!.effects[0];
    // Le dispatcher tague au porteur ce qui n'a pas de source : ici l'arme est SANS id de catalogue
    // (arme forgée pour la sonde) → aucune fiche à nommer, la dérivation rend `undefined`.
    expect(withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake).toBeUndefined();
  });
});
