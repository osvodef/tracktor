<template>
  <div v-once class="container" ref="container" @drop.prevent="importTrack" @dragover.prevent></div>
</template>

<script setup lang="ts">
  import { useStore } from '@/store';
  import mapboxgl from '@osvodef/mapbox-gl';
  import { accessToken } from '@/constants';
  import type { Mapbox } from '@/types/mapbox';
  import { getGeoJson, getBound } from '@/functions/misc';
  import { onMounted, onUnmounted, ref, watch } from 'vue';
  import type { GeoJSONSource, Marker } from 'mapbox-gl';

  const container = ref<HTMLDivElement>();
  const store = useStore();

  let map: Mapbox;
  let marker: Marker;

  onMounted(() => {
    mapboxgl.accessToken = accessToken;

    map = new mapboxgl.Map({
      container: container.value,
      zoom: 2,
      center: [0, 0],
      hash: true,
      scrollZoom: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
    });

    const nav = new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true });
    map.addControl(nav, 'bottom-right');

    const scale = new mapboxgl.ScaleControl();
    map.addControl(scale);

    marker = new mapboxgl.Marker({ color: '#f84c4c' });

    map.on('wheel', e => {
      if (map.isZooming() || e.originalEvent.deltaY === 0) {
        return;
      }

      const { deltaY, offsetX, offsetY } = e.originalEvent;

      const mapWidth = map.getContainer().clientWidth;
      const mapHeight = map.getContainer().clientHeight;

      const duration = 250;
      const offset: [number, number] = [offsetX - mapWidth / 2, offsetY - mapHeight / 2];

      if (deltaY < 0) {
        map.zoomTo(Math.floor(map.getZoom() + 1), { duration, offset });
      }

      if (deltaY > 0) {
        map.zoomTo(Math.ceil(map.getZoom() - 1), { duration, offset });
      }
    });

    map.on('zoomend', () => {
      if (!Number.isInteger(map.getZoom())) {
        map.zoomTo(Math.round(map.getZoom()), { duration: 100 });
      }
    });

    map.on('load', () => {
      map.addSource('track', {
        type: 'geojson',
        data: getGeoJson([]),
      });

      map.addSource('track-gaps', {
        type: 'geojson',
        data: getGeoJson([]),
      });

      map.addSource('selection', {
        type: 'geojson',
        data: getGeoJson([]),
      });

      map.addSource('dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: window.devicePixelRatio >= 2 ? 256 : 512,
      });

      map.addLayer({
        id: 'track-gaps',
        type: 'line',
        source: 'track-gaps',
        paint: {
          'line-color': '#000000',
          'line-opacity': 0.1,
          'line-width': 3,
        },
      });

      map.addLayer({
        id: 'track',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#ff0000',
          'line-width': 3,
        },
      });

      map.addLayer({
        id: 'selection',
        type: 'line',
        source: 'selection',
        paint: {
          'line-color': '#0000ff',
          'line-width': 3,
        },
      });

      // map.setTerrain({ source: 'dem' });
    });
  });

  onUnmounted(() => {
    map.remove();
  });

  watch([() => store.track], () => {
    if (store.track !== undefined) {
      const source = map.getSource('track') as GeoJSONSource;

      source.setData(getGeoJson(store.track));
      map.fitBounds(getBound(store.track));
    }
  });

  watch([() => store.cursorPositionIndex], () => {
    if (store.track !== undefined && store.cursorPositionIndex !== undefined) {
      const point = store.track[store.cursorPositionIndex];

      marker.setLngLat([point.pos.lng, point.pos.lat]);
      marker.addTo(map);
    } else {
      marker.remove();
    }
  });

  function importTrack(e: DragEvent): void {
    const file = e.dataTransfer?.files?.[0];

    if (file === undefined) {
      return;
    }

    store.importTrack(file);
  }
</script>

<style scoped>
  .container {
    width: 100%;
    height: 100%;
  }
</style>

<style>
  .mapboxgl-canvas {
    cursor: default !important;
  }

  .mapboxgl-ctrl-compass {
    cursor: pointer !important;
  }
</style>
