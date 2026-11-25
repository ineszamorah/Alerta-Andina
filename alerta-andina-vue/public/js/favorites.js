/*
 * favorites.js — Favoritos simulados (sin backend)
 * ---------------------------------------------------------------
 * Requisito de esta entrega: simular una funcionalidad básica de
 * favoritos sin backend real. Se implementa 100% en el cliente con
 * localStorage: el usuario puede "guardar" un sismo desde la tarjeta
 * o el detalle, y verlo luego en la pestaña de Ajustes > Favoritos.
 *
 * Pendiente / mejora futura: si en algún momento hay backend, esto
 * se reemplazaría por una sincronización real por usuario.
 */

const FAV_KEY = "alertaandina_favoritos";

function obtenerFavoritos() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function esFavorito(id) {
  return obtenerFavoritos().includes(id);
}

/** Alterna el estado de favorito de un sismo. Devuelve el nuevo estado (bool). */
function alternarFavorito(id) {
  const favs = obtenerFavoritos();
  const idx = favs.indexOf(id);
  if (idx === -1) {
    favs.push(id);
  } else {
    favs.splice(idx, 1);
  }
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch (e) {
    // localStorage no disponible (modo privado, cuota excedida, etc.)
    // La app sigue funcionando, simplemente no persiste entre sesiones.
  }
  return favs.includes(id);
}
