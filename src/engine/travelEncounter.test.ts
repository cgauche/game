import { describe, it, expect } from 'vitest';
import { stageEncounterCategory } from './travelEncounter';
import type { TravelActivityResult } from './activities';

const r = (p: Partial<TravelActivityResult>): TravelActivityResult =>
  ({ activityId: 'x', actorId: 'h', sl: 0, success: true, ops: [], extenue: false, roll: 50, ...p });

describe('stageEncounterCategory (EDOC 8 — déclencheur par qualité de DR)', () => {
  it('aucun testeur (Activités sans Test) → aucune Rencontre', () => {
    expect(stageEncounterCategory([r({ roll: undefined })])).toBeNull();
    expect(stageEncounterCategory([])).toBeNull();
  });

  it('Succès Impressionnant (DR ≥ +4) → positives (l.188), prioritaire sur un échec', () => {
    expect(stageEncounterCategory([r({ success: true, sl: 4 })])).toBe('positives');
    expect(stageEncounterCategory([r({ success: true, sl: 6 })])).toBe('positives');
    // Un Succès Impressionnant l'emporte même si un autre héros échoue.
    expect(stageEncounterCategory([r({ success: true, sl: 5 }), r({ success: false, sl: -3 })])).toBe('positives');
  });

  it('majorité des testeurs échouent → dangereuses (l.221)', () => {
    expect(stageEncounterCategory([r({ success: false, sl: -2 })])).toBe('dangereuses'); // solo qui rate
    expect(stageEncounterCategory([r({ success: false, sl: -2 }), r({ success: false, sl: -1 }), r({ success: true, sl: 2 })])).toBe('dangereuses');
  });

  it('minorité d’échecs (sans Succès Impressionnant) → fortuites (l.203)', () => {
    expect(stageEncounterCategory([r({ success: false, sl: -5 }), r({ success: true, sl: 2 }), r({ success: true, sl: 3 })])).toBe('fortuites');
  });

  it('tous réussissent sans éclat → aucune Rencontre (voyage calme)', () => {
    expect(stageEncounterCategory([r({ success: true, sl: 2 }), r({ success: true, sl: 1 })])).toBeNull();
  });
});
