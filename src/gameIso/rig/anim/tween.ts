export type Easing = 'linear' | 'easeOut' | 'easeInOut' | 'easeOutBack';

export function ease(e: Easing, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  switch (e) {
    case 'linear':
      return x;
    case 'easeOut':
      return 1 - (1 - x) * (1 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
  }
}
