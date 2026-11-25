/*
 * lugares.js — Nombres de lugar en español
 * ---------------------------------------------------------------
 * USGS y EMSC entregan el lugar en inglés y, a veces, sin tildes:
 *   USGS: "48 km WNW of Khuzdar, Pakistan"  → "48 km al oeste-noroeste de Khuzdar, Pakistán"
 *   EMSC: "PERU-ECUADOR BORDER REGION"      → "Frontera Perú–Ecuador"
 *         "NEAR COAST OF SOUTHERN PERU"     → "Cerca de la costa del sur de Perú"
 * Se traduce en el momento de cargar los datos, así toda la app (lista,
 * mapa, detalle, alertas, búsqueda de noticias) usa el mismo texto.
 * Los diccionarios no son exhaustivos: si un nombre no está, se deja
 * tal cual (solo se corrigen mayúsculas).
 */

const DIRECCIONES = {
  N: "norte", S: "sur", E: "este", W: "oeste",
  NE: "noreste", NW: "noroeste", SE: "sureste", SW: "suroeste",
  NNE: "nor-noreste", ENE: "este-noreste", ESE: "este-sureste", SSE: "sur-sureste",
  SSW: "sur-suroeste", WSW: "oeste-suroeste", WNW: "oeste-noroeste", NNW: "nor-noroeste",
};

// Clave en minúsculas y sin tildes → nombre correcto en español
const NOMBRES = {
  // Países y territorios
  peru: "Perú", ecuador: "Ecuador", bolivia: "Bolivia", chile: "Chile", colombia: "Colombia",
  argentina: "Argentina", brazil: "Brasil", brasil: "Brasil", venezuela: "Venezuela", paraguay: "Paraguay",
  uruguay: "Uruguay", mexico: "México", guatemala: "Guatemala", "el salvador": "El Salvador",
  honduras: "Honduras", nicaragua: "Nicaragua", "costa rica": "Costa Rica", panama: "Panamá",
  cuba: "Cuba", haiti: "Haití", jamaica: "Jamaica", "dominican republic": "República Dominicana",
  "puerto rico": "Puerto Rico", "saint kitts and nevis": "San Cristóbal y Nieves", "saint lucia": "Santa Lucía",
  martinique: "Martinica", guadeloupe: "Guadalupe", "trinidad and tobago": "Trinidad y Tobago",
  "united states": "Estados Unidos", canada: "Canadá", alaska: "Alaska", california: "California",
  hawaii: "Hawái", nevada: "Nevada", oregon: "Oregón", washington: "Washington", "u.s. virgin islands": "Islas Vírgenes de EE. UU.",
  japan: "Japón", china: "China", taiwan: "Taiwán", philippines: "Filipinas", indonesia: "Indonesia",
  "papua new guinea": "Papúa Nueva Guinea", "new zealand": "Nueva Zelanda", australia: "Australia",
  vanuatu: "Vanuatu", fiji: "Fiyi", tonga: "Tonga", samoa: "Samoa", "american samoa": "Samoa Americana",
  "solomon islands": "Islas Salomón", "new caledonia": "Nueva Caledonia", "wallis and futuna": "Wallis y Futuna",
  "kermadec islands": "Islas Kermadec", "northern mariana islands": "Islas Marianas del Norte", guam: "Guam",
  myanmar: "Myanmar", india: "India", nepal: "Nepal", pakistan: "Pakistán", afghanistan: "Afganistán",
  iran: "Irán", iraq: "Irak", turkey: "Turquía", turkiye: "Turquía", greece: "Grecia", italy: "Italia",
  spain: "España", france: "Francia", portugal: "Portugal", morocco: "Marruecos", algeria: "Argelia",
  tunisia: "Túnez", albania: "Albania", croatia: "Croacia", romania: "Rumanía", russia: "Rusia",
  iceland: "Islandia", tajikistan: "Tayikistán", kyrgyzstan: "Kirguistán", kazakhstan: "Kazajistán",
  "south sandwich islands": "Islas Sandwich del Sur", "mid-atlantic ridge": "Dorsal mesoatlántica",
  "east pacific rise": "Dorsal del Pacífico Oriental", "easter island": "Isla de Pascua",
  "galapagos islands": "Islas Galápagos", galapagos: "Galápagos",
  // Regiones / accidentes geográficos frecuentes en EMSC
  pyrenees: "Pirineos", "bay of biscay": "Golfo de Vizcaya", "strait of gibraltar": "Estrecho de Gibraltar",
  "atlantic ocean": "Océano Atlántico", "pacific ocean": "Océano Pacífico", "western mediterranean sea": "Mediterráneo occidental",
  "central mediterranean sea": "Mediterráneo central", "eastern mediterranean sea": "Mediterráneo oriental",
  "adriatic sea": "Mar Adriático", "aegean sea": "Mar Egeo", "dodecanese islands": "Islas del Dodecaneso",
  "canary islands": "Islas Canarias", "azores islands": "Islas Azores", "azores-cape st. vincent ridge": "Dorsal Azores–Cabo San Vicente",
  "chile-argentina border region": "Frontera Chile–Argentina", "peru-bolivia border region": "Frontera Perú–Bolivia",
  "peru-brazil border region": "Frontera Perú–Brasil", "peru-ecuador border region": "Frontera Perú–Ecuador",
  "bolivia-chile border region": "Frontera Bolivia–Chile", "chile-bolivia border region": "Frontera Chile–Bolivia",
  "colombia-ecuador border region": "Frontera Colombia–Ecuador", "jujuy province": "Provincia de Jujuy",
  "salta province": "Provincia de Salta", "san juan province": "Provincia de San Juan", "mendoza province": "Provincia de Mendoza",
  "off coast of": "Frente a la costa de",
  // Ciudades andinas que a veces llegan sin tilde
  huanuco: "Huánuco", ancash: "Áncash", junin: "Junín", apurimac: "Apurímac", "san martin": "San Martín",
  "tingo maria": "Tingo María", acari: "Acarí", jaen: "Jaén", juanjui: "Juanjuí", "puerto maldonado": "Puerto Maldonado",
  camana: "Camaná", ocona: "Ocoña", carhuaz: "Carhuaz", caraveli: "Caravelí", chiguata: "Chiguata",
  potosi: "Potosí", "bahia de caraquez": "Bahía de Caráquez", "bahía de caráquez": "Bahía de Caráquez",
  valparaiso: "Valparaíso", concepcion: "Concepción", copiapo: "Copiapó", curico: "Curicó",
  constitucion: "Constitución", ollague: "Ollagüe", bogota: "Bogotá", medellin: "Medellín",
  popayan: "Popayán", cucuta: "Cúcuta", ibague: "Ibagué", neuquen: "Neuquén", tucuman: "Tucumán",
  michoacan: "Michoacán", queretaro: "Querétaro", "san cristobal": "San Cristóbal",
};

const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "PERU-ECUADOR" → "Peru-Ecuador"; respeta "de", "del", "y", "la"… en minúscula. */
function capitalizar(texto) {
  const menores = new Set(["de", "del", "la", "las", "los", "el", "y", "of", "and"]);
  return String(texto || "")
    .toLowerCase()
    .replace(/[\p{L}\p{N}.']+/gu, (p, i) => (i > 0 && menores.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)));
}

/** Traduce un nombre suelto si está en el diccionario; si no, solo lo capitaliza. */
function nombreEnEspanol(nombre) {
  const limpio = String(nombre || "").trim();
  const clave = sinTildes(limpio.toLowerCase());
  if (NOMBRES[clave]) return NOMBRES[clave];
  // Si viene con mayúsculas correctas (USGS), conservarlas; si es todo
  // mayúsculas o todo minúsculas (EMSC), capitalizar.
  return limpio === limpio.toUpperCase() || limpio === limpio.toLowerCase() ? capitalizar(limpio) : limpio;
}

/** Traduce una región tipo EMSC (Flynn-Engdahl): "SOUTHERN PERU", "NEAR COAST OF CENTRAL CHILE"… */
function regionEnEspanol(texto) {
  const t = String(texto || "").trim();
  const clave = sinTildes(t.toLowerCase());
  if (NOMBRES[clave]) return NOMBRES[clave];

  let m;
  if ((m = /^(.+)-(.+) border region$/i.exec(t))) return "Frontera " + nombreEnEspanol(m[1]) + "–" + nombreEnEspanol(m[2]);
  if ((m = /^near (?:the )?coast of (.+)$/i.exec(t))) return "Cerca de la costa " + conArticulo(regionEnEspanol(m[1]));
  if ((m = /^near (?:the )?(north|south|east|west) coast of (.+)$/i.exec(t)))
    return "Cerca de la costa " + { north: "norte", south: "sur", east: "este", west: "oeste" }[m[1].toLowerCase()] + " " + conArticulo(regionEnEspanol(m[2]));
  if ((m = /^off (?:the )?(?:coast of )?(.+)$/i.exec(t))) return "Frente a la costa " + conArticulo(regionEnEspanol(m[1]));
  if ((m = /^(northern|southern|central|eastern|western|northeastern|northwestern|southeastern|southwestern) (.+)$/i.exec(t))) {
    const zona = {
      northern: "Norte", southern: "Sur", central: "Centro", eastern: "Este", western: "Oeste",
      northeastern: "Noreste", northwestern: "Noroeste", southeastern: "Sureste", southwestern: "Suroeste",
    }[m[1].toLowerCase()];
    return zona + " " + conArticulo(regionEnEspanol(m[2]));
  }
  if ((m = /^(north|south|east|west) of (.+)$/i.exec(t)))
    return { north: "Al norte", south: "Al sur", east: "Al este", west: "Al oeste" }[m[1].toLowerCase()] + " " + conArticulo(regionEnEspanol(m[2]));
  if ((m = /^(.+) region$/i.exec(t))) return "Región " + conArticulo(nombreEnEspanol(m[1]));
  if ((m = /^(.+) islands?$/i.exec(t))) return "Islas " + nombreEnEspanol(m[1]);
  return nombreEnEspanol(t);
}

/** "de" + nombre, con contracción si empieza por "El " ("del Salvador" no: solo en minúscula). */
function conArticulo(nombre) {
  if (/^Islas\b/.test(nombre)) return "de las " + nombre;
  return /^(Sur|Norte|Centro|Este|Oeste)\b/.test(nombre) ? "del " + nombre.charAt(0).toLowerCase() + nombre.slice(1) : "de " + nombre;
}

/**
 * Punto de entrada: convierte el texto de lugar de USGS o EMSC a español.
 * Textos que ya vienen en español (datos de ejemplo) se devuelven igual.
 */
function traducirLugar(lugar) {
  const t = String(lugar || "").trim();
  if (!t) return t;
  // USGS: "<n> km <DIR> of <Lugar>, <País>"
  let m = /^(\d+(?:\.\d+)?)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i.exec(t);
  if (m) {
    const dir = DIRECCIONES[m[2].toUpperCase()] || m[2];
    return m[1] + " km al " + dir + " de " + traducirListaLugares(m[3]);
  }
  // USGS sin distancia: "Ica, Peru" / "south of the Fiji Islands" / "Kermadec Islands region"
  if (t.includes(",")) return traducirListaLugares(t);
  return regionEnEspanol(t);
}

/** "Camana, Peru" → "Camaná, Perú" (cada trozo separado por coma). */
function traducirListaLugares(texto) {
  return texto.split(",").map((p) => {
    const limpio = p.trim();
    const clave = sinTildes(limpio.toLowerCase());
    return NOMBRES[clave] ? NOMBRES[clave] : /\b(region|islands?|coast|border)\b/i.test(limpio) ? regionEnEspanol(limpio) : nombreEnEspanol(limpio);
  }).join(", ");
}

/** Aplica la traducción a una lista de features (modifica una copia de properties). */
function traducirFeatures(features) {
  return (features || []).map((f) => {
    if (!f || !f.properties) return f;
    const original = f.properties.place;
    return Object.assign({}, f, { properties: Object.assign({}, f.properties, { place: traducirLugar(original), placeOriginal: original }) });
  });
}

/* =================================================================
   Ciudad más cercana (geocodificación inversa con OpenStreetMap)
   -----------------------------------------------------------------
   EMSC solo da una región ("SPAIN", "CENTRAL PERU"), así que en la lista
   salía "España" a secas. Para esos sismos se pregunta a Nominatim
   (OpenStreetMap) qué municipio hay en el epicentro y se escribe como
   USGS: "12 km al noroeste de Ponferrada, España".
   - Primero vía /api/lugar (vite-api.js en local, regla de _redirects en Netlify); si falla, directo a Nominatim.
   - Máximo 1 petición por segundo y caché en localStorage (~1 km).
   - En el mar no hay municipio: se deja el nombre original.
   ================================================================= */
const CLAVE_CACHE_CIUDADES = "alertaandina_ciudades";
let cacheCiudades = (() => {
  try { return JSON.parse(localStorage.getItem(CLAVE_CACHE_CIUDADES) || "{}"); } catch (e) { return {}; }
})();
const colaCiudades = [];
let colaActiva = false;

function guardarCacheCiudades() {
  const claves = Object.keys(cacheCiudades);
  if (claves.length > 600) claves.slice(0, claves.length - 600).forEach((k) => delete cacheCiudades[k]);
  try { localStorage.setItem(CLAVE_CACHE_CIUDADES, JSON.stringify(cacheCiudades)); } catch (e) {}
}

/** Pide un reverse geocoding: primero a /api/lugar y si no, directo. */
async function consultarNominatim(lat, lon, zoom) {
  const qs = "lat=" + lat.toFixed(3) + "&lon=" + lon.toFixed(3) + "&zoom=" + zoom;
  const intentar = async (url) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    try {
      const r = await fetch(url, { signal: c.signal });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  };
  try { return await intentar("/api/lugar?" + qs); }
  catch (e) { return intentar("https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=es&" + qs); }
}

/** Distancia en km y rumbo (en palabras) desde (la1,lo1) hacia (la2,lo2). */
function distanciaYRumbo(la1, lo1, la2, lo2) {
  const r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(dLo) * Math.cos(la2 * r);
  const x = Math.cos(la1 * r) * Math.sin(la2 * r) - Math.sin(la1 * r) * Math.cos(la2 * r) * Math.cos(dLo);
  const grados = (Math.atan2(y, x) / r + 360) % 360;
  const rumbos = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];
  return { km, rumbo: rumbos[Math.round(grados / 45) % 8] };
}

/** Convierte la respuesta de Nominatim en "Ciudad, País" (o null). */
function ciudadDeNominatim(d) {
  if (!d || d.error || !d.address) return null;
  const a = d.address;
  const ciudad = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || a.state_district || a.state;
  if (!ciudad || !a.country) return null;
  return { ciudad, pais: a.country, lat: Number(d.lat), lon: Number(d.lon) };
}

function etiquetaCiudad(c, lat, lon) {
  if (!c) return null;
  const { km, rumbo } = distanciaYRumbo(c.lat, c.lon, lat, lon);
  const nombre = c.ciudad + ", " + c.pais;
  return km < 5 ? nombre : Math.round(km) + " km al " + rumbo + " de " + nombre;
}

/** ¿Al sismo le falta la ciudad? (EMSC: "España", "Perú central"…) */
function necesitaCiudad(f) {
  return f && f.properties && !f.properties.ciudadResuelta && !String(f.properties.place || "").includes(",");
}

/**
 * Completa la ciudad de una lista de sismos. Los que están en caché se
 * cambian al momento; el resto se piden de uno en uno y, al llegar,
 * se llama a alCambiar(sismo) para que la vista actualice ese texto.
 */
function completarCiudades(features, alCambiar) {
  (features || []).forEach((f) => {
    if (!necesitaCiudad(f)) return;
    const [lon, lat] = f.geometry.coordinates;
    const clave = lat.toFixed(2) + "," + lon.toFixed(2);
    if (clave in cacheCiudades) {
      const et = etiquetaCiudad(cacheCiudades[clave], lat, lon);
      f.properties.ciudadResuelta = true;
      if (et) f.properties.place = et;
      return;
    }
    if (!colaCiudades.some((x) => x.f.id === f.id)) colaCiudades.push({ f, clave, lat, lon, alCambiar });
  });
  if (colaCiudades.length > 40) colaCiudades.splice(40);
  procesarColaCiudades();
}

async function procesarColaCiudades() {
  if (colaActiva) return;
  colaActiva = true;
  while (colaCiudades.length) {
    const { f, clave, lat, lon, alCambiar } = colaCiudades.shift();
    if (!(clave in cacheCiudades)) {
      try {
        cacheCiudades[clave] = ciudadDeNominatim(await consultarNominatim(lat, lon, 10));
        guardarCacheCiudades();
      } catch (e) {
        continue; // sin conexión: se reintenta en la próxima carga
      }
      await new Promise((r) => setTimeout(r, 1100)); // política de Nominatim: 1/s
    }
    const et = etiquetaCiudad(cacheCiudades[clave], lat, lon);
    f.properties.ciudadResuelta = true;
    if (et) { f.properties.place = et; alCambiar && alCambiar(f); }
  }
  colaActiva = false;
}

/** Calle aproximada para el modo SOS (si hay conexión). */
async function direccionAproximada(lat, lon) {
  const d = await consultarNominatim(lat, lon, 18);
  if (!d || !d.address) return null;
  const a = d.address;
  const calle = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(" ");
  const zona = a.city || a.town || a.village || a.suburb || a.municipality;
  return [calle, zona].filter(Boolean).join(", ") || null;
}
