/**
 * FORME UNIQUE de la monnaie dans la donnée AUTHORÉE (#1463, vague `monnaie`).
 *
 * Le mode de panne fermé ici est la RÉAPPARITION SILENCIEUSE d'une 2ᵉ graphie : la bourse a vécu
 * quatre ans en `{gold, silver, bronze}` côté catalogues et en `{gold, silver, brass}` côté moteur
 * (`Money`, `src/engine/money.ts:10`), sans qu'aucun test ne voie les deux à la fois — chaque côté
 * était vert sur SA graphie, et `priceToMoney` traduisait au milieu.
 *
 * Les deux sondes marchent la DONNÉE des 2 racines authorées (`src/data`, `src/scenes`), jamais le
 * code : ce qu'elles mesurent est la forme réellement écrite par les auteurs.
 *  A. le concept `monnaie` ne s'écrit qu'en dénominations de `Money` — `{gold?, silver?, brass?}` ;
 *     le seul porteur qui les ÉTALE sur un objet-action est l'effet `giveMoney` (solde : L-monnaie-3).
 *  B. les noms RÉSERVÉS `price`/`cost` : recensement par CLASSE réelle et par SIGNATURE d'objet —
 *     un nom de concept est réservé à son type (#1463 S2 ; solde de `cost` : L-monnaie-4).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RACINES = ['src/data', 'src/scenes'];
/** Les 3 dénominations de `Money` + la graphie HISTORIQUE `bronze`, que la sonde A doit voir à ZÉRO. */
const DENOMINATIONS = ['gold', 'silver', 'brass', 'bronze'];

function documents(): unknown[] {
  const out: unknown[] = [];
  const marcher = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) marcher(p);
      else if (e.name.endsWith('.json')) out.push(JSON.parse(fs.readFileSync(p, 'utf8')));
    }
  };
  for (const r of RACINES) marcher(path.join(ROOT, r));
  return out;
}

type Compte = Record<string, number>;
const inc = (c: Compte, k: string) => { c[k] = (c[k] ?? 0) + 1; };

/** Marche TOUT nœud objet des documents, en donnant à `visiter` ses clés. */
function marcherObjets(noeud: unknown, visiter: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(noeud)) { for (const e of noeud) marcherObjets(e, visiter); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  visiter(noeud as Record<string, unknown>);
  for (const v of Object.values(noeud)) marcherObjets(v, visiter);
}

const DOCS = documents();

describe('monnaie — forme UNIQUE dans la donnée authorée (#1463)', () => {
  it('A. une dénomination ne s’écrit qu’en `{gold?, silver?, brass?}` — jamais `bronze`, jamais étalée hors de `giveMoney`', () => {
    const montants: Compte = {};
    const etales: Compte = {};
    let bronze = 0;
    for (const doc of DOCS) marcherObjets(doc, (o) => {
      const cles = Object.keys(o);
      const den = cles.filter((k) => DENOMINATIONS.includes(k)).sort();
      if (den.length === 0) return;
      if (cles.includes('bronze')) bronze++;
      const autres = cles.filter((k) => !DENOMINATIONS.includes(k)).sort();
      if (autres.length === 0) inc(montants, den.join(','));
      else inc(etales, String(o.type ?? o.op ?? '(objet sans type)'));
    });

    // La graphie historique a DISPARU de la donnée : la 3ᵉ dénomination est `brass`, comme au moteur.
    expect(bronze, 'clé `bronze` en donnée — la 3ᵉ dénomination de `Money` est `brass`').toBe(0);

    // Recensement des MONTANTS (un objet dont les clés sont des dénominations et rien d'autre) :
    // les catalogues chiffrent les 3, un coût authoré n'écrit que ce qu'il coûte.
    expect(montants, 'signatures de montant observées').toEqual({
      'brass,gold,silver': 465, // 447 colonnes Prix (trappings 392, vehicles 31, creatures 14, machines de guerre 10) + solde d'équipage 18
      gold: 2, // mise minimale du Mécénat + 1 coût de choix d'arène
      silver: 7, // coûts de choix d'arène
    });

    // Un objet-ACTION qui étale une dénomination parmi ses propres clés : le vocabulaire n'en a
    // qu'UN, `giveMoney` — les autres actions portent leur charge sous un nom (`amount`, `ref`…).
    expect(Object.keys(etales).sort(), 'actions qui étalent une monnaie à plat').toEqual(['giveMoney']);
    // Cliquet DÉCROISSANT — `giveMoney` prend son enveloppe `montant` au lot L-monnaie-3.
    expect(etales.giveMoney, 'porteurs plats `giveMoney`').toBeLessThanOrEqual(44);
  });

  it('B. les noms réservés `price` et `cost` : recensement par CLASSE réelle et par signature d’objet', () => {
    const classe = (v: unknown) =>
      v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : v === 'ND' ? "'ND'" : typeof v;
    const classes: Record<'price' | 'cost', Compte> = { price: {}, cost: {} };
    const signatures: Record<'price' | 'cost', Compte> = { price: {}, cost: {} };
    for (const doc of DOCS) marcherObjets(doc, (o) => {
      for (const nom of ['price', 'cost'] as const) {
        if (!Object.prototype.hasOwnProperty.call(o, nom)) continue;
        const v = o[nom];
        inc(classes[nom], classe(v));
        if (v && typeof v === 'object' && !Array.isArray(v)) inc(signatures[nom], Object.keys(v).sort().join(','));
      }
    });

    // `price` = la colonne Prix TELLE QUE LE LIVRE L'IMPRIME (`money.ts:36-39`) : un montant, la
    // marque « ND », ou rien. La classe `number` est le barème qui USURPE le nom (solde L-monnaie-4).
    expect(classes.price, 'classes de `price`').toEqual({ object: 465, null: 46, "'ND'": 3, number: 6 });
    expect(signatures.price, 'signatures d’objet sous `price`').toEqual({
      'brass,gold,silver': 447, // la colonne Prix chiffrée
      'automne,ete,hiver,printemps': 17, // barème SAISONNIER d'une cargaison
      dice: 1, // prix TIRÉ
    });

    // `cost` porte encore trois types sous un seul nom (économie du Tour, bandes de coque, monnaie) :
    // le nom se rend à son type au lot L-monnaie-4, ce recensement en est la mesure d'entrée.
    expect(classes.cost, 'classes de `cost`').toEqual({ string: 56, object: 30, number: 7 });
    expect(signatures.cost, 'signatures d’objet sous `cost`').toEqual({
      bands: 14, 'bands,per': 6, // bandes de coque (naval-traits)
      advantage: 1, advantageOrMovement: 1, // Avantage / Avantage ou Mouvement
      gold: 1, silver: 7, // vraie monnaie
    });
  });
});
