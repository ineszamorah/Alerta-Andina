/*
 * geo.js — Geolocalización del navegador (Geolocation API)
 * ---------------------------------------------------------------
 * Ubicación real y opcional del usuario, usada solo para la zona
 * "Cerca de mí": calcula distancia a cada sismo y filtra/ordena por
 * cercanía. Se pide explícitamente (botón en Ajustes o al elegir
 * "Cerca de mí"), se guarda solo en localStorage de este dispositivo,
 * y no se envía a ningún servidor.
 */

function pedirUbicacion() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ estado: "unsupported", lat: null, lon: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ estado: "granted", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        // err.code === 1 → PERMISSION_DENIED; el resto (timeout, posición
        // no disponible) lo agrupamos como "error" genérico.
        resolve({ estado: err.code === 1 ? "denied" : "error", lat: null, lon: null });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

/** Distancia entre dos puntos geográficos (fórmula de Haversine), en km. */
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
