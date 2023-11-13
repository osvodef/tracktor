/// <reference types="vite/client" />
/// <reference types="mapbox-gl" />

declare module '@osvodef/mapbox-gl' {
  let accessToken: string;

  const Map: any;
  const MercatorCoordinate: typeof mapboxgl.MercatorCoordinate;
  const Marker: typeof mapboxgl.Marker;
  const NavigationControl: typeof mapboxgl.NavigationControl;
  const ScaleControl: typeof mapboxgl.ScaleControl;

  export { Map, accessToken, MercatorCoordinate, Marker, NavigationControl, ScaleControl };
}
