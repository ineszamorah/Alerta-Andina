/*
 * settings.js — Preferencias del usuario (localStorage)
 * ---------------------------------------------------------------
 * Persiste: umbral mínimo de magnitud para alertar, zona preferida,
 * y si ya se vio el onboarding. Todo client-side; no hay backend.
 */

const SETTINGS_KEY = "alertaandina_ajustes";

const AJUSTES_POR_DEFECTO = {
  umbralMagnitud: 4.0,
  zona: "peru", // "cerca" | "peru" | "andina" | "mundo"
  onboardingVisto: false,
  notificacionesActivas: false,
  // Ubicación real (opcional), solo para la zona "cerca". No se pide
  // automáticamente: el estado queda "no-solicitada" hasta que el
  // usuario toque "Usar mi ubicación exacta" o elija "Cerca de mí".
  ubicacionEstado: "no-solicitada", // "no-solicitada" | "granted" | "denied" | "error" | "unsupported"
  ubicacionLat: null,
  ubicacionLon: null,
  radioKm: 500,
};

function obtenerAjustes() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? Object.assign({}, AJUSTES_POR_DEFECTO, JSON.parse(raw)) : Object.assign({}, AJUSTES_POR_DEFECTO);
  } catch (e) {
    return Object.assign({}, AJUSTES_POR_DEFECTO);
  }
}

function guardarAjustes(parcial) {
  const actuales = obtenerAjustes();
  const nuevos = Object.assign({}, actuales, parcial);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nuevos));
  } catch (e) {
    // Best-effort: si falla, la sesión actual sigue funcionando en memoria.
  }
  return nuevos;
}

const ZONAS = {
  cerca: { etiqueta: "Cerca de mí" }, // usa geolocalización real (ver geo.js)
  peru: { etiqueta: "Perú" }, // filtrado ya viene acotado desde la API
  andina: { etiqueta: "Región andina" },
  mundo: { etiqueta: "Todo el mundo" },
};
