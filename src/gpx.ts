import { TrackPoint, Track } from './types';

export function generateGpx(track: Track): string {
    const gpx = `
        <?xml version="1.0" encoding="UTF-8"?>
        <gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxdata="http://www.cluetrust.com/XML/GPXDATA/1/0" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.cluetrust.com/XML/GPXDATA/1/0 http://www.cluetrust.com/Schemas/gpxdata10.xsd" version="1.1" creator="Tracktor">
            ${generateTrack(track)}
        </gpx>
    `;

    return gpx.trim();
}

function generateTrack(track: Track): string {
    return `<trk><trkseg>${track.map(point => generatePoint(point)).join('')}</trkseg></trk>`;
}

function generatePoint(point: TrackPoint): string {
    return `
        <trkpt lat="${point.lat}" lon="${point.lng}">
            <ele>${point.altitude}</ele>
            <time>${point.time.toISOString()}</time>
        </trkpt>
    `;
}
