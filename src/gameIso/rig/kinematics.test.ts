import { describe, it, expect } from 'vitest';
import { translate, rotate, mul, apply, worldTransforms } from './kinematics';
import type { Skeleton } from './bones';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('affine', () => {
  it('translate déplace un point', () => {
    const p = apply(translate(10, 5), { x: 0, y: 0 });
    close(p.x, 10); close(p.y, 5);
  });
  it('rotate 90° envoie (1,0) sur (0,1)', () => {
    const p = apply(rotate(90), { x: 1, y: 0 });
    close(p.x, 0); close(p.y, 1);
  });
  it('mul compose dans l’ordre parent∘local', () => {
    // translate puis rotate : on tourne d'abord, puis on translate
    const m = mul(translate(10, 0), rotate(90));
    const p = apply(m, { x: 1, y: 0 });
    close(p.x, 10); close(p.y, 1);
  });
});

describe('worldTransforms', () => {
  // squelette synthétique à 2 os pour vérifier la composition.
  const sk = {
    a: { id: 'a', parent: null, pivot: { x: 10, y: 0 }, length: 0, thickness: 0, angle: 0, z: 0 },
    b: { id: 'b', parent: 'a', pivot: { x: 0, y: 5 }, length: 0, thickness: 0, angle: 90, z: 0 },
  } as unknown as Skeleton;

  it('origine d’un os enfant = transform monde composé', () => {
    const w = worldTransforms(sk, {});
    // a : translate(10,0). b : a ∘ translate(0,5) ∘ rotate(90). origine de b = (10,5).
    const ob = apply(w['b' as keyof typeof w], { x: 0, y: 0 });
    close(ob.x, 10); close(ob.y, 5);
    // un point (1,0) dans b subit rotate(90) → (0,1), puis +(10,5) = (10,6).
    const pb = apply(w['b' as keyof typeof w], { x: 1, y: 0 });
    close(pb.x, 10); close(pb.y, 6);
  });
});
