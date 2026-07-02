import { ICON_DEFS } from './icons';
import type { IconId } from './icons';

/* Primitive d'icône UI (LOT 4 — remplace les emojis d'affordance). Rend le fragment SVG du
   registre src/ui/icons/ dans un viewBox 24×24 qui hérite la couleur du texte (currentColor). */

const SIZES = { sm: 14, md: 18, lg: 24 } as const;

export function Icon({ id, size = 'md', className }: { id: IconId; size?: number | keyof typeof SIZES; className?: string }) {
  const def = ICON_DEFS[id];
  if (!def) {
    // `?.` : import.meta.env n'existe pas sous tsx (scripts de galerie SSR).
    if (import.meta.env?.DEV) throw new Error(`Icône inconnue : « ${id} » — déposer une def dans src/ui/icons/defs/ puis \`npm run gen\`.`);
    return null;
  }
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width={px}
      height={px}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: def.svg }}
    />
  );
}
