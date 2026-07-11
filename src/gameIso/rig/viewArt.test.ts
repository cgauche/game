import { describe, it, expect } from 'vitest';
import { declaredViews, foldView, pickView, type ViewArt } from './viewArt';

const full: ViewArt = { front: () => 'F', profile: () => 'P', back: () => 'B' };
const profileOnly: ViewArt = { profile: () => 'P' };
const frontBack: ViewArt = { front: () => 'F', back: () => 'B' };

describe('viewArt — contrat PARTAGÉ des arts orientés', () => {
  it('declaredViews : couverture réelle dans l’ordre canon (face, profil, dos)', () => {
    expect(declaredViews(full)).toEqual(['front', 'profile', 'back']);
    expect(declaredViews(profileOnly)).toEqual(['profile']);
    expect(declaredViews(frontBack)).toEqual(['front', 'back']);
  });

  it('foldView : mono-vue → toute vue demandée replie sur la seule déclarée', () => {
    expect(foldView(profileOnly, 'front')).toBe('profile');
    expect(foldView(profileOnly, 'back')).toBe('profile');
    expect(foldView(profileOnly, 'profile')).toBe('profile');
  });

  it('foldView : le profil est mitoyen ; face↔dos passent par lui d’abord', () => {
    expect(foldView(frontBack, 'profile')).toBe('front'); // profil absent → 1re déclarée (face)
    expect(foldView(full, 'back')).toBe('back'); // déclarée → elle-même
  });

  it('pickView : renvoie la fonction de la vue repliée', () => {
    expect(pickView(profileOnly, 'front')()).toBe('P');
    expect(pickView(full, 'back')()).toBe('B');
  });

  it('foldView : art sans aucune vue = erreur de donnée (lève)', () => {
    expect(() => foldView({}, 'front')).toThrow();
  });
});
