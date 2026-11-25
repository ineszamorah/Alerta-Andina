/*
 * estado.js — estado compartido de la pantalla de Inicio
 * ---------------------------------------------------------------
 * Un único objeto reactive() de Vue con los sismos cargados y los filtros.
 * Lo leen los componentes de Inicio (que se repintan solos cuando cambia)
 * y también el código vanilla que aún no se ha migrado (mapa, detalle,
 * alertas, Ajustes), a través de window.AA (ver main.js).
 *
 * Así hay una sola "fuente de verdad": antes, app.js guardaba estos datos
 * en variables sueltas y repintaba el DOM a mano cada vez que cambiaban.
 */
import { reactive } from "vue";
import { legado } from "./legado.js";

export const estado = reactive({
  // Datos
  todos: [],        // banda andina (USGS + EMSC, 30 días, desde M2)
  globales: [],     // mundo (M4.5+, 7 días)
  locales: [],      // alrededor de la ubicación de la persona, si la dio
  fuente: "usgs",   // "usgs" (en vivo) o "respaldo" (datos de ejemplo)
  fuentes: [],      // ["USGS", "EMSC"]
  cargando: true,
  error: null,

  // Filtros de Inicio
  zona: "peru",            // "cerca" | "peru" | "andina" | "mundo"
  orden: "recientes",      // "recientes" | "magnitud"
  soloGuardados: false,
  buscandoUbicacion: false,

  // Sismo seleccionado (hero + resaltado en lista y mapa)
  idHero: null,

  // Contadores de "versión": Ajustes y favoritos viven en localStorage
  // (no son reactivos), así que al guardarlos se suma 1 aquí y Vue sabe
  // que tiene que recalcular lo que dependa de ellos.
  versionAjustes: 0,
  versionFavoritos: 0,
});

/* ---------- Lógica de filtrado (antes en app.js) ---------- */

/** "Mayor magnitud" no solo ordena: deja solo los sismos M4.5+, o el
 *  umbral de Ajustes si es más alto. */
const MAG_MINIMA_MAYOR = 4.5;

export function umbralActual() {
  void estado.versionAjustes; // dependencia para Vue
  const u = Number(legado.obtenerAjustes().umbralMagnitud) || 0;
  return estado.orden === "magnitud" ? Math.max(u, MAG_MINIMA_MAYOR) : u;
}

export function superaUmbral(s) {
  return (s.properties.mag || 0) >= umbralActual();
}

function esDePeru(s) {
  const lugar = (s.properties.place || "").toLowerCase();
  return lugar.includes("peru") || lugar.includes("perú");
}

/** Unión sin duplicados de los tres feeds. */
export function unirFeeds() {
  const vistos = new Set();
  return estado.todos.concat(estado.globales, estado.locales).filter((s) => {
    if (vistos.has(s.id)) return false;
    vistos.add(s.id);
    return true;
  });
}

/** Sismos dentro del radio elegido, ordenados por distancia. */
export function sismosCercaDeMi() {
  void estado.versionAjustes;
  const a = legado.obtenerAjustes();
  if (a.ubicacionEstado !== "granted") return [];
  return unirFeeds()
    .map((s) => {
      const [lon, lat] = s.geometry.coordinates;
      return Object.assign({}, s, { _distanciaKm: legado.distanciaKm(a.ubicacionLat, a.ubicacionLon, lat, lon) });
    })
    .filter((s) => s._distanciaKm <= a.radioKm)
    .sort((x, y) => x._distanciaKm - y._distanciaKm);
}

export function datosBaseSegunZona() {
  if (estado.zona === "mundo") return unirFeeds();
  if (estado.zona === "peru") return estado.todos.filter(esDePeru);
  if (estado.zona === "cerca") return sismosCercaDeMi();
  return estado.todos.slice();
}

function ordenar(lista) {
  if (estado.orden === "magnitud") return lista.sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0));
  return lista.sort((a, b) => b.properties.time - a.properties.time);
}

function filtrarGuardados(lista) {
  if (!estado.soloGuardados) return lista;
  void estado.versionFavoritos;
  return lista.filter((s) => legado.esFavorito(s.id));
}

/** Lista principal de Inicio: zona + umbral + guardados + orden. */
export function sismosFiltrados() {
  const lista = filtrarGuardados(datosBaseSegunZona().filter(superaUmbral));
  // "Cerca de mí" ya viene ordenada por distancia
  return estado.zona === "cerca" ? lista : ordenar(lista);
}

/** "En el mundo": los M4.5+ que no están ya en la lista principal. */
export function sismosDelMundo(listaZona) {
  const ids = new Set(listaZona.map((s) => s.id));
  return ordenar(filtrarGuardados(estado.globales.filter((s) => !ids.has(s.id) && superaUmbral(s))));
}

/** Sismo del hero: el elegido si sigue en la lista; si no, el primero. */
export function sismoHero(lista = sismosFiltrados()) {
  return lista.find((s) => s.id === estado.idHero) || estado.globales.find((s) => s.id === estado.idHero) || lista[0] || null;
}
