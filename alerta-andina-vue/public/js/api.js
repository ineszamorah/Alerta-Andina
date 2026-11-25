// Consumo de la API de USGS (GeoJSON, sin API key). El IGP no tiene
// una API pública documentada, por eso uso USGS y lo dejo claro en
// el panel "De dónde vienen los datos" del home, para no simular que
// el dato es del IGP cuando no lo es.
//
// Si el fetch falla (sin conexión, caída, timeout) caigo a
// data/sample-quakes.json y lo aviso en el status banner — no quería
// que la app se quedara en blanco si USGS no responde.

const USGS_ENDPOINT =
  "https://earthquake.usgs.gov/fdsnws/event/1/query" +
  "?format=geojson" +
  "&starttime=" + getStartTime() +
  "&minlatitude=-20&maxlatitude=1" +   // banda andina: sur de Perú/Bolivia a norte de Ecuador
  "&minlongitude=-82&maxlongitude=-66" +
  "&minmagnitude=2.5" +
  "&orderby=time";

// Segunda consulta, sin límite geográfico, para la sección "En el mundo".
// Umbral de magnitud más alto (4.5) y ventana más corta (7 días) porque
// a nivel mundial un umbral bajo como el de la banda andina devolvería
// cientos de resultados por día.
const USGS_GLOBAL_ENDPOINT =
  "https://earthquake.usgs.gov/fdsnws/event/1/query" +
  "?format=geojson" +
  "&starttime=" + getStartTimeGlobal() +
  "&minmagnitude=4.5" +
  "&orderby=time" +
  "&limit=20";

// Segunda fuente para la banda andina: EMSC (Euro-Mediterranean Seismological
// Centre, servicio FDSN abierto). Registra sismos pequeños de Perú que USGS
// no publica (USGS casi no cataloga < M4 fuera de EE. UU.); es lo que hace
// que en apps de referencia aparezcan sismos de M2–3.
const EMSC_ENDPOINT =
  "https://www.seismicportal.eu/fdsnws/event/1/query" +
  "?format=json&limit=500&orderby=time&minmag=2" +
  "&minlat=-20&maxlat=1&minlon=-82&maxlon=-66" +
  "&start=" + getStartTime();

const FALLBACK_ENDPOINT = "data/sample-quakes.json";
const FETCH_TIMEOUT_MS = 6000;

function getStartTime() {
  const d = new Date();
  d.setDate(d.getDate() - 30); // último mes
  return d.toISOString().slice(0, 10);
}

function getStartTimeGlobal() {
  const d = new Date();
  d.setDate(d.getDate() - 7); // última semana
  return d.toISOString().slice(0, 10);
}

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function tituloRegion(txt) {
  return String(txt || "").toLowerCase().replace(/(^|\s|\()(\S)/g, (m, a, b) => a + b.toUpperCase());
}

/** Normaliza un evento EMSC a la misma forma que USGS (GeoJSON), para que
 *  el resto de la app no distinga la fuente. */
function normalizarEMSC(f) {
  const p = f.properties || {};
  const mag = Number(p.mag);
  const t = Date.parse(p.time);
  const c = (f.geometry && f.geometry.coordinates) || [p.lon, p.lat, -(p.depth || 0)];
  if (!isFinite(mag) || !isFinite(t) || c[0] == null || c[1] == null) return null;
  if (p.evtype && p.evtype !== "ke") return null; // solo sismos, no explosiones
  return {
    type: "Feature",
    id: "emsc-" + (p.unid || f.id),
    properties: {
      mag, magType: p.magtype || "", time: t,
      place: p.flynn_region || "",
      status: "automatic", fuente: fuenteEMSC(p.auth),
    },
    geometry: { type: "Point", coordinates: [Number(c[0]), Number(c[1]), Math.abs(Number(p.depth != null ? p.depth : c[2]) || 0)] },
  };
}

/** EMSC no mide: reúne lo que publican las redes de cada país. El campo
 *  "auth" dice qué red dio el dato (en Perú suele ser el IGP). */
const REDES = {
  IGP: "IGP (Perú)", IGN: "IGN (España)", MDD: "IGN (España)", CSN: "CSN (Chile)", GUC: "CSN (Chile)",
  IGEPN: "IG-EPN (Ecuador)", SGC: "SGC (Colombia)", RSNC: "SGC (Colombia)", INGV: "INGV (Italia)",
  ICGC: "ICGC (Cataluña)", IPMA: "IPMA (Portugal)", OCA: "OCA (Francia)", LDG: "LDG (Francia)", BGS: "BGS (Reino Unido)",
};
function fuenteEMSC(auth) {
  const red = String(auth || "").trim().toUpperCase();
  if (!red || red === "EMSC") return "EMSC";
  return (REDES[red] || red) + " vía EMSC";
}

async function obtenerSismosEMSC() {
  try {
    const res = await fetchWithTimeout(EMSC_ENDPOINT, FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error("EMSC respondió " + res.status);
    const data = await res.json();
    return (data.features || []).map(normalizarEMSC).filter(Boolean);
  } catch (e) {
    return []; // fuente complementaria: si falla, se sigue con USGS
  }
}

/** Une USGS + EMSC sin duplicar: un evento EMSC se descarta si ya hay uno de
 *  USGS a < 90 s y < 1° de distancia (mismo sismo reportado por dos redes). */
function unirUSGSyEMSC(usgs, emsc) {
  const extra = emsc.filter((e) => {
    const [lo, la] = e.geometry.coordinates;
    return !usgs.some((u) => {
      const [ulo, ula] = u.geometry.coordinates;
      return Math.abs(u.properties.time - e.properties.time) < 90000 && Math.abs(ulo - lo) < 1 && Math.abs(ula - la) < 1;
    });
  });
  return usgs.concat(extra).sort((a, b) => b.properties.time - a.properties.time);
}

/**
 * Sismos alrededor de la ubicación del usuario (para "Cerca de mí" fuera de
 * los Andes). Las otras dos consultas solo cubren la banda andina (desde M2)
 * y el mundo desde M4.5; sin esta, alguien en España nunca vería sismos
 * pequeños cerca, por mucho que bajara el umbral.
 */
async function obtenerSismosCercanos(lat, lon, radioKm) {
  const inicio = getStartTime(); // 30 días
  const usgs = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=500" +
    "&minmagnitude=2&starttime=" + inicio +
    "&latitude=" + lat.toFixed(3) + "&longitude=" + lon.toFixed(3) + "&maxradiuskm=" + Math.round(radioKm);
  const emsc = "https://www.seismicportal.eu/fdsnws/event/1/query?format=json&orderby=time&limit=500" +
    "&minmag=2&start=" + inicio +
    "&lat=" + lat.toFixed(3) + "&lon=" + lon.toFixed(3) + "&maxradius=" + (radioKm / 111.2).toFixed(2);
  const [u, e] = await Promise.all([
    fetchWithTimeout(usgs, FETCH_TIMEOUT_MS).then((r) => (r.ok ? r.json() : { features: [] })).then((d) => d.features || []).catch(() => []),
    fetchWithTimeout(emsc, FETCH_TIMEOUT_MS).then((r) => (r.ok ? r.json() : { features: [] })).then((d) => (d.features || []).map(normalizarEMSC).filter(Boolean)).catch(() => []),
  ]);
  return traducirFeatures(unirUSGSyEMSC(u, e));
}

/**
 * Obtiene la lista de sismos recientes.
 * @returns {Promise<{features: object[], source: "usgs"|"local", error: string|null}>}
 */
async function obtenerSismos() {
  const [usgsRes, emsc] = await Promise.all([
    (async () => {
      try {
        const res = await fetchWithTimeout(USGS_ENDPOINT, FETCH_TIMEOUT_MS);
        if (!res.ok) throw new Error("USGS respondió " + res.status);
        const data = await res.json();
        return { ok: true, features: data.features || [] };
      } catch (err) {
        return { ok: false, features: [] };
      }
    })(),
    obtenerSismosEMSC(),
  ]);

  if (usgsRes.ok || emsc.length) {
    const features = unirUSGSyEMSC(usgsRes.features, emsc);
    if (features.length) {
      return { features: traducirFeatures(features), source: "usgs", fuentes: [usgsRes.ok ? "USGS" : null, emsc.length ? "EMSC" : null].filter(Boolean), error: null };
    }
    return await usarRespaldo("Las fuentes no devolvieron sismos recientes para la zona. Mostrando datos de ejemplo.");
  }
  // Sin conexión, API caída, timeout o bloqueo de red.
  return await usarRespaldo("No se pudo conectar con USGS ni EMSC. Mostrando datos de ejemplo guardados localmente.");
}

/**
 * Obtiene sismos destacados a nivel mundial (sección "En el mundo").
 * Es secundaria: si falla, no hay respaldo local — esa sección
 * simplemente queda vacía con su propio aviso, sin tapar el resto
 * de la app (el feed principal de la zona andina sigue funcionando).
 * @returns {Promise<{features: object[], error: string|null}>}
 */
async function obtenerSismosGlobales() {
  try {
    const res = await fetchWithTimeout(USGS_GLOBAL_ENDPOINT, FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error("USGS (global) respondió " + res.status);
    const data = await res.json();
    return { features: traducirFeatures(data.features), error: null };
  } catch (err) {
    return { features: [], error: "No se pudieron cargar sismos globales en este momento." };
  }
}

async function usarRespaldo(mensaje) {
  try {
    const res = await fetch(FALLBACK_ENDPOINT);
    const data = await res.json();
    return { features: data.features, source: "local", error: mensaje };
  } catch (e) {
    return { features: [], source: "local", error: "No se pudieron cargar los datos de sismos." };
  }
}

/** Clasifica una magnitud dentro de la escala de la app. */
function nivelDeMagnitud(mag) {
  if (mag == null) return "leve";
  if (mag < 3.5) return "leve";
  if (mag < 4.5) return "moderado";
  if (mag < 5.5) return "alto";
  return "critico";
}

/** Qué tan "llena" queda la escala visual (anillo): posición de la
 *  magnitud entre M 2.5 y M 7, en % (mínimo 4 para que siempre se vea un trazo). */
function pctDeMagnitud(mag) {
  const m = mag == null ? 2.5 : mag;
  return Math.round(Math.min(100, Math.max(4, ((m - 2.5) / 4.5) * 100)));
}

function etiquetaNivel(nivel) {
  return { leve: "Leve", moderado: "Moderado", alto: "Alto", critico: "Crítico" }[nivel] || "Leve";
}

/** "hace una hora", "hace un día"… hasta 3 días; después, la fecha real
 *  en formato dd/mm/aa (p. ej. 10/10/26). */
function tiempoRelativo(ms) {
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return "justo ahora";
  if (diffMin < 60) return diffMin === 1 ? "hace un minuto" : "hace " + diffMin + " minutos";
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH === 1 ? "hace una hora" : "hace " + diffH + " horas";
  const diffD = Math.floor(diffH / 24);
  if (diffD <= 3) return diffD === 1 ? "hace un día" : "hace " + diffD + " días";
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return dd + "/" + mm + "/" + String(d.getFullYear()).slice(-2);
}
