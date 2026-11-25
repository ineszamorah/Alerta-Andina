<!--
  PantallaInicio — columna izquierda de la vista Alertas: hero, aviso de
  carga/error, filtros y las dos listas (tu zona y el mundo).
  El mapa de la derecha (escritorio) sigue siendo vanilla + Leaflet.
-->
<script setup>
import { computed, watch } from "vue";
import HeroSismo from "./HeroSismo.vue";
import FiltrosInicio from "./FiltrosInicio.vue";
import ListaSismos from "./ListaSismos.vue";
import { estado, sismosFiltrados, sismosDelMundo, sismoHero } from "../estado.js";
import { legado } from "../legado.js";

const TITULOS_ZONA = {
  cerca: "Cerca de ti",
  peru: "En Perú",
  andina: "En la región andina",
  mundo: "Sismos recientes en el mundo",
};

// Todo lo que se ve se deriva del estado con computed():
// si cambia un filtro o llegan datos nuevos, Vue recalcula y repinta.
const lista = computed(() => sismosFiltrados());
const mundo = computed(() => (estado.zona === "mundo" ? [] : sismosDelMundo(lista.value)));
const hero = computed(() => sismoHero(lista.value));
const idSeleccionado = computed(() => (hero.value ? hero.value.id : null));

const etiquetaFuente = computed(() =>
  estado.fuente === "usgs"
    ? "Fuente: " + (estado.fuentes.length ? estado.fuentes : ["USGS"]).join(" + ") + " (en vivo)"
    : "Fuente: datos de ejemplo"
);

/** Qué decir cuando la lista principal está vacía. */
const ajustes = computed(() => {
  void estado.versionAjustes;
  return legado.obtenerAjustes();
});
const mensajeVacio = computed(() => {
  if (estado.soloGuardados) return "Todavía no estás siguiendo ningún sismo.";
  if (estado.zona === "cerca") {
    const a = ajustes.value;
    if (a.ubicacionEstado === "no-solicitada") return "Activa tu ubicación en Ajustes para ver sismos cerca de ti.";
    if (a.ubicacionEstado === "denied") return "El navegador tiene bloqueada la ubicación para esta página. Pulsa el icono ⓘ a la izquierda de la dirección → Ubicación → Permitir, y luego el botón de abajo.";
    if (a.ubicacionEstado === "unsupported") return "Tu navegador no admite geolocalización.";
    if (a.ubicacionEstado === "error") return "No se pudo obtener tu ubicación. Inténtalo de nuevo en Ajustes.";
    return "No hay sismos dentro de " + a.radioKm + " km de tu ubicación.";
  }
  return "No hay sismos que coincidan con este filtro.";
});
const ofrecerUbicacion = computed(
  () => estado.zona === "cerca" && !estado.soloGuardados && ajustes.value.ubicacionEstado !== "granted"
);

// Al cambiar un filtro, el mapa (vanilla) se vuelve a dibujar y encuadrar.
watch(() => [estado.zona, estado.orden, estado.soloGuardados], () => window.AA && window.AA.alCambiarFiltros());

// Acciones que siguen en el código vanilla (detalle, mapa, ubicación)
const elegir = (sismo) => window.AA.alElegirSismo(sismo);
const abrirDetalle = (sismo) => window.AA.abrirDetalle(sismo);
const usarMiUbicacion = () => window.AA.usarMiUbicacion();
</script>

<template>
  <HeroSismo :sismo="hero" :cargando="estado.cargando" @abrir="abrirDetalle" />

  <div v-if="estado.cargando || estado.error" class="status-banner" :class="{ error: !!estado.error && !estado.cargando }">
    <span v-if="estado.cargando" class="spin"></span>
    <span>{{ estado.cargando ? "Conectando con USGS y EMSC…" : estado.error }}</span>
  </div>

  <FiltrosInicio />

  <ListaSismos
    :titulo="TITULOS_ZONA[estado.zona] || 'Sismos recientes'"
    :etiqueta="etiquetaFuente"
    :sismos="lista"
    :id-seleccionado="idSeleccionado"
    @elegir="elegir"
  >
    <template #vacio>
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /></svg>
      <p>{{ mensajeVacio }}</p>
      <button
        v-if="ofrecerUbicacion"
        class="btn btn-secundario"
        type="button"
        :disabled="estado.buscandoUbicacion"
        @click="usarMiUbicacion"
      >
        {{ estado.buscandoUbicacion ? "Buscando ubicación…" : "Usar mi ubicación" }}
      </button>
    </template>
  </ListaSismos>

  <!-- Se oculta con "Todo el mundo": sería la misma lista repetida -->
  <ListaSismos
    v-if="estado.zona !== 'mundo'"
    class="mt-4"
    titulo="En el mundo"
    etiqueta="M 4.5 o más · 7 días"
    :sismos="mundo"
    :id-seleccionado="idSeleccionado"
    @elegir="elegir"
  >
    <template #vacio>
      <p>{{ estado.soloGuardados ? "No tienes sismos del mundo en seguimiento." : "No hay sismos destacados en el mundo en este momento." }}</p>
    </template>
  </ListaSismos>
</template>
