import { defineStore } from 'pinia';
import { parse } from '@/functions/tcx';
import { clamp, getName, lerp } from '@/functions/misc';
import type { Track } from '@/types/tracks';
import type { Ranges } from '@/types/misc';
import { getRanges } from '@/functions/tracks';

export interface State {
  track: Track | undefined;
  chartStart: number;
  chartEnd: number;
  cursorPosition: number | undefined;
}

export const useStore = defineStore('store', {
  state: (): State => {
    return {
      track: undefined,
      chartStart: 0,
      chartEnd: 1,
      cursorPosition: undefined,
    };
  },
  getters: {
    name(state): string | undefined {
      return state.track !== undefined ? getName(state.track) : undefined;
    },
    ranges(state): Ranges | undefined {
      return state.track !== undefined ? getRanges(state.track) : undefined;
    },
    isCursorActive(state): boolean {
      return state.cursorPosition !== undefined && state.track !== undefined;
    },
    cursorPositionIndex(state): number | undefined {
      if (state.track === undefined || state.cursorPosition === undefined) {
        return undefined;
      }

      const ratioZoomed = lerp(state.chartStart, state.chartEnd, state.cursorPosition);
      return clamp(Math.floor(state.track.length * ratioZoomed), 0, state.track.length - 1);
    },
  },
  actions: {
    async importTrack(file: File) {
      this.track = await parse(await file.text());
    },
    setCursor(ratio: number) {
      this.cursorPosition = ratio;
    },
    resetCursor() {
      this.cursorPosition = undefined;
    },
    zoomChart(position: number, delta: number) {
      const range = this.chartEnd - this.chartStart;
      const newRange = range * 2 ** delta;

      const rangeDifference = range - newRange;

      this.chartStart = Math.max(this.chartStart + rangeDifference * position, 0);
      this.chartEnd = Math.min(this.chartEnd - rangeDifference * (1 - position), 1);
    },
  },
});
