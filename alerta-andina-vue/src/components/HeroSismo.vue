<!--
  HeroSismo — el anillo grande de arriba con la magnitud del sismo
  seleccionado (o del más reciente). El número "cuenta" hasta su valor
  cuando cambia, salvo si la persona prefiere menos movimiento.
-->
<script setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { estado } from "../estado.js";
import { legado } from "../legado.js";

const props = defineProps({
  sismo: { type: Object, default: null },
  cargando: { type: Boolean, default: false },
});
const emit = defineEmits(["abrir"]);

const mag = computed(() => (props.sismo ? props.sismo.properties.mag || 0 : 0));
const nivel = computed(() => (props.sismo ? legado.nivelDeMagnitud(mag.value) : "leve"));
const texto = computed(() => {
  if (props.cargando) return "Cargando el sismo más reciente…";
  if (!props.sismo) return "No hay sismos recientes para mostrar.";
  void estado.versionAjustes;
  return (props.sismo.properties.place || "Ubicación desconocida") + " · " + legado.tiempoRelativo(props.sismo.properties.time);
});

/* ---- Número animado ---- */
const numero = ref(null); // valor que se está mostrando
let raf = 0;
function animarHasta(hasta) {
  cancelAnimationFrame(raf);
  const desde = numero.value;
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (desde == null || desde === hasta || sinMovimiento) {
    numero.value = hasta;
    return;
  }
  const t0 = performance.now();
  const dur = 900;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3); // ease-out
    numero.value = desde + (hasta - desde) * e;
    if (k < 1) raf = requestAnimationFrame(paso);
  };
  raf = requestAnimationFrame(paso);
}
watch(
  () => (props.sismo ? mag.value : null),
  (m) => {
    if (m == null) numero.value = null;
    else animarHasta(m);
  },
  { immediate: true }
);
onBeforeUnmount(() => cancelAnimationFrame(raf));

const textoNumero = computed(() => {
  if (props.cargando) return "–.–";
  return numero.value == null ? "—" : numero.value.toFixed(1);
});
</script>

<template>
  <button
    class="hero"
    id="hero"
    type="button"
    :data-nivel="nivel"
    :disabled="!cargando && !sismo"
    aria-label="Ver detalle del sismo seleccionado"
    @click="sismo && emit('abrir', sismo)"
  >
    <span
      class="mag-ring mag-ring--hero"
      :class="{ 'is-cargando': cargando }"
      :data-nivel="nivel"
      :style="{ '--pct': cargando || !sismo ? 0 : legado.pctDeMagnitud(mag) }"
    >
      <span class="mag-ring-centro">
        <span class="mag-ring-label">MAGNITUD</span>
        <span class="mag-ring-num">{{ textoNumero }}</span>
      </span>
    </span>
    <span class="hero-nivel">{{ sismo && !cargando ? legado.etiquetaNivel(nivel) : "" }}</span>
    <span class="hero-texto">{{ texto }}</span>
  </button>
</template>
