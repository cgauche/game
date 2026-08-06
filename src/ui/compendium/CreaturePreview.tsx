/**
 * Aperçu RENDU d'une créature depuis sa donnée (nom + apparence) — face + profil. Rendu par le
 * MÊME chemin que le jeu (entityRigProfile/resolveRig pour les bipèdes, gabarit pour les non-bipèdes)
 * → l'aperçu reflète EXACTEMENT ce qu'affichera le jeu. Recomputé à chaque changement d'apparence :
 * dans l'éditeur, on voit en DIRECT le résultat de la modification.
 */
import { useMemo } from 'react';
import { entityRigProfile } from '../../gameIso/rig/enemyProfile';
import { resolveRig } from '../../gameIso/rig/composeRig';
import { bonesToSvg } from '../../gameIso/rig/renderBones';
import { resolveRender, planById, planOptsForRecord } from '../../gameIso/rig/bodyPlan';
import { hashSeed } from '../../engine/dice';
import { findCreatureById } from '../../data';
import type { View } from '../../gameIso/rig/facing';
import type { EntityAppearance } from '../../engine/authoringAppearance';

// `name` = id de créature (Codex/bestiaire) OU libellé d'espèce/race (la résolution lit l'espèce
// explicite de l'apparence ; les Nuées tirent leur trait du record par id).
function rigSvg(name: string, a: EntityAppearance | undefined, view: View): string {
  const seed = a?.seed ?? hashSeed(name);
  const r = resolveRender(a?.species, findCreatureById(name)?.traits, name);
  if (r.kind === 'rig') {
    const p = entityRigProfile(name, seed, {
      species: a?.species, tenue: a?.tenue, monster: a?.monster, features: a?.features,
      colors: a?.colors, parts: a?.parts, sex: a?.sex, build: a?.build, eyes: a?.eyes,
    });
    return p ? bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, view, [])) : '';
  }
  const plan = planById(r.plan);
  if (!plan) return '';
  if (!plan.hasView(r.species, view)) return '';
  return bonesToSvg(plan.resolve(r.species, view, plan.restPose(), planOptsForRecord(name, a)));
}

export function CreaturePreview({ label, appearance }: { label: string; appearance?: EntityAppearance }) {
  const key = JSON.stringify(appearance ?? {});
  const views = useMemo(
    () => (['front', 'profile'] as View[]).map((v) => ({ v, svg: rigSvg(label, appearance, v) })),
    [label, key], // re-rend à CHAQUE édition d'apparence
  );
  return (
    <div className="creature-preview">
      {views.map(({ v, svg }) => (
        <svg key={v} viewBox="0 0 120 150" className="creature-preview-svg" aria-label={`${label} (${v})`}>
          <g dangerouslySetInnerHTML={{ __html: svg }} />
        </svg>
      ))}
    </div>
  );
}
