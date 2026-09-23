export const FEUILLES_PARTAGEES: readonly string[];
export const RACINE_DES_MODULES: string;
export function moduleHorsCouche(fichier: string, css: string): boolean;

export interface RegleCss {
  selecteurs: string[];
  corps: string;
  /** Préludes at-rule empilés, joints par ` && ` — `null` au premier niveau. */
  media: string | null;
}

export function reglesCss(texte: string): RegleCss[];
/** Découpe une liste de sélecteurs sur ses virgules de NIVEAU 0 (hors `:has()`/`:is()`/`[attr]`). */
export function decoupeSelecteurs(tete: string): string[];
export function declarations(corps: string): { prop: string; valeur: string }[];
/** Corps interne d'une tranche `@media` — lève si la tranche est absente. */
export function mediaBlock(css: string, requete: string): string;
/** La feuille privée de toutes ses tranches `@media`. */
export function baseSection(css: string): string;
export const PROPRIETES_DE_PLACEMENT: ReadonlySet<string>;
export const PROPRIETES_A_ECHELLE: ReadonlySet<string>;
export function estPlacement(prop: string): boolean;
export function valeurHorsEchelle(valeur: string): boolean;

/** Un fichier lu (disque, image git) — ou une FIXTURE de même forme. */
export interface Fichier { rel: string; text: string }
/** Un site mesuré, forme d'entrée de `sitesEnEntrees` (`stock.mjs`). */
export interface Site { file: string; ref: string }
/** Une entrée du manifeste des primitives, réduite à ce que la frontière CSS lit. */
export interface EntreeManifeste { id: string; css?: string }
/** Une IMAGE mesurable : les feuilles, le manifeste et la liste `FEUILLES_PARTAGEES` d'un même arbre. */
export interface ImageCss { fichiers: readonly Fichier[]; manifeste: readonly EntreeManifeste[]; partagees: readonly string[] }
/** Le côté d'une image lu par un lecteur de texte (`revendicationsArmees`). */
export interface CoteCss { manifeste: readonly EntreeManifeste[]; partagees: readonly string[]; lire: (f: string) => string | null }
/** Le prix d'une revendication, par volet ; `n` = identité + espacement. */
export interface PrixDeRevendication { identite: number; espacement: number; n: number }
export interface MesureDeZone { identite: Site[]; espacement: Site[] }
export interface VoletVentile {
  stock: [number, number];
  exempte: [number, number];
  deltaStock: number;
  deltaExempte: number;
  entre: number;
  disparu: number;
  reclasse: number;
  primitivise: number;
}

export const FEUILLE_LAYOUT: string;
export const CHEMIN_MANIFESTE: string;
export const CHEMIN_COUCHES: string;
export function manifesteDe(texte: string | null): EntreeManifeste[];
export function feuillesPartageesDe(texte: string | null): string[];
/** Le sélecteur NORMALISÉ d'une règle (espaces réduits, `@media` hors clé). */
export function cleDeRegle(selecteurs: readonly string[]): string;
export function sitesIdentiteEcran(fichiers: readonly Fichier[]): Site[];
export function sitesEspacementHorsEchelle(fichiers: readonly Fichier[]): Site[];
export function modulesDePrimitive(manifeste: readonly EntreeManifeste[]): Set<string>;
export function modulesDEcran(image: ImageCss): Fichier[];
export function modulesExemptes(image: Pick<ImageCss, 'manifeste' | 'partagees'>): Set<string>;
export function partitionCss(image: ImageCss): { stock: MesureDeZone; exempte: MesureDeZone };
export function sitesSiEcran(module: string, texte: string | null): PrixDeRevendication;
export function revendicationsArmees(base: CoteCss, tete: CoteCss, touches: Iterable<string>): ({ module: string } & PrixDeRevendication)[];
/** Le prix d'un intervalle : `min(Σ N armés, max(0, −Δstock))` par volet ; `n` = identité + espacement. */
export function prixDuReclassement(base: CoteCss, tete: CoteCss, touches: Iterable<string>): PrixDeRevendication & {
  revendications: ({ module: string } & PrixDeRevendication)[];
  deltaStock: { identite: number; espacement: number };
};
export function ventilerDecrue(base: ImageCss, tete: ImageCss): {
  identite: VoletVentile;
  espacement: VoletVentile;
  revendications: ({ module: string } & PrixDeRevendication)[];
};
export function ligneDeVentilation(nom: string, v: VoletVentile): string;
