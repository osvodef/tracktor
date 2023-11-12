export interface Ranges {
  minAltitude: number;
  maxAltitude: number;
  minSpeed: number;
  maxSpeed: number;
  minTime: number;
  maxTime: number;
}

export type Bound = [number, number, number, number];

export interface Point {
  x: number;
  y: number;
}
