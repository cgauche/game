/**
 * Corrige l'ART des têtes générées (heads.ts) — défauts exposés depuis le retrait du
 * prototype slice : YEUX en iris orange « luisant » (gradient g_eye = monstres) sans
 * blanc d'œil → on remplace par un VRAI œil (blanc d'almande + iris brun + pupille).
 * Travaille sur les chaînes PROPRES (import) puis réécrit heads.ts. Lancer :
 *   npx tsx scripts/_fix-heads.mts
 */
import { writeFileSync } from 'node:fs';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';

/** Remplace chaque iris luisant (ellipse|circle fill=url(#g_eye)) par blanc + iris brun.
 *  La pupille (#140a06) qui suit reste et se centre dans l'iris. */
function fixEyes(svg: string): string {
  return svg.replace(/<(?:ellipse|circle)\s+([^>]*?)fill="url\(#g_eye\)"\s*\/>/g, (_m, attrs: string) => {
    const cx = (/\bcx="(-?[\d.]+)"/.exec(attrs) || [])[1] ?? '0';
    const cy = (/\bcy="(-?[\d.]+)"/.exec(attrs) || [])[1] ?? '0';
    // blanc d'œil (almande, plus large que haut) + iris @yeux (recoloriable) + contour fin.
    // La pupille #140a06 qui suit reste (keep). Œil net, non luisant.
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="2.05" ry="1.3" fill="#f3ede1"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="2.05" ry="1.3" fill="none" stroke="#7a6a55" stroke-width="0.35"/>` +
      `<circle cx="${cx}" cy="${cy}" r="1.15" fill="@yeux"/>`
    );
  });
}

// Calotte (cuir chevelu) sous la chevelure : dôme couleur cheveux couvrant le crâne
// jusqu'au haut du front → supprime le « trou » de fond entre la racine et le visage
// (le visage, dessiné par-dessus, recouvre le bas). Marqueur pour rester idempotent.
const SCALP_MARK = '<!--scalp-->';
const SCALP = `${SCALP_MARK}<path d="M-9.4 7 Q-10.4 -9 0 -9.6 Q10.4 -9 9.4 7 Q9 -1 6 -2.4 Q0 -4 -6 -2.4 Q-9 -1 -9.4 7Z" fill="@cheveuxO"/>`;

const heads: Record<string, { visage?: string; cheveux?: string }> = {};
let eyesFixed = 0;
let scalps = 0;
for (const key of Object.keys(GENERATED_HEADS)) {
  const src = GENERATED_HEADS[key] as { visage?: string; cheveux?: string };
  const out: { visage?: string; cheveux?: string } = {};
  if (src.visage != null) {
    const before = (src.visage.match(/url\(#g_eye\)/g) || []).length;
    out.visage = fixEyes(src.visage);
    eyesFixed += before;
  }
  if (src.cheveux != null) {
    out.cheveux = src.cheveux.includes(SCALP_MARK) ? src.cheveux : SCALP + src.cheveux;
    if (!src.cheveux.includes(SCALP_MARK)) scalps++;
  }
  heads[key] = out;
}

const body = Object.entries(heads)
  .map(([key, parts]) => {
    const lines = (['visage', 'cheveux'] as const).filter((p) => parts[p] != null).map((p) => `    ${JSON.stringify(p)}: ${JSON.stringify(parts[p])}`);
    return `  ${JSON.stringify(key)}: {\n${lines.join(',\n')}\n  }`;
  })
  .join(',\n');
writeFileSync(
  'src/gameIso/rig/parts/generated/heads.ts',
  `// Généré par scripts/_ingest-rig-art.mjs, yeux corrigés par scripts/_fix-heads.mjs — NE PAS éditer à la main.\n` +
    `/** Têtes (visage + cheveux) par "Espèce:Sexe", dessinées depuis l'art officiel. */\n` +
    `export const GENERATED_HEADS: Record<string, { visage?: string; cheveux?: string }> = {\n${body}\n};\n`,
);
console.log(`OK — yeux : ${eyesFixed} iris → œil blanc+iris @yeux ; calottes ajoutées : ${scalps}, sur ${Object.keys(heads).length} têtes.`);
