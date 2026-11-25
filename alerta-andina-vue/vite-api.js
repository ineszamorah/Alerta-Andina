/*
 * vite-api.js — mini API de Alerta Andina dentro del servidor de Vite
 * ---------------------------------------------------------------
 * Hace lo mismo que servidor.py, pero sin tener que arrancarlo aparte:
 *
 *  /api/noticias?q=<búsqueda>   Lee el RSS de Google News desde el servidor
 *                               (el navegador no puede por CORS) y lo
 *                               devuelve como JSON. Caché de 15 minutos.
 *  /api/lugar?lat=&lon=&zoom=   Pregunta a OpenStreetMap (Nominatim) qué
 *                               ciudad hay en esas coordenadas, con User-Agent
 *                               propio, caché y máx. 1 petición por segundo
 *                               (lo pide la política de uso de Nominatim).
 *
 * Funciona con `npm run dev` y `npm run preview`. En un hosting estático
 * (solo la carpeta dist/) no existe: la app usa entonces sus alternativas.
 */

const UA = "AlertaAndina/1.0 (proyecto educativo, posgrado Shifta)";
const CACHE_MS = 15 * 60 * 1000;
const cacheNoticias = new Map(); // consulta -> { t, datos }
const cacheLugares = new Map();  // "lat,lon,zoom" -> datos
let ultimaNominatim = 0;
let colaNominatim = Promise.resolve();

/* ---------- Google News ---------- */
function decodificar(txt) {
  return txt
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .trim();
}
function etiqueta(xml, nombre) {
  const m = xml.match(new RegExp("<" + nombre + "[^>]*>([\\s\\S]*?)</" + nombre + ">"));
  return m ? decodificar(m[1]) : "";
}
export function parsearRSS(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const titulo = etiqueta(m[1], "title");
    const link = etiqueta(m[1], "link");
    const ms = Date.parse(etiqueta(m[1], "pubDate"));
    if (titulo && link.startsWith("https://")) items.push({ titulo, link, ms: isFinite(ms) ? ms : null });
  }
  return items.slice(0, 15);
}
async function leerGoogleNews(consulta) {
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(consulta) + "&hl=es-419&gl=PE&ceid=PE:es-419";
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return parsearRSS(await r.text());
}

/* ---------- Nominatim (OpenStreetMap) ---------- */
function leerNominatim(lat, lon, zoom) {
  // En cola: una petición detrás de otra, con 1 s de separación
  const tarea = colaNominatim.then(async () => {
    const espera = 1050 - (Date.now() - ultimaNominatim);
    if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
    ultimaNominatim = Date.now();
    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=es" +
      "&lat=" + lat.toFixed(3) + "&lon=" + lon.toFixed(3) + "&zoom=" + zoom;
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
  colaNominatim = tarea.catch(() => {});
  return tarea;
}

/* ---------- Rutas ---------- */
function responder(res, codigo, datos) {
  res.statusCode = codigo;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(datos));
}

async function manejar(req, res, next) {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/noticias") {
    const consulta = (url.searchParams.get("q") || "").trim().slice(0, 200);
    if (!consulta) return responder(res, 400, { error: "falta q" });
    const guardado = cacheNoticias.get(consulta);
    if (guardado && Date.now() - guardado.t < CACHE_MS) return responder(res, 200, guardado.datos);
    try {
      const datos = { origen: "Google News", items: await leerGoogleNews(consulta) };
      cacheNoticias.set(consulta, { t: Date.now(), datos });
      return responder(res, 200, datos);
    } catch (e) {
      return responder(res, 502, { error: "No se pudo leer Google News: " + e.message });
    }
  }

  if (url.pathname === "/api/lugar") {
    const lat = parseFloat(url.searchParams.get("lat"));
    const lon = parseFloat(url.searchParams.get("lon"));
    const zoom = Math.min(18, Math.max(3, parseInt(url.searchParams.get("zoom") || "10", 10) || 10));
    if (!isFinite(lat) || !isFinite(lon)) return responder(res, 400, { error: "faltan lat/lon" });
    const clave = lat.toFixed(3) + "," + lon.toFixed(3) + "," + zoom;
    if (cacheLugares.has(clave)) return responder(res, 200, cacheLugares.get(clave));
    try {
      const datos = await leerNominatim(lat, lon, zoom);
      cacheLugares.set(clave, datos);
      return responder(res, 200, datos);
    } catch (e) {
      return responder(res, 502, { error: "No se pudo consultar OpenStreetMap: " + e.message });
    }
  }

  next();
}

/** Plugin de Vite: añade /api/... al servidor de desarrollo y al de preview. */
export default function apiAlertaAndina() {
  return {
    name: "alerta-andina-api",
    configureServer(server) {
      server.middlewares.use(manejar);
    },
    configurePreviewServer(server) {
      server.middlewares.use(manejar);
    },
  };
}
