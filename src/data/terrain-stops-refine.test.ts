/**
 * CONTRAT du REFINE D'ORDRE des arrêts de rampe des terrains (#1690) — `schemas/defs/terrains.ts`.
 *
 * Un `<linearGradient>` SVG lit ses `<stop>` dans l'ordre d'ÉMISSION et CLAMPE un offset qui recule
 * sur son prédécesseur : l'arrêt écrit hors ordre ne peint rien, et rien ne le dit. Ce que ce fichier
 * tient : le refus MORD au PARSE, et il NOMME le terrain et ses offsets — sans quoi rien ne
 * distinguerait un refine vivant d'un refine mort, la donnée committée étant conforme.
 *
 * Les fautes sont injectées dans une COPIE du dataset réel, jamais dans le fichier.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema } from './schemas/defs/terrains';

type Entree = { id: string; stops: Record<string, string> };

const charger = (): Entree[] => JSON.parse(readFileSync(fileURLToPath(new URL('./terrains.json', import.meta.url)), 'utf8'));

/** Parse une copie du dataset après y avoir injecté une faute ; rend les messages de refus. */
function refus(saboter: (dataset: Entree[]) => void): string[] {
  const dataset = charger();
  saboter(dataset);
  const r = schema.safeParse(dataset);
  return r.success ? [] : r.error.issues.map((i) => `${i.code} @${i.path.join('.')} : ${i.message}`);
}

describe('rampe des terrains — l’ordre des arrêts est REFUSÉ au parse quand il recule (#1690)', () => {
  it('le dataset COMMITTÉ passe : la sonde ne mesure pas un refus permanent', () => {
    expect(refus(() => {}), 'terrains.json refusé À VIDE : les cas ci-dessous ne prouveraient plus rien.').toEqual([]);
  });

  it('une rampe à TROIS arrêts porte son intermédiaire au milieu — sans quoi les cas ci-dessous seraient vides', () => {
    const multi = charger().filter((t) => Object.keys(t.stops).length > 2);
    expect(multi.length, 'plus aucune rampe à plus de deux arrêts : le cas de l’arrêt intermédiaire n’est plus exercé.').toBeGreaterThan(0);
  });

  it('un Record écrit À L’ENVERS est refusé, en citant le terrain et ses offsets', () => {
    const messages = refus((dataset) => {
      const t = dataset[0];
      t.stops = Object.fromEntries(Object.entries(t.stops).reverse());
    });
    const id = charger()[0].id;
    expect(messages.length, `l’ordre inversé de « ${id} » n’a levé AUCUN refus.`).toBe(1);
    expect(messages[0], 'le refus ne cite pas le champ fautif.').toContain('@0.stops');
    expect(messages[0], 'le refus ne NOMME pas le terrain fautif.').toContain(`terrain « ${id} »`);
    expect(messages[0], 'le refus ne dit pas quels offsets sont écrits, ni dans quel ordre.').toMatch(/100% → 0%/);
    expect(messages[0]).toContain('STRICTEMENT plus grand que le précédent');
  });

  it('un arrêt INTERMÉDIAIRE rejeté en fin de Record est refusé (l’arrêt inerte de la rampe à 3 crans)', () => {
    const multi = charger().find((t) => Object.keys(t.stops).length > 2)!;
    const messages = refus((dataset) => {
      const t = dataset.find((x) => x.id === multi.id)!;
      const [premier, milieu, dernier] = Object.entries(t.stops);
      t.stops = Object.fromEntries([premier, dernier, milieu]);
    });
    expect(messages.length, `« ${multi.id} » : un arrêt intermédiaire rejeté en fin de rampe n’a levé AUCUN refus.`).toBe(1);
    expect(messages[0]).toContain(`terrain « ${multi.id} »`);
  });

  it('les rampes CROISSANTES du dataset passent une à une : le refine ne mord pas au hasard', () => {
    for (const t of charger()) {
      const messages = refus((dataset) => {
        const e = dataset.find((x) => x.id === t.id)!;
        e.stops = { ...e.stops };
      });
      expect(messages, `« ${t.id} » : rampe conforme refusée.`).toEqual([]);
    }
  });
});
