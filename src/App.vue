<template>
  <div class="map">
    <Map />
  </div>
  <div class="bottom-panel">
    <div class="chart">
      <Chart />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { watch } from 'vue';
  import { useStore } from '@/store';
  import Map from '@/components/Map.vue';
  import Chart from '@/components/Chart.vue';

  const store = useStore();

  watch([() => store.name], () => {
    document.title = store.name !== undefined ? `${store.name} — Tracktor` : 'Tracktor';
  });
</script>

<style scoped>
  .map {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 230px;
    width: 100%;
  }

  .bottom-panel {
    display: flex;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 230px;
    background-color: #ffffff;
    padding: 20px;
  }

  .chart {
    position: relative;
    height: 160px;
    flex-grow: 1;
  }
</style>
