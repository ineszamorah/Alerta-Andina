/*
 * main.js — punto de entrada de Vite
 * ---------------------------------------------------------------
 * Migración progresiva a Vue: la pantalla de Inicio (hero, filtros y
 * listas) ya es Vue; el resto de la app (mapa, detalle, Mi Plan, Ajustes,
 * emergencia, onboarding) sigue siendo el JavaScript vanilla de antes.
 *
 * Orden de arranque:
 *  1. index.html carga los scripts clásicos de public/js (api, ajustes,
 *     favoritos, mapa…), que declaran funciones globales.
 *  2. Este módulo crea el estado compartido, lo publica en window.AA y
 *     monta los componentes Vue.
 *  3. Después carga app.js y plan.js (vanilla), que leen y escriben ese
 *     mismo estado a través de window.AA.
 */
import { createApp } from "vue";
import PantallaInicio from "./components/PantallaInicio.vue";
import * as logica from "./estado.js";

const { estado } = logica;

// Puente para el código vanilla: el estado y la lógica de filtrado.
// app.js añade aquí sus propias funciones (abrirDetalle, establecerZona…)
// para que los componentes Vue puedan llamarlas.
window.AA = { ...logica };

// Ajustes y favoritos se guardan en localStorage (no son reactivos). Al
// guardar, avisamos a Vue sumando 1 a su "versión" para que recalcule.
const guardarAjustesOriginal = window.guardarAjustes;
window.guardarAjustes = function (parcial) {
  const r = guardarAjustesOriginal(parcial);
  estado.versionAjustes++;
  return r;
};
const alternarFavoritoOriginal = window.alternarFavorito;
window.alternarFavorito = function (id) {
  const r = alternarFavoritoOriginal(id);
  estado.versionFavoritos++;
  return r;
};

createApp(PantallaInicio).mount("#app-inicio");

// Código vanilla aún no migrado (en orden: plan.js usa cosas que prepara app.js)
import("./vanilla/app.js").then(() => import("./vanilla/plan.js"));
