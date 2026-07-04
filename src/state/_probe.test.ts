import { describe, it } from 'vitest';
import { writeFileSync, appendFileSync } from 'fs';
import { useGame } from './store';
const OUT = 'C:/Users/gauch/AppData/Local/Temp/claude/probe-result.txt';
writeFileSync(OUT, '');
const rec = (s: string) => appendFileSync(OUT, s + '\n');
import { seedBattleRng } from './battleRng';
import { emptyScene, Scene } from './scene';
import { WorldMap } from './worldMap';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, ItemInstance } from '../engine/types';

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', trappingId: 'ration', kind: 'misc', qualities: [], enc: 0, equipped: false });
const hero = (p: Partial<Combatant> = {}): Combatant => ({
  id: 'h', name: 'Hilda', kind: 'hero',
  characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);
function sceneA(): Scene { const s = emptyScene(10, 10); s.id = 'lieu-a-scene'; s.nom = 'A'; return s; }
function sceneB(): Scene { const s = emptyScene(10, 10); s.id = 'lieu-b-scene'; s.nom = 'B'; return s; }
function map(rp: Partial<WorldMap['routes'][0]> = {}): WorldMap {
  return { id: 'c', nom: 'c', places: [
    { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
    { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
  ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 12, modes: ['pied'], perilDie: 0, ...rp }] };
}
function setup(wm: WorldMap, party: Combatant[]) {
  useGame.setState({ party });
  useGame.getState().loadProject([sceneA(), sceneB()], 'lieu-a-scene', wm);
}

describe('PROBE inline', () => {
  it('activities forage', () => {
    setRule('travel-etapes', true);
    seedBattleRng(3);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    rec(['ACT scene', st.scene?.id, 'ration', (st.party[0].items ?? []).length].join(" "));
    rec(['ACT journal', JSON.stringify(st.journal.filter((l) => /Approvisionnement|ration|Météo/.test(l)))].join(" "));
    resetRule('travel-etapes');
  });

  it('exposure', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    for (let s = 1; s <= 8; s++) {
      seedBattleRng(s);
      const h = hero({ travelRole: 'recuperer' });
      setup(map({ km: 12, perilDie: 0 }), [h]);
      useGame.getState().startTravel('r1', 'pied');
      const st = useGame.getState();
      const j = st.journal.filter((l) => /Exposition de fin/.test(l));
      if (j.length) rec(['EXPO seed', s, 'wounds', st.party[0].wounds.current, 'cond', JSON.stringify(st.party[0].conditions), JSON.stringify(j)].join(' '));
    }
    resetRule('travel-etapes');
    resetRule('travel-attraper-froid');
  });

  it('peril ereintant', () => {
    seedBattleRng(2);
    const h = hero({ items: [ration('r1')], skills: [{ skillId: 'survie-en-exterieur', advances: 0 } as any] });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    // force die by scanning seeds? just log across seeds
    for (let s = 1; s <= 12; s++) {
      seedBattleRng(s);
      const hh = hero({ items: [ration('r1')], skills: [{ skillId: 'survie-en-exterieur', advances: 0 } as any] });
      setup(map({ km: 12, perilDie: 8 }), [hh]);
      useGame.getState().startTravel('r1', 'pied');
      const j = useGame.getState().journal.filter((l) => /Péripétie de voyage|Survie|Perception|Exténué|détour/.test(l));
      if (j.length) rec(['PERIL seed', s, JSON.stringify(j)].join(" "));
    }
  });
});
