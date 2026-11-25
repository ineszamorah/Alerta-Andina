/*
 * map.js — Mapa interactivo con Leaflet
 * ---------------------------------------------------------------
 * Soporta más de una instancia del mapa a la vez: el tab "Mapa"
 * (mobile y desktop) y el panel de mapa que aparece junto al
 * listado en pantallas anchas (>= 900px), inspirado en cómo la
 * app de referencia consultada muestra lista + mapa a la vez en
 * vez de obligar a cambiar de pestaña. Cada instancia se identifica
 * por el id de su contenedor.
 *
 * Nota de alcance: los tiles del mapa se piden a un servidor de
 * teselas externo (OpenStreetMap). Si la vista se ejecuta en un
 * entorno sin salida de red a ese dominio (p. ej. una vista previa
 * aislada), los tiles no cargarán pero los marcadores de sismos sí
 * se dibujan igual sobre el fondo; esto se documenta como una
 * limitación conocida del entorno de previsualización, no de la app.
 */

const instanciasMapa = {}; // { [containerId]: { map, capa } }

function inicializarMapa(containerId) {
  if (instanciasMapa[containerId]) return instanciasMapa[containerId].map;

  // Si la librería Leaflet no pudo cargar (sin conexión al CDN, por
  // ejemplo), mostramos un aviso en lugar de romper el resto de la app.
  if (typeof L === "undefined") {
    const contenedor = document.getElementById(containerId);
    if (contenedor) {
      contenedor.style.display = "flex";
      contenedor.style.alignItems = "center";
      contenedor.style.justifyContent = "center";
      contenedor.style.textAlign = "center";
      contenedor.style.padding = "24px";
      contenedor.style.color = "var(--color-texto-suave)";
      contenedor.textContent = "No se pudo cargar el mapa (sin conexión a la librería Leaflet). Revisa tu conexión a internet e inténtalo de nuevo.";
    }
    return null;
  }

  const contenedor = document.getElementById(containerId);
  if (!contenedor) return null;

  const map = L.map(containerId, {
    zoomControl: false,
    attributionControl: true,
    // Zoom fluido: rueda del mouse, pinch del trackpad (Mac), doble clic y
    // táctil. Pasos finos (0.25) y rueda suavizada, en vez de saltos de 1.
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 100,
    wheelDebounceTime: 20,
    minZoom: 3,
    maxZoom: 12,
  }).setView([-9.5, -75.0], 5); // centro aproximado: Perú

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const capa = L.layerGroup().addTo(map);
  instanciasMapa[containerId] = { map, capa };
  return map;
}

function colorPorNivel(nivel) {
  return {
    leve: "#FFC300",
    moderado: "#F29A1F",
    alto: "#E0262A",
    critico: "#B0101F",
  }[nivel] || "#FFC300";
}

/** Marcador en forma de anillo hueco con la magnitud dentro (mismo
 *  lenguaje visual que los anillos de la lista). El color del aro sale de
 *  [data-nivel] en el CSS; el tamaño crece con la magnitud. */
function iconoSismo(mag, nivel, seleccionado) {
  const tam = Math.round((6 + mag * 2.2) * 2);
  return L.divIcon({
    className: "eq-icon",
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
    html: `<div class="eq-marker${seleccionado ? " is-selected" : ""}" data-nivel="${nivel}">${mag.toFixed(1)}</div>`,
  });
}

/** Dibuja los sismos como anillos proporcionales a la magnitud en una instancia concreta.
 *  idSeleccionado (opcional) resalta el sismo que está en el hero de la lista.
 *  opciones.ajustar → recentra el mapa (fitBounds) sobre lo dibujado;
 *  opciones.usuario → dibuja la ubicación del usuario (y su radio si lo trae). */
function dibujarSismosEnMapa(containerId, sismos, onClickSismo, idSeleccionado, opciones) {
  const instancia = instanciasMapa[containerId];
  if (typeof L === "undefined" || !instancia) return;
  opciones = opciones || {};
  instancia.capa.clearLayers();
  const puntos = [];

  sismos.forEach((s) => {
    const [lon, lat] = s.geometry.coordinates;
    const mag = s.properties.mag || 0;
    const nivel = nivelDeMagnitud(mag);
    const elegido = s.id === idSeleccionado;
    puntos.push([lat, lon]);

    const marcador = L.marker([lat, lon], {
      icon: iconoSismo(mag, nivel, elegido),
      zIndexOffset: elegido ? 1000 : 0,
      keyboard: false,
    });
    marcador.bindTooltip(
      `<strong>M ${mag.toFixed(1)}</strong> · ${etiquetaNivel(nivel)}<br>${s.properties.place || "Sin ubicación"}<br><small>${tiempoRelativo(s.properties.time)}</small>`,
      { direction: "top", offset: [0, -8], className: "eq-tooltip" }
    );
    marcador.on("click", () => onClickSismo && onClickSismo(s));
    marcador.addTo(instancia.capa);
  });

  let circulo = null;
  const u = opciones.usuario;
  if (u) {
    L.marker([u.lat, u.lon], {
      icon: L.divIcon({ className: "user-icon", iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="user-marker"></div>' }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 2000,
    }).addTo(instancia.capa);
    if (u.radioKm) {
      circulo = L.circle([u.lat, u.lon], { radius: u.radioKm * 1000, className: "user-radio", weight: 1.5, interactive: false }).addTo(instancia.capa);
    }
  }

  if (opciones.ajustar) {
    const map = instancia.map;
    map.invalidateSize();
    if (opciones.centrarEnUsuario && circulo) {
      map.fitBounds(circulo.getBounds(), { padding: [24, 24], maxZoom: 9 });
    } else if (opciones.centrarEnUsuario && u) {
      map.setView([u.lat, u.lon], 7);
    } else if (puntos.length) {
      map.fitBounds(L.latLngBounds(puntos), { padding: [48, 48], maxZoom: 8 });
    } else {
      map.setView([-9.5, -75.0], 5);
    }
  }
}

/** Leaflet necesita recalcular tamaño cuando su contenedor cambia de tamaño o de hidden a visible. */
function refrescarTamanoMapa(containerId) {
  const instancia = instanciasMapa[containerId];
  if (instancia) {
    setTimeout(() => instancia.map.invalidateSize(), 50);
  }
}

/** Mini mapa del detalle (bottom sheet): un único marcador, centrado y
 *  con zoom en el epicentro de ese sismo — a diferencia de
 *  dibujarSismosEnMapa(), que dibuja la lista completa. */
function mostrarUnSismoEnMapa(containerId, sismo) {
  const map = inicializarMapa(containerId);
  if (typeof L === "undefined" || !map) return;
  const instancia = instanciasMapa[containerId];
  instancia.capa.clearLayers();

  const [lon, lat] = sismo.geometry.coordinates;
  const mag = sismo.properties.mag || 0;
  const nivel = nivelDeMagnitud(mag);

  L.marker([lat, lon], { icon: iconoSismo(mag, nivel, false), keyboard: false, interactive: false }).addTo(instancia.capa);

  map.setView([lat, lon], 7);
  refrescarTamanoMapa(containerId);
}

/** "Actividad en la zona": dibuja los sismos cercanos a uno dado que ya
 *  habían ocurrido hasta `hastaMs`. Los más recientes respecto a ese
 *  momento laten y los antiguos se van apagando (opacidad por antigüedad).
 *  El sismo principal se resalta y el radio de búsqueda se marca con un
 *  círculo discontinuo. */
function dibujarActividad(containerId, sismo, cercanos, hastaMs, radioKm, ajustar) {
  const map = inicializarMapa(containerId);
  if (typeof L === "undefined" || !map) return;
  const instancia = instanciasMapa[containerId];
  instancia.capa.clearLayers();

  const [lon0, lat0] = sismo.geometry.coordinates;
  const circulo = L.circle([lat0, lon0], { radius: radioKm * 1000, className: "zona-radio", weight: 1.5, interactive: false }).addTo(instancia.capa);

  const DIA = 86400000;
  cercanos.forEach((s) => {
    const t = s.properties.time;
    if (t > hastaMs) return;
    const [lon, lat] = s.geometry.coordinates;
    const mag = s.properties.mag || 0;
    const nivel = nivelDeMagnitud(mag);
    const esEste = s.id === sismo.id;
    const edadDias = (hastaMs - t) / DIA;
    const marcador = L.marker([lat, lon], {
      icon: iconoSismo(mag, nivel, esEste),
      zIndexOffset: esEste ? 1000 : 0,
      keyboard: false,
      opacity: esEste ? 1 : Math.max(0.35, 1 - edadDias / 20),
    });
    marcador.bindTooltip(
      `<strong>M ${mag.toFixed(1)}</strong>${esEste ? " · este sismo" : ""}<br>${s.properties.place || "Sin ubicación"}<br><small>${tiempoRelativo(t)}</small>`,
      { direction: "top", offset: [0, -8], className: "eq-tooltip" }
    );
    marcador.addTo(instancia.capa);
    // Los que "acaban de pasar" (menos de un día respecto al momento mostrado) laten
    if (edadDias < 1 && !esEste) {
      marcador.on("add", () => marcador.getElement() && marcador.getElement().classList.add("eq-late"));
      if (marcador.getElement()) marcador.getElement().classList.add("eq-late");
    }
  });

  if (ajustar) {
    map.invalidateSize();
    map.fitBounds(circulo.getBounds(), { padding: [20, 20], maxZoom: 9 });
  }
}
