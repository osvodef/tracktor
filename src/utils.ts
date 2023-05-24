import GpxParser from 'gpxparser';
import { fillTileCache, queryAltitude } from './altitude';
import { chartPadding } from './constants';
import { Coords, Track, TrackPoint, Bound, Ranges } from './types';

export function parse(string: string): Track {
    const gpx = new GpxParser();

    gpx.parse(string);

    return gpx.tracks[0].points.map(point => {
        const mercator = window.mapboxgl.MercatorCoordinate.fromLngLat({
            lng: point.lon,
            lat: point.lat,
        });

        return {
            lng: point.lon,
            lat: point.lat,
            x: mercator.x,
            y: mercator.y,
            altitude: point.ele,
            time: point.time,
            speed: 0,
            distance: 0,
        };
    });
}

export async function resample(track: Track): Promise<Track> {
    const minTime = Math.ceil(track[0].time.getTime() / 1000);
    const maxTime = Math.floor(track[track.length - 1].time.getTime() / 1000);

    const result: Track = [];

    let index = 1;

    for (let s = minTime; s <= maxTime; s++) {
        const ms = s * 1000;

        while (ms > track[index].time.getTime()) {
            index++;
        }

        const prev = track[index - 1];
        const curr = track[index];

        const ratio = (ms - prev.time.getTime()) / (curr.time.getTime() - prev.time.getTime());

        const mercator = new window.mapboxgl.MercatorCoordinate(
            lerp(prev.x, curr.x, ratio),
            lerp(prev.y, curr.y, ratio),
            0,
        );

        const lngLat = mercator.toLngLat();

        result.push({
            time: new Date(s * 1000),
            lng: lngLat.lng,
            lat: lngLat.lat,
            x: mercator.x,
            y: mercator.y,
            altitude: 0,
            speed: 0,
            distance: 0,
        });
    }

    await fillTileCache(result);

    let cumulativeDistance = 0;

    result[0].altitude = queryAltitude(result[0].x, result[0].y);
    result[0].distance = 0;
    result[0].speed = 0;

    for (let i = 1; i < result.length; i++) {
        const distance = haversine(result[i - 1], result[i]);
        const time = (result[i].time.getTime() - result[i - 1].time.getTime()) / 1000;

        cumulativeDistance += distance;

        result[i].speed = (distance / time) * 3.6;
        result[i].distance = cumulativeDistance;
        result[i].altitude = queryAltitude(result[i].x, result[i].y);
    }

    return result;
}

export function getGeoJson(track: Track): any {
    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: track.map(point => [point.lng, point.lat]),
        },
    };
}

export function projectPoint(
    xValue: number,
    xMin: number,
    xMax: number,
    yValue: number,
    yMin: number,
    yMax: number,
    width: number,
    height: number,
    chartStart: number,
    chartEnd: number,
): Coords {
    const xRatio = (xValue - xMin) / (xMax - xMin);
    const xRatioZoomed = (xRatio - chartStart) / (chartEnd - chartStart);
    const yRatio = (yValue - yMin) / (yMax - yMin);

    return [lerp(chartPadding, width - chartPadding, xRatioZoomed), lerp(height, 0, yRatio)];
}

export function lerp(min: number, max: number, ratio: number): number {
    return (1 - ratio) * min + ratio * max;
}

export function haversine(lngLat1: TrackPoint, lngLat2: TrackPoint): number {
    const R = 6371000;
    const rad = Math.PI / 180;
    const lat1 = lngLat1.lat * rad;
    const lat2 = lngLat2.lat * rad;
    const sinDLat = Math.sin(((lngLat2.lat - lngLat1.lat) * rad) / 2);
    const sinDLon = Math.sin(((lngLat2.lng - lngLat1.lng) * rad) / 2);
    const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function getRanges(track: Track): Ranges {
    let minAltitude = Infinity;
    let maxAltitude = -Infinity;

    let minSpeed = Infinity;
    let maxSpeed = -Infinity;

    for (const point of track) {
        if (point.altitude < minAltitude) {
            minAltitude = point.altitude;
        }

        if (point.altitude > maxAltitude) {
            maxAltitude = point.altitude;
        }

        if (point.speed < minSpeed) {
            minSpeed = point.speed;
        }

        if (point.speed > maxSpeed) {
            maxSpeed = point.speed;
        }
    }

    return { minAltitude, maxAltitude, minSpeed, maxSpeed };
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
        if (point.lng < bound[0]) {
            bound[0] = point.lng;
        }

        if (point.lng > bound[2]) {
            bound[2] = point.lng;
        }

        if (point.lat < bound[1]) {
            bound[1] = point.lat;
        }

        if (point.lat > bound[3]) {
            bound[3] = point.lat;
        }
    }

    return bound;
}
