import { PortraitTile } from './PortraitTile';
import { HERO_RING } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Dock d'ÉQUIPE (bord gauche, façon BG3) — remplace le panneau Groupe dans les DEUX modes.
 * Une tuile-portrait par héros : cadre = couleur d'IDENTITÉ (HERO_RING, cohérente avec les anneaux
 * du champ), PV chiffrés DANS le portrait, états à droite ; tap = fiche perso (CharacterSheet).
 * En combat, passer la version « vivante » des héros (battle.combatants). Pur à props.
 */
export function PartyDock({ heroes, activeId, onOpen }: {
  heroes: Combatant[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="party-dock">
      {heroes.map((c, idx) => (
        <PortraitTile
          key={c.id}
          c={c}
          ring={HERO_RING[idx % HERO_RING.length]}
          size={56}
          active={c.id === activeId}
          showPv
          onClick={() => onOpen(c.id)}
          title={`${c.name} — fiche du personnage`}
        />
      ))}
    </div>
  );
}
