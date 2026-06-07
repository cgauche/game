import { describe, it, expect } from 'vitest';
import {
  resolveSpiderFromProps, spiderIdle, spiderRush, SPIDER_REST, SPIDER_DEATH, SPIDER_DEFAULT,
} from './composeSpider';

describe('gabarit arachnide', () => {
  it('résout abdomen (derrière) puis corps, avec 8 pattes + yeux + chélicères', () => {
    const bones = resolveSpiderFromProps(SPIDER_DEFAULT, 'front', {});
    expect(bones.map((b) => b.id)).toEqual(['abdomen', 'corps']); // z : abdomen derrière
    const corps = bones.find((b) => b.id === 'corps')!.parts[0].svg;
    expect((corps.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(16); // 8 pattes × (trait + ombre)
    expect(corps).toContain('#9a1818'); // yeux rougeoyants
  });

  it('recolor : colors.corps change le markup', () => {
    const a = JSON.stringify(resolveSpiderFromProps(SPIDER_DEFAULT, 'front', {}));
    const b = JSON.stringify(resolveSpiderFromProps(SPIDER_DEFAULT, 'front', {}, { corps: '#3a5a2a' }));
    expect(a).not.toEqual(b);
  });

  it('de dos : pas d’yeux (on voit la nuque)', () => {
    const back = resolveSpiderFromProps(SPIDER_DEFAULT, 'back', {}).find((b) => b.id === 'corps')!.parts[0].svg;
    expect(back).not.toContain('#9a1818');
  });

  it('les poses diffèrent (idle pulse, ruée penche le corps, mort sur le dos)', () => {
    expect(spiderIdle(0.25)).not.toEqual(SPIDER_REST);
    expect(spiderRush(0.5).corps).toBeGreaterThan(5);
    expect(SPIDER_DEATH.corps).toBeGreaterThan(90);
  });
});
