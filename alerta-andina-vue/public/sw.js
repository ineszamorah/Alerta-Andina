/*
 * Service Worker mínimo — Alerta Andina
 * ---------------------------------------------------------------
 * Alcance deliberado de esta entrega:
 * Este Service Worker existe únicamente para que el navegador
 * considere la app "instalable" como PWA real (Chrome exige un SW
 * registrado, con al menos un listener de "fetch", para mostrar el
 * prompt de instalación). NO implementa una estrategia de caché
 * offline completa a propósito: cachear todas las rutas, los datos
 * de sismos y los tiles del mapa es un trabajo mayor (invalidación,
 * tamaño de caché, datos desactualizados mostrados como si fueran en
 * vivo) que queda fuera del alcance de esta entrega y se documenta
 * como mejora futura en la memoria del proyecto.
 *
 * Pendiente / posible mejora futura (no implementado aquí):
 *  - Cache-first para el shell (html/css/js) con actualización en
 *    segundo plano (estrategia stale-while-revalidate).
 *  - Cache de los tiles del mapa ya visitados.
 *  - Cola de reintentos para fetch() cuando no hay conexión.
 */

const SW_VERSION = "alerta-andina-sw-v1";

self.addEventListener("install", (event) => {
  // Sin precache intencional (ver nota de alcance arriba).
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener de fetch mínimo, requerido para que el navegador trate la
// app como instalable. Deja pasar la petición normal a la red; no
// intercepta ni cachea respuestas.
self.addEventListener("fetch", (event) => {
  // Intencionalmente no se hace event.respondWith(...) con caché.
});
