/// <reference types="vite/client" />
/// <reference types="mapbox-gl" />

declare module '@osvodef/mapbox-gl' {
  let accessToken: string;

  const Map: any;
  const MercatorCoordinate: typeof mapboxgl.MercatorCoordinate;
  const Marker: typeof mapboxgl.Marker;

  export { Map, accessToken, MercatorCoordinate, Marker };
}
