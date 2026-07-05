/**
 * GARDE dérivée des INSTANCES — anti-dérive du SCHÉMA d'argument des Traits (filet exhaustif).
 *
 * Balaie CHAQUE instance de trait de la donnée et vérifie que la DÉCLARATION de schéma du trait
 * (`TraitData` : `indice` / `specsSource` / `specsOpen` / `specsMulti`, cf. `index.ts`) COUVRE ce que
 * l'instance porte. Trois INVARIANTS stricts, sans tolérance ad hoc ni baseline de dette (aucun élément
 * différé) — même esprit que la GARDE EXHAUSTIVE de `refs-migrated.test.ts` (walk + offenders + `expect([])`) :
 *   1. `value` numérique ⟹ le trait déclare `indice` (le sens de la valeur).            → « missing-indice »
 *   2. `arg` d'une source FERMÉE (`specsSource` sans `specsOpen`) RÉSOUT dans son registre. → « label-as-id »
 *   3. Toute instance porteuse d'un `id` RÉSOUT dans `traits.json` (id de trait connu).    → « id fantôme »
 * Un `arg` sur un trait SANS `specsSource` est un descripteur TEXTE LIBRE (« Arme (Épée) », « Armure
 * (Cuir 2) ») — légitime, non contraint (même convention que `refs-migrated` : hors catalogue = verbatim).
 *
 * ── PÉRIMÈTRE ─────────────────────────────────────────────────────────────────────────────────────
 * Les instances vivent dans `creatures.json`, sous `traits[]` (profil imprimé) et `optionals[]` (LDB 76,
 * menu facultatif). TOUTES sont désormais id-based `{ id, value?, arg?, range?, count? }` — la liste
 * `optionals[]` a été migrée du format legacy label-`key` vers les id (args des sources FERMÉES résolus
 * en id, comme `traits[]`). Restent 33 entrées `optionals` en `key` (libellé) : des entrées GENUINEMENT
 * PROSE (fourchettes de Taille « de Petite à Énorme », cibles de Haine hors registre « Prédateurs »,
 * « Dressé » à skills sans trait dresse-* pré-défini, notes de profil « Remplacer Bestial par… »…) qui
 * ne SONT PAS des ids de trait — laissées telles quelles (non forcées), donc naturellement hors des
 * invariants #2/#3 (elles n'ont pas d'`id`). L'invariant #1 les couvre si leur `key` résout à un trait.
 *
 * Les instances CONSTRUITES par op (`grantTrait { traitId, arg? }`, dans mutations/sorts/traits/États/
 * maladies) sont balayées par l'invariant #4 (même résolution que #2). Toute dérive FUTURE (un `value`
 * sans `indice`, un `arg` fermé pris pour un libellé, un `id` de trait fantôme, un `grantTrait` à arg
 * libellé) fait échouer la garde en LISTANT les fautifs.
 *   4. `grantTrait { traitId, arg }` (ops) : l'arg RÉSOUT dans le registre du trait ciblé.  → « op label-as-id »
 */
import { describe, it, expect } from 'vitest';
import { traits, creatures, mutations, spells, etats, maladies, SPEC_SOURCES, type SpecsSource, type TraitData } from './index';

/** Forme BRUTE d'une instance. Typage local : le type `TraitInstance` public n'a que `id` ; les 33
 *  entrées `optionals` non migrées portent encore `key` (libellé) → accès via ce shape. */
type RawTraitInstance = { id?: string; key?: string; value?: unknown; arg?: unknown; range?: unknown; count?: unknown };

const byId = new Map(traits.map((t) => [t.id, t] as const));
const byLabel = new Map(traits.map((t) => [t.label, t] as const));

/** Sentinelle joker d'un statbloc RAW (« Animosité (un au choix) », « Peur (Au choix) ») — tolérée. */
const WILDCARD = /^(un |une |deux )?au choix$/i;

interface Row { inst: RawTraitInstance; def: TraitData | undefined; where: string; hasId: boolean; }
/** Toutes les instances de trait (`traits[]` + `optionals[]`), def résolue par `id` (byId) puis, à
 *  défaut, par libellé `key` (byLabel — les 33 entrées prose non migrées). `hasId` = l'instance porte
 *  un vrai `id` (⇒ soumise à la résolution fermée #2 et à la résolution d'id #3). */
function* eachInstance(): Generator<Row> {
  for (const c of creatures) {
    for (const list of ['traits', 'optionals'] as const) {
      for (const inst of (c[list] ?? []) as unknown as RawTraitInstance[]) {
        const def = typeof inst.id === 'string' ? byId.get(inst.id) : typeof inst.key === 'string' ? byLabel.get(inst.key) : undefined;
        yield { inst, def, where: `${c.label}.${list}[${String(inst.id ?? inst.key)}]`, hasId: typeof inst.id === 'string' };
      }
    }
  }
}

/** Parts d'un `arg` : liste séparée par virgules si `specsMulti`, sinon l'arg entier. */
const argParts = (arg: string, multi: boolean): string[] =>
  (multi ? arg.split(',').map((s) => s.trim()) : [arg.trim()]).filter(Boolean);

describe('schéma d\'argument des traits — chaque instance est COUVERTE par la déclaration de son trait', () => {
  it('value numérique ⟹ le trait déclare `indice` (sens de la valeur)', () => {
    const offenders: string[] = [];
    for (const { inst, def, where } of eachInstance()) {
      if (!def || typeof inst.value !== 'number') continue;
      if (!def.indice) offenders.push(`${where} value=${inst.value} (aucun \`indice\` déclaré)`);
    }
    expect(offenders, `value numérique sans \`indice\` déclaré :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('arg d\'une source FERMÉE (specsSource sans specsOpen) RÉSOUT dans le registre — jamais un libellé/id fantôme', () => {
    const offenders: string[] = [];
    for (const { inst, def, where, hasId } of eachInstance()) {
      if (!hasId || !def || typeof inst.arg !== 'string') continue;
      const src: SpecsSource | undefined = def.specsSource;
      if (!src || def.specsOpen) continue; // ouvert / sans source = descripteur texte libre (légitime, non contraint)
      if (WILDCARD.test(inst.arg.trim())) continue; // sentinelle « au choix » sur l'arg entier
      for (const part of argParts(inst.arg, !!def.specsMulti)) {
        if (WILDCARD.test(part)) continue; // part joker « un au choix »
        if (!SPEC_SOURCES[src].resolves(part)) offenders.push(`${where} → ${src}: ${JSON.stringify(part)} (id inconnu du registre)`);
      }
    }
    expect(offenders, `arg fermé non résolu (libellé pris pour un id ?) :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('toute instance porteuse d\'un `id` RÉSOUT dans traits.json — jamais un id de trait fantôme (les entrées prose portent `key`, pas `id`)', () => {
    const offenders: string[] = [];
    for (const { inst, where, hasId } of eachInstance()) {
      if (!hasId) continue; // entrées prose non migrées : `key`, pas `id` → hors de cet invariant
      if (!byId.has(inst.id as string)) {
        const carries = [inst.value != null && 'value', inst.arg != null && 'arg', inst.range != null && 'range'].filter(Boolean).join('/');
        offenders.push(`${where} → id « ${String(inst.id)} » introuvable dans traits.json${carries ? ` (porte ${carries})` : ''}`);
      }
    }
    expect(offenders, `id de trait fantôme :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('grantTrait { traitId, arg } (mutations/sorts/traits/États/maladies) : l\'arg RÉSOUT dans le registre du trait', () => {
    const offenders: string[] = [];
    const walk = (node: unknown, where: string): void => {
      if (Array.isArray(node)) { for (const n of node) walk(n, where); return; }
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (o.op === 'grantTrait' && typeof o.traitId === 'string' && typeof o.arg === 'string') {
        const def = byId.get(o.traitId);
        const src: SpecsSource | undefined = def?.specsSource;
        if (def && src && !def.specsOpen && !WILDCARD.test(o.arg.trim())) {
          for (const part of argParts(o.arg, !!def.specsMulti)) {
            if (WILDCARD.test(part)) continue;
            if (!SPEC_SOURCES[src].resolves(part)) offenders.push(`${where} grantTrait ${o.traitId} → ${src}: ${JSON.stringify(part)}`);
          }
        }
      }
      for (const v of Object.values(o)) walk(v, where);
    };
    for (const m of mutations) walk(m, `mutation:${m.id}`);
    for (const t of traits) walk(t, `trait:${t.id}`);
    for (const s of spells) walk(s, `spell:${s.id}`);
    for (const e of etats) walk(e, `etat:${e.id}`);
    for (const md of maladies) walk(md, `maladie:${md.id}`);
    expect(offenders, `grantTrait à arg non résolu (libellé pris pour un id ?) :\n${offenders.join('\n')}`).toEqual([]);
  });
});
