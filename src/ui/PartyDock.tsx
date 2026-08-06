import { useGame } from '../state/store';
import { PortraitTile } from './PortraitTile';
import { HERO_RING } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/** Dock de compagnie composé de portraits complets, sans identité de tour, avec empilement contextuel de fiche. */
export type PartyDockProps = {
  heroes: Combatant[];
  targeting?: boolean;
  onOpen: (id: string) => void;
};

export function PartyDock({ heroes, targeting, onOpen }: PartyDockProps) {
  const sheetOpen = useGame((s) => s.sheetId != null);
  return (
    <div className="party-dock" style={sheetOpen ? { zIndex: 126 } : undefined}>
      {heroes.map((c, idx) => (
        <PortraitTile
          key={c.id}
          c={c}
          ring={HERO_RING[idx % HERO_RING.length]}
          team="ally"
          variant="full"
          size="md"
          onClick={() => onOpen(c.id)}
          title={targeting ? `${c.label} — cibler` : `${c.label} — fiche du personnage`}
        />
      ))}
    </div>
  );
}
