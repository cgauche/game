/**
 * CharacterPreview — LA primitive d'aperçu « perso en pied » hors combat (roster, créateur,
 * fiche, marchand…). Rend le rig réel (`RigSprite`) : l'aperçu reflète EXACTEMENT le rendu jeu
 * (mêmes briques que pickBackend, branche rig) — apparence d'état, équipement porté, tenue de
 * carrière, calques de mutations/blessures.
 *
 * Deux entrées exclusives :
 *  - bas niveau : `appearance` (+ `equip`/`career`/`overlays`) — créateur/éditeur, avant qu'un
 *    Combatant n'existe ;
 *  - haut niveau : `hero` (Combatant) — tout est dérivé via les briques canoniques
 *    (combatantAppearance/combatantOverlays/equipFromCombatant).
 *
 * AUCUN `<defs>` local : les gradients du rig (DEFS) sont montés UNE fois au niveau App
 * (GlobalSvgDefs). Tailles et ambiances en CSS (`.charprev`, components.css).
 */
import { memo, useMemo } from 'react';
import type { Combatant } from '../engine/types';
import { RigSprite } from '../gameIso/rig/composeRig';
import { defaultAppearance, type Appearance } from '../gameIso/rig/appearance';
import { equipFromCombatant, type EquipCtx } from '../gameIso/rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../gameIso/rig/parts/combatantVisuals';
import type { RigOverlay } from '../gameIso/rig/bones';
import type { Pose } from '../gameIso/rig/poses';
import type { View } from '../gameIso/rig/facing';

export type CharacterPreviewSize = 'xs' | 'sm' | 'md' | 'lg' | 'fill';
export type CharacterPreviewAmbiance = 'none' | 'panel' | 'parchment' | 'spotlight';

interface CommonProps {
  view?: View;
  pose?: Pose;
  mirror?: boolean;
  /** Hauteur du cadre : xs≈40px … lg≈190px ; `fill` = 100 % du conteneur. */
  size?: CharacterPreviewSize;
  /** Fond du cadre : `panel` (surface), `parchment`/`spotlight` (textures .tx-* d'ornaments.css). */
  ambiance?: CharacterPreviewAmbiance;
  className?: string;
}
interface RawProps extends CommonProps {
  appearance: Appearance;
  equip?: EquipCtx;
  /** Id de garde-robe (tenue OU carrière) — la carrière d'un héros sert de tenue par défaut. */
  career?: string;
  overlays?: RigOverlay[];
  hero?: undefined;
}
interface HeroProps extends CommonProps {
  /** Sur-couche pratique : tout (apparence/équipement/tenue/calques) est dérivé du Combatant. */
  hero: Combatant;
  appearance?: undefined;
  equip?: undefined;
  career?: undefined;
  overlays?: undefined;
}
export type CharacterPreviewProps = RawProps | HeroProps;

const EMPTY_EQUIP: EquipCtx = { weapons: [], armour: [] };

const AMBIANCE_CLASS: Record<CharacterPreviewAmbiance, string> = {
  none: '',
  panel: 'charprev-amb-panel',
  parchment: 'charprev-amb-parchment tx-parchment',
  spotlight: 'charprev-amb-spotlight tx-ink',
};

function CharacterPreviewBase(props: CharacterPreviewProps) {
  const { view = 'front', pose, mirror = false, size = 'md', ambiance = 'none', className, hero } = props;
  // Dérivation « héros » = MÊMES briques que le rendu jeu (cf. pickBackend, branche rig).
  const appearance = useMemo(
    () => (hero ? combatantAppearance(hero.appearance ?? defaultAppearance(hero), hero) : props.appearance),
    [hero, props.appearance],
  );
  const equip = useMemo(() => (hero ? equipFromCombatant(hero) : props.equip ?? EMPTY_EQUIP), [hero, props.equip]);
  const overlays = useMemo(() => (hero ? combatantOverlays(hero) : props.overlays), [hero, props.overlays]);
  const career = hero ? hero.career : props.career; // id de garde-robe (carrière), jamais un libellé
  // Résolution du rig mémoïsée (rendu en listes de 8-15) : mêmes entrées → même élément, React saute le sous-arbre.
  const sprite = useMemo(
    () => <RigSprite appearance={appearance} equip={equip} pose={pose} career={career} view={view} overlays={overlays} mirror={mirror} />,
    [appearance, equip, pose, career, view, overlays, mirror],
  );
  const cls = ['charprev', `charprev-${size}`, AMBIANCE_CLASS[ambiance], className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <svg className="charprev-svg" viewBox="0 0 120 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        {sprite}
      </svg>
    </div>
  );
}

export const CharacterPreview = memo(CharacterPreviewBase);
