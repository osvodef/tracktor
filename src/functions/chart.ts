import { chartPadding } from '@/constants';
import { clamp, lerp, unlerp } from '@/functions/misc';
import type { Domain } from '@/types/misc';
import type { Track } from '@/types/tracks';

export function resetCanvas(context: CanvasRenderingContext2D): void {
  const { canvas } = context;

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function projectX(
  value: number,
  min: number,
  max: number,
  width: number,
  chartStart: number,
  chartEnd: number,
): number {
  const ratio = unlerp(value, min, max);
  const ratioZoomed = unlerp(ratio, chartStart, chartEnd);

  return lerp(chartPadding, width + chartPadding, ratioZoomed);
}

export function projectY(value: number, min: number, max: number, height: number): number {
  return lerp(height, 0, unlerp(value, min, max)) + 0.5;
}

export function crisp(coordinate: number): number {
  return Math.floor(coordinate) + 0.5;
}

export function calcTickInterval(
  niceValues: number[],
  range: number,
  maxTickCount: number,
): number {
  for (let i = 0; i < niceValues.length; i++) {
    const interval = niceValues[i];
    const tickCount = Math.floor(range / interval);

    if (tickCount <= maxTickCount) {
      return interval;
    }
  }

  return niceValues[niceValues.length - 1];
}

export function downscale(
  track: Track,
  width: number,
  chartStart: number,
  chartEnd: number,
): Array<[number, number, number, number]> {
  const startIndex = Math.floor(chartStart * (track.length - 1));
  const endIndex = Math.ceil(chartEnd * (track.length - 1));

  const pointCount = endIndex - startIndex;

  const smoothingFactor = 2;

  const pointsPerPx = pointCount / width;
  const step = Math.max(Math.ceil(pointsPerPx), 1);
  const alpha = pointCount < width * 2 ? 1 : 1 - Math.exp(-1 / (pointsPerPx * smoothingFactor));

  const smoothForward: number[] = [];
  const smoothBackward: number[] = [];
  const result: Array<[number, number, number, number]> = [];

  for (let i = 0; i < track.length; i++) {
    if (i === 0) {
      smoothForward.push(track[i].speed);
    } else {
      smoothForward.push(lerp(smoothForward[i - 1], track[i].speed, alpha));
    }
  }

  for (let i = track.length - 1; i >= 0; i--) {
    if (i === track.length - 1) {
      smoothBackward[i] = track[i].speed;
    } else {
      smoothBackward[i] = lerp(smoothBackward[i + 1], track[i].speed, alpha);
    }
  }

  for (let i = 0; i < track.length; i += step) {
    if (i < startIndex || i > endIndex) {
      continue;
    }

    if (i === 0) {
      result.push([track[i].time, smoothForward[i], smoothForward[i], smoothForward[i]]);
    } else {
      let max = -Infinity;
      let min = Infinity;

      for (let j = 0; j < step; j++) {
        min = Math.min(min, track[i - j].speed, smoothForward[i - j], smoothBackward[i - j]);
        max = Math.max(max, track[i - j].speed, smoothForward[i - j], smoothBackward[i - j]);
      }

      result.push([track[i].time, (smoothForward[i] + smoothBackward[i]) / 2, min, max]);
    }
  }

  return result;
}

export function downscaleForDistance(
  track: Track,
  width: number,
  chartStart: number,
  chartEnd: number,
): Array<[number, number, number, number]> {
  const startIndex = pointIndexByRatio(track, chartStart, 'distance');
  const endIndex = pointIndexByRatio(track, chartEnd, 'distance');

  const startDistance = track[startIndex].distance;
  const endDistance = track[endIndex].distance;
  const range = endDistance - startDistance;

  const step = range / width;
  const downsampled: Array<[number, number, number, number]> = [];

  let index = startIndex + 1;

  for (let distance = startDistance; distance <= endDistance; distance += step) {
    while (distance < track[index - 1].distance || distance > track[index].distance) {
      index++;
    }

    const ratio = unlerp(distance, track[index - 1].distance, track[index].distance);
    const speed = lerp(track[index - 1].speed, track[index].speed, ratio);

    downsampled.push([distance, speed, speed, speed]);
  }

  return downsampled;
}

export function timeRatioToDistanceRatio(track: Track, ratio: number): number {
  const distance = track[(track.length - 1) * ratio].distance;
  const totalDistance = track[track.length - 1].distance;

  return clamp(distance / totalDistance, 0, 1);
}

export function distanceRatioToTimeRatio(track: Track, ratio: number): number {
  const minTime = track[0].time;
  const maxTime = track[track.length - 1].time;

  const totalDistance = track[track.length - 1].distance;
  const distance = totalDistance * ratio;

  const index = pointIndexByDistance(track, distance);
  const time = track[index].time;

  return unlerp(time, minTime, maxTime);
}

export function pointIndexByDistance(track: Track, distance: number): number {
  let bestIndex = 0;
  let bestError = Infinity;

  for (let i = 0; i < track.length; i++) {
    const error = Math.abs(distance - track[i].distance);
    if (error < bestError) {
      bestError = error;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function pointIndexByRatio(track: Track, ratio: number, domain: Domain): number {
  if (domain === 'time') {
    return Math.round((track.length - 1) * ratio);
  }

  const totalDistance = track[track.length - 1].distance;
  const distance = totalDistance * ratio;

  return pointIndexByDistance(track, distance);
}
