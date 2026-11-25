<!--
  FiltrosInicio — fila de filtros de Inicio: zona, orden y "Solo guardados".
  Escribe directamente en el estado compartido; la lista se recalcula sola.
-->
<script setup>
import { computed } from "vue";
import DropdownFiltro from "./DropdownFiltro.vue";
import { estado } from "../estado.js";

const opcionesZona = [
  { valor: "cerca", texto: "Cerca de mí" },
  { valor: "peru", texto: "Perú" },
  { valor: "andina", texto: "Región andina" },
  { valor: "mundo", texto: "Todo el mundo" },
];
const opcionesOrden = [
  { valor: "recientes", texto: "Más recientes" },
  { valor: "magnitud", texto: "Mayor magnitud (M4.5+)" },
];

// Cambiar de zona puede requerir pedir la ubicación y sincronizar Ajustes
// (código vanilla): por eso pasa por window.AA en vez de escribir el estado.
const zona = computed({
  get: () => estado.zona,
  set: (valor) => window.AA.establecerZona(valor),
});
</script>

<template>
  <div class="filters-row">
    <DropdownFiltro
      v-model="zona"
      :opciones="opcionesZona"
      :texto-chip="estado.buscandoUbicacion ? 'Buscando ubicación…' : ''"
    />
    <DropdownFiltro v-model="estado.orden" :opciones="opcionesOrden" />
    <button
      class="chip"
      :class="{ 'is-active': estado.soloGuardados }"
      type="button"
      :aria-pressed="estado.soloGuardados"
      @click="estado.soloGuardados = !estado.soloGuardados"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.75L6 21V4.5z" /></svg>
      Solo guardados
    </button>
  </div>
</template>
