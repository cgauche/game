// @vitest-environment jsdom
/**
 * #1686 lot 3a-2 — l'atelier d'un document DISCRIMINÉ présente la charge du CAS de l'entrée, jamais
 * l'union des cas.
 *
 * `inferFields` prend l'UNION des clés de TOUTES les entrées : sur `materials.json` (28 clés d'union,
 * dont 7 portées par une matière de décor), une matière `prop` s'éditait avec 21 champs ÉTRANGERS —
 * des pentes de toit et des faces de relief que son propre schéma REFUSE au save (refine ⟺ du def).
 * Le mécanisme est GÉNÉRIQUE : le def déclare `chargeParDiscriminant`, `chargeDiscriminee` le sert,
 * l'atelier filtre. Un document sans discriminant garde l'union (témoin ci-dessous).
 *
 * Le geste mesuré est celui de l'écran : `CodexEdit` monté sur une entrée réelle, libellés LUS dans
 * le DOM (patron `codex-edit-save-transaction.test.tsx`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit, editableDataset, editableObjectDataset, dedicatedFieldKeys } from './CodexEdit';
import { libelleDuChamp, inferFields } from './editFields';
import { metaPourFichier, chargeDiscriminee, schemaForFile } from '../../data/schemas/validate';
import { CODEX } from './registry';
import { datasetArray, datasetFile } from '../../data/overrides';
import { materials, oups } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Libellés des champs que le formulaire générique PRÉSENTE (un `span` par champ monté). */
function champsPresentes(): string[] {
  return [...container.querySelectorAll<HTMLElement>('.codex-edit-form .ed-field > span, .codex-edit-form .ed-check > span')]
    .map((s) => s.textContent?.trim() ?? '')
    .filter(Boolean);
}

function monte(categoryKey: string, label: string, id: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} label={label} id={id} onClose={() => {}} />); });
}

/** L'atelier ouvert sur une entrée NEUVE (bouton « Nouveau ») — le brouillon ne vient d'aucune entrée. */
function monteNeuf(categoryKey: string, label: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} label={label} isNew onClose={() => {}} />); });
}

/** Le champ nommé `label`, tel que l'écran le porte. */
function champ(label: string): HTMLLabelElement | undefined {
  return [...container.querySelectorAll<HTMLLabelElement>('.codex-edit-form label.ed-field')]
    .find((l) => l.querySelector('span')?.textContent?.trim() === label);
}

const META = metaPourFichier('materials.json');
const UNE_MATIERE = (domaine: string) => materials.find((m) => m.domain === domaine)!;
/** Libellés des clés qui appartiennent aux AUTRES cas — ce qu'un formulaire juste ne montre jamais. */
function libellesEtrangers(domaine: string): string[] {
  const charge = chargeDiscriminee('materials.json', UNE_MATIERE(domaine) as unknown as Record<string, unknown>)!;
  return charge.toutes.filter((k) => !charge.duCas.includes(k)).map((k) => libelleDuChamp(k, { meta: META }));
}

describe('atelier du Codex — charge du CAS d’un document discriminé (#1686)', () => {
  it('une matière de DÉCOR n’édite aucun champ de toiture ni de relief', () => {
    const m = UNE_MATIERE('prop');
    monte('materials', m.label, m.id);
    const presentes = champsPresentes();
    expect(presentes, 'la charge du domaine n’est pas montée — le formulaire ne mesure rien').toContain('Couleur');
    const etrangers = libellesEtrangers('prop');
    // 22 = les 25 clés de charge DÉCLARÉES du document moins les 3 du domaine `prop` (la sonde du juge
    // en comptait 21 : elle mesurait l'union OBSERVÉE des entrées, où `couverture` n'apparaît pas).
    expect(etrangers.length, 'le témoin d’étrangers est vide — la mesure ne prouverait rien').toBe(22);
    expect(presentes.filter((l) => etrangers.includes(l))).toEqual([]);
  });

  it('le DOMAINE se choisit dans un `select` dont les options portent les libellés du def', () => {
    const m = UNE_MATIERE('roof');
    monte('materials', m.label, m.id);
    const select = champ('Domaine')?.querySelector('select');
    expect(select, 'le champ discriminant n’est pas un choix borné').toBeTruthy();
    expect([...select!.options].map((o) => o.textContent)).toEqual(['Décor', 'Toiture', 'Relief']);
    expect(select!.value).toBe('roof');
  });

  it('changer le DOMAINE au formulaire change les champs présentés (la charge suit le cas)', () => {
    const m = UNE_MATIERE('relief');
    monte('materials', m.label, m.id);
    expect(champsPresentes()).toContain('Couleur de face');
    const select = champ('Domaine')!.querySelector('select')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(select, 'prop');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const presentes = champsPresentes();
    expect(presentes).toContain('Couleur');
    expect(presentes, 'un champ de relief survit au changement de domaine').not.toContain('Couleur de face');
  });

  it('CRÉATION — le brouillon porte ce que le def détermine : `type` posé et FIGÉ, domaine à la 1re valeur, charge du seul cas', () => {
    monteNeuf('materials', 'Nouvelle matière');
    // Le `type` d'enveloppe est un `z.literal` du def : pré-rempli et non saisissable (un champ vide
    // qu'il faut deviner, ou ouvert à la frappe, est une affordance qui ment).
    const type = champ(libelleDuChamp('type', { meta: META }))?.querySelector('input');
    expect(type, 'le champ de type d’enveloppe n’est pas monté').toBeTruthy();
    expect(type!.value).toBe('materials');
    expect(type!.readOnly, 'le type d’enveloppe se saisit encore à la main').toBe(true);
    // Le `select` affiche « Décor » : l'ÉTAT le porte, donc le save le prend et les champs suivent.
    const select = champ('Domaine')!.querySelector('select')!;
    expect(select.value).toBe('prop');
    const presentes = champsPresentes();
    expect(presentes, 'la charge du domaine n’est pas montée').toContain('Couleur');
    expect(presentes.filter((l) => libellesEtrangers('prop').includes(l)), 'la création empile les champs des autres domaines').toEqual([]);
  });

  it('TÉMOIN — un document sans `chargeParDiscriminant` DÉCLARÉ garde l’union : l’Incident de Tir édite les deux bornes d100', () => {
    // `oups.json` partitionne ses entrées par refine (un `misfire` ne porte NI min NI max, defs/oups.ts)
    // sans DÉCLARER sa charge par cas : l'atelier lui présente donc l'union — les deux bornes que son
    // schéma REFUSE au save. C'est ce que le mécanisme retire aux documents qui déclarent, et ce témoin
    // le tient à l'écran : le jour où `oups` déclare, il rougit ici et le stock ci-dessous décroît.
    const misfire = oups.find((o) => o.kind === 'misfire')!;
    monte('oups', misfire.label, misfire.id);
    const presentes = champsPresentes();
    expect(presentes, 'le formulaire de l’Incident de Tir n’est pas monté — le témoin ne mesure rien').toContain('Effet mécanique');
    expect(presentes).toContain(libelleDuChamp('min', { meta: metaPourFichier('oups.json') }));
    expect(presentes).toContain(libelleDuChamp('max', { meta: metaPourFichier('oups.json') }));
    expect(chargeDiscriminee('oups.json', misfire as unknown as Record<string, unknown>)).toBeUndefined();
    // Une valeur INCONNUE du discriminant ne fabrique pas une charge : l'union reprend (saisie en cours).
    expect(chargeDiscriminee('materials.json', { domain: 'inconnu' })).toBeUndefined();
  });
});

/**
 * CLIQUET DÉCROISSANT du champ ÉTRANGER : aucune catégorie éditable ne doit présenter, sur une de ses
 * entrées, un champ que le SCHÉMA du document refuserait sur cette entrée-là.
 *
 * La mesure est DÉRIVÉE, jamais récitée : pour chaque catégorie de dataset-liste éditable (`CODEX` ×
 * `editableDataset`), les champs présentés sont ceux de l'atelier (`inferFields` moins les éditeurs
 * dédiés, moins ce que `chargeDiscriminee` retranche), et un champ compte ÉTRANGER quand l'entrée
 * parse SEULE mais ne parse PLUS une fois ce champ posé avec une valeur RÉELLE, prise à une autre
 * entrée du même document. C'est exactement la pathologie de `materials` avant ce lot : un formulaire
 * qui offre ce que le save refuse. Les entrées sont dédupliquées par SIGNATURE de clés (deux entrées
 * aux mêmes clés présentent le même formulaire) et les documents sans schéma-tableau sont hors mesure.
 */
describe('cliquet — champs ÉTRANGERS présentés par les catégories éditables', () => {
  /** Par catégorie, le PIRE nombre de champs étrangers présentés sur une de ses entrées. Stock
   *  NOMINATIF et DÉCROISSANT : il ne baisse qu'en déclarant la charge par cas du document fautif. */
  const STOCK: Record<string, number> = {
    // Chacun partitionne ses entrées par REFINE sans DÉCLARER sa charge par cas — la clé fautive est
    // MESURÉE par la sonde ci-dessous, elle est ici pour se lire :
    activities: 3, // `recuperer` : `stake`/`stakeForm`/`rule` (enjeu et règle optionnelle d'un autre cas d'activité)
    oups: 2, // Incident de Tir : `min`/`max`, les bornes d100 d'une bande de table (defs/oups.ts)
    reglesOptionnelles: 2, // règle à BANDES : `min`/`max` d'une autre forme de valeur par défaut
    structures: 1, // `porte` : `occulte`, drapeau d'un mur
  };

  it('le stock des catégories qui présentent un champ étranger est celui déclaré, et il DÉCROÎT', () => {
    const mesure: Record<string, number> = {};
    for (const cat of CODEX) {
      if (editableObjectDataset(cat.key)) continue;
      const dsKey = editableDataset(cat.key);
      if (!dsKey) continue;
      const fichier = datasetFile(dsKey);
      const schema = schemaForFile(fichier);
      const entrees = datasetArray(dsKey) as unknown as Record<string, unknown>[];
      if (!schema || !entrees.length || !schema.safeParse([entrees[0]]).success) continue; // racine non-liste : hors mesure
      const dedies = dedicatedFieldKeys(cat.key);
      const champs = inferFields(entrees, { meta: metaPourFichier(fichier) }).map((f) => f.key).filter((k) => !dedies.has(k));
      const donneur = new Map<string, unknown>();
      for (const k of champs) for (const e of entrees) if (e[k] != null && !donneur.has(k)) donneur.set(k, e[k]);
      const vues = new Set<string>();
      let pire = 0;
      for (const e of entrees) {
        const signature = Object.keys(e).sort().join('|');
        if (vues.has(signature)) continue;
        vues.add(signature);
        const charge = chargeDiscriminee(fichier, e);
        const presentes = champs.filter((k) => !charge || k === charge.champ || charge.duCas.includes(k) || !charge.toutes.includes(k));
        let etrangers = 0;
        for (const k of presentes) {
          if (e[k] !== undefined || !donneur.has(k)) continue;
          if (!schema.safeParse([{ ...e, [k]: donneur.get(k) }]).success) etrangers++;
        }
        if (etrangers > pire) pire = etrangers;
      }
      if (pire > 0) mesure[cat.key] = pire;
    }
    expect(mesure, 'une catégorie présente un champ que son schéma refuse : déclarer sa charge par cas (`chargeParDiscriminant`) — ou, si le stock BAISSE, retirer sa ligne').toEqual(STOCK);
    expect(mesure.materials, '`materials` a repris des champs étrangers').toBeUndefined();
  }, 120_000);
});
