import type { FacadeFeature } from '../../../state/scene';
import { structureAppearance, type StructureAppearanceDef } from '../structures';
import type { FacadeAppearanceDef, FacadeFeatureViz } from '../types';
import { facade as aubergeRelaisImperiale } from './defs/auberge-relais-imperiale';

const DEFINITIONS: readonly FacadeAppearanceDef[] = [aubergeRelaisImperiale];
const BY_ID: ReadonlyMap<string, FacadeAppearanceDef> = new Map(
  DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function facadeAppearance(id?: string): FacadeAppearanceDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function facadeStructureAppearance(id?: string): StructureAppearanceDef {
  const definition = facadeAppearance(id);
  if (!definition) return structureAppearance(id);
  return { ...structureAppearance(definition.wallAppearance), id: definition.id };
}

export function facadeFeatureViz(
  facadeId: string,
  kind: FacadeFeature['kind'],
): FacadeFeatureViz | undefined {
  return facadeAppearance(facadeId)?.features[kind];
}
