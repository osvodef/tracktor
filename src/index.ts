import { accessToken, chartPadding, chartZoomSpeed } from './constants';
import { saveAs } from 'file-saver';
import { Track } from './types';
import {
    clamp,
    clone,
    getBound,
    getGeoJson,
    getRanges,
    lerp,
    parse,
    projectPoint,
    resample,
} from './utils';
import { generateGpx } from './gpx';
import { TrackPoint } from './types';

window.mapboxgl.accessToken = accessToken;

const container = document.querySelector('.map') as HTMLDivElement;
const chart = document.querySelector('.chart') as HTMLCanvasElement;
const bottomTicks = document.querySelector('.ticks-bottom') as HTMLCanvasElement;
const positionIndicator = document.querySelector('.position-indicator') as HTMLDivElement;
const selectionIndicator = document.querySelector('.selection-indicator') as HTMLDivElement;
const deleteButton = document.querySelector('.delete-button') as HTMLDivElement;
const undoButton = document.querySelector('.undo-button') as HTMLDivElement;
const saveButton = document.querySelector('.save-button') as HTMLDivElement;

const map = (window.map = new window.mapboxgl.Map({
    container,
    zoom: 2,
    center: [0, 0],
    hash: true,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
}));

const marker = new window.mapboxgl.Marker({
    color: '#f84c4c',
});

const history: Track[] = [];

let track: Track | undefined;
let name = 'track';

let isSelecting = false;
let selectionStartIndex: number | undefined = undefined;
let selectionEndIndex: number | undefined = undefined;

let chartStart = 0;
let chartEnd = 1;

let chartMode: 'time' | 'distance' = 'time';

map.on('load', () => {
    map.addSource('track', {
        type: 'geojson',
        data: getGeoJson([]),
    });

    map.addSource('selection', {
        type: 'geojson',
        data: getGeoJson([]),
    });

    map.addSource('dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: window.devicePixelRatio >= 2 ? 256 : 512,
    });

    map.addLayer({
        id: 'track',
        type: 'line',
        source: 'track',
        paint: {
            'line-color': '#ff0000',
            'line-width': 3,
        },
    });

    map.addLayer({
        id: 'selection',
        type: 'line',
        source: 'selection',
        paint: {
            'line-color': '#0000ff',
            'line-width': 3,
        },
    });

    map.setTerrain({ source: 'dem' });
});

container.addEventListener('drop', async e => {
    e.preventDefault();

    const file = e.dataTransfer?.files?.[0];

    if (file === undefined) {
        return;
    }

    name = file.name.split('.').slice(0, -1).join('.');

    document.title = `${name} — Tracktor`;

    track = await resample(parse(await file.text()));

    drawChart();
    drawTrack();

    map.fitBounds(getBound(track));
});

container.addEventListener('dragover', e => e.preventDefault());

chart.addEventListener('mousedown', e => {
    if (track === undefined) {
        return;
    }

    isSelecting = true;
    positionIndicator.style.visibility = 'hidden';

    const xRatio = (e.offsetX - chartPadding) / (chart.clientWidth - 2 * chartPadding);
    const xRatioZoomed = lerp(chartStart, chartEnd, xRatio);

    selectionStartIndex = clamp(Math.floor(track.length * xRatioZoomed), 0, track.length - 1);
    selectionEndIndex = undefined;

    drawSelection();
});

chart.addEventListener('mousemove', e => {
    if (track === undefined) {
        return;
    }

    const ratio = (e.offsetX - chartPadding) / (chart.clientWidth - 2 * chartPadding);
    const ratioZoomed = lerp(chartStart, chartEnd, ratio);
    const index = clamp(Math.floor(track.length * ratioZoomed), 0, track.length - 1);
    const point = track[index];

    if (isSelecting) {
        selectionEndIndex = index;
    }

    marker.setLngLat([point.lng, point.lat]);
    marker.addTo(map);

    positionIndicator.style.visibility = 'visible';
    positionIndicator.style.transform = `translateX(${e.offsetX}px)`;

    drawSelection();
});

chart.addEventListener('mouseout', () => {
    marker.remove();
    positionIndicator.style.visibility = 'hidden';
});

chart.addEventListener('wheel', e => {
    const ratio = clamp((e.offsetX - chartPadding) / (chart.clientWidth - 2 * chartPadding), 0, 1);

    const range = chartEnd - chartStart;
    const newRange = range * 2 ** (e.deltaY * chartZoomSpeed);

    const rangeDifference = range - newRange;

    chartStart = Math.max(chartStart + rangeDifference * ratio, 0);
    chartEnd = Math.min(chartEnd - rangeDifference * (1 - ratio), 1);

    drawChart();
    drawSelection();
});

document.body.addEventListener('mouseup', () => {
    isSelecting = false;
});

deleteButton.addEventListener('click', async () => {
    if (
        selectionStartIndex === undefined ||
        selectionEndIndex === undefined ||
        track === undefined
    ) {
        return;
    }

    history.push(clone(track));

    track.splice(selectionStartIndex, selectionEndIndex - selectionStartIndex + 1);

    track = await resample(track);

    selectionStartIndex = undefined;
    selectionEndIndex = undefined;

    drawChart();
    drawTrack();
    drawSelection();
});

undoButton.addEventListener('click', () => {
    const previous = history.pop();

    if (previous !== undefined) {
        track = previous;
    }

    selectionStartIndex = undefined;
    selectionEndIndex = undefined;

    drawChart();
    drawTrack();
    drawSelection();
});

saveButton.addEventListener('click', () => {
    if (track === undefined) {
        return;
    }

    const blob = new Blob([generateGpx(track)], { type: 'text/plain;charset=utf-8' });

    saveAs(blob, `${name}.gpx`);
});

function drawChart(): void {
    if (track === undefined) {
        return;
    }

    const ctx = chart.getContext('2d') as CanvasRenderingContext2D;

    const width = chart.clientWidth;
    const height = chart.clientHeight;

    chart.width = width;
    chart.height = height;

    const startTime = track[0].time.getTime();
    const endTime = track[track.length - 1].time.getTime();

    const startDistance = track[0].distance;
    const endDistance = track[track.length - 1].distance;

    const byTime = chartMode === 'time';

    const { minAltitude, maxAltitude, minSpeed, maxSpeed } = getRanges(track);

    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();

    for (let i = 0; i < track.length; i++) {
        const point = track[i];

        const coords = projectPoint(
            byTime ? point.time.getTime() : point.distance,
            byTime ? startTime : startDistance,
            byTime ? endTime : endDistance,
            point.altitude,
            minAltitude,
            maxAltitude,
            width,
            height,
            chartStart,
            chartEnd,
        );

        if (i === 0) {
            ctx.moveTo(...coords);
        } else {
            ctx.lineTo(...coords);
        }
    }

    ctx.lineTo(width - chartPadding, height);
    ctx.lineTo(chartPadding, height);
    ctx.closePath();

    ctx.fillStyle = '#fb9a99';
    ctx.fill();

    ctx.beginPath();

    const start = byTime
        ? lerp(startTime, endTime, chartStart)
        : lerp(startDistance, endDistance, chartStart);
    const end = byTime
        ? lerp(startTime, endTime, chartEnd)
        : lerp(startDistance, endDistance, chartEnd);

    const pixelCount = width - 2 * chartPadding;
    const step = (end - start) / pixelCount;

    let index = 0;
    let prevTime = 0;
    let prevDistance = 0;

    for (let i = 0; i < pixelCount; i++) {
        const wantedX = start + i * step;
        const prevIndex = index;

        while (true) {
            const point = track[index];
            const x = getX(point, byTime);

            if (x > wantedX) {
                break;
            }

            index++;
        }

        if (index > prevIndex) {
            const point = track[index];
            const prevPoint = track[prevIndex];

            const ratio =
                (wantedX - getX(prevPoint, byTime)) /
                (getX(point, byTime) - getX(prevPoint, byTime));

            const distance = lerp(prevPoint.distance, point.distance, ratio);
            const time = lerp(prevPoint.time.getTime(), point.time.getTime(), ratio);

            const speed = (3.6 * (distance - prevDistance)) / ((time - prevTime) / 1000);

            const coords = projectPoint(
                wantedX,
                byTime ? startTime : startDistance,
                byTime ? endTime : endDistance,
                speed,
                minSpeed,
                maxSpeed,
                width,
                height,
                chartStart,
                chartEnd,
            );

            if (i === 0) {
                ctx.moveTo(...coords);
            } else {
                ctx.lineTo(...coords);
            }

            prevDistance = distance;
            prevTime = time;
        }
    }

    ctx.strokeStyle = '#1f78b4';
    ctx.stroke();

    drawTicks();
}

function drawTicks(): void {
    if (track === undefined) {
        return;
    }

    const ctx = bottomTicks.getContext('2d') as CanvasRenderingContext2D;

    const width = bottomTicks.clientWidth;
    const height = bottomTicks.clientHeight;

    bottomTicks.width = width;
    bottomTicks.height = height;

    ctx.clearRect(0, 0, width, height);

    ctx.font = '10px sans-serif';

    ctx.beginPath();
    ctx.moveTo(chartPadding, 0.5);
    ctx.lineTo(width - chartPadding, 0.5);

    if (chartMode === 'time') {
        const start = track[0].time.getTime() / 1000;
        const end = track[track.length - 1].time.getTime() / 1000;

        const niceValues = [1, 2, 5, 10, 20, 30, 60].map(minutes => minutes * 60);
        const duration = end - start;

        let niceValuesIndex = 0;
        let interval = niceValues[niceValuesIndex];
        let ticksCount = duration / interval;

        const maxTicksCount = (width - 2 * chartPadding) / 100 / (chartEnd - chartStart);

        while (ticksCount > maxTicksCount) {
            niceValuesIndex++;
            interval =
                niceValues[niceValuesIndex] ??
                niceValues[niceValues.length - 1] * (niceValuesIndex - niceValues.length - 2);

            ticksCount = Math.floor(duration / interval);
        }

        const firsTickX = Math.ceil(start / interval) * interval;

        for (let x = firsTickX; x < end; x += interval) {
            const coords = projectPoint(
                x,
                start,
                end,
                0,
                0,
                1,
                width,
                height,
                chartStart,
                chartEnd,
            );

            const chartX = Math.round(coords[0]) + 0.5;

            ctx.moveTo(chartX, 0);
            ctx.lineTo(chartX, 10);

            const date = new Date(x * 1000);
            const text = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            ctx.fillText(text, chartX, 20);
        }
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function getX(point: TrackPoint, byTime: boolean): number {
    return byTime ? point.time.getTime() : point.distance;
}

function drawTrack(): void {
    if (track !== undefined) {
        map.getSource('track').setData(getGeoJson(track));
    }
}

function drawSelection(): void {
    if (
        selectionStartIndex === undefined ||
        selectionEndIndex === undefined ||
        track === undefined
    ) {
        selectionIndicator.style.display = 'none';
        map.getSource('selection').setData(getGeoJson([]));
        return;
    }

    selectionIndicator.style.display = 'block';

    const startRatio = (selectionStartIndex / track.length - chartStart) / (chartEnd - chartStart);
    const endRatio = (selectionEndIndex / track.length - chartStart) / (chartEnd - chartStart);

    const width = chart.clientWidth - 2 * chartPadding;

    selectionIndicator.style.transform = `translateX(${chartPadding + width * startRatio}px)`;
    selectionIndicator.style.width = `${(endRatio - startRatio) * width}px`;

    map.getSource('selection').setData(
        getGeoJson(track.slice(selectionStartIndex, selectionEndIndex)),
    );
}
