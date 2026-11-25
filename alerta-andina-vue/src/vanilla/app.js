/*
 * app.js — Orquestador principal de Alerta Andina
 * ---------------------------------------------------------------
 * Responsable de: navegación entre vistas, onboarding, carga de datos,
 * vigilancia y alertas, mapa, página de detalle, ajustes y PWA.
 *
 * MIGRACIÓN A VUE (en curso): la pantalla de Inicio (hero, filtros y
 * listas) ya la pintan los componentes de src/components. Este archivo
 * ya no toca ese HTML: escribe los datos en el estado compartido
 * (window.AA.estado, ver src/estado.js) y Vue se encarga de repintar.
 * A cambio, publica en window.AA las acciones que Vue necesita
 * (abrir el detalle, cambiar de zona, pedir ubicación…).
 *
 * Pendiente / mejoras futuras (fuera de alcance de esta entrega):
 *  - Paginación / scroll infinito de la lista de sismos.
 *  - Notificaciones push reales en segundo plano (requiere backend).
 *  - Caché offline completa del shell y de los datos (ver sw.js).
 */

(function () {
  "use strict";

  // ---------- Estado en memoria ----------
  // Sismos, filtros y sismo seleccionado viven en el estado de Vue
  // (src/estado.js): estado.todos, estado.globales, estado.locales,
  // estado.zona, estado.orden, estado.soloGuardados, estado.idHero…
  const AA = window.AA;
  const estado = AA.estado;
  const { unirFeeds, superaUmbral, datosBaseSegunZona, sismosFiltrados } = AA;
  let claveLocal = null;        // lat,lon,radio con los que se pidieron estado.locales
  let sismoSeleccionado = null; // el que está abierto en el detalle

  // ---------- Referencias DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const vistas = $$(".view");
  const navItems = $$(".nav-item");

  // A partir de este ancho mostramos el mapa junto al listado (igual que
  // el tab "Mapa", pero sin tener que cambiar de pestaña), inspirado en
  // el patrón de lista+mapa simultáneos de la app de referencia revisada.
  const MEDIA_DESKTOP = window.matchMedia("(min-width: 900px)");

  /* =============================================================
     1. NAVEGACIÓN FUNCIONAL ENTRE SECCIONES
     ============================================================= */
  /** Qué mapas deben recentrarse en su próximo dibujo. Se activa cuando
   *  cambian los datos (zona, umbral, orden, ubicación…), no cuando solo
   *  se elige un sismo, para que el mapa no "salte" al tocar un marcador. */
  const ajustarPendiente = { "mapa-leaflet": true, "mapa-leaflet-inline": true };
  function opcionesMapa(id) {
    const a = obtenerAjustes();
    const o = { ajustar: !!ajustarPendiente[id], usuario: null };
    ajustarPendiente[id] = false;
    if (a.ubicacionEstado === "granted" && a.ubicacionLat != null) {
      o.usuario = { lat: a.ubicacionLat, lon: a.ubicacionLon, radioKm: estado.zona === "cerca" ? a.radioKm : null };
    }
    o.centrarEnUsuario = estado.zona === "cerca" && !!o.usuario;
    return o;
  }

  function irAVista(nombre) {
    vistas.forEach((v) => (v.hidden = v.dataset.view !== nombre));
    navItems.forEach((n) => n.classList.toggle("active", n.dataset.view === nombre));
    if (nombre === "mapa") {
      const mapa = inicializarMapa("mapa-leaflet");
      if (mapa) {
        dibujarSismosEnMapa("mapa-leaflet", sismosFiltrados(), alElegirSismo, idHeroActual(), opcionesMapa("mapa-leaflet"));
        refrescarTamanoMapa("mapa-leaflet");
      }
    }
    if (nombre === "ajustes") {
      renderFavoritos();
    }
    if (nombre === "alertas") {
      // al volver del detalle, Vue ya resalta el sismo visto (estado.idHero)
      refrescarTamanoMapa("mapa-leaflet-inline");
    }
    // Permite enlaces internos tipo #mapa, #ajustes, etc.
    history.replaceState(null, "", "#" + nombre);
  }

  /** Mantiene el mapa inline (junto al listado, en escritorio) sincronizado
   *  con los datos filtrados actuales. No hace nada en pantallas angostas,
   *  donde ese panel está oculto y se usa el tab "Mapa" en su lugar. */
  function actualizarMapaInlineSiDesktop() {
    if (!MEDIA_DESKTOP.matches) return;
    const mapa = inicializarMapa("mapa-leaflet-inline");
    if (mapa) {
      dibujarSismosEnMapa("mapa-leaflet-inline", sismosFiltrados(), alElegirSismo, idHeroActual(), opcionesMapa("mapa-leaflet-inline"));
      refrescarTamanoMapa("mapa-leaflet-inline");
    }
  }

  MEDIA_DESKTOP.addEventListener("change", actualizarMapaInlineSiDesktop);

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => irAVista(btn.dataset.view));
  });

  // Soporta abrir una vista directa por hash al cargar (enlace interno)
  function vistaInicialDesdeHash() {
    const hash = location.hash.replace("#", "");
    const valido = ["alertas", "mapa", "ajustes", "plan"].includes(hash);
    return valido ? hash : "alertas";
  }

  /* =============================================================
     2. ONBOARDING
     ============================================================= */
  function iniciarOnboardingSiProcede() {
    const ajustes = obtenerAjustes();
    if (ajustes.onboardingVisto) return;

    const onboarding = $("#onboarding");
    onboarding.hidden = false;
    const slides = $("#onboarding-slides");
    const dots = $$("#onboarding-dots span");
    const btnPrimario = $("#btn-onboarding-siguiente");
    const btnSecundario = $("#btn-onboarding-saltar");
    const chipNotifStatus = $("#onboarding-notif-status");
    const totalSlides = dots.length;
    let actual = 0;

    // Config por paso: cada uno decide su propio botón primario y si
    // hay (o no) una acción secundaria de "ahora no" / "saltar" —
    // en vez de un único botón genérico para todo el flujo.
    const pasos = [
      { primario: "Continuar", secundario: "Saltar", accionSecundaria: "cerrar" },
      { primario: "Permitir notificaciones", secundario: "Ahora no", accionSecundaria: "avanzar", accionPrimaria: "notificaciones" },
      { primario: "Continuar", secundario: null },
      { primario: "Comenzar", secundario: null },
    ];

    function irASlide(i) {
      actual = Math.max(0, Math.min(totalSlides - 1, i));
      slides.scrollTo({ left: slides.clientWidth * actual, behavior: "smooth" });
      actualizarUI();
    }

    function actualizarUI() {
      dots.forEach((d, i) => d.classList.toggle("active", i === actual));
      const cfg = pasos[actual] || pasos[0];
      btnPrimario.textContent = cfg.primario;
      if (cfg.secundario) {
        btnSecundario.hidden = false;
        btnSecundario.textContent = cfg.secundario;
      } else {
        btnSecundario.hidden = true;
      }
    }

    slides.addEventListener("scroll", () => {
      const ancho = slides.clientWidth;
      actual = Math.round(slides.scrollLeft / ancho);
      actualizarUI();
    });

    btnPrimario.addEventListener("click", async () => {
      const cfg = pasos[actual] || pasos[0];

      if (cfg.accionPrimaria === "notificaciones") {
        const permiso = await pedirPermisoNotificaciones();
        chipNotifStatus.textContent = permiso === "granted" ? "Activado" : permiso === "denied" ? "Rechazado" : "Pendiente";
        chipNotifStatus.classList.toggle("is-granted", permiso === "granted");
        chipNotifStatus.classList.toggle("is-denied", permiso === "denied");
        guardarAjustes({ notificacionesActivas: permiso === "granted" });
      }

      if (actual < totalSlides - 1) {
        irASlide(actual + 1);
      } else {
        cerrarOnboarding();
      }
    });

    btnSecundario.addEventListener("click", () => {
      const cfg = pasos[actual] || pasos[0];
      if (cfg.accionSecundaria === "cerrar") {
        cerrarOnboarding();
      } else {
        irASlide(actual + 1);
      }
    });

    // Elegir zona en el paso 3: guarda de inmediato, como el resto
    // de ajustes de la app (sin esperar a cerrar el onboarding).
    $("#onboarding-zone-picker").addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      $$("#onboarding-zone-picker .chip").forEach((c) => c.classList.remove("selected"));
      btn.classList.add("selected");
      guardarAjustes({ zona: btn.dataset.zona });
    });

    function cerrarOnboarding() {
      guardarAjustes({ onboardingVisto: true });
      onboarding.hidden = true;
    }

    actualizarUI();
  }

  /* =============================================================
     3. FILTROS — ahora son componentes Vue (FiltrosInicio.vue).
     Aquí solo queda el cambio de zona, porque puede pedir la ubicación
     y tiene que sincronizar también los radios de Ajustes.
     ============================================================= */
  /** Único punto de entrada para cambiar de zona: sincroniza el chip de
   *  Alertas, el radio de Ajustes, persiste la preferencia y — si hace
   *  falta y es la primera vez que se elige "cerca" — pide ubicación. */
  async function establecerZona(nuevaZona) {
    if (nuevaZona === "cerca" && obtenerAjustes().ubicacionEstado !== "granted") {
      estado.buscandoUbicacion = true;
      const resultado = await pedirUbicacion();
      estado.buscandoUbicacion = false;
      guardarAjustes({ ubicacionEstado: resultado.estado, ubicacionLat: resultado.lat, ubicacionLon: resultado.lon });
      actualizarEstadoUbicacionUI();
    }

    estado.zona = nuevaZona;
    guardarAjustes({ zona: nuevaZona });
    sincronizarControlesZona();
    renderListaSismos();
  }

  function sincronizarControlesZona() {
    $$('input[name="zona-ajustes"]').forEach((r) => (r.checked = r.value === estado.zona));
    $("#radio-km-row").hidden = estado.zona !== "cerca";
  }


  /* =============================================================
     4. CARGA DE DATOS (fetch USGS + fallback) y RENDER
     ============================================================= */
  async function cargarSismos(silencioso) {
    if (!silencioso) {
      estado.cargando = true;   // Vue muestra el aviso y el anillo "cargando"
      estado.error = null;
    }
    // Las dos consultas van en paralelo: la de la banda andina (principal,
    // con respaldo local si falla) y la mundial (secundaria, para "En el
    // mundo" — si falla, esa sección queda vacía pero no bloquea el resto).
    const [{ features, source, error, fuentes }, { features: globales }] = await Promise.all([
      obtenerSismos(),
      obtenerSismosGlobales(),
    ]);
    estado.todos = features;
    estado.globales = globales;
    estado.fuente = source;
    estado.fuentes = fuentes || ["USGS"];
    estado.error = error || null;
    estado.cargando = false;

    const mags = unirFeeds().map((x) => x.properties.mag).filter((m) => m != null);
    if (mags.length) {
      $("#umbral-nota").textContent = "Con los datos cargados ahora, el sismo más pequeño es M " + Math.min(...mags).toFixed(1) + ". Si la fuente es solo USGS, casi no hay sismos menores a M4 fuera de EE. UU.; EMSC añade los más pequeños.";
    }
    if (silencioso) claveLocal = null; // que también se refresquen los sismos de alrededor
    // En una actualización en segundo plano no se toca la página del detalle
    if (!silencioso || !location.hash.startsWith("#sismo/")) renderListaSismos();
    datosCargados = true;
    if (!silencioso && location.hash.startsWith("#sismo/")) router();
    revisarSismosNuevos();
  }

  /* ---- Vigilancia: revisar cada 2 min y avisar de sismos nuevos ----
     Solo funciona con la app abierta (sin backend no hay push en segundo
     plano). Avisa de sismos ocurridos desde que se abrió la app, que
     superen el umbral y estén en la zona elegida. */
  const INTERVALO_VIGILANCIA_MS = 2 * 60000;
  const inicioApp = Date.now();
  const idsAvisados = new Set();
  let primeraRevision = true;

  function revisarSismosNuevos() {
    const candidatos = datosBaseSegunZona().filter(superaUmbral);
    if (primeraRevision) {           // lo que ya había al abrir no es "nuevo"
      candidatos.forEach((s) => idsAvisados.add(s.id));
      primeraRevision = false;
      return;
    }
    const nuevos = candidatos
      .filter((s) => !idsAvisados.has(s.id) && s.properties.time > inicioApp - 10 * 60000)
      .sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0));
    candidatos.forEach((s) => idsAvisados.add(s.id));
    if (!nuevos.length) return;
    mostrarAlerta(nuevos[0], false);
    if (obtenerAjustes().notificacionesActivas) notificarSismo(nuevos[0]);
  }
  setInterval(() => { if (!document.hidden) cargarSismos(true); }, INTERVALO_VIGILANCIA_MS);

  /* ---- Pantalla de alerta (real o de prueba) ---- */
  function mostrarAlerta(sismo, esPrueba) {
    const mag = sismo.properties.mag || 0;
    const o = $("#alerta-overlay");
    o.classList.toggle("es-prueba", esPrueba);
    $("#alerta-etiqueta").textContent = esPrueba ? "Prueba · no es un sismo real" : "Sismo detectado";
    $("#alerta-mag").textContent = mag.toFixed(1);
    $("#alerta-lugar").textContent = sismo.properties.place || "Ubicación desconocida";
    const partes = [((sismo.geometry.coordinates[2] || 0).toFixed(0)) + " km de profundidad", tiempoRelativo(sismo.properties.time)];
    const a = obtenerAjustes();
    if (a.ubicacionEstado === "granted" && a.ubicacionLat != null) {
      const [lon, lat] = sismo.geometry.coordinates;
      partes.unshift("a " + Math.round(distanciaKm(a.ubicacionLat, a.ubicacionLon, lat, lon)) + " km de ti");
    }
    $("#alerta-meta").textContent = partes.join(" · ");
    $("#alerta-ver").hidden = esPrueba;
    o.hidden = false;
    alertaSismoId = esPrueba ? null : sismo.id;
    sonarAlerta();
    if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) {} }
    $("#alerta-entendido").focus();
  }
  let alertaSismoId = null;
  function cerrarAlerta() { $("#alerta-overlay").hidden = true; }
  $("#alerta-entendido").addEventListener("click", cerrarAlerta);
  $("#alerta-ver").addEventListener("click", () => {
    cerrarAlerta();
    const s = alertaSismoId && buscarSismo(alertaSismoId);
    if (s) abrirDetalle(s);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#alerta-overlay").hidden) cerrarAlerta(); });

  /** Tres pitidos cortos con Web Audio (distintos a la sirena oficial SISMATE). */
  function sonarAlerta() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [0, 0.35, 0.7].forEach((t) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        vol.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
        osc.connect(vol).connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.25);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch (e) { /* sin audio: la alerta visual sigue funcionando */ }
  }

  $("#btn-probar-alerta").addEventListener("click", () => {
    const a = obtenerAjustes();
    // Sismo ficticio cerca de la persona (o frente a Lima si no hay ubicación)
    const lat = a.ubicacionLat != null ? a.ubicacionLat + 0.6 : -12.4;
    const lon = a.ubicacionLon != null ? a.ubicacionLon - 0.6 : -77.6;
    const prueba = { id: "prueba", properties: { mag: 6.5, place: "Sismo de prueba", time: Date.now(), title: "Prueba de Alerta Andina — no es un sismo real" }, geometry: { coordinates: [lon, lat, 30] } };
    mostrarAlerta(prueba, true);
    if (a.notificacionesActivas) notificarSismo(prueba);
  });

  /* Filtrado (zona, umbral, guardados, orden): ahora en src/estado.js,
     compartido con Vue. Aquí solo se usa a través de window.AA. */
  const sismoHeroActual = () => AA.sismoHero();
  function idHeroActual() {
    const s = sismoHeroActual();
    return s ? s.id : null;
  }

  /* El hero (anillo grande con la magnitud) es HeroSismo.vue. */

  /** Elegir un sismo (tarjeta, marcador): actualiza hero, resalta tarjeta y
   *  marcador, y abre el detalle. */
  function alElegirSismo(sismo) {
    estado.idHero = sismo.id;   // Vue resalta la tarjeta y actualiza el hero
    actualizarMapaInlineSiDesktop();
    abrirDetalle(sismo);
  }

  /** Tarjeta en HTML a mano. En Inicio ya se usa TarjetaSismo.vue; esta
   *  versión vanilla queda solo para la lista de guardados de Ajustes,
   *  que todavía no se ha migrado. */
  function crearTarjetaSismo(sismo, index) {
    const nivel = nivelDeMagnitud(sismo.properties.mag);
    const fav = esFavorito(sismo.id);

    const card = document.createElement("div");
    card.className = "quake-card" + (sismo.id === idHeroActual() ? " is-selected" : "");
    card.dataset.id = sismo.id;
    card.dataset.nivel = nivel;
    card.style.animationDelay = Math.min(index * 0.04, 0.3) + "s";
    card.innerHTML = `
      <div class="mag-ring" data-nivel="${nivel}" style="--pct:${pctDeMagnitud(sismo.properties.mag)}">
        <span class="mag-ring-centro"><span class="mag-ring-num">${sismo.properties.mag.toFixed(1)}</span></span>
      </div>
      <div class="quake-info">
        <div class="place">${sismo.properties.place || "Ubicación desconocida"}</div>
        <div class="meta">${tiempoRelativo(sismo.properties.time)} · <span class="nivel-txt">${etiquetaNivel(nivel)}</span></div>
      </div>
      <button class="fav-btn ${fav ? "is-fav" : ""}" aria-label="${fav ? "Dejar de seguir" : "Hacer seguimiento"}" data-id="${sismo.id}">
        <svg viewBox="0 0 24 24" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.75L6 21V4.5z"/></svg>
      </button>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn")) return;
      alElegirSismo(sismo);
    });

    card.querySelector(".fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const nuevoEstado = alternarFavorito(sismo.id);
      const btn = e.currentTarget;
      btn.classList.toggle("is-fav", nuevoEstado);
      btn.querySelector("svg").setAttribute("fill", nuevoEstado ? "currentColor" : "none");
      btn.setAttribute("aria-label", nuevoEstado ? "Dejar de seguir" : "Hacer seguimiento");
      btn.classList.add("pulse");
      setTimeout(() => btn.classList.remove("pulse"), 350);
    });

    return card;
  }


  /** Si hay ubicación, asegura tener los sismos pequeños de alrededor.
   *  Se vuelve a pedir solo si cambian la posición o el radio. */
  function asegurarFeedLocal() {
    const a = obtenerAjustes();
    if (a.ubicacionEstado !== "granted" || a.ubicacionLat == null) return;
    const clave = a.ubicacionLat.toFixed(2) + "," + a.ubicacionLon.toFixed(2) + "," + a.radioKm;
    if (clave === claveLocal) return;
    claveLocal = clave;
    obtenerSismosCercanos(a.ubicacionLat, a.ubicacionLon, Math.max(a.radioKm, 100)).then((f) => {
      if (claveLocal !== clave) return; // llegó tarde: ya se pidió otra zona
      estado.locales = f;
      if (!location.hash.startsWith("#sismo/")) renderListaSismos();
      revisarSismosNuevos();
    });
  }

  /** Antes pintaba hero y listas a mano; ahora Vue lo hace solo al cambiar
   *  el estado. Queda lo que Vue no ve: Ajustes y favoritos (localStorage),
   *  el feed de "cerca de mí", los nombres de ciudad y el mapa. */
  function renderListaSismos() {
    estado.versionAjustes++;   // fuerza a Vue a releer umbral/ubicación
    alCambiarFiltros();
  }

  /** Se llama también desde Vue (PantallaInicio.vue) al tocar un filtro. */
  function alCambiarFiltros() {
    asegurarFeedLocal();
    // EMSC solo trae la región ("España"): se busca la ciudad más cercana
    completarCiudades(sismosFiltrados().slice(0, 40), actualizarLugarEnPantalla);
    ajustarPendiente["mapa-leaflet"] = true;
    ajustarPendiente["mapa-leaflet-inline"] = true;
    actualizarMapaInlineSiDesktop();
  }

  /** Llega la ciudad de un sismo: se cambia el texto donde aparezca, sin
   *  volver a pintar la lista (así el mapa no se reencuadra). */
  function actualizarLugarEnPantalla(sismo) {
    // En Inicio, Vue ya ve el cambio (el sismo es un objeto reactivo)
    const lugar = sismo.properties.place;
    if (location.hash === "#sismo/" + sismo.id) $("#sheet-place").textContent = lugar;
  }



  function renderFavoritos() {
    const grid = $("#favoritos-grid");
    const favIds = obtenerFavoritos();
    const vistos = new Set();
    const lista = estado.todos.concat(estado.globales).filter((s) => {
      if (!favIds.includes(s.id) || vistos.has(s.id)) return false;
      vistos.add(s.id);
      return true;
    });
    grid.innerHTML = "";

    if (!lista.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <p>Aún no estás siguiendo ningún sismo.</p>
        </div>`;
      return;
    }
    lista.forEach((sismo, i) => grid.appendChild(crearTarjetaSismo(sismo, i)));
  }

  /* =============================================================
     5. DETALLE — página completa (#sismo/<id>)
     Antes era un modal; ahora es una vista propia con URL, para que el
     botón "atrás" funcione, se pueda compartir el enlace y haya sitio
     para las pestañas Detalle · Actividad en la zona · Noticias.
     ============================================================= */
  let idSismoPendiente = null;   // abierto por URL antes de que lleguen los datos
  let vinoDesdeLaApp = false;    // para que "Volver" use el historial solo si es nuestro
  let datosCargados = false;

  function buscarSismo(id) {
    return unirFeeds().find((s) => s.id === id) || null;
  }

  /** Abrir el detalle de un sismo: cambia la URL y el router hace el resto. */
  function abrirDetalle(sismo) {
    vinoDesdeLaApp = true;
    const destino = "#sismo/" + encodeURIComponent(sismo.id);
    if (location.hash === destino) mostrarPaginaSismo(sismo.id);
    else location.hash = destino;
  }

  function mostrarPaginaSismo(id) {
    pararRepeticion();
    vistas.forEach((v) => (v.hidden = v.dataset.view !== "sismo"));
    navItems.forEach((n) => n.classList.toggle("active", n.dataset.view === "alertas"));
    window.scrollTo(0, 0);

    const sismo = buscarSismo(id);
    $("#sismo-contenido").hidden = !sismo;
    $("#sismo-vacio").hidden = !!sismo;
    $("#sismo-seguir").hidden = !sismo;
    if (!sismo) {
      idSismoPendiente = datosCargados ? null : id;
      $("#sismo-vacio-texto").textContent = datosCargados
        ? "Este sismo ya no está en los datos recientes (la app guarda los últimos 30 días de la región andina y 7 días del resto del mundo)."
        : "Cargando sismo…";
      return;
    }
    idSismoPendiente = null;
    sismoSeleccionado = sismo;
    estado.idHero = sismo.id;

    const nivel = nivelDeMagnitud(sismo.properties.mag);
    const [lon, lat] = sismo.geometry.coordinates;
    const badge = $("#sheet-mag-badge");
    badge.dataset.nivel = nivel;
    badge.style.setProperty("--pct", pctDeMagnitud(sismo.properties.mag));
    badge.querySelector(".mag-ring-num").textContent = sismo.properties.mag.toFixed(1);
    completarCiudades([sismo], actualizarLugarEnPantalla);
    $("#sheet-place").textContent = sismo.properties.place || "Ubicación desconocida";
    $("#sheet-time").textContent = new Date(sismo.properties.time).toLocaleString("es-PE") + " · " + etiquetaNivel(nivel);
    $("#sheet-cuando").textContent = tiempoRelativo(sismo.properties.time);
    $("#sheet-depth").textContent = (sismo.geometry.coordinates[2] || 0).toFixed(1) + " km";
    $("#sheet-mag").textContent = sismo.properties.mag.toFixed(1) + " " + (sismo.properties.magType || "").toLowerCase();
    $("#sheet-epicentro").textContent = lat.toFixed(2) + ", " + lon.toFixed(2);
    $("#sheet-fuente").textContent = sismo.properties.fuente || "USGS";
    $("#sheet-status").textContent = sismo.properties.status === "reviewed" ? "Revisado" : "Automático";
    actualizarBotonSeguir();
    document.title = "M " + sismo.properties.mag.toFixed(1) + " · " + (sismo.properties.place || "Sismo") + " — Alerta Andina";

    elegirTab("detalle");
    precargarNoticias(sismo).catch(() => {});
  }

  function actualizarBotonSeguir() {
    if (!sismoSeleccionado) return;
    const fav = esFavorito(sismoSeleccionado.id);
    const btn = $("#sismo-seguir");
    btn.classList.toggle("is-fav", fav);
    btn.setAttribute("aria-pressed", String(fav));
    btn.querySelector("svg").setAttribute("fill", fav ? "currentColor" : "none");
    $("#sismo-seguir-texto").textContent = fav ? "Siguiendo" : "Seguir";
  }
  $("#sismo-seguir").addEventListener("click", () => {
    if (!sismoSeleccionado) return;
    alternarFavorito(sismoSeleccionado.id);
    actualizarBotonSeguir();
  });

  $("#sismo-volver").addEventListener("click", () => {
    if (vinoDesdeLaApp && history.length > 1) history.back();
    else location.hash = "#alertas";
  });

  /* ---- Pestañas ---- */
  function elegirTab(cual) {
    $$(".sheet-tab").forEach((t) => {
      const activo = t.dataset.tab === cual;
      t.classList.toggle("is-active", activo);
      t.setAttribute("aria-selected", String(activo));
    });
    $$(".sheet-panel").forEach((p) => (p.hidden = p.dataset.panel !== cual));
    if (cual !== "actividad") pararRepeticion();
    if (!sismoSeleccionado) return;
    if (cual === "detalle") mostrarUnSismoEnMapa("mapa-leaflet-sheet", sismoSeleccionado);
    if (cual === "actividad") renderActividad(sismoSeleccionado);
    if (cual === "noticias") mostrarNoticias(sismoSeleccionado);
  }
  $$(".sheet-tab").forEach((t) => t.addEventListener("click", () => elegirTab(t.dataset.tab)));

  /* ---- Actividad en la zona ----
     Sismos a menos de RADIO_ZONA_KM del epicentro en los datos cargados
     (30 días en la región andina, 7 días M4.5+ en el resto del mundo).
     "Posibles réplicas" = después de este, más pequeños y dentro del radio:
     una pista útil, no una clasificación sismológica. */
  const RADIO_ZONA_KM = 100;
  const DIA_MS = 86400000;
  let actividad = null;          // { sismo, cercanos, inicio, dias }
  let temporizadorRep = null;

  function renderActividad(sismo) {
    const [lon0, lat0] = sismo.geometry.coordinates;
    const cercanos = unirFeeds()
      .filter((s) => {
        const [lon, lat] = s.geometry.coordinates;
        return distanciaKm(lat0, lon0, lat, lon) <= RADIO_ZONA_KM;
      })
      .sort((a, b) => a.properties.time - b.properties.time);

    const t0 = sismo.properties.time;
    const otros = cercanos.filter((s) => s.id !== sismo.id);
    const antes = otros.filter((s) => s.properties.time < t0).length;
    const despues = otros.filter((s) => s.properties.time > t0);
    const replicas = despues.filter((s) => (s.properties.mag || 0) < (sismo.properties.mag || 0)).length;

    $("#act-radio").textContent = RADIO_ZONA_KM;
    $("#act-antes").textContent = antes;
    $("#act-despues").textContent = despues.length;
    $("#act-replicas").textContent = replicas;
    $("#act-titulo").textContent = otros.length === 0
      ? "Ningún otro sismo cerca en estos días"
      : otros.length === 1 ? "1 sismo más en la zona" : otros.length + " sismos más en la zona";

    const enAndes = estado.todos.some((s) => s.id === sismo.id) || estado.locales.some((s) => s.id === sismo.id);
    $("#act-ventana").textContent = enAndes
      ? "Datos de los últimos 30 días, desde M2."
      : "Fuera de la región andina solo hay datos de los últimos 7 días y de M4.5 o más, así que puede faltar actividad pequeña.";

    // Línea de tiempo: desde el sismo más antiguo disponible (máx. 30 días) hasta hoy
    const hoy = Date.now();
    const dias = enAndes ? 30 : 7;
    const inicio = hoy - dias * DIA_MS;
    actividad = { sismo, cercanos, inicio, dias };

    const rango = $("#act-rango");
    rango.max = dias;
    rango.value = dias;
    $("#act-marcas").innerHTML = "<span>Hace " + dias + " d</span><span>Hoy</span>";
    pintarBarras();
    pintarMomento(true);
  }

  /** Histograma de sismos por día (barras) con el día de este sismo marcado. */
  function pintarBarras() {
    const { sismo, cercanos, inicio, dias } = actividad;
    const cuenta = new Array(dias).fill(0);
    cercanos.forEach((s) => {
      const i = Math.floor((s.properties.time - inicio) / DIA_MS);
      if (i >= 0 && i < dias) cuenta[i]++;
    });
    const max = Math.max(1, ...cuenta);
    const diaEste = Math.floor((sismo.properties.time - inicio) / DIA_MS);
    const cont = $("#act-barras");
    cont.innerHTML = "";
    cont.style.setProperty("--dias", dias);
    cuenta.forEach((n, i) => {
      const b = document.createElement("span");
      b.className = "act-barra" + (i === diaEste ? " es-este" : "");
      b.style.setProperty("--h", n ? Math.max(8, (n / max) * 100) : 0);
      b.title = n + (n === 1 ? " sismo" : " sismos") + " · hace " + (dias - i - 1) + " d";
      cont.appendChild(b);
    });
  }

  function pintarMomento(ajustar) {
    if (!actividad) return;
    const v = Number($("#act-rango").value);
    const { inicio, dias, sismo, cercanos } = actividad;
    const hasta = v >= dias ? Date.now() : inicio + (v + 1) * DIA_MS;
    $("#act-hasta").textContent = v >= dias ? "Hoy" : "Hasta hace " + (dias - v - 1) + " d";
    $$("#act-barras .act-barra").forEach((b, i) => b.classList.toggle("es-futuro", i > v));
    dibujarActividad("mapa-leaflet-actividad", sismo, cercanos, hasta, RADIO_ZONA_KM, ajustar);
    if (ajustar) refrescarTamanoMapa("mapa-leaflet-actividad");
  }

  function pararRepeticion() {
    clearInterval(temporizadorRep);
    temporizadorRep = null;
    const btn = $("#act-play");
    if (btn) { btn.classList.remove("is-playing"); btn.setAttribute("aria-label", "Reproducir los últimos días"); }
  }
  $("#act-rango").addEventListener("input", () => { pararRepeticion(); pintarMomento(false); });
  $("#act-play").addEventListener("click", () => {
    if (temporizadorRep) { pararRepeticion(); return; }
    const rango = $("#act-rango");
    if (Number(rango.value) >= Number(rango.max)) rango.value = 0;
    const btn = $("#act-play");
    btn.classList.add("is-playing");
    btn.setAttribute("aria-label", "Pausar");
    pintarMomento(false);
    temporizadorRep = setInterval(() => {
      const v = Number(rango.value) + 1;
      rango.value = v;
      pintarMomento(false);
      if (v >= Number(rango.max)) pararRepeticion();
    }, 450);
  });

  /* ---- Pestaña Noticias (Google News) ----
     Google News no permite leer su RSS desde el navegador (CORS), así que se
     pide a través de un conversor público (rss2json) y, si falla, a un proxy
     (allorigins). Si ambos fallan queda el enlace directo a Google News. */
  const cacheNoticias = {};
  /** Ciudad y país a partir del texto del lugar.
   *  USGS: "20 km SW of Ica, Peru" → ciudad "Ica", país "Peru".
   *  EMSC: "Central Peru" / "Near Coast Of Southern Peru" → solo país. */
  function partesLugar(sismo) {
    const lugar = (sismo.properties.place || "").replace(/^\s*\d+(?:\.\d+)?\s*km\s+(?:\S+\s+of|al\s+\S+\s+de)\s+/i, "").trim();
    const trozos = lugar.split(",").map((x) => x.trim()).filter(Boolean);
    if (trozos.length > 1) return { ciudad: trozos[0], pais: trozos[trozos.length - 1] };
    const palabras = lugar.split(/\s+/);
    return { ciudad: null, pais: palabras[palabras.length - 1] || lugar };
  }
  const fechaISO = (ms) => new Date(ms).toISOString().slice(0, 10);

  /** Búsqueda acotada a los días del sismo (after:/before: de Google News),
   *  para no traer noticias de otros sismos de semanas atrás. */
  function consultaNoticias(sismo, soloPais) {
    const { ciudad, pais } = partesLugar(sismo);
    const t = sismo.properties.time;
    const donde = ciudad && !soloPais ? "\"" + ciudad + "\"" : pais;
    return "(sismo OR temblor OR terremoto) " + donde +
      " after:" + fechaISO(t - DIA_MS) + " before:" + fechaISO(t + 3 * DIA_MS);
  }

  /** Webs que generan una página automática por cada sismo (listados de
   *  catálogos): no son noticias, así que no se muestran como tales. */
  const FUENTES_AUTOMATICAS = /volcano ?discovery|earthquake ?list|earthquaketrack|sismos? en vivo|emsc|usgs|quakes?feed|sismologia\.cl/i;

  /** Separa los titulares en: sobre ESTE sismo (fecha cercana y que nombren
   *  su magnitud o su ciudad) y otros de sismos en el país esos días. */
  function clasificarNoticias(sismo, items) {
    const t = sismo.properties.time;
    const mag = (sismo.properties.mag || 0).toFixed(1);
    const magRe = new RegExp("\\b" + mag.replace(".", "[.,]") + "\\b");
    const { ciudad } = partesLugar(sismo);
    const ciudadRe = ciudad ? new RegExp(ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), "i") : null;
    const sinTildes = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const reales = items.filter((n) => {
      const medio = (n.titulo.split(" - ").pop() || "");
      return !FUENTES_AUTOMATICAS.test(medio) && !FUENTES_AUTOMATICAS.test(n.link);
    });
    const enFechas = reales.filter((n) => !isFinite(n.ms) || (n.ms > t - DIA_MS && n.ms < t + 4 * DIA_MS));
    const sobreEste = enFechas.filter((n) => magRe.test(n.titulo) || (ciudadRe && ciudadRe.test(sinTildes(n.titulo))));
    const otros = enFechas.filter((n) => !sobreEste.includes(n));
    return { sobreEste, otros, descartadas: items.length - reales.length };
  }
  function urlGoogleNews(q, rss) {
    return "https://news.google.com/" + (rss ? "rss/" : "") + "search?q=" + encodeURIComponent(q) + "&hl=es-419&gl=PE&ceid=PE:es-419";
  }
  async function pedir(url) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000); // si un intermediario tarda más, no vale la pena esperarlo
    try {
      const r = await fetch(url, { signal: c.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r;
    } finally { clearTimeout(t); }
  }
  function itemsDeXML(texto) {
    const xml = new DOMParser().parseFromString(texto, "text/xml");
    const items = [...xml.querySelectorAll("item")].map((i) => ({
      titulo: (i.querySelector("title") || {}).textContent || "",
      link: (i.querySelector("link") || {}).textContent || "",
      ms: Date.parse((i.querySelector("pubDate") || {}).textContent || ""),
    }));
    if (!items.length) throw new Error("sin items");
    return items;
  }
  /** Nuestra propia ruta /api/noticias: en local (vite-api.js) devuelve JSON;
   *  en Netlify, la regla de public/_redirects reenvía a Google News y llega
   *  el RSS (XML). Devuelve [] si no hay titulares, sin lanzar error. */
  async function noticiasPropias(q) {
    const texto = await (await pedir("/api/noticias?q=" + encodeURIComponent(q))).text();
    if (texto.trim().startsWith("<")) {
      try { return itemsDeXML(texto); } catch (e) { return []; }
    }
    const d = JSON.parse(texto);
    if (!Array.isArray(d.items)) throw new Error("respuesta rara");
    return d.items;
  }
  /** Prueba varios conversores/proxies a la vez y se queda con el primero
   *  que responde (cada uno falla a veces por límites de uso). */
  function rssGoogleNews(rss) {
    const e = encodeURIComponent(rss);
    const intentos = [
      pedir("https://api.rss2json.com/v1/api.json?rss_url=" + e).then(async (r) => {
        const d = await r.json();
        if (d.status !== "ok" || !(d.items || []).length) throw new Error("rss2json vacío");
        return d.items.map((i) => ({ titulo: i.title, link: i.link, ms: Date.parse(String(i.pubDate).replace(" ", "T") + "Z") }));
      }),
      pedir("https://api.allorigins.win/raw?url=" + e).then(async (r) => itemsDeXML(await r.text())),
      pedir("https://corsproxy.io/?url=" + e).then(async (r) => itemsDeXML(await r.text())),
      pedir("https://api.codetabs.com/v1/proxy?quest=" + e).then(async (r) => itemsDeXML(await r.text())),
    ];
    return Promise.any(intentos);
  }
  /** Último recurso: GDELT (índice abierto de noticias, con CORS). */
  async function noticiasGdelt(sismo) {
    const lugar = lugarLimpio(sismo);
    const q = "\"" + lugar + "\" (sismo OR terremoto OR earthquake)";
    const r = await pedir("https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&maxrecords=15&timespan=1month&query=" + encodeURIComponent(q));
    const d = await r.json();
    return (d.articles || []).map((a) => {
      const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(a.seendate || "");
      return { titulo: a.title + " - " + (a.domain || ""), link: a.url, ms: m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN };
    });
  }
  function lugarLimpio(sismo) {
    return (sismo.properties.place || "").replace(/^\s*\d+(?:\.\d+)?\s*km\s+(?:\S+\s+of|al\s+\S+\s+de)\s+/i, "").trim();
  }
  /** Lanza TODAS las fuentes a la vez (4 intermediarios de Google News +
   *  GDELT) y se queda con la primera que traiga titulares. Antes se
   *  probaban en cadena y, si fallaban, la espera podía pasar de 25 s;
   *  ahora el máximo es el tiempo de corte de una sola petición (5 s). */
  function cargarNoticias(sismo) {
    // 1) Nuestra propia API (vite-api.js, dentro de `npm run dev`): lee Google
    //    News sin CORS y es la vía rápida y fiable. En un hosting estático no
    //    existe (404) y se cae a los intermediarios públicos de abajo.
    const propio = noticiasPropias(consultaNoticias(sismo)).then(async (items) => {
      // Una búsqueda vacía NO es un error: los sismos pequeños casi nunca
      // salen en prensa. Si con la ciudad no hay nada, se busca en el país
      // para mostrar al menos "Otras noticias de sismos en <país>".
      const { ciudad, pais } = partesLugar(sismo);
      if (!items.length && ciudad && pais) {
        items = await noticiasPropias(consultaNoticias(sismo, true)).catch(() => []);
      }
      return { items, origen: "Google News" };
    });
    const google = rssGoogleNews(urlGoogleNews(consultaNoticias(sismo), true))
      .then((items) => ({ items, origen: "Google News" }));
    const gdelt = noticiasGdelt(sismo).then((items) => {
      if (!items.length) throw new Error("GDELT sin resultados");
      return { items, origen: "GDELT" };
    });
    // Preferimos Google News: si GDELT llega antes, esperamos un poco a Google
    const gdeltConMargen = gdelt.then((r) => new Promise((ok) => setTimeout(() => ok(r), 1200)));
    return Promise.any([propio, google, gdeltConMargen]).catch((e) => {
      console.warn("[noticias] ninguna fuente respondió:", e && (e.errors || e));
      throw e;
    });
  }

  /** Caché entre visitas (30 min) para no repetir la búsqueda del mismo sismo. */
  const CLAVE_NOTICIAS = "alertaandina_noticias_v2";
  function leerCacheNoticias(id) {
    try {
      const todo = JSON.parse(localStorage.getItem(CLAVE_NOTICIAS) || "{}");
      const e = todo[id];
      return e && Date.now() - e.t < 30 * 60000 ? e.res : null;
    } catch (err) { return null; }
  }
  function guardarCacheNoticias(id, res) {
    try {
      const todo = JSON.parse(localStorage.getItem(CLAVE_NOTICIAS) || "{}");
      todo[id] = { t: Date.now(), res };
      const ids = Object.keys(todo);
      if (ids.length > 30) delete todo[ids[0]]; // que no crezca sin límite
      localStorage.setItem(CLAVE_NOTICIAS, JSON.stringify(todo));
    } catch (err) { /* sin almacenamiento: solo caché en memoria */ }
  }

  /** Empieza a buscar las noticias en cuanto se abre la página del sismo,
   *  sin esperar a que se toque la pestaña. */
  function precargarNoticias(sismo) {
    if (cacheNoticias[sismo.id]) return cacheNoticias[sismo.id];
    const guardada = leerCacheNoticias(sismo.id);
    if (guardada) return (cacheNoticias[sismo.id] = Promise.resolve(guardada));
    const p = cargarNoticias(sismo).then((res) => { guardarCacheNoticias(sismo.id, res); return res; });
    p.catch(() => delete cacheNoticias[sismo.id]); // permitir reintentar
    return (cacheNoticias[sismo.id] = p);
  }

  function listaNoticias(items) {
    const ul = document.createElement("ul");
    ul.className = "noticias-lista";
    items.forEach((n) => {
      // Google News pone el medio al final: "Titular - Medio"
      const partes = n.titulo.split(" - ");
      const medio = partes.length > 1 ? partes.pop() : "";
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "noticia";
      a.href = n.link; a.target = "_blank"; a.rel = "noopener noreferrer";
      const t = document.createElement("span"); t.className = "noticia-titulo"; t.textContent = partes.join(" - ");
      const m = document.createElement("span"); m.className = "noticia-meta";
      m.textContent = [medio, isFinite(n.ms) ? tiempoRelativo(n.ms) : ""].filter(Boolean).join(" · ");
      a.append(t, m); li.appendChild(a); ul.appendChild(li);
    });
    return ul;
  }
  function textoNoticia(clase, texto) {
    const p = document.createElement("p");
    p.className = clase;
    p.textContent = texto;
    return p;
  }

  function pintarNoticias(sismo, res) {
    $("#noticias-fuente").textContent = res.origen === "GDELT"
      ? "Titulares de GDELT (Google News no respondió desde aquí)"
      : "Titulares de Google News";
    const cont = $("#noticias-contenido");
    cont.textContent = "";
    const validas = res.items.filter((n) => /^https:\/\//.test(n.link));
    const { sobreEste, otros } = clasificarNoticias(sismo, validas);
    const { pais } = partesLugar(sismo);

    if (sobreEste.length) {
      cont.appendChild(textoNoticia("noticias-subtitulo", "Sobre este sismo"));
      cont.appendChild(listaNoticias(sobreEste.slice(0, 10)));
    } else {
      cont.appendChild(textoNoticia("noticias-estado",
        (sismo.properties.mag || 0) < 4.5
          ? "No hay noticias asociadas a este sismo. Es lo habitual: los sismos pequeños (menos de M4.5) casi nunca salen en prensa."
          : "Todavía no hay noticias asociadas a este sismo."));
    }
    if (otros.length) {
      cont.appendChild(textoNoticia("noticias-subtitulo", "Otras noticias de sismos en " + pais + " esos días"));
      cont.appendChild(listaNoticias(otros.slice(0, 5)));
    }
  }
  async function mostrarNoticias(sismo) {
    const cont = $("#noticias-contenido");
    $("#noticias-google").href = urlGoogleNews(consultaNoticias(sismo), false);
    cont.innerHTML = '<p class="noticias-estado noticias-buscando">Buscando titulares…</p><div class="noticias-lista"><div class="noticias-skel"></div><div class="noticias-skel"></div><div class="noticias-skel"></div></div>';
    try {
      const res = await precargarNoticias(sismo);
      if (sismoSeleccionado && sismoSeleccionado.id === sismo.id) pintarNoticias(sismo, res);
    } catch (e) {
      if (!sismoSeleccionado || sismoSeleccionado.id !== sismo.id) return;
      cont.innerHTML = "";
      const p = document.createElement("p");
      p.className = "noticias-estado";
      p.textContent = "No hay noticias asociadas a este sismo. Si quieres, puedes buscar más en Google News:";
      cont.appendChild(p);
    }
  }

  /* ---- Router por hash: #alertas, #ajustes… y #sismo/<id> ---- */
  function router() {
    const hash = decodeURIComponent(location.hash.replace("#", ""));
    if (hash.startsWith("sismo/")) {
      mostrarPaginaSismo(hash.slice(6));
      return;
    }
    pararRepeticion();
    document.title = "Alerta Andina";
    let vista = hash === "seguridad" ? "plan" : hash; // enlaces viejos a "Seguridad"
    vista = ["alertas", "mapa", "ajustes", "plan"].includes(vista) ? vista : "alertas";
    // En escritorio "Mapa" ya no existe: el mapa vive junto a la lista
    if (vista === "mapa" && MEDIA_DESKTOP.matches) vista = "alertas";
    irAVista(vista);
    if (vista === "alertas") actualizarMapaInlineSiDesktop();
  }
  window.addEventListener("hashchange", router);

  // El logo (header y sidebar) siempre lleva al inicio. Es un enlace a
  // #alertas; si ya estás en el inicio, el hash no cambia, así que
  // además se vuelve arriba del todo.
  $$(".logo-link").forEach((a) => a.addEventListener("click", () => {
    if (location.hash === "#alertas" || location.hash === "") {
      router();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }));

  /* =============================================================
     6. AJUSTES — umbral, zona, notificaciones
     ============================================================= */
  function inicializarAjustes() {
    const ajustes = obtenerAjustes();
    const rango = $("#umbral-range");
    const valor = $("#umbral-valor");

    rango.value = ajustes.umbralMagnitud;
    valor.textContent = Number(ajustes.umbralMagnitud).toFixed(1);

    // Se aplica en vivo: lista, hero y mapa se recalculan mientras se arrastra.
    rango.addEventListener("input", () => {
      valor.textContent = Number(rango.value).toFixed(1);
      guardarAjustes({ umbralMagnitud: Number(rango.value) });
      renderListaSismos();
    });

    document.querySelectorAll('input[name="zona-ajustes"]').forEach((radio) => {
      radio.checked = radio.value === estado.zona;
      radio.addEventListener("change", () => {
        establecerZona(radio.value);
      });
    });

    const radioKm = $("#radio-km-range");
    const radioKmValor = $("#radio-km-valor");
    radioKm.value = ajustes.radioKm;
    radioKmValor.textContent = ajustes.radioKm + " km";
    $("#radio-km-row").hidden = estado.zona !== "cerca";
    radioKm.addEventListener("input", () => {
      radioKmValor.textContent = radioKm.value + " km";
    });
    radioKm.addEventListener("change", () => {
      guardarAjustes({ radioKm: Number(radioKm.value) });
      if (estado.zona === "cerca") renderListaSismos();
    });

    actualizarEstadoUbicacionUI();
    $("#btn-pedir-ubicacion").addEventListener("click", async () => {
      $("#btn-pedir-ubicacion").textContent = "Buscando ubicación…";
      $("#btn-pedir-ubicacion").disabled = true;
      const resultado = await pedirUbicacion();
      guardarAjustes({ ubicacionEstado: resultado.estado, ubicacionLat: resultado.lat, ubicacionLon: resultado.lon });
      actualizarEstadoUbicacionUI();
      // Si justo estábamos en "cerca" esperando ubicación, refrescamos
      // la lista para que se vea de inmediato (sin esto, el usuario
      // tendría que cambiar de zona y volver para ver el resultado).
      renderListaSismos();
    });

    const toggleNotif = $("#toggle-notificaciones");
    toggleNotif.checked = ajustes.notificacionesActivas;
    toggleNotif.addEventListener("change", async () => {
      if (toggleNotif.checked) {
        const permiso = await pedirPermisoNotificaciones();
        toggleNotif.checked = permiso === "granted";
        guardarAjustes({ notificacionesActivas: toggleNotif.checked });
      } else {
        guardarAjustes({ notificacionesActivas: false });
      }
    });
  }

  /** Refleja ubicacionEstado en el panel de Ajustes (texto + botón),
   *  igual de visible tanto si se pidió desde aquí como desde el
   *  selector de zona en Alertas. */
  function actualizarEstadoUbicacionUI() {
    const ajustes = obtenerAjustes();
    const estadoTexto = $("#ubicacion-estado-texto");
    const btn = $("#btn-pedir-ubicacion");
    btn.disabled = false;

    switch (ajustes.ubicacionEstado) {
      case "granted":
        estadoTexto.textContent = "Ubicación activa (aprox. " + ajustes.ubicacionLat.toFixed(2) + ", " + ajustes.ubicacionLon.toFixed(2) + ").";
        estadoTexto.className = "estado-ubicacion is-granted";
        btn.textContent = "Actualizar ubicación";
        break;
      case "denied":
        estadoTexto.textContent = "Permiso denegado. Actívalo en los permisos del navegador para este sitio y vuelve a intentarlo.";
        estadoTexto.className = "estado-ubicacion is-denied";
        btn.textContent = "Reintentar";
        break;
      case "unsupported":
        estadoTexto.textContent = "Tu navegador no admite geolocalización.";
        estadoTexto.className = "estado-ubicacion is-denied";
        btn.disabled = true;
        btn.textContent = "No disponible";
        break;
      case "error":
        estadoTexto.textContent = "No se pudo obtener tu ubicación. Inténtalo de nuevo.";
        estadoTexto.className = "estado-ubicacion is-denied";
        btn.textContent = "Reintentar";
        break;
      default:
        estadoTexto.textContent = "No solicitada. Se usa solo en este dispositivo, para la zona \"Cerca de mí\" — no se envía a ningún servidor.";
        estadoTexto.className = "estado-ubicacion";
        btn.textContent = "Usar mi ubicación exacta";
    }
  }


  /* =============================================================
     6b. BOTÓN "INSTALAR APP" (beforeinstallprompt)
     Chrome/Edge disparan el evento cuando la app es instalable
     (HTTPS o localhost + manifest + service worker). Lo guardamos y
     mostramos nuestros botones; en Safari/iOS el evento no existe,
     así que ahí solo mostramos la instrucción manual.
     ============================================================= */
  let promptInstalacion = null;

  function estaInstalada() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  /** Pasos para instalarla a mano, según el dispositivo (cuando el
   *  navegador no ofrece el botón: iPhone siempre, y muchos casos más). */
  function pasosInstalacion() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return "En iPhone o iPad: ábrela en Safari, toca Compartir (el cuadrado con la flecha) y luego «Añadir a pantalla de inicio».";
    if (/Android/.test(ua)) return "En Android: abre el menú ⋮ de Chrome y toca «Instalar app» o «Añadir a pantalla de inicio».";
    return "En el ordenador: en Chrome o Edge, usa el icono de instalar a la derecha de la barra de direcciones, o el menú ⋮ → «Instalar Alerta Andina».";
  }

  function actualizarUIInstalacion() {
    const btnSidebar = $("#btn-instalar-sidebar");
    const btnAjustes = $("#btn-instalar-ajustes");
    const texto = $("#instalar-estado-texto");
    const puedeInstalar = !!promptInstalacion && !estaInstalada();

    // "Instalar app" (bloque del mapa) queda siempre visible, como en el
    // diseño; si el navegador no ofrece instalación, lleva a Ajustes.
    btnSidebar.classList.toggle("es-instalable", puedeInstalar);
    // El botón de Ajustes se ve siempre (también en móvil): instala si el
    // navegador lo permite y, si no, muestra los pasos para hacerlo a mano.
    btnAjustes.hidden = estaInstalada();
    btnAjustes.textContent = puedeInstalar ? "Instalar Alerta Andina" : "Cómo instalarla";

    if (estaInstalada()) {
      texto.textContent = "Ya estás usando Alerta Andina como app instalada.";
    } else {
      texto.textContent = "Instálala como una app más, con su propio ícono y sin pasar por ninguna tienda.";
    }
  }

  async function instalarApp() {
    if (!promptInstalacion) {
      irAVista("ajustes");
      $("#instalar-estado-texto").textContent = pasosInstalacion();
      $("#btn-instalar-ajustes").hidden = true;
      $("#instalar-estado-texto").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    promptInstalacion.prompt();
    await promptInstalacion.userChoice;
    promptInstalacion = null; // el evento solo se puede usar una vez
    actualizarUIInstalacion();
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // evitamos el mini-infobar para controlar cuándo se ofrece
    promptInstalacion = e;
    actualizarUIInstalacion();
  });
  window.addEventListener("appinstalled", () => {
    promptInstalacion = null;
    actualizarUIInstalacion();
  });
  $("#btn-instalar-sidebar").addEventListener("click", instalarApp);
  $("#btn-instalar-ajustes").addEventListener("click", instalarApp);
  actualizarUIInstalacion();

  /* =============================================================
     7. REGISTRO DEL SERVICE WORKER (PWA instalable)
     ============================================================= */
  function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    // Nota: en el entorno de vista previa dentro del chat esto puede
    // no registrarse por restricciones del sandbox; al desplegar el
    // proyecto como sitio real, el registro funciona normalmente.
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Silencioso: no es crítico para el resto de la app.
    });
  }

  /* =============================================================
     INICIO
     ============================================================= */
  /** El estado guardado ("denied") puede quedarse viejo si la persona luego
   *  permite la ubicación desde el navegador. Si el permiso ya está concedido,
   *  pedimos la posición sin mostrar ningún aviso y refrescamos la lista. */
  async function sincronizarPermisoUbicacion() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    try {
      const p = await navigator.permissions.query({ name: "geolocation" });
      const revisar = async () => {
        const guardado = obtenerAjustes().ubicacionEstado;
        if (p.state === "granted" && guardado !== "granted") {
          const r = await pedirUbicacion();
          guardarAjustes({ ubicacionEstado: r.estado, ubicacionLat: r.lat, ubicacionLon: r.lon });
        } else if (p.state === "prompt" && guardado === "denied") {
          guardarAjustes({ ubicacionEstado: "no-solicitada" });
        } else return;
        actualizarEstadoUbicacionUI();
        renderListaSismos();
      };
      p.onchange = revisar; // si cambia el permiso con la página abierta
      revisar();
    } catch (e) { /* navegador sin Permissions API: se queda como estaba */ }
  }

  function init() {
    // Restaura la zona guardada sin pedir ubicación de entrada: si
    // quedó en "cerca" pero el permiso no está concedido, el estado
    // vacío ya explica qué hacer (ver PantallaInicio.vue). Pedir
    // ubicación solo ocurre ante una acción explícita del usuario.
    estado.zona = obtenerAjustes().zona || "peru";
    exponerAccionesParaVue();
    sincronizarPermisoUbicacion();
    sincronizarControlesZona();
    router();
    iniciarOnboardingSiProcede();
    inicializarAjustes();
    registrarServiceWorker();
    cargarSismos();
  }

  /** Botón "Usar mi ubicación" del estado vacío de "Cerca de mí". */
  async function usarMiUbicacion() {
    estado.buscandoUbicacion = true;
    const r = await pedirUbicacion();
    estado.buscandoUbicacion = false;
    guardarAjustes({ ubicacionEstado: r.estado, ubicacionLat: r.lat, ubicacionLon: r.lon });
    actualizarEstadoUbicacionUI();
    renderListaSismos();
  }

  /** Lo que los componentes Vue pueden pedirle a este archivo. */
  function exponerAccionesParaVue() {
    Object.assign(AA, { alElegirSismo, abrirDetalle, establecerZona, alCambiarFiltros, usarMiUbicacion });
  }

  // Este archivo lo carga main.js cuando el HTML ya está listo
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
