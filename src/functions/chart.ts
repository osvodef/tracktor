import { chartPadding } from '@/constants';
import { lerp, unlerp } from '@/functions/misc';
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
