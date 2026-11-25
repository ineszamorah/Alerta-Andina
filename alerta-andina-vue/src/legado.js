/*
 * legado.js — puente hacia el código "vanilla" que todavía no se ha migrado
 * ---------------------------------------------------------------
 * Los scripts de public/js (api.js, settings.js, favorites.js, geo.js,
 * map.js, lugares.js, notifications.js) se cargan como <script> clásicos
 * en index.html y declaran funciones globales. Este archivo las reúne en
 * un único sitio para que los componentes Vue no dependan de nombres
 * globales sueltos: si mañana se migra api.js a un módulo, solo cambia
 * este archivo.
 */
/* global nivelDeMagnitud, pctDeMagnitud, etiquetaNivel, tiempoRelativo,
   obtenerAjustes, guardarAjustes, esFavorito, alternarFavorito, obtenerFavoritos,
   distanciaKm, ZONAS */

export const legado = {
  nivelDeMagnitud: (mag) => nivelDeMagnitud(mag),
  pctDeMagnitud: (mag) => pctDeMagnitud(mag),
  etiquetaNivel: (nivel) => etiquetaNivel(nivel),
  tiempoRelativo: (ms) => tiempoRelativo(ms),
  obtenerAjustes: () => obtenerAjustes(),
  guardarAjustes: (parcial) => guardarAjustes(parcial),
  esFavorito: (id) => esFavorito(id),
  alternarFavorito: (id) => alternarFavorito(id),
  obtenerFavoritos: () => obtenerFavoritos(),
  distanciaKm: (a, b, c, d) => distanciaKm(a, b, c, d),
  etiquetaZona: (zona) => (ZONAS[zona] && ZONAS[zona].etiqueta) || "Zona",
};
