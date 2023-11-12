import type { Track, TrackPoint } from '@/types/tracks';
import type { Bound } from '@/types/misc';

export function getGeoJson(track: Track): any {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: track.map(point => [point.pos.lng, point.pos.lat]),
    },
  };
}

export function lerp(min: number, max: number, ratio: number): number {
  return (1 - ratio) * min + ratio * max;
}

export function unlerp(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

export function haversine(lngLat1: TrackPoint, lngLat2: TrackPoint): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const lat1 = lngLat1.pos.lat * rad;
  const lat2 = lngLat2.pos.lat * rad;
  const sinDLat = Math.sin(((lngLat2.pos.lat - lngLat1.pos.lat) * rad) / 2);
  const sinDLon = Math.sin(((lngLat2.pos.lng - lngLat1.pos.lng) * rad) / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function clone(track: Track): Track {
  return track.map(point => ({ ...point }));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getBound(track: Track): [number, number, number, number] {
  const bound: Bound = [Infinity, Infinity, -Infinity, -Infinity];

  for (const point of track) {
    if (point.pos.lng < bound[0]) {
      bound[0] = point.pos.lng;
    }

    if (point.pos.lng > bound[2]) {
      bound[2] = point.pos.lng;
    }

    if (point.pos.lat < bound[1]) {
      bound[1] = point.pos.lat;
    }

    if (point.pos.lat > bound[3]) {
      bound[3] = point.pos.lat;
    }
  }

  return bound;
}

export function getName(track: Track): string {
  const start = new Date(track[0].time);
  const year = String(start.getFullYear()).padStart(4, '0');
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  const hour = String(start.getHours()).padStart(2, '0');
  const minute = String(start.getMinutes()).padStart(2, '0');
  const second = String(start.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hour}-${minute}-${second}`;
}
