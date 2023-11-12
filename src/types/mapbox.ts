import type { AnyLayer, CustomLayerInterface, Map, Style } from 'mapbox-gl';

export type Layer = Exclude<AnyLayer, CustomLayerInterface>;

export type Mapstyle = Omit<Style, 'layers'> & { layers: Layer[] };

export type Mapbox = Omit<Map, 'getStyle' | 'getLayer'> & {
  getStyle(): Mapstyle;
  getLayer(id: string): Layer;

  getDisplayedElevationRange: () => { min: number; max: number };
};
