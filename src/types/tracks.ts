export interface TrackPointPosition {
  lng: number;
  lat: number;
  x: number;
  y: number;
}

export interface PartialTrackPoint {
  time: number;
  altitude: number;
  speed: number;
  distance: number;
  pos?: TrackPointPosition;
}

export type TrackPoint = Required<PartialTrackPoint>;

export type PartialTrack = PartialTrackPoint[];
export type Track = TrackPoint[];
