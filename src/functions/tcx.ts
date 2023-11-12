import type {
  Track,
  TrackPoint,
  PartialTrack,
  TrackPointPosition,
  PartialTrackPoint,
} from '@/types/tracks';
import { getName } from '@/functions/misc';
import { XMLParser } from 'fast-xml-parser';
import { fillPositionHoles } from '@/functions/tracks';
import { MercatorCoordinate } from '@osvodef/mapbox-gl';

export async function parse(string: string): Promise<Track> {
  const parser = new XMLParser();

  const tcx = parser.parse(string);
  const tcxTrack = tcx.TrainingCenterDatabase.Activities.Activity.Lap.Track.Trackpoint as any[];

  const partialTrack: PartialTrack = [];

  let prevTime: number | undefined = undefined;
  let prevPoint: PartialTrackPoint | undefined = undefined;

  for (const point of tcxTrack) {
    const time = new Date(point.Time).getTime();

    if (prevTime !== undefined && prevPoint !== undefined) {
      const padding = (time - prevTime) / 1000 - 1;

      for (let i = 0; i < padding; i++) {
        partialTrack.push({
          altitude: prevPoint.altitude,
          time: prevTime + (i + 1) * 1000,
          speed: 0,
          distance: prevPoint.distance,
        });
      }
    }

    const position = parsePosition(point.Position);

    const altitude = Number(point.AltitudeMeters);
    const distance = Number(point.DistanceMeters);
    const speed = Number(point.Extensions['ns3:TPX']['ns3:Speed'] ?? 0) * 3.6;

    const newPoint: PartialTrackPoint = {
      altitude,
      time,
      speed,
      distance,
      pos: speed > 0 ? position : undefined,
    };

    partialTrack.push(newPoint);

    prevTime = time;
    prevPoint = newPoint;
  }

  const track = fillPositionHoles(partialTrack);

  return track;
}

function parsePosition(position: any): TrackPointPosition | undefined {
  if (position === undefined) {
    return undefined;
  }

  const lng = Number(position.LongitudeDegrees);
  const lat = Number(position.LatitudeDegrees);

  const { x, y } = MercatorCoordinate.fromLngLat({ lng, lat });

  return { lng, lat, x, y };
}

export function generateTcx(track: Track): string {
  const tcx = `
      <?xml version="1.0" encoding="UTF-8"?>
      <TrainingCenterDatabase
          xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
          xmlns:ns5="http://www.garmin.com/xmlschemas/ActivityGoals/v1"
          xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
          xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2"
          xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns4="http://www.garmin.com/xmlschemas/ProfileExtension/v1">
          <Activities>
              <Activity Sport="Biking">
              <Id>${getName(track)}</Id>
              <Lap>
                  ${generateTrack(track)}
              </Lap>
              </Activity>
          </Activities>
      </TrainingCenterDatabase>
  `;

  return tcx.trim();
}

function generateTrack(track: Track): string {
  return `<Track>${track.map(point => generatePoint(point)).join('')}</Track>`;
}

function generatePoint(point: TrackPoint): string {
  const date = new Date(point.time);

  return `
      <Trackpoint>
          <Time>${date.toISOString()}</Time>
          <Position>
              <LatitudeDegrees>${point.pos.lat}</LatitudeDegrees>
              <LongitudeDegrees>${point.pos.lng}</LongitudeDegrees>
          </Position>
          <AltitudeMeters>${point.altitude}</AltitudeMeters>
          <DistanceMeters>${point.distance}</DistanceMeters>
          <Extensions>
              <ns3:TPX>
                  <ns3:Speed>${point.speed / 3.6}</ns3:Speed>
              </ns3:TPX>
          </Extensions>
      </Trackpoint>
  `;
}
