import { lerp, unlerp } from '@/functions/misc';
import { MercatorCoordinate } from '@osvodef/mapbox-gl';
import type { Track, TrackPoint, PartialTrack } from '@/types/tracks';
import type { Ranges } from '@/types/misc';

export function fillPositionHoles(track: PartialTrack): Track {
  const positionHoles: Array<[number, number]> = [];

  let holeStart: number | undefined = undefined;

  for (let i = 0; i < track.length; i++) {
    const point = track[i];
    const hasPosition = point.pos !== undefined;

    if (!hasPosition && holeStart === undefined) {
      holeStart = i - 1;
    } else if (hasPosition && holeStart !== undefined) {
      positionHoles.push([holeStart, i]);
      holeStart = undefined;
    }
  }

  if (holeStart !== undefined) {
    positionHoles.push([holeStart, track.length]);
  }

  for (const hole of positionHoles) {
    const startIndex = hole[0];
    const endIndex = hole[1];

    const endPoint =
      endIndex === track.length
        ? (track[startIndex] as TrackPoint)
        : (track[endIndex] as TrackPoint);
    const startPoint =
      startIndex === -1 ? (track[endIndex] as TrackPoint) : (track[startIndex] as TrackPoint);

    for (let i = startIndex + 1; i <= endIndex - 1; i++) {
      const ratio = unlerp(i, startIndex, endIndex);

      const x = lerp(startPoint.pos.x, endPoint.pos.x, ratio);
      const y = lerp(startPoint.pos.y, endPoint.pos.y, ratio);

      const { lng, lat } = new MercatorCoordinate(x, y).toLngLat();

      track[i].pos = { x, y, lng, lat };
    }
  }

  return track as Track;
}

export function getRanges(track: Track): Ranges {
  let minAltitude = Infinity;
  let maxAltitude = -Infinity;

  let maxSpeed = -Infinity;

  for (const point of track) {
    if (point.altitude < minAltitude) {
      minAltitude = point.altitude;
    }

    if (point.altitude > maxAltitude) {
      maxAltitude = point.altitude;
    }

    if (point.speed > maxSpeed) {
      maxSpeed = point.speed;
    }
  }

  maxAltitude = Math.ceil(maxAltitude / 100) * 100;
  minAltitude -= 0.025 * (maxAltitude - minAltitude);
  minAltitude = Math.min(maxAltitude - 100, minAltitude);

  if (maxSpeed <= 40) {
    maxSpeed = Math.ceil(maxSpeed / 5) * 5;
  } else {
    maxSpeed = Math.ceil(maxSpeed / 10) * 10;
  }

  return {
    minAltitude,
    maxAltitude,
    minSpeed: 0,
    maxSpeed,
    minTime: track[0].time,
    maxTime: track[track.length - 1].time,
    minDistance: 0,
    maxDistance: track[track.length - 1].distance,
  };
}
