export interface TrackPoint {
    time: Date;
    lng: number;
    lat: number;
    x: number;
    y: number;
    altitude: number;
    speed: number;
    distance: number;
}

export type Track = TrackPoint[];

export interface Ranges {
    minAltitude: number;
    maxAltitude: number;
    minSpeed: number;
    maxSpeed: number;
}

export type Coords = [number, number];

export type Bound = [number, number, number, number];

export interface Point {
    x: number;
    y: number;
}
