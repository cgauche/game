import React from 'react';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER, type BoneId, type Slot, type RigOverlay } from './bones';
import { baseSkeleton, applyBuild, referenceSkeleton, groundSkeleton, profileNarrow, baseSpeciesOf } from './skeletons';
import { bipedDef } from './creatures';
import { gabaritById } from './gabarits';
import { raceById, racePalette } from './races';
import type { RaceFeature } from './races';
import { worldTransforms, toSvg, type Matrix } from './kinematics';
import { addPose, type Pose } from './poses';
import type { Appearance } from './appearance';
import { resolveParts } from './parts/resolve';
import { applyEyes, eyesArtFromKeys } from './parts/eyes';
import { feat as catalogFeatures } from './parts/elements';
import { pickView } from './parts/types';
import { monsterInjection } from './parts/monstrous';
import { HEADS, ARMS, LEGS } from './parts/monster';
import { buildTokenMap, applyTokenMap, type Palette } from './palette';
import { tenuePaletteFor } from './parts/career';
import type { EquipCtx } from './parts/equipment';
import { dorsalOverlays } from './parts/dorsal';
import { CAPE_ART } from './parts/cape';
import type { View } from './facing';
import { VIEW_POSE } from './viewPose';

/** Convertit une RaceFeature en part d'os.
 *  'bone' (défaut) = telle quelle : l'os l'échelonne automatiquement via son transform scale.
 *  'fixed' = enveloppe d'échelle inverse pour annuler l'échelle de l'os (taille constante). */
export function featureToPart(f: RaceFeature, boneScale: [number, number]): { svg: string; layer: number } {
  const layer = f.layer ?? 50;
  if (f.scale === 'fixed' && (Math.abs(boneScale[0] - 1) > 1e-4 || Math.abs(boneScale[1] - 1) > 1e-4)) {
    const inv = `<g transform="scale(${(1 / boneScale[0]).toFixed(4)},${(1 / boneScale[1]).toFixed(4)})">${f.svg}</g>`;
    return { svg: inv, layer };
  }
  return { svg: f.svg, layer };
}

export interface ResolvedBone {
  id: string; // BoneId (bipède) OU os d'un autre gabarit (quadrupède…) — forme partagée cross-plan
  matrix: Matrix;
  /** échelle de rendu de la part (thickness/réf, length/réf) — morpho + gabarit d'espèce. */
  scale: [number, number];
  z: number;
  parts: { svg: string; layer: number; mirror?: boolean }[];
}

/** (apparence, équipement, pose, tenue?) → os résolus, triés z croissant (peintre). PUR. */
export function resolveRig(
  appearance: Appearance,
  equip: EquipCtx,
  pose: Pose,
  tenue?: string,
  view: View = 'front',
  overlays: RigOverlay[] = [],
  mirror = false,
): ResolvedBone[] {
  // Race de rendu : le def bipède de l'espèce peut IMPOSER sa race (Vermine de choc → Skaven,
  // Fimir → Fimir…) ; sinon heuristique de nom (variantes régionales → espèce de base).
  const bDef = bipedDef(appearance.species);
  const race = raceById(bDef?.race ?? baseSpeciesOf(appearance.species));
  // appearance.gabarit explicite = remplacement COMPLET de la carrure ; le gabaritOverride
  // de la race (réglé pour son gabarit par défaut) ne s'applique PAS dans ce cas.
  let gDef = appearance.gabarit
    ? gabaritById(appearance.gabarit)
    : { ...gabaritById(race.gabarit), ...(race.gabaritOverride ?? {}) };
  // Mutation morpho « Court sur pattes » : multiplicateur de jambes composé sur le gabarit.
  if (appearance.legs) gDef = { ...gDef, legs: gDef.legs * appearance.legs };
  let sk = groundSkeleton(applyBuild(baseSkeleton(gDef, appearance.sex), appearance.build));
  if (view === 'profile') sk = profileNarrow(sk); // corps étroit de profil (membres sur l'axe)
  // De profil, le swing du bras DROIT (porteur de l'arme) éloigne la main → l'arme barre le
  // torse. Quand une arme de MÊLÉE est tenue, on annule ce swing pour que le bras pende au
  // côté (l'arme tombe à la verticale). Mêlée seulement : le distance garde sa pose de visée.
  let viewPose = VIEW_POSE[view];
  if (view === 'profile' && equip.weapons?.some((w) => w.type === 'melee')) {
    viewPose = addPose(viewPose, { epauleD: 8, avantBrasD: 6 }); // bras porteur LÉGÈREMENT en avant → arme visible au côté (base profil = -4)
  }
  // Posture de repos PAR ESPÈCE (ex. skaven voûté : torse penché + tête basse). UNIQUEMENT
  // en PROFIL : une rotation du torse en 2D = penché EN AVANT de profil (correct), mais de
  // FACE/DOS elle tilterait tout le corps DE CÔTÉ (« penche à droite »). De face/dos on reste
  // droit (un dos voûté ne se montre pas pile de face en 2D).
  const speciesPose = view === 'profile' ? race.pose ?? {} : {};
  const world = worldTransforms(sk, addPose(speciesPose, addPose(viewPose, pose)));
  const parts = resolveParts(appearance.species, appearance.sex, tenue, equip, appearance.parts ?? {}, appearance.seed ?? 1, view);
  // Yeux personnalisés (œil de verre, Œil énorme, yeux d'animaux…) : remplacés EN PLACE
  // sur l'orbite marquée du visage (cf. parts/eyes.ts — no-op sans marqueur). Les yeux de
  // RACE (Vampire rougeoyant) servent de défaut, l'apparence (mutation/blessure) prime.
  // race.eyes = CLÉS du catalogue d'yeux (résolues en art ici) ; appearance.eyes = art déjà résolu en amont.
  const eyes = race.eyes || appearance.eyes ? { ...eyesArtFromKeys(race.eyes), ...appearance.eyes } : undefined;
  if (eyes && parts.visage?.svg) parts.visage = { svg: applyEyes(parts.visage.svg, eyes) };

  // Échelle de rendu par os = (thickness/réf, length/réf). Os de longueur/épaisseur
  // nulle (arme/bouclier) : hérite du parent. N'affecte PAS la FK (positions des joints).
  const REF = referenceSkeleton();
  const scaleOf = {} as Record<BoneId, [number, number]>;
  for (const id of BONE_IDS) {
    const b = sk[id];
    const r = REF[id];
    const par: [number, number] = b.parent ? scaleOf[b.parent] : [1, 1];
    if (r.thickness <= 0.001 && r.length <= 0.001) {
      // os d'attache (arme/bouclier) : échelle UNIFORME du parent → l'arme ne s'étire pas.
      const u = (par[0] + par[1]) / 2;
      scaleOf[id] = [u, u];
    } else {
      const sx = r.thickness > 0.001 ? b.thickness / r.thickness : par[0];
      const sy = r.length > 0.001 ? b.length / r.length : par[1];
      scaleOf[id] = [sx, sy];
    }
  }

  const boneParts: Record<BoneId, ResolvedBone['parts']> = {} as Record<BoneId, ResolvedBone['parts']>;
  for (const id of BONE_IDS) boneParts[id] = [];

  // Un vampire (monster.cape) garde la robe de carrière mais PAS le couvre-chef de cour
  // (le chapeau de Noble faisait une « couronne » rouge) : on saute le slot `tete` (le
  // visage + les cheveux lissés restent, via leurs propres slots).
  const dropHeadgear = !!appearance.monster?.cape || !!race.dropHeadgear;
  // perso.monster du creature-def = override COMPLET de la race (parts structurelles sautées).
  const hasPersoMonster = !!appearance.monster && Object.keys(appearance.monster).length > 0;
  // Tête de RACE (rat, orc…) — surchargeable par le def créature (perso.head : tête de
  // vache/poulet de la basse-cour SANS perdre queue/fourrure de race). Remplace visage/
  // cheveux mais PAS la coiffe de tenue — un skaven casqué garde sa tête de rat SOUS le
  // casque (corps nu et tenue = axes séparés).
  const raceHeadKey = hasPersoMonster ? undefined : (bDef?.perso?.head ?? race.head);
  const raceHead = raceHeadKey ? HEADS[raceHeadKey] : undefined;
  for (const slot of Object.keys(SLOT_BONES) as Slot[]) {
    if (slot === 'tete' && dropHeadgear) continue;
    if ((slot === 'visage' || slot === 'cheveux') && raceHead) continue;
    const part = parts[slot];
    if (!part || !part.svg) continue;
    // Visage inversé (mutation LDB 19) : le VRAI visage du personnage est retourné tête en bas
    // (flip vertical au centre du visage, y≈7) — cheveux et crâne restent en place.
    const svg = slot === 'visage' && appearance.faceFlip
      ? `<g transform="translate(0,14) scale(1,-1)">${part.svg}</g>`
      : part.svg;
    SLOT_BONES[slot].forEach((bid, idx) => {
      // Le 2e os d'une paire est miroité POUR LA SYMÉTRIE DE FACE/DOS. En PROFIL c'est
      // faux : les deux pieds/jambes/bras regardent dans la même direction (pas en miroir)
      // — sinon le pied arrière pointe à l'envers (« chaussures vers l'intérieur »).
      boneParts[bid].push({ svg, layer: SLOT_LAYER[slot], mirror: idx === 1 && view !== 'profile' });
    });
  }

  // Parties structurelles de RACE (tête/jambes/bras monstrueux + features) — sautées si
  // appearance.monster est défini (perso.monster du creature-def = override COMPLET de la
  // race, ex. Démonette qui hérite du Démon mais a sa propre config sans tête de Khorne).
  // Symétrie avec l'ancien race.monster : un perso.monster non-vide remplaçait intégralement
  // le race.monster (opérateur ??), donc les parts de la race n'étaient jamais injectées.
  if (!hasPersoMonster) {
    // Tête de RACE (ex. Orc) : poussée SOUS la coiffe de tenue (layer 0 < coiffe 2) —
    // visage/cheveux ont déjà été sautés au remplissage des slots ci-dessus.
    if (raceHead) boneParts['tete'].push({ svg: pickView(raceHead, view), layer: 0 });
    // Membres monstrueux de RACE (REMPLACENT l'os) : jambes de chèvre (Minotaure)…
    if (race.legs) {
      const l = LEGS[race.legs];
      if (l) { boneParts['cuisseG'] = [{ svg: pickView(l, view), layer: 5 }]; boneParts['cuisseD'] = [{ svg: pickView(l, view), layer: 5 }]; }
    }
    if (race.armG) { const a = ARMS[race.armG]; if (a) boneParts['epauleG'] = [{ svg: pickView(a, view), layer: 5 }]; }
    if (race.armD) { const a = ARMS[race.armD]; if (a) boneParts['epauleD'] = [{ svg: pickView(a, view), layer: 5 }]; }
  }

  // Parts MONSTRUEUSES (mutant modulaire / perso créature) : les REMPLACEMENTS d'os (tête
  // monstrueuse → efface visage/cheveux ; bras G/D → membre asymétrique) sont appliqués ici ;
  // leurs CALQUES rejoignent la file commune ci-dessous — UN SEUL traitement pour l'éditeur
  // (monster) et le reste (mutations/blessures/traits), aucune divergence possible.
  const queue: RigOverlay[] = [];
  if (appearance.monster) {
    const inj = monsterInjection(appearance.monster, view);
    for (const [bone, part] of Object.entries(inj.replace) as [BoneId, import('./parts/types').PartArt][])
      boneParts[bone] = [{ svg: pickView(part, view), layer: 5 }];
    queue.push(...inj.overlays);
  }
  // Cape portée (emplacement Cape — cosmétique) : appendice dorsal accroché au torse, mêmes
  // règles de profondeur que les ailes. Suit l'EquipCtx → visible partout (token, portraits…).
  if (equip.cape) queue.push(...dorsalOverlays('torse', CAPE_ART));
  queue.push(...overlays);

  // Calques cosmétiques (mutations, blessures, traits, parts monstrueuses…) dans le repère de
  // leur os. `view` limite à une vue (groin/langue de face) ; `behind` passe SOUS la part
  // (cornes, halo) ; `replace` substitue la part de l'os (bras → tentacule, svg vide = efface) ;
  // `plane` extrait le calque du z de l'os hôte (ailes : derrière/devant TOUT le corps).
  const planeExtras: { bone: BoneId; svg: string; z: number }[] = [];
  for (const ov of queue) {
    if (ov.view && ov.view !== view) continue;
    if (ov.plane) {
      if (ov.svg) planeExtras.push({ bone: ov.bone, svg: ov.svg, z: ov.plane === 'fond' ? -10 : 99 });
      continue;
    }
    if (ov.replace) { boneParts[ov.bone] = ov.svg ? [{ svg: ov.svg, layer: 5 }] : []; continue; }
    if (!ov.svg) continue;
    boneParts[ov.bone].push({ svg: ov.svg, layer: ov.behind ? -2 : 99 });
  }

  // Traits de corps de RACE (cornes, queue, crocs, verrues…). Injectés AVANT la résolution
  // de palette pour que leurs tokens @peau/@metal soient appliqués comme le reste.
  // Sautés si appearance.monster (perso complet) — idem race.head/legs ci-dessus.
  if (!hasPersoMonster) {
    for (const feat of race.features ?? []) {
      if (feat.view && feat.view !== view) continue;   // feature limitée à une vue (ex. crocs front)
      const part = featureToPart(feat, scaleOf[feat.bone]);
      boneParts[feat.bone].push({ svg: part.svg, layer: part.layer });
    }
  }
  // Traits propres à CETTE créature (perso.features du def) — ADDITIFS par-dessus la race,
  // jamais sautés : l'outil « race partagée + extra » (cornes du Prophète gris sur tête de rat)
  // sans basculer dans l'override complet perso.monster.
  for (const feat of bDef?.perso?.features ?? []) {
    if (feat.view && feat.view !== view) continue;
    const part = featureToPart(feat, scaleOf[feat.bone]);
    boneParts[feat.bone].push({ svg: part.svg, layer: part.layer });
  }
  // Traits ADDITIFS d'INSTANCE — `appearance.features` (clés du catalogue) : n'importe quel PNJ pioche
  // des éléments réutilisables (queue, cornes, crocs… ET difformités : tentacule, bouche…) par-dessus
  // sa race/def, EN APPARENCE PURE (sans trait/talent). Applique le calque COMPLET : remplacement de
  // membre (`replace`), arrière-plan (`behind`) ou calque échelonné (`scale`) — comme une mutation.
  for (const f of catalogFeatures(...(appearance.features ?? []))) {
    if (f.view && f.view !== view) continue;
    if (f.replace) { boneParts[f.bone] = f.svg ? [{ svg: f.svg, layer: 5 }] : []; continue; }
    if (f.scale) { const part = featureToPart(f, scaleOf[f.bone]); boneParts[f.bone].push({ svg: part.svg, layer: part.layer }); }
    else boneParts[f.bone].push({ svg: f.svg, layer: f.behind ? -2 : 99 });
  }

  // PALETTE : résout les tokens @peau/@cheveux/@vet1/@vet2/@cuir/@metal de chaque part.
  // Couches (priorité croissante) : défaut carrière (ombres exactes d'origine) → peau de
  // la tête monstrueuse (lézard=vert, chien=fauve, accorde la chair du corps) → surcharges
  // utilisateur (appearance.colors). Surcharger un slot dérive toute sa famille (recolor).
  // SKIN_FROM_HEAD n'accorde la peau du corps QUE pour une espèce SANS palette dédiée (ex.
  // un Humain à qui on greffe une tête de lézard) : si l'espèce a sa propre palette de peau
  // (Skaven, Orc, Goule…), celle-ci prime — sinon la peau de la tête écraserait la teinte
  // d'espèce (ex. la Goule grise deviendrait fauve à cause de sa tête « chien »).
  const speciesPalette = racePalette(race.id, appearance.sex);
  const SKIN_FROM_HEAD: Record<string, string> = {
    lezard: '#5d7a42', chien: '#6e4a2c', rat: '#6e4a2e',
  };
  const speciesHasSkin = speciesPalette?.peau != null;
  const skinHeadKey = appearance.monster?.tete ?? bDef?.perso?.head ?? race.head; // greffe de peau depuis la tête (monster, def OU race)
  const headSkin = !speciesHasSkin && skinHeadKey ? SKIN_FROM_HEAD[skinHeadKey] : undefined;
  const overrides: Palette = { ...(headSkin ? { peau: headSkin } : {}), ...appearance.colors };
  // Défauts empilés : ESPÈCE (peau/cheveux/yeux par espèce:sexe) → TENUE → surcharges.
  // Palette de tenue : tenue dédiée OU archétype de classe en repli (tenuePaletteFor) →
  // les tenues SANS art dédié héritent/recolorent comme les autres (cohérence).
  const stored = { ...(speciesPalette ?? {}), ...tenuePaletteFor(tenue) };
  const tmap = buildTokenMap(stored, overrides);
  for (const id of BONE_IDS) boneParts[id] = boneParts[id].map((p) => ({ ...p, svg: applyTokenMap(p.svg, tmap) }));

  // Profondeur en PROFIL, par COUCHES : ARME DU FOND ← (recouverte par) le HÉROS ← (recouverte par) l'ARME
  // DEVANT. Seules les armes sont re-z-ées (le corps garde son ordre normal entre les deux) : l'arme du fond
  // passe SOUS tout le héros (le bouclier, plus grand que la main, dépasse derrière sans être imprimé dessus) ;
  // l'arme avant passe AU-DESSUS de tout. Quelle main est au fond dépend du sens (mirror) : main directrice
  // (droite=arme) près face-à-droite / loin face-à-gauche ; main gauche (bouclier/2e arme) l'inverse.
  const zOverride: Partial<Record<BoneId, number>> = {};
  if (view === 'profile') {
    zOverride.arme = mirror ? -2 : 99; // arme = main droite (directrice)
    zOverride.bouclier = mirror ? 99 : -2; // bouclier / 2e arme = main gauche
  }

  const bones = BONE_IDS
    .map((id) => ({ id, matrix: world[id], scale: scaleOf[id], z: zOverride[id] ?? sk[id].z, parts: boneParts[id].sort((a, b) => a.layer - b.layer) }))
    .filter((b) => b.parts.length > 0);
  // Calques à PLAN dédié (ailes…) : entrée z propre, dans le repère (matrice/échelle) de l'os hôte.
  for (const p of planeExtras) {
    bones.push({ id: p.bone, matrix: world[p.bone], scale: scaleOf[p.bone], z: p.z, parts: [{ svg: applyTokenMap(p.svg, tmap), layer: 0 }] });
  }
  return bones.sort((a, b) => a.z - b.z);
}

/** Composant : un <g data-bone> par os, transformable individuellement (anim C / postures D). */
export function RigSprite({ appearance, equip, pose = {}, career, view = 'front', overlays, mirror = false }: {
  appearance: Appearance;
  equip: EquipCtx;
  pose?: Pose;
  /** Libellé de TENUE à porter (la carrière de jeu d'un héros sert de tenue par défaut). */
  career?: string;
  view?: View;
  overlays?: RigOverlay[];
  /** Regarde à gauche (le token applique le flip horizontal) → profondeur de profil inversée. */
  mirror?: boolean;
}): JSX.Element {
  const bones = resolveRig(appearance, equip, pose, career, view, overlays ?? [], mirror);
  return (
    <g className="rig">
      {bones.map((b) => (
        <g key={`${b.id}.${b.z}`} data-bone={b.id} transform={toSvg(b.matrix)}>
          <g transform={`scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})`}>
            {b.parts.map((p, i) =>
              p.mirror ? (
                <g key={i} transform="scale(-1,1)" dangerouslySetInnerHTML={{ __html: p.svg }} />
              ) : (
                <g key={i} dangerouslySetInnerHTML={{ __html: p.svg }} />
              ),
            )}
          </g>
        </g>
      ))}
    </g>
  );
}
