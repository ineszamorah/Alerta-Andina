<!--
  TarjetaSismo — una tarjeta de la lista: anillo de magnitud, lugar,
  cuándo, nivel y botón de guardar. Se reutiliza en "En tu zona" y en
  "En el mundo" (antes era la función crearTarjetaSismo de app.js, que
  montaba el HTML con innerHTML y le colgaba los eventos a mano).
-->
<script setup>
import { computed, ref } from "vue";
import { estado } from "../estado.js";
import { legado } from "../legado.js";

const props = defineProps({
  sismo: { type: Object, required: true },
  indice: { type: Number, default: 0 },
  seleccionado: { type: Boolean, default: false },
});
const emit = defineEmits(["elegir"]);

const mag = computed(() => props.sismo.properties.mag || 0);
const nivel = computed(() => legado.nivelDeMagnitud(mag.value));
const lugar = computed(() => props.sismo.properties.place || "Ubicación desconocida");
const cuando = computed(() => {
  void estado.versionAjustes; // se refresca en cada recarga de datos
  return legado.tiempoRelativo(props.sismo.properties.time);
});
const guardado = computed(() => {
  void estado.versionFavoritos;
  return legado.esFavorito(props.sismo.id);
});

// Pequeño "latido" del icono al guardar
const latido = ref(false);
function alternarGuardado() {
  legado.alternarFavorito(props.sismo.id);
  latido.value = true;
  setTimeout(() => (latido.value = false), 350);
}
</script>

<template>
  <div
    class="quake-card"
    :class="{ 'is-selected': seleccionado }"
    :data-id="sismo.id"
    :data-nivel="nivel"
    :style="{ animationDelay: Math.min(indice * 0.04, 0.3) + 's' }"
    @click="emit('elegir', sismo)"
  >
    <div class="mag-ring" :data-nivel="nivel" :style="{ '--pct': legado.pctDeMagnitud(mag) }">
      <span class="mag-ring-centro"><span class="mag-ring-num">{{ mag.toFixed(1) }}</span></span>
    </div>
    <div class="quake-info">
      <div class="place">{{ lugar }}</div>
      <div class="meta">{{ cuando }} · <span class="nivel-txt">{{ legado.etiquetaNivel(nivel) }}</span></div>
    </div>
    <button
      class="fav-btn"
      :class="{ 'is-fav': guardado, pulse: latido }"
      type="button"
      :aria-label="guardado ? 'Dejar de seguir' : 'Hacer seguimiento'"
      :aria-pressed="guardado"
      @click.stop="alternarGuardado"
    >
      <svg viewBox="0 0 24 24" :fill="guardado ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.75L6 21V4.5z" /></svg>
    </button>
  </div>
</template>
