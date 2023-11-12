<template>
  <div class="top-row">
    <canvas ref="leftAxisCanvas" class="axis-left"></canvas>
    <canvas
      ref="chartCanvas"
      class="chart"
      @mousemove="setCursor"
      @mouseout="store.resetCursor"
      @wheel="zoom"
    ></canvas>
    <canvas ref="rightAxisCanvas" class="axis-right"></canvas>
  </div>
  <div class="bottom-row">
    <canvas ref="bottomAxisCanvas" class="axis-bottom"></canvas>
  </div>

  <div class="cursor" :style="{ transform: `translateX(${cursorOffset}px)` }"></div>
  <div class="cursor-left" :style="leftCursorStyle"></div>
  <div class="cursor-right" :style="rightCursorStyle"></div>

  <div class="selection-indicator"></div>
</template>

<script setup lang="ts">
  import { useStore } from '@/store';
  import { clamp } from '@/functions/misc';
  import type { Ranges } from '@/types/misc';
  import type { Track } from '@/types/tracks';
  import { computed, onMounted, ref, watch } from 'vue';
  import { chartPadding, chartZoomSpeed } from '@/constants';
  import {
    calcTickInterval,
    projectX,
    projectY,
    resetCanvas,
    crisp,
    downscale,
  } from '@/functions/chart';

  const chartCanvas = ref<HTMLCanvasElement>();
  const bottomAxisCanvas = ref<HTMLCanvasElement>();
  const leftAxisCanvas = ref<HTMLCanvasElement>();
  const rightAxisCanvas = ref<HTMLCanvasElement>();

  let chartCtx: CanvasRenderingContext2D;
  let bottomAxisCtx: CanvasRenderingContext2D;
  let leftAxisCtx: CanvasRenderingContext2D;
  let rightAxisCtx: CanvasRenderingContext2D;

  const chartCanvasWidth = ref(0);
  const chartCanvasHeight = ref(0);

  const chartWidth = computed(() => chartCanvasWidth.value - 2 * chartPadding);
  const chartHeight = computed(() => chartCanvasHeight.value);

  const store = useStore();

  onMounted(() => {
    chartCtx = chartCanvas.value!.getContext('2d')!;
    bottomAxisCtx = bottomAxisCanvas.value!.getContext('2d')!;
    leftAxisCtx = leftAxisCanvas.value!.getContext('2d')!;
    rightAxisCtx = rightAxisCanvas.value!.getContext('2d')!;

    rememberChartSize();
    draw();
  });

  window.addEventListener('resize', () => rememberChartSize());

  const cursorOffset = computed<number>(() => {
    const { track, cursorPositionIndex } = store;

    if (track === undefined || cursorPositionIndex === undefined) {
      return 0;
    }

    const minTime = track[0].time;
    const maxTime = track[track.length - 1].time;
    const time = track[cursorPositionIndex].time;

    const width = chartWidth.value;
    const { chartStart, chartEnd } = store;

    const x = projectX(time, minTime, maxTime, chartWidth.value, chartStart, chartEnd);

    return Math.floor(Math.min(x - chartPadding, width - 1));
  });

  const leftCursorStyle = computed(() => {
    const { track, ranges, cursorPositionIndex } = store;

    if (track === undefined || ranges === undefined || cursorPositionIndex === undefined) {
      return {
        width: '0',
        transform: 'translateY(0)',
      };
    }

    const { minAltitude, maxAltitude } = ranges;
    const altitude = track[cursorPositionIndex].altitude;
    const offset = projectY(altitude, minAltitude, maxAltitude, chartHeight.value);

    return {
      width: `${cursorOffset.value}px`,
      transform: `translateY(${Math.round(offset)}px)`,
    };
  });

  const rightCursorStyle = computed(() => {
    const { track, ranges, cursorPositionIndex } = store;

    if (track === undefined || ranges === undefined || cursorPositionIndex === undefined) {
      return {
        width: '0',
        transform: 'translateY(0)',
      };
    }

    const { minSpeed, maxSpeed } = ranges;
    const speed = track[cursorPositionIndex].speed;
    const offset = projectY(speed, minSpeed, maxSpeed, chartHeight.value);

    return {
      width: `${chartWidth.value - cursorOffset.value}px`,
      transform: `translateY(${Math.round(offset)}px)`,
    };
  });

  function rememberChartSize(): void {
    const canvas = chartCanvas.value;

    if (canvas !== undefined && canvas !== null) {
      chartCanvasWidth.value = canvas.clientWidth;
      chartCanvasHeight.value = canvas.clientHeight;
    }
  }

  watch(
    [() => store.track, () => store.chartStart, () => store.chartEnd, chartWidth, chartHeight],
    () => draw(),
  );

  function setCursor(e: MouseEvent): void {
    store.setCursor((e.offsetX - chartPadding) / chartWidth.value);
  }

  function zoom(e: WheelEvent): void {
    store.zoomChart(
      clamp((e.offsetX - chartPadding) / chartWidth.value, 0, 1),
      e.deltaY * chartZoomSpeed,
    );
  }

  function draw(): void {
    const { track, ranges } = store;

    if (track === undefined || ranges === undefined) {
      return;
    }

    resetCanvas(chartCtx);

    const region = new Path2D();
    region.rect(chartPadding, 0, chartWidth.value, chartHeight.value);
    chartCtx.clip(region);

    drawElevation(track, ranges);
    drawSpeed(track, ranges);

    drawBottomAxis(ranges);
    drawLeftAxis(ranges);
    drawRightAxis(ranges);
  }

  function drawElevation(track: Track, ranges: Ranges): void {
    const ctx = chartCtx;

    const width = chartWidth.value;
    const height = chartHeight.value;

    const { chartStart, chartEnd } = store;
    const { minAltitude, maxAltitude, minTime, maxTime } = ranges;

    ctx.beginPath();

    const startIndex = Math.floor((track.length - 1) * store.chartStart);
    const endIndex = Math.ceil((track.length - 1) * store.chartEnd);

    for (let i = startIndex; i <= endIndex; i++) {
      const point = track[i];

      const x = projectX(point.time, minTime, maxTime, width, chartStart, chartEnd);
      const y = projectY(point.altitude, minAltitude, maxAltitude, height);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.lineTo(width + chartPadding, height);
    ctx.lineTo(chartPadding, height);
    ctx.closePath();

    ctx.fillStyle = '#fb9a99';
    ctx.fill();
  }

  function drawSpeed(track: Track, ranges: Ranges): void {
    const ctx = chartCtx;

    const width = chartWidth.value;
    const height = chartHeight.value;

    const { chartStart, chartEnd } = store;
    const { minSpeed, maxSpeed, minTime, maxTime } = ranges;

    ctx.beginPath();

    const downscaled = downscale(track, width, chartStart, chartEnd);

    for (let i = 0; i < downscaled.length; i++) {
      const x = projectX(downscaled[i][0], minTime, maxTime, width, chartStart, chartEnd);
      const y = projectY(downscaled[i][2], minSpeed, maxSpeed, height);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    for (let i = downscaled.length - 1; i >= 0; i--) {
      const x = projectX(downscaled[i][0], minTime, maxTime, width, chartStart, chartEnd);
      const y = projectY(downscaled[i][3], minSpeed, maxSpeed, height);

      ctx.lineTo(x, y);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();

    for (let i = 0; i < downscaled.length; i++) {
      const [time, speed] = downscaled[i];

      const x = projectX(time, minTime, maxTime, width, chartStart, chartEnd);
      const y = projectY(speed, minSpeed, maxSpeed, height);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // ctx.lineTo(width + chartPadding, height);
    // ctx.lineTo(chartPadding, height);
    // ctx.closePath();
    // ctx.fillStyle = '#1f78b4';
    // ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBottomAxis(ranges: Ranges): void {
    const ctx = bottomAxisCtx;
    const width = chartWidth.value;

    const { chartStart, chartEnd } = store;
    const { minTime, maxTime } = ranges;

    resetCanvas(ctx);

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    ctx.beginPath();
    ctx.moveTo(chartPadding, crisp(0));
    ctx.lineTo(chartPadding + width, crisp(0));

    const duration = maxTime - minTime;

    const niceValues = [
      1,
      5,
      10,
      30,
      60,
      5 * 60,
      10 * 60,
      30 * 60,
      60 * 60,
      2 * 60 * 60,
      4 * 60 * 60,
      8 * 60 * 60,
      16 * 60 * 60,
    ].map(seconds => seconds * 1000);

    const maxTicksCount = width / 75 / (chartEnd - chartStart);
    const interval = calcTickInterval(niceValues, duration, maxTicksCount);

    const firstTickTime = Math.ceil(minTime / interval) * interval;

    for (let time = firstTickTime; time < maxTime; time += interval) {
      const x = crisp(projectX(time, minTime, maxTime, width, chartStart, chartEnd));

      if (x < chartPadding || x > width + chartPadding) {
        continue;
      }

      ctx.moveTo(x, 0);
      ctx.lineTo(x, 5);

      const date = new Date(time);
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');

      const text = interval < 60 * 1000 ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;

      ctx.fillText(text, x, 16);
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawLeftAxis(ranges: Ranges): void {
    const ctx = leftAxisCtx;
    const height = chartHeight.value;
    const { minAltitude, maxAltitude } = ranges;

    resetCanvas(ctx);

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    ctx.beginPath();
    ctx.moveTo(crisp(chartPadding), 0);
    ctx.lineTo(crisp(chartPadding), height);

    const range = maxAltitude - minAltitude;

    const niceValues = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 1000];
    const interval = calcTickInterval(niceValues, range, height / 20);

    for (let altitude = maxAltitude; altitude > minAltitude; altitude -= interval) {
      const y = projectY(altitude, minAltitude, maxAltitude, height);

      ctx.moveTo(chartPadding - 5, crisp(y));
      ctx.lineTo(chartPadding, crisp(y));

      ctx.fillText(String(altitude), chartPadding - 8, clamp(y - 4, -1, height - 8));
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawRightAxis(ranges: Ranges): void {
    const ctx = rightAxisCtx;
    const height = chartHeight.value;
    const { minSpeed, maxSpeed } = ranges;

    resetCanvas(ctx);

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, height);

    const range = maxSpeed - minSpeed;

    const niceValues = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const interval = calcTickInterval(niceValues, range, height / 20);

    for (let speed = maxSpeed; speed > minSpeed; speed -= interval) {
      const y = projectY(speed, minSpeed, maxSpeed, height);

      ctx.moveTo(0, crisp(y));
      ctx.lineTo(5, crisp(y));

      ctx.fillText(String(speed), 8, y - 1);
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
</script>

<style scoped>
  .top-row {
    width: 100%;
    height: 100%;
  }

  .chart {
    display: block;
    width: 100%;
    height: 100%;
    cursor: text;
  }

  .axis-left,
  .axis-right {
    display: block;
    width: 31px;
    height: 100%;
    position: absolute;
    top: 0;
    pointer-events: none;
  }

  .axis-left {
    left: 0;
  }

  .axis-right {
    right: 0;
  }

  .bottom-row {
    width: 100%;
    height: 20px;
  }

  .axis-bottom {
    display: block;
    width: 100%;
    height: 100%;
  }

  .cursor {
    position: absolute;
    top: 0;
    left: 30px;
    width: 0;
    height: 161px;
    border-left: 1px solid #333;
    pointer-events: none;
  }

  .cursor-left,
  .cursor-right {
    position: absolute;
    top: 0;
    width: 200px;
    height: 0;
    border-top: 1px solid rgba(0, 0, 0, 0.2);
  }

  .cursor-left {
    left: 30px;
  }

  .cursor-right {
    right: 30px;
  }

  .selection-indicator {
    position: absolute;
    display: none;
    top: 0;
    left: 0;
    height: 160px;
    pointer-events: none;
    background-color: rgba(0, 0, 0, 0.1);
  }
</style>
