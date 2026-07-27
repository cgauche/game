import { describe, it, expect } from 'vitest';
import { categoryByKey, type CodexItem, type CodexRow } from './registry';

/** Lignes de la section « Niveau N : … » de l'onglet Progression d'une Carrière. */
const levelRows = (item: CodexItem, levelPrefix: string): CodexRow[] => {
  const prog = item.tabs?.find((t) => t.title === 'Progression');
  const section = prog?.sections.find((s) => s.title.startsWith(levelPrefix));
  return section?.rows ?? [];
};

describe('Codex registry — Possessions de Niveau de Carrière : réf STRUCTURÉE, jamais un libellé re-résolu (#904)', () => {
  it('Umbramancien N3 (Gardien Gris) : {creatureId} lie le bestiaire, {id} lie les Possessions, {text} reste du texte', () => {
    const item = categoryByKey('careers')!.items.find((i) => i.label === 'Umbramancien')!;
    const rows = levelRows(item, 'Niveau 3');
    expect(rows.length).toBeGreaterThan(0);

    const creatureRow = rows.find((r) => r.t === 'ref' && r.category === 'creatures');
    expect(creatureRow).toMatchObject({ t: 'ref', category: 'creatures', id: 'cheval-de-guerre-leger' });

    const trappingRow = rows.find((r) => r.t === 'ref' && r.category === 'trappings');
    expect(trappingRow).toMatchObject({ t: 'ref', category: 'trappings', id: 'robe-de-sorcier-ordinaire' });

    const textRow = rows.find((r) => r.t === 'text' && r.text === 'Apprenti');
    expect(textRow).toBeTruthy();
  });

  it('Bourgeois N3 (Conseiller municipal) : {vehicleId} lie les Véhicules', () => {
    const item = categoryByKey('careers')!.items.find((i) => i.label === 'Bourgeois')!;
    const rows = levelRows(item, 'Niveau 3');
    const vehicleRow = rows.find((r) => r.t === 'ref' && r.category === 'vehicles');
    expect(vehicleRow).toMatchObject({ t: 'ref', category: 'vehicles', id: 'diligence' });
  });
});
