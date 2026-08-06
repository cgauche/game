/**
 * COMPILATEUR DE DESSIN QUADRUPÈDE — « bête entière par vue » (#1082).
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts [--check] [espèce…]
 *
 * ENTRÉE  : `src/gameIso/rig/quadruped/atelier/<espèce>-<vue>.dessin.mts` — une illustration en
 *           coordonnées MONDE (canevas 120×150, sol y=150), groupée par os, langage restreint.
 * SORTIE  : `src/gameIso/rig/quadruped/<espèce><Vue>Compile.ts` — l'art par OS, dans le repère
 *           LOCAL de chaque os, prêt pour le canal `QuadProps.viewArt`. Le moteur de RENDU ne
 *           change pas d'un octet : il reçoit de l'art de part comme tout autre.
 *
 * MÉCANIQUE — le rendu compose : monde = M(os) · S(os) · local  (`composeQuad` : `transform=
 * toSvg(matrix)` puis `scale(sx,sy)`). Le compilateur applique donc l'INVERSE, T = S⁻¹ · M⁻¹, à
 * CHAQUE coordonnée du dessin, et CUIT le résultat dans le `d` du path. Aucun `<g transform>` n'est
 * émis : l'art compilé vit dans le repère de son os, comme tout art de part du dépôt (le cliquet
 * `REPERES_ART_PROPRES_GELES` interdit qu'une part s'enveloppe dans son propre repère).
 * Les matrices M viennent du SQUELETTE RÉEL en pose de REPOS (`buildQuadSkeleton` →
 * `quadSkeletonForView` → `groundQuad` → `worldTransformsG`), l'échelle S de `quadBoneScale` —
 * jamais d'un littéral recopié. La POSE de référence se compose par la MÊME expression que le rendu
 * (`resolveQuadFromProps` : `QUAD_REST` ADDITIONNÉ au `stance` de l'espèce, en PROFIL seulement —
 * les vues de bout refigent leurs angles) : la bête que l'artiste a sous les yeux.
 *
 * Une largeur de trait est mise à l'échelle par √|det T| : le trait garde au monde l'épaisseur que
 * l'artiste a vue. Sous une échelle NON UNIFORME (carrure 1,2 en y du tronc bovin) c'est une
 * approximation ASSUMÉE — un trait de 0,7 u y devient 0,64 u au lieu de varier avec son orientation.
 *
 * IDEMPOTENT : relancé sur un dessin inchangé, il réécrit le même octet. `--check` n'écrit rien et
 * sort en 1 si une sortie diverge de son dessin (porte de commit).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ATELIER = resolve(ROOT, 'src/gameIso/rig/quadruped/atelier');
const DEST_DIR = resolve(ROOT, 'src/gameIso/rig/quadruped');
const CHECK = process.argv.includes('--check');
const FILTRE = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const { QUAD_SPECIES, WINGED_SPECIES } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/creatures/index.ts'))}`);
const { buildQuadSkeleton, quadSkeletonForView, groundQuad } =
  await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/quadruped/quadSkeleton.ts'))}`);
const { worldTransformsG } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/kinematics.ts'))}`);
const { QUAD_REST } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/quadruped/quadPose.ts'))}`);
const { quadBoneScale } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/quadruped/composeQuad.ts'))}`);

type Mat = [number, number, number, number, number, number]; // a b c d e f : x'=ax+cy+e, y'=bx+dy+f
interface GroupeDessin { bone: string; svg: string }

/** Les trois vues du gabarit, nommées en FRANÇAIS dans le nom de fichier du dessin. */
const VUES: Record<string, string> = { profil: 'profile', face: 'front', dos: 'back' };

/** `grand-cerf` → `GRAND_CERF` (nom de la constante exportée). */
const constante = (espece: string, vueFr: string) =>
  `${espece.replace(/-/g, '_').toUpperCase()}_${vueFr.toUpperCase()}_COMPILE`;
/** `grand-cerf` + `profil` → `grandCerfProfilCompile` (nom de fichier de la sortie). */
const camel = (s: string) => s.replace(/-(.)/g, (_m, c: string) => c.toUpperCase());
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** T = S⁻¹ · M⁻¹ — le passage monde → repère local de l'os, échelle d'os comprise. */
function versLocal(p: unknown, sk: Record<string, unknown>, world: Record<string, Mat>, bone: string, vue: string): Mat {
  const m = world[bone];
  const [sx, sy] = quadBoneScale(p, sk[bone], bone, vue);
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-9) throw new Error(`matrice singulière pour ${bone}`);
  const inv: Mat = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  return [inv[0] / sx, inv[1] / sy, inv[2] / sx, inv[3] / sy, inv[4] / sx, inv[5] / sy];
}
const applique = (t: Mat, x: number, y: number): [number, number] =>
  [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];

/** Cuisson des coordonnées d'un fragment. Langage restreint : M/L/C/Q/Z en ABSOLU uniquement. */
function cuire(svg: string, t: Mat): string {
  const k = Math.sqrt(Math.abs(t[0] * t[3] - t[1] * t[2]));
  return svg
    .replace(/d="([^"]+)"/g, (_m, d: string) => {
      const jetons = d.match(/[MLCQZ]|-?\d+(?:\.\d+)?/g) ?? [];
      const out: string[] = [];
      const nb: number[] = [];
      const vide = () => {
        for (let i = 0; i + 1 < nb.length; i += 2) {
          const [X, Y] = applique(t, nb[i], nb[i + 1]);
          out.push(`${+X.toFixed(2)} ${+Y.toFixed(2)}`);
        }
        nb.length = 0;
      };
      for (const j of jetons) {
        if (/[MLCQZ]/.test(j)) { vide(); out.push(j); } else nb.push(+j);
      }
      vide();
      return `d="${out.join(' ').replace(/([MLCQZ]) /g, '$1')}"`;
    })
    .replace(/stroke-width="([\d.]+)"/g, (_m, w: string) => `stroke-width="${+(+w * k).toFixed(2)}"`);
}

/** Compile UN dessin et rend le texte du module de sortie. */
async function compile(fichier: string): Promise<{ dest: string; texte: string; groupes: number }> {
  const nom = basename(fichier, '.dessin.mts');
  const coupe = nom.lastIndexOf('-');
  const espece = nom.slice(0, coupe), vueFr = nom.slice(coupe + 1);
  const vue = VUES[vueFr];
  if (!vue) throw new Error(`${nom} : vue inconnue « ${vueFr} » (attendu : ${Object.keys(VUES).join(', ')})`);
  const especes = { ...QUAD_SPECIES, ...WINGED_SPECIES } as Record<string, Record<string, unknown>>;
  const p = especes[espece];
  if (!p) throw new Error(`${nom} : espèce inconnue du registre « ${espece} »`);

  let pose: Record<string, number> = QUAD_REST as Record<string, number>;
  if (p.stance && vue === 'profile') {
    const merged: Record<string, number> = { ...(p.stance as Record<string, number>) };
    for (const [id, d] of Object.entries(pose)) merged[id] = (merged[id] ?? 0) + (d ?? 0);
    pose = merged;
  }
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), vue), pose);
  const world = worldTransformsG(sk, pose) as Record<string, Mat>;
  const { DESSIN } = await import(`${pathToFileURL(fichier)}`) as { DESSIN: GroupeDessin[] };

  const lignes: string[] = [];
  for (const g of DESSIN) {
    if (!world[g.bone]) throw new Error(`${nom} : os inconnu du squelette — ${g.bone}`);
    const art = cuire(g.svg, versLocal(p, sk, world, g.bone, vue));
    if (/<g[^>]*transform/.test(art)) throw new Error(`${nom} : repère propre interdit sur ${g.bone}`);
    lignes.push(`  ${g.bone}: ${JSON.stringify(art)},`);
  }
  const texte =
    `// GÉNÉRÉ par scripts/rig/compile-dessin-quad.mts depuis atelier/${basename(fichier)} — ne pas éditer à la main.\n` +
    `export const ${constante(espece, vueFr)}: Record<string, string> = {\n${lignes.join('\n')}\n};\n`;
  return { dest: resolve(DEST_DIR, `${camel(espece)}${cap(vueFr)}Compile.ts`), texte, groupes: DESSIN.length };
}

// ── balayage de l'atelier ────────────────────────────────────────────────────────────────────
const dessins = readdirSync(ATELIER)
  .filter((f) => f.endsWith('.dessin.mts'))
  .filter((f) => !FILTRE.length || FILTRE.some((x) => f.startsWith(`${x}-`)))
  .sort();
if (!dessins.length) { console.error(`aucun dessin dans ${ATELIER}`); process.exit(1); }

const divergents: string[] = [];
for (const f of dessins) {
  const { dest, texte, groupes } = await compile(resolve(ATELIER, f));
  const actuel = (() => { try { return readFileSync(dest, 'utf8'); } catch { return null; } })();
  if (CHECK) {
    if (actuel !== texte) divergents.push(`${f} → ${basename(dest)}`);
    console.log(`${actuel === texte ? 'à jour ' : 'DIVERGE'} : ${f} (${groupes} groupes)`);
  } else {
    if (actuel !== texte) writeFileSync(dest, texte);
    console.log(`compilé : ${f} → ${basename(dest)} (${groupes} groupes${actuel === texte ? ', inchangé' : ''})`);
  }
}
if (divergents.length) {
  console.error(`sortie(s) divergentes du dessin — relancer sans --check :\n  ${divergents.join('\n  ')}`);
  process.exit(1);
}
