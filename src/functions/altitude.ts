import { accessToken, sku } from '@/constants';
import type { Track } from '@/types/tracks';
import type { Point } from '@/types/misc';

const tileCache: { [key: string]: Uint8ClampedArray } = {};

const tileSize = 512;
const tileZoom = 14;
const tileCount = 2 ** tileZoom;

export async function fillTileCache(track: Track): Promise<void> {
  const tiles: Map<string, Point> = new Map();

  for (let i = 0; i < track.length; i++) {
    const point = track[i];

    const x = Math.floor(point.pos.x * tileCount);
    const y = Math.floor(point.pos.y * tileCount);

    const key = `${x}_${y}`;

    tiles.set(key, { x, y });
  }

  const promises: Array<Promise<Uint8ClampedArray>> = [];

  tiles.forEach(point => {
    promises.push(downloadTile(point.x, point.y));
  });

  await Promise.all(promises);
}

export function queryAltitude(x: number, y: number): number {
  const nonRoundedX = x * tileCount;
  const nonRoundedY = y * tileCount;

  const coordX = Math.floor(nonRoundedX);
  const coordY = Math.floor(nonRoundedY);

  const tileData = tileCache[`${coordX}_${coordY}`];

  const tileX = Math.floor((nonRoundedX - coordX) * tileSize);
  const tileY = Math.floor((nonRoundedY - coordY) * tileSize);
  const index = (tileY * tileSize + tileX) * 4;

  const r = tileData[index];
  const g = tileData[index + 1];
  const b = tileData[index + 2];

  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

async function downloadTile(x: number, y: number): Promise<Uint8ClampedArray> {
  const key = `${x}_${y}`;

  if (tileCache[key] === undefined) {
    const response = await fetch(
      `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/14/${x}/${y}@2x.pngraw?sku=${sku}&access_token=${accessToken}`,
    );
    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: 'image/png' });
    const imageBitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(imageBitmap, 0, 0);

    tileCache[key] = context.getImageData(0, 0, tileSize, tileSize).data;
  }

  return tileCache[key];
}
