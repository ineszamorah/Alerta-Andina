/*
 * plan.js — "Mi Plan" y modo emergencia (SOS)
 * ---------------------------------------------------------------
 * Reemplaza a la antigua sección "Seguridad". Tres pasos de preparación:
 *   1. Contactos a quién avisar (máx. 3) + mensaje "Estoy bien".
 *   2. Mochila viva: lista recomendada + "Otros" propios, con vencimientos.
 *   3. Dirección de emergencia (la dice la voz del móvil en el modo SOS).
 *
 * Sin cuenta ni servidor: todo vive en localStorage de este dispositivo
 * ("Vaciar mochila" borra la mochila; los contactos se quitan uno a uno). Lo que sale del móvil lo envía la persona:
 * El aviso "Estoy bien" sale por SMS (con el texto listo; la persona
 * pulsa enviar): tras un sismo internet suele caerse y el SMS llega igual.
 *
 * Modo emergencia: silbato con Web Audio API y voz con Web Speech API
 * (speechSynthesis). Ambos funcionan sin conexión. Una web no puede subir
 * el volumen del sistema; se avisa en pantalla y se puede probar antes.
 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const CLAVE = "alertaandina_plan";
  const MAX_CONTACTOS = 3;
  const DIA = 86400000;

  /* ---------------- Datos por país (región andina) ----------------
     Teléfonos verificados por país antes de publicar (ver memoria del TFP).
     Para "Otro país" no se inventan números: se avisa.
     - entidad: organismo oficial de gestión de riesgos que se cita.
     - doc: nombre del documento de identidad (para la mochila).
     - telEj / dirEj: ejemplos de los campos con el formato local. */
  const PAISES = {
    PE: { nombre: "Perú", tel: [["116", "Bomberos"], ["106", "SAMU"], ["105", "Policía"], ["119", "Mensajes de voz"]],
          entidad: "el INDECI", doc: "DNI", telEj: "+51 987 654 321", dirEj: "Ej. Jr. Las Flores 245, Comas, Lima",
          fuente: "Lista recomendada por el INDECI (Perú) para las primeras 24 horas." },
    BO: { nombre: "Bolivia", tel: [["110", "Policía"], ["118", "Ambulancia"], ["119", "Bomberos"]],
          entidad: "el VIDECI, Viceministerio de Defensa Civil", doc: "carnet de identidad", telEj: "+591 7123 4567", dirEj: "Ej. Calle Murillo 123, La Paz" },
    CL: { nombre: "Chile", tel: [["131", "Ambulancia"], ["132", "Bomberos"], ["133", "Carabineros"]],
          entidad: "SENAPRED", doc: "carnet de identidad", telEj: "+56 9 1234 5678", dirEj: "Ej. Av. Providencia 1234, depto 56, Santiago" },
    CO: { nombre: "Colombia", tel: [["123", "Línea única de emergencias"]],
          entidad: "la UNGRD", doc: "cédula", telEj: "+57 300 123 4567", dirEj: "Ej. Calle 45 # 12-34, Bogotá" },
    EC: { nombre: "Ecuador", tel: [["911", "ECU 911"]],
          entidad: "la Secretaría Nacional de Gestión de Riesgos", doc: "cédula", telEj: "+593 99 123 4567", dirEj: "Ej. Av. 10 de Agosto N25-45, Quito" },
    XX: { nombre: "tu país", tel: [], doc: "documento de identidad", telEj: "+ prefijo y número", dirEj: "Ej. calle, número y ciudad",
          fuente: "Lista general para las primeras 24 horas." },
  };
  const paisActual = () => PAISES[plan.pais] || PAISES.XX;
  function fuenteMochila(p) {
    if (p.fuente) return p.fuente;
    return ("Lista general para las primeras 24 horas. Consulta también las recomendaciones de " + p.entidad + " (" + p.nombre + ").").replace(" de el ", " del ");
  }

  // Lista recomendada. "vence": productos que caducan y piden fecha.
  const GRUPOS = [
    ["Agua y comida", [["agua", "Agua · 2 L por persona", true], ["conservas", "Conservas abre fácil", true], ["galletas", "Galletas y frutos secos", true]]],
    ["Salud", [["botiquin", "Botiquín básico"], ["medicinas", "Medicinas de la casa", true], ["mascarillas", "Mascarillas"]]],
    ["Luz y comunicación", [["linterna", "Linterna"], ["pilas", "Pilas de repuesto", true], ["radio", "Radio a pilas"], ["silbato", "Silbato"]]],
    ["Documentos y dinero", [["dni", "Copias del documento de identidad en bolsa"], ["billetes", "Billetes pequeños"]]],
    ["Abrigo e higiene", [["manta", "Manta y muda de ropa"], ["higiene", "Papel higiénico y jabón"]]],
  ];
  const BASE = GRUPOS.flatMap(([, items]) => items.map(([id, texto, vence]) => ({ id, texto, vence: !!vence })));
  const MOCHILA_LISTA = 0.7; // "lo básico": 70 % de la lista marcada

  const MENSAJE_INICIAL = "Estoy bien. Te escribo tras el sismo. Te llamo cuando pueda.";

  /* ---------------- Estado (localStorage) ---------------- */
  function vacio() {
    return { pais: "PE", contactos: [], mensaje: MENSAJE_INICIAL, direccion: "", marcados: {}, vencen: {}, otros: [], voz: "" };
  }
  function leer() {
    try {
      const p = Object.assign(vacio(), JSON.parse(localStorage.getItem(CLAVE) || "{}"));
      if (!PAISES[p.pais]) p.pais = "XX"; // p. ej. "España", que ya no está en la lista
      return p;
    } catch (e) { return vacio(); }
  }
  let plan = leer();
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(plan)); } catch (e) { /* modo privado: solo en memoria */ }
    pintarEstado();
  }

  /* ---------------- Utilidades ---------------- */
  const crear = (tag, props, ...hijos) => {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => (k in el ? (el[k] = v) : el.setAttribute(k, v)));
    hijos.flat().forEach((h) => h != null && el.append(h));
    return el;
  };
  const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fechaCorta = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "");
  const diasHasta = (iso) => Math.round((new Date(iso + "T12:00:00") - Date.now()) / DIA);
  const soloDigitos = (t) => String(t || "").replace(/[^\d+]/g, "");

  /* =============================================================
     MI PLAN
     ============================================================= */
  function pintarTodo() {
    $("#plan-pais").value = plan.pais;
    $("#plan-mensaje").value = plan.mensaje;
    $("#plan-direccion").value = plan.direccion;
    pintarTelefonos();
    pintarContactos();
    pintarMochila();
    pintarEstado();
  }

  function pintarEstado() {
    const nMarcados = todosLosItems().filter((i) => i.ok).length;
    const total = todosLosItems().length;
    const pasos = [
      { id: "contactos", ok: plan.contactos.length > 0,
        det: plan.contactos.length ? plan.contactos.length + " de " + MAX_CONTACTOS + " añadidos" : "añade al menos uno" },
      { id: "mochila", ok: BASE.filter((i) => plan.marcados[i.id]).length >= Math.ceil(BASE.length * MOCHILA_LISTA),
        det: "" },
      { id: "direccion", ok: !!plan.direccion.trim(), det: plan.direccion.trim() ? "guardada" : "pendiente" },
    ];
    pasos[1].det = pasos[1].ok ? "lo básico listo" : nMarcados + " de " + total + " cosas";
    const hechos = pasos.filter((p) => p.ok).length;
    pasos.forEach((p) => {
      const li = $("#paso-" + p.id);
      li.classList.toggle("is-ok", p.ok);
      li.querySelector(".paso-det").textContent = p.det;
    });
    $("#plan-pasos").textContent = hechos + "/3";
    const anillo = $("#plan-anillo");
    anillo.style.setProperty("--pct", Math.max(4, Math.round((hechos / 3) * 100)));
    anillo.setAttribute("aria-label", hechos + " de 3 pasos completados");
  }

  /* ---- País y teléfonos ---- */
  function pintarTelefonos() {
    const p = paisActual();
    const cont = $("#plan-telefonos");
    cont.textContent = "";
    cont.append(crear("strong", { textContent: "En " + p.nombre }));
    if (!p.tel.length) {
      cont.append(crear("span", { className: "tel-nota", textContent: "Alerta Andina está pensada para los países andinos. Busca el número de emergencias de tu país y guárdalo como contacto." }));
    } else {
      p.tel.forEach(([n, q]) => cont.append(crear("a", { href: "tel:" + n, className: "tel-link" }, crear("strong", { textContent: n }), " " + q)));
      cont.append(crear("span", { className: "tel-nota", textContent: "Toca un número para llamar" }));
    }
    $("#mochila-fuente").textContent = fuenteMochila(p) + ' Lo que añadas tú va abajo, en "Otros".';
    // La ventana "¿Qué es la mochila?" cita al INDECI solo si el país es Perú
    $("#dialogo-mochila .dialogo-fuente").textContent = plan.pais === "PE"
      ? "Fuente: INDECI · Combo de supervivencia."
      : "Recomendaciones generales para las primeras 24 horas tras un sismo.";
    // Ejemplos de teléfono y dirección con el formato de cada país
    $("#contacto-tel").placeholder = p.telEj;
    $("#plan-direccion").placeholder = p.dirEj;
  }
  $("#plan-pais").addEventListener("change", (e) => {
    plan.pais = e.target.value;
    guardar();
    pintarTelefonos();
    pintarMochila(); // el documento de identidad cambia de nombre
  });

  /* ---- Contactos ---- */
  function pintarContactos() {
    const ul = $("#contactos-lista");
    ul.textContent = "";
    plan.contactos.forEach((c, i) => {
      ul.append(crear("li", {},
        crear("span", { className: "contacto-inicial", textContent: (c.nombre[0] || "?").toUpperCase(), "aria-hidden": "true" }),
        crear("span", { className: "contacto-datos" }, crear("strong", { textContent: c.nombre }), crear("span", { textContent: c.tel })),
        crear("a", { className: "contacto-accion", href: enlaceSMS([c.tel]), textContent: "SMS", "aria-label": "Avisar a " + c.nombre + " por SMS" }),
        crear("button", { type: "button", className: "contacto-quitar", "aria-label": "Quitar a " + c.nombre, innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', onclick: () => { plan.contactos.splice(i, 1); guardar(); pintarContactos(); } })
      ));
    });
    $("#contactos-cuenta").textContent = plan.contactos.length + " de " + MAX_CONTACTOS;
    const lleno = plan.contactos.length >= MAX_CONTACTOS;
    $("#contactos-abrir").hidden = lleno || !$("#contactos-form").hidden;
    if (lleno) $("#contactos-form").hidden = true;
    $("#contactos-abrir").textContent = "+ Añadir contacto (máx. " + MAX_CONTACTOS + ")";
  }
  $("#contactos-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = $("#contacto-nombre").value.trim();
    const tel = $("#contacto-tel").value.trim();
    if (!nombre || soloDigitos(tel).replace("+", "").length < 6 || plan.contactos.length >= MAX_CONTACTOS) return;
    plan.contactos.push({ nombre, tel });
    e.target.reset();
    e.target.hidden = true;
    guardar();
    pintarContactos();
  });

  $("#contactos-abrir").addEventListener("click", () => {
    $("#contactos-form").hidden = false;
    $("#contactos-abrir").hidden = true;
    $("#contacto-nombre").focus();
  });

  /* ---- Mensaje "Estoy bien" ---- */
  function textoEstoyBien() {
    const hora = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    return (plan.mensaje.trim() || MENSAJE_INICIAL) + " (" + hora + ")";
  }
  $("#plan-mensaje").addEventListener("input", (e) => { plan.mensaje = e.target.value; guardar(); });
  $("#plan-mensaje").addEventListener("change", pintarContactos); // refresca los enlaces con el texto nuevo

  /** Enlace sms: con el mensaje listo. iPhone y Android escriben distinto
   *  los destinatarios múltiples; sin destinatarios se abre el SMS vacío
   *  para que la persona elija a quién. */
  // iPhone, iPad y Mac (app Mensajes) usan el mismo formato
  const ES_IOS = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  function enlaceSMS(telefonos) {
    const nums = telefonos.map(soloDigitos).filter(Boolean).join(",");
    const cuerpo = encodeURIComponent(textoEstoyBien());
    if (ES_IOS) return nums ? "sms:/open?addresses=" + nums + "&body=" + cuerpo : "sms:&body=" + cuerpo;
    return "sms:" + nums + "?body=" + cuerpo;
  }

  /** Un toque: SMS a todos los contactos con el mensaje y la hora. Solo SMS,
   *  a propósito: tras un sismo internet suele caerse y los SMS llegan igual. */
  function avisarEstoyBien() {
    location.href = enlaceSMS(plan.contactos.map((c) => c.tel));
  }
  $("#plan-avisar").addEventListener("click", avisarEstoyBien);

  /* ---- Mochila ---- */
  function todosLosItems() {
    const doc = paisActual().doc;
    return BASE.map((i) => ({ ...i, ok: !!plan.marcados[i.id], fecha: plan.vencen[i.id] || "" }))
      .map((i) => (i.id === "dni" ? { ...i, texto: "Copias de " + (doc === "DNI" ? "DNI" : "tu " + doc) + " en bolsa" } : i))
      .concat(plan.otros.map((o) => ({ id: o.id, texto: o.texto, vence: !!o.fecha, ok: !!o.ok, fecha: o.fecha || "", otro: true })));
  }

  function filaItem(item) {
    const id = "mi-" + item.id;
    const li = crear("li", {});
    const chk = crear("input", { type: "checkbox", id, checked: item.ok });
    chk.addEventListener("change", () => {
      // Si ya no lo tienes, su fecha de vencimiento deja de tener sentido:
      // se borra para que no siga saliendo en "Vencen pronto".
      if (item.otro) {
        const o = plan.otros.find((x) => x.id === item.id);
        o.ok = chk.checked;
        if (!chk.checked) o.fecha = "";
      } else {
        plan.marcados[item.id] = chk.checked;
        if (!chk.checked) delete plan.vencen[item.id];
      }
      guardar();
      pintarMochila();
    });
    li.append(chk, crear("label", { htmlFor: id, textContent: item.texto }));
    const ponerFecha = (valor) => {
      if (item.otro) plan.otros.find((o) => o.id === item.id).fecha = valor;
      else if (valor) plan.vencen[item.id] = valor;
      else delete plan.vencen[item.id];
      guardar();
      pintarMochila();
    };
    if ((item.vence || item.otro) && item.ok) {
      // Texto corto ("vence 12 nov" / "+ vencimiento") con el selector de fecha
      // nativo encima, transparente: al tocarlo se abre el calendario del móvil.
      const fecha = crear("input", { type: "date", value: item.fecha, min: hoyISO(), "aria-label": "Fecha de vencimiento de " + item.texto });
      fecha.addEventListener("change", () => ponerFecha(fecha.value));
      const chip = crear("span", { className: "item-vence-btn " + (item.fecha ? tonoVence(item.fecha) : "sin-fecha"), title: "Fecha de vencimiento" },
        item.fecha ? "vence " + fechaCorta(item.fecha) : "+ vencimiento", fecha);
      li.append(chip);
      if (item.fecha) {
        li.append(crear("button", { type: "button", className: "item-fecha-quitar", "aria-label": "Quitar la fecha de " + item.texto, title: "Quitar fecha",
          innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
          onclick: () => ponerFecha("") }));
      }
    } else if (item.fecha) {
      li.append(crear("span", { className: "item-vence " + tonoVence(item.fecha), textContent: fechaCorta(item.fecha) }));
    }
    if (item.otro) {
      li.append(crear("button", { type: "button", className: "item-quitar", "aria-label": "Quitar " + item.texto, innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        onclick: () => { plan.otros = plan.otros.filter((o) => o.id !== item.id); guardar(); pintarMochila(); } }));
    }
    if (item.fecha) li.classList.add(tonoVence(item.fecha));
    return li;
  }
  const tonoVence = (iso) => (diasHasta(iso) <= 14 ? "vence-ya" : diasHasta(iso) <= 30 ? "vence-pronto" : "vence-lejos");

  function pintarMochila() {
    const cont = $("#mochila-grupos");
    cont.textContent = "";
    GRUPOS.forEach(([titulo, items]) => {
      const ul = crear("ul", {});
      items.forEach(([id]) => ul.append(filaItem(todosLosItems().find((i) => i.id === id))));
      cont.append(crear("div", { className: "mochila-grupo" }, crear("h3", { textContent: titulo }), ul));
    });
    const ulOtros = $("#otros-lista");
    ulOtros.textContent = "";
    todosLosItems().filter((i) => i.otro).forEach((i) => ulOtros.append(filaItem(i)));
    $("#otros-cuenta").textContent = plan.otros.length ? plan.otros.length + (plan.otros.length === 1 ? " cosa" : " cosas") : "";

    const items = todosLosItems();
    const hechos = items.filter((i) => i.ok).length;
    $("#mochila-cuenta").textContent = hechos + " de " + items.length + " listas";
    $("#mochila-barra").style.width = Math.round((hechos / items.length) * 100) + "%";
    $("#mochila-barra-wrap").setAttribute("aria-label", hechos + " de " + items.length + " cosas listas");

    // Vencen en los próximos 30 días (o ya vencidas)
    const pronto = items.filter((i) => i.ok && i.fecha && diasHasta(i.fecha) <= 30).sort((a, b) => a.fecha.localeCompare(b.fecha));
    $("#mochila-vencen").hidden = !pronto.length;
    const lista = $("#mochila-vencen-lista");
    lista.textContent = "";
    pronto.forEach((i, n) => {
      if (n) lista.append(" · ");
      lista.append(i.texto.split(" · ")[0] + " ", crear("strong", { className: tonoVence(i.fecha), textContent: diasHasta(i.fecha) < 0 ? "venció" : fechaCorta(i.fecha) }));
    });
    $("#otros-vence").min = hoyISO();
  }

  $("#otros-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = $("#otros-texto").value.trim();
    if (!texto) return;
    plan.otros.push({ id: "o" + Date.now().toString(36), texto, fecha: $("#otros-vence").value || "", ok: true });
    e.target.reset();
    guardar();
    pintarMochila();
  });

  /** Recordatorios en el calendario sin cuenta. Se ofrecen dos caminos:
   *  - Google Calendar: un enlace por cosa, abre el evento ya rellenado.
   *  - Apple / Outlook: un archivo .ics (al abrirlo, el calendario lo importa).
   *  Un evento por cosa, una semana antes de que venza (o hoy si ya no da tiempo). */
  const ymd = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  function eventosQueVencen() {
    return todosLosItems().filter((i) => i.fecha && diasHasta(i.fecha) <= 30).map((i) => {
      let dia = new Date(new Date(i.fecha + "T12:00:00").getTime() - 7 * DIA);
      if (dia < new Date()) dia = new Date();
      const nombre = i.texto.split(" · ")[0];
      return { i, dia, fin: new Date(dia.getTime() + DIA),
        titulo: "Cambiar " + nombre.toLowerCase() + " de la mochila (vence el " + fechaCorta(i.fecha) + ")",
        nombre };
    });
  }
  function enlaceGoogle(ev) {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(ev.titulo) +
      "&dates=" + ymd(ev.dia) + "/" + ymd(ev.fin) +
      "&details=" + encodeURIComponent("Recordatorio de Mi Plan · Alerta Andina. Revisa tu mochila para emergencias.");
  }
  function descargarICS(eventos) {
    const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const ev = eventos.map((e) => ["BEGIN:VEVENT", "UID:" + e.i.id + "-" + e.i.fecha + "@alerta-andina", "DTSTAMP:" + ahora,
      "DTSTART;VALUE=DATE:" + ymd(e.dia), "DTEND;VALUE=DATE:" + ymd(e.fin),
      "SUMMARY:" + e.titulo, "DESCRIPTION:Recordatorio de Mi Plan · Alerta Andina",
      "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", "DESCRIPTION:Revisa tu mochila para emergencias", "END:VALARM",
      "END:VEVENT"].join("\r\n"));
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Alerta Andina//Mi Plan//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"].concat(ev, "END:VCALENDAR").join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = crear("a", { href: url, download: "recordatorio-mochila.ics" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  $("#mochila-calendario").addEventListener("click", () => {
    const eventos = eventosQueVencen();
    if (!eventos.length) return;
    const lista = $("#calendario-lista");
    lista.textContent = "";
    eventos.forEach((ev) => lista.append(crear("li", {},
      crear("span", {}, crear("strong", { textContent: ev.nombre }), " · aviso el " + ev.dia.toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "")),
      crear("a", { href: enlaceGoogle(ev), target: "_blank", rel: "noopener", className: "cal-google", textContent: "Google Calendar" }))));
    $("#calendario-ics").onclick = () => { descargarICS(eventos); $("#calendario-ics-nota").hidden = false; };
    $("#calendario-ics-nota").hidden = true;
    $("#dialogo-calendario").showModal();
  });

  /* ---- Modales informativos (<dialog> nativo: Esc y foco ya resueltos) ---- */
  $("#mochila-info").addEventListener("click", () => $("#dialogo-mochila").showModal());
  document.querySelectorAll("dialog.plan-dialogo").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-cerrar]")) d.close(); });
  });

  /* ---- Dirección ---- */
  $("#plan-direccion").addEventListener("input", (e) => { plan.direccion = e.target.value; guardar(); });

  /* ---- Vaciar mochila (confirmación dentro de la tarjeta) ----
     Quita marcas, fechas y "Otros". Contactos, mensaje y dirección no se
     tocan: los contactos ya tienen su propia ✕. */
  $("#mochila-vaciar").addEventListener("click", () => {
    $("#mochila-vaciar").hidden = true;
    $("#plan-confirmar").hidden = false;
    $("#plan-borrar-no").focus();
  });
  function cerrarConfirmacion() {
    $("#plan-confirmar").hidden = true;
    $("#mochila-vaciar").hidden = false;
  }
  $("#plan-borrar-no").addEventListener("click", cerrarConfirmacion);
  $("#plan-borrar-si").addEventListener("click", () => {
    plan.marcados = {};
    plan.vencen = {};
    plan.otros = [];
    guardar();
    pintarMochila();
    cerrarConfirmacion();
  });

  /* =============================================================
     MODO EMERGENCIA
     ============================================================= */
  /* ---- Silbato (Web Audio) ----
     Onda cuadrada a ~3.100 Hz: el oído es más sensible ahí y el altavoz
     del móvil rinde mejor; el compresor lleva el nivel al tope sin
     distorsionar. Patrón: 3 pitidos y pausa (señal de auxilio). */
  let ctx = null, temporizador = null, sonando = false, modo = null, wakeLock = null;

  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {} // iPhone: que suene aunque esté en silencio
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  /* Desbloqueo temprano: el primer toque en cualquier parte de la app crea el
     contexto de audio y "despierta" la salida de sonido con un instante de
     silencio. Sin esto, la primera vez que se pulsaba "Probar el silbato" el
     altavoz tardaba en arrancar y la primera tanda se perdía o llegaba tarde. */
  function despertarAudio() {
    const c = audio();
    if (!c) return;
    try {
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
  }
  document.addEventListener("pointerdown", despertarAudio, { once: true, capture: true });
  document.addEventListener("keydown", despertarAudio, { once: true, capture: true });
  function tresPitidos() {
    const c = audio();
    if (!c) return 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.1;
    comp.connect(c.destination);
    // Margen de arranque: si el audio acaba de despertar, se deja un instante
    // para que la salida esté lista y no se pierda el primer pitido.
    const base = c.currentTime + (c.state === "running" ? 0.06 : 0.3);
    [0, 0.5, 1.0].forEach((dt) => {
      const t = base - c.currentTime + dt;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(3100, c.currentTime + t);
      o.frequency.linearRampToValueAtTime(3300, c.currentTime + t + 0.35); // un leve "trino", como un silbato
      g.gain.setValueAtTime(0.0001, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.9, c.currentTime + t + 0.02);
      g.gain.setValueAtTime(0.9, c.currentTime + t + 0.33);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.38);
      o.connect(g).connect(comp);
      o.start(c.currentTime + t);
      o.stop(c.currentTime + t + 0.4);
    });
    try { navigator.vibrate && navigator.vibrate([350, 150, 350, 150, 350]); } catch (e) {}
    animarPatron();
    return 1450 + Math.round((base - c.currentTime) * 1000); // ms que dura la tanda
  }
  function animarPatron() {
    const marcas = document.querySelectorAll("#sonando-patron i");
    marcas.forEach((m, i) => { m.classList.remove("on"); if (i < 3) setTimeout(() => m.classList.add("on"), i * 500); });
    setTimeout(() => marcas.forEach((m) => m.classList.remove("on")), 1500);
  }

  /* ---- Voz (Web Speech API) ---- */
  function fraseDonde() {
    const donde = $("#emergencia-donde").value.trim();
    return donde ? "Necesito ayuda. Estoy " + donde + "." : "Necesito ayuda. Estoy aquí.";
  }
  /* Elegir bien la voz importa: en Mac/iPhone hay voces "de broma" en español
     (Eddy, Flo, Grandpa, Rocko…) que suenan robóticas, y si las voces aún no
     han cargado el navegador usa la del sistema (a menudo en inglés). */
  const VOCES_RARAS = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph)\b/i;
  let vocesES = [];
  function cargarVoces() {
    if (!("speechSynthesis" in window)) return;
    vocesES = speechSynthesis.getVoices().filter((v) => /^es\b|^es[-_]/i.test(v.lang) && !VOCES_RARAS.test(v.name));
    vocesES.sort((a, b) => puntuarVoz(b) - puntuarVoz(a));
  }
  /** La app usa siempre una voz en español de España (la mejor que tenga el
   *  dispositivo); si no hay ninguna, otra en español. Sin selector: menos
   *  decisiones para la persona en un momento de estrés. */
  function puntuarVoz(v) {
    let p = 0;
    if (/ES$/i.test(v.lang)) p += 100;           // español de España, siempre primero
    if (/premium|enhanced|mejorada|natural|neural|siri/i.test(v.name)) p += 50; // voces de alta calidad descargadas
    if (/m[oó]nica|paulina|marisol|jorge|juan|diego|isabela|soledad|ang[eé]lica|francisca|helena|laura|pablo|elvira|dalia|camila|lucia/i.test(v.name)) p += 25;
    if (/^google/i.test(v.name)) p += 20;        // natural, pero necesita internet
    if (v.localService) p += 10;                  // funciona sin conexión
    return p;
  }
  function vozElegida() {
    return vocesES[0] || null;
  }
  if ("speechSynthesis" in window) {
    cargarVoces();
    speechSynthesis.addEventListener("voiceschanged", cargarVoces);
  }

  function decir(texto, alTerminar) {
    if (!("speechSynthesis" in window)) { alTerminar && setTimeout(alTerminar, 1500); return false; }
    speechSynthesis.cancel();
    if (!vocesES.length) cargarVoces();
    const u = new SpeechSynthesisUtterance(texto);
    const voz = vozElegida();
    if (voz) u.voice = voz;
    u.lang = voz ? voz.lang : "es-ES";
    u.rate = 0.9; u.pitch = 1; u.volume = 1;
    u.onend = () => alTerminar && alTerminar();
    speechSynthesis.speak(u);
    return true;
  }

  /* ---- Bucle: "silbato", "voz" o "alterna" ---- */
  function empezar(nuevoModo) {
    parar(true);
    modo = nuevoModo;
    sonando = true;
    $("#emergencia-panel").hidden = true;
    $("#emergencia-sonando").hidden = false;
    pintarSonando();
    pedirPantallaEncendida();
    paso(0);
  }
  function paso(n) {
    if (!sonando) return;
    const toca = modo === "voz" || (modo === "alterna" && n % 3 === 2) ? "voz" : "silbato";
    if (toca === "voz") {
      decir(fraseDonde(), () => { temporizador = setTimeout(() => paso(n + 1), 1200); });
    } else {
      const dura = tresPitidos();
      temporizador = setTimeout(() => paso(n + 1), dura + 1200);
    }
  }
  function parar(sinVolver) {
    sonando = false;
    clearTimeout(temporizador);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    soltarPantalla();
    if (!sinVolver) {
      $("#emergencia-sonando").hidden = true;
      $("#emergencia-panel").hidden = false;
    }
  }
  function pintarSonando() {
    const etiquetas = { silbato: "Silbato sonando", voz: "Diciendo dónde estás", alterna: "Silbato y voz" };
    $("#sonando-etiqueta").textContent = etiquetas[modo];
    $("#sonando-texto").textContent = modo === "voz"
      ? '"' + fraseDonde() + '" Se repite hasta que lo detengas.'
      : "3 pitidos y pausa: la señal internacional de auxilio. Suena hasta que la detengas.";
    $("#sonando-alternar").textContent = modo === "alterna" ? "Solo silbato" : 'Alternar silbato y "Decir dónde estoy"';
  }

  async function pedirPantallaEncendida() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { wakeLock = null; }
  }
  function soltarPantalla() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }

  /* ---- Abrir / cerrar ---- */
  function abrirEmergencia() {
    const alerta = $("#alerta-overlay");
    if (alerta) alerta.hidden = true;
    $("#emergencia-donde").value = $("#emergencia-donde").value.trim() || (plan.direccion ? "en " + plan.direccion : "");
    $("#emergencia-panel").hidden = false;
    $("#emergencia-sonando").hidden = true;
    $("#emergencia").hidden = false;
    document.body.classList.add("sin-scroll");
    $("#btn-silbato").focus();
    audio(); // desbloquea el audio con este toque
  }
  function cerrarEmergencia() {
    parar(true);
    $("#emergencia").hidden = true;
    document.body.classList.remove("sin-scroll");
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-abrir-emergencia]")) abrirEmergencia(); });
  $("#emergencia-cerrar").addEventListener("click", cerrarEmergencia);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#emergencia").hidden) { sonando ? parar() : cerrarEmergencia(); }
  });
  $("#btn-silbato").addEventListener("click", () => empezar("silbato"));
  $("#btn-voz").addEventListener("click", () => empezar("voz"));
  $("#sonando-detener").addEventListener("click", () => parar());
  $("#sonando-alternar").addEventListener("click", () => empezar(modo === "alterna" ? "silbato" : "alterna"));
  $("#emergencia-bien").addEventListener("click", () => { cerrarEmergencia(); avisarEstoyBien(); });

  $("#donde-casa").addEventListener("click", () => {
    $("#emergencia-donde").value = plan.direccion ? "en " + plan.direccion : "";
    $("#emergencia-donde-nota").textContent = plan.direccion ? "Usando tu dirección guardada." : "No tienes dirección guardada: escríbela aquí o en Mi Plan.";
  });
  $("#donde-gps").addEventListener("click", async () => {
    const nota = $("#emergencia-donde-nota");
    nota.textContent = "Buscando tu posición…";
    const r = typeof pedirUbicacion === "function" ? await pedirUbicacion() : { estado: "unsupported" };
    if (r.estado !== "granted") {
      nota.textContent = "No se pudo obtener tu ubicación. Escribe dónde estás.";
      return;
    }
    // Con internet se convierte en calle (OpenStreetMap); sin internet, coordenadas
    const coords = "en latitud " + r.lat.toFixed(5) + ", longitud " + r.lon.toFixed(5);
    $("#emergencia-donde").value = coords;
    nota.textContent = "Coordenadas GPS. Buscando la calle…";
    try {
      const calle = typeof direccionAproximada === "function" ? await direccionAproximada(r.lat, r.lon) : null;
      if (calle) {
        $("#emergencia-donde").value = "en " + calle;
        nota.textContent = "Calle aproximada según tu GPS (OpenStreetMap). Corrígela si hace falta.";
        return;
      }
    } catch (e) { /* sin conexión */ }
    nota.textContent = "Coordenadas GPS: quien te escuche puede buscarlas en un mapa.";
  });

  $("#plan-probar-silbato").addEventListener("click", () => tresPitidos());

  if (!plan.contactos.length) $("#contactos-form").hidden = false;
  pintarTodo();
})();
