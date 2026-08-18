/**
 * DEMANDE D'IMAGE PONCTUELLE (#1376) : un geste qui n'a besoin que d'être VU (la relève d'une texture
 * de billboard au franchissement d'un cran) demande UNE image, jamais un rendu. La panne en face est
 * mesurée : 63 boards reposés appelaient 63 rendus complets dans la même image (331 ms en
 * exploration).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  battreStageFrames,
  demanderFrames,
  demanderUneImage,
  relacherFrames,
  resetStageFrames,
  signalerImagePeinte,
  subscribeStageFrames,
} from './stageFrames';

/** Horloge et rAF PILOTÉS : la cadence du banc est la nôtre, jamais celle de la machine. */
let horloge = 0;
let enAttente: (() => void)[] = [];
/** Les POSES de rAF : une demande coalescée n'en pose qu'une, quel que soit le nombre d'appelants. */
let posesRaf = 0;

/** Sert les rAF posés — comme le navigateur au vsync suivant, une passe et une seule. */
function image(avanceMs = 20): void {
  horloge += avanceMs;
  const àServir = enAttente;
  enAttente = [];
  for (const cb of àServir) cb();
}

beforeEach(() => {
  enAttente = [];
  // Ardoise neuve : la suite partage ses modules (`isolate: false`), et une source laissée par un écran
  // d'un autre fichier fermerait ici toutes les demandes ponctuelles.
  resetStageFrames();
  posesRaf = 0;
  horloge += 1000; // toute image précédente est loin : plus aucune cession de `MEME_IMAGE_MS`
  vi.spyOn(performance, 'now').mockImplementation(() => horloge);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    posesRaf++;
    enAttente.push(cb);
    return enAttente.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('stageFrames — demande d’image PONCTUELLE', () => {
  it('N demandes dans la même image ne valent qu’UN battement', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    for (let i = 0; i < 63; i++) demanderUneImage();
    expect(battu, 'la demande est différée au prochain rAF, jamais servie sur place').not.toHaveBeenCalled();
    // COALESCENCE au point où elle coûte : une seule pose de rAF pour les 63 appelants. Sans ce
    // compte, 63 poses passeraient la garde — les 62 rappels suivants cèdent sur `MEME_IMAGE_MS` et
    // le compte de battements ne dirait rien.
    expect(posesRaf, `${posesRaf} rAF posés pour 63 demandes`).toBe(1);

    image();

    expect(battu).toHaveBeenCalledTimes(1);
    désabonner();
  });

  it('une demande servie n’en garde aucune en réserve : l’image suivante ne bat pas', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    demanderUneImage();
    image();
    image();
    expect(battu).toHaveBeenCalledTimes(1);
    // …et une demande NEUVE bat de nouveau : la porte n'est pas restée fermée.
    demanderUneImage();
    image();
    expect(battu).toHaveBeenCalledTimes(2);
    désabonner();
  });

  it('sous une boucle CONTINUE, la demande ponctuelle n’ajoute aucun battement', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    const source = Symbol('banc');
    demanderFrames(source);
    for (let i = 0; i < 10; i++) demanderUneImage();

    image();

    expect(battu, 'la boucle continue sert déjà l’image : une seule passe').toHaveBeenCalledTimes(1);
    relacherFrames(source);
    désabonner();
  });

  it('elle CÈDE le pas à un battement qui vient d’avoir lieu (même image)', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    demanderUneImage();
    battreStageFrames(); // la marche, le pointeur… quelqu'un d'autre a déjà peint cette image
    expect(battu).toHaveBeenCalledTimes(1);

    image(1); // moins de `MEME_IMAGE_MS` : c'est la MÊME image

    expect(battu).toHaveBeenCalledTimes(1);
    désabonner();
  });
});

/**
 * SOURCES CONTINUES MULTIPLES (#1378) : l'écran volumique en tient jusqu'à trois à la fois (averse,
 * flamme qui vacille, halo qui pulse), et chacune portait sa propre boucle rAF — quatre horloges pour
 * un canevas. Le module n'en arme qu'UNE, quel que soit le nombre de demandeurs.
 */
describe('stageFrames — N sources CONTINUES, une seule boucle', () => {
  it('trois sources ne posent qu’UN rAF par image, et ne battent qu’une fois', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    const sources = [Symbol('averse'), Symbol('vacillement'), Symbol('halos')];
    for (const s of sources) demanderFrames(s);
    // La pose est le point où la panne coûte : trois boucles arment trois rAF, et les deux battements
    // de trop cèdent ensuite sur `MEME_IMAGE_MS` — le compte de battements, seul, ne dirait rien.
    expect(posesRaf, `${posesRaf} rAF posés pour ${sources.length} sources`).toBe(1);

    const IMAGES = 5;
    for (let i = 0; i < IMAGES; i++) image();

    expect(posesRaf, `${posesRaf} rAF posés pour ${IMAGES} images`).toBe(1 + IMAGES);
    expect(battu, 'une image, un battement').toHaveBeenCalledTimes(IMAGES);
    désabonner();
    for (const s of sources) relacherFrames(s);
  });

  it('la boucle vit tant qu’il RESTE une source, et s’éteint avec la dernière', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    const sources = [Symbol('averse'), Symbol('vacillement'), Symbol('halos')];
    for (const s of sources) demanderFrames(s);
    image();
    expect(battu).toHaveBeenCalledTimes(1);

    // L'averse cesse et la flamme s'éteint : le halo pulse toujours, la boucle doit tenir.
    relacherFrames(sources[0]);
    relacherFrames(sources[1]);
    image();
    expect(battu, 'une source relâchée a coupé les images des autres').toHaveBeenCalledTimes(2);

    relacherFrames(sources[2]);
    image();
    expect(battu, 'plus aucune source : plus une seule image').toHaveBeenCalledTimes(2);
    désabonner();
  });
});

/**
 * DEUX HORLOGES, DEUX CESSIONS (#1378). Le stage signale ses images peintes hors battement
 * (`signalerImagePeinte` : un commit React qui redessine). La BOUCLE doit y céder — elle ne demande
 * qu'un redessin. La demande PONCTUELLE, non : elle porte une peinture NEUVE (une texture de billboard
 * relevée), qu'aucun commit n'a servie — l'avaler laisse le quad sans son art jusqu'à la frame
 * suivante, et à cache chaud il n'y en a pas d'autre.
 */
describe('stageFrames — la ponctuelle ne cède qu’au BATTEMENT', () => {
  it('demandée dans les 4 ms d’une image PEINTE par un commit, elle est quand même servie', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);

    signalerImagePeinte(); // un commit React vient de repeindre le stage
    horloge += 1;
    demanderUneImage(); // …et la texture arrive : elle demande à être VUE
    horloge += 2; // servie dans la MÊME image du navigateur
    image(0);
    expect(battu, 'une image ponctuelle avalée par un commit : le billboard reste sans art').toHaveBeenCalledTimes(1);

    // TÉMOIN — derrière un BATTEMENT, elle cède (la coalescence d'origine, #1376).
    battu.mockClear();
    battreStageFrames();
    battu.mockClear();
    horloge += 1;
    demanderUneImage();
    horloge += 2;
    image(0);
    expect(battu, 'un battement vient d’avoir lieu : la ponctuelle doit s’effacer').toHaveBeenCalledTimes(0);

    // TÉMOIN 2 — loin de toute image, elle est servie : sans quoi le premier compte ne dirait rien.
    horloge += 1000;
    demanderUneImage();
    image(0);
    expect(battu).toHaveBeenCalledTimes(1);
    désabonner();
  });

  it('la BOUCLE, elle, cède à une image peinte par un commit', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    const source = Symbol('averse');
    demanderFrames(source);

    signalerImagePeinte(); // le commit peint l'image N
    image(2); // la boucle sert son rAF dans la MÊME image
    expect(battu, 'la boucle a repeint une image que le commit venait de peindre').toHaveBeenCalledTimes(0);

    image(20); // image N+1 : elle bat de nouveau
    expect(battu).toHaveBeenCalledTimes(1);
    relacherFrames(source);
    désabonner();
  });
});
