/*
 * notifications.js — Web Notifications API
 * ---------------------------------------------------------------
 * Notificaciones nativas del navegador cuando se detecta un sismo
 * nuevo por encima del umbral configurado, mientras la app está
 * abierta. No usa push real (eso requeriría backend + VAPID keys),
 * así que esto es "alerta mientras tienes la app abierta", no
 * notificación push en background — se documenta como limitación.
 */

async function pedirPermisoNotificaciones() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return "denied";
  }
}

function notificarSismo(sismo) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification("Alerta Andina — nuevo sismo", {
      body: sismo.properties.title,
      tag: "sismo-" + sismo.id,
      icon: "icons/icon-192.png",
    });
    n.onclick = () => window.focus();
  } catch (e) {
    // Algunos navegadores/contextos (p. ej. sin HTTPS, o vistas
    // previas en iframe) no permiten crear notificaciones nativas.
  }
}
