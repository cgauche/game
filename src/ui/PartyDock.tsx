import { useGame } from '../state/store';
import { PortraitTile } from './PortraitTile';
import { HERO_RING } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Dock d'ÉQUIPE (bord gauche, façon BG3) — remplace le panneau Groupe dans les DEUX modes.
 * Une tuile-portrait par héros : cadre = couleur d'IDENTITÉ (HERO_RING, cohérente avec les anneaux
 * du champ), PV chiffrés DANS le portrait, états à droite ; tap = fiche perso (CharacterSheet).
 * En combat, passer la version « vivante » des héros (battle.combatants). Pur à props, à UNE
 * exception : la fiche perso (`CharacterSheet`, `.sheet-overlay` z-index 125, panneau de référence
 * PASSIF) couvre normalement le dock (z-index 45, hud.css) — le switch de héros SANS refermer la
 * fiche exige le dock au-dessus tant qu'elle est montée (#492 arbitrage 2026-07-17 pt.2, verbatim :
 * « la compagnie […] est en haut et ne change jamais de place »). Élever `.party-dock` dans hud.css
 * globalement toucherait un module hors du lot ; lire `sheetId` ICI (z-index inline CONTEXTUEL,
 * jamais un hex/token) reste sous la modale ACTIVE (jet, 130) : un jet lancé depuis la fiche prime
 * toujours sur le dock. */
export function PartyDock({ heroes, activeId, targeting, onOpen }: {
  heroes: Combatant[];
  activeId: string | null;
  /** Action de CIBLAGE en cours (#21) : le clic sur une tuile CIBLE ce héros (titre adapté). */
  targeting?: boolean;
  onOpen: (id: string) => void;
}) {
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
          active={c.id === activeId}
          onClick={() => onOpen(c.id)}
          title={targeting ? `${c.label} — cibler` : `${c.label} — fiche du personnage`}
        />
      ))}
    </div>
  );
}
