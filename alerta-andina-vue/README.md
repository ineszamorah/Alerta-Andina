# Alerta Andina — Vue 3 + Vite (Posgrado FrontEnd, Shifta)

PWA de alertas sísmicas para Perú y la región andina, con datos públicos de USGS y EMSC.

Esta versión migra la app a **Vue 3 + Vite de forma progresiva**: las pantallas principales pasan a componentes Vue y el resto sigue siendo el JavaScript "vanilla" de la versión anterior (carpeta `alerta-andina`), que se mantiene intacta como referencia.

**Web publicada:** https://alerta-andina.netlify.app

## Cómo arrancarla

Necesitas [Node.js](https://nodejs.org) 20.19 o superior.

```
cd alerta-andina-vue
npm install        # solo la primera vez
npm run dev        # abre http://localhost:5173
```

Para generar la versión final (carpeta `dist/`, lista para subir a cualquier hosting):

```
npm run build
npm run preview    # para revisar el build en local
```

**Noticias y nombres de ciudad.** La pestaña Noticias del detalle y los nombres de ciudad de los sismos de EMSC necesitan leer Google News y OpenStreetMap desde un servidor (el navegador no puede por CORS). Lo hace el propio Vite con un pequeño plugin (`vite-api.js`, que sustituye al `servidor.py` de la versión vanilla), así que no hay que arrancar nada más: funciona con `npm run dev` y `npm run preview`. En Netlify esa misma ruta la resuelven las reglas de `public/_redirects`, que reenvían `/api/noticias` a Google News y `/api/lugar` a Nominatim. Si no hay titulares, la app muestra «No hay noticias asociadas a este sismo» y busca otras noticias de sismos en el país.

## Publicación en Netlify

La app está publicada en **https://alerta-andina.netlify.app** (acceso público, HTTPS).

1. `npm run build` genera la carpeta `dist/` con la versión final (HTML, CSS, JS empaquetado, manifest, service worker e iconos).
2. Se subió `dist/` a Netlify con **Netlify Drop** (arrastrar la carpeta o un .zip en app.netlify.com/drop).
3. Se cambió el nombre del sitio a `alerta-andina` y se dejó el acceso en **Public**.

`netlify.toml` deja escrita la configuración (comando de build, carpeta `dist`, versión de Node y cabeceras del manifest y del service worker), para poder conectar más adelante un repositorio de GitHub y tener despliegue automático.

Para actualizar la web: `npm run build` y, en Netlify → Deploys, arrastrar la nueva carpeta `dist/`. La URL se mantiene.

**Noticias y nombres de ciudad en Netlify.** En Netlify no corre `vite-api.js`. En su lugar, `public/_redirects` (Vite lo copia a `dist/`) define dos reglas de reescritura: `/api/noticias` reenvía al RSS de Google News y `/api/lugar` a OpenStreetMap (Nominatim). Así el navegador no choca con CORS. Si fallan, la app sigue usando sus alternativas (intermediarios públicos, GDELT y el enlace directo a Google News).

## Estado de la migración

| Parte de la app | Tecnología | Dónde está |
|---|---|---|
| **Inicio**: hero, filtros, lista "En tu zona" y "En el mundo" | **Vue** | `src/components/` |
| Detalle del sismo (Detalle · Actividad · Noticias) | Vanilla → **siguiente fase** | `src/vanilla/app.js` |
| Mapa (Leaflet), onboarding, alertas en vivo, Ajustes, PWA | Vanilla | `src/vanilla/app.js`, `public/js/map.js` |
| Mi Plan y modo emergencia (SOS) | Vanilla | `src/vanilla/plan.js` |
| Datos, ajustes, favoritos, geolocalización, lugares | Vanilla (scripts clásicos) | `public/js/` |

### Por qué una migración progresiva

Vue se presenta a sí mismo como un *framework progresivo*: se puede adoptar por partes en una web que ya existe, sin reescribirla entera de golpe. Se migraron primero las pantallas donde Vue aporta más:

- **Componentes reutilizables.** `TarjetaSismo.vue` se usa en las dos listas, y `ListaSismos.vue` y `DropdownFiltro.vue` también se usan dos veces cada uno. Antes, cada tarjeta se montaba con `innerHTML` y se le añadían los eventos a mano.
- **Reactividad en vez de tocar el DOM.** Antes, cada cambio (un filtro, un dato nuevo, guardar un sismo) obligaba a llamar a funciones que borraban y repintaban la lista. Ahora la lista, el hero y los títulos son `computed()` del estado: cuando cambia algo, Vue recalcula y repinta solo lo necesario.
- **Vite** sirve la app en desarrollo con recarga instantánea y genera un build optimizado (minificado y con nombres con hash para la caché).

## Cómo conviven Vue y el código vanilla

```
index.html
 ├─ <script> clásicos de public/js     → funciones globales (obtenerSismos, guardarAjustes…)
 └─ <script type="module" src/main.js>
      1. crea el estado compartido (src/estado.js) y lo publica en window.AA
      2. monta <PantallaInicio> en #app-inicio
      3. carga src/vanilla/app.js y src/vanilla/plan.js
```

- **`src/estado.js`** es la única fuente de verdad de Inicio: un `reactive()` con los sismos cargados, los filtros (zona, orden, solo guardados) y el sismo seleccionado, más las funciones de filtrado. Lo usan los componentes Vue y también `app.js`, a través de `window.AA.estado`.
- **`app.js` ya no pinta Inicio.** Cuando llegan datos, solo escribe en el estado (`estado.todos = …`) y Vue repinta. A cambio, publica en `window.AA` las acciones que Vue necesita y que siguen siendo vanilla: `abrirDetalle`, `alElegirSismo` (mapa), `establecerZona` (pide ubicación y sincroniza Ajustes) y `usarMiUbicacion`.
- **Ajustes y favoritos** se guardan en `localStorage`, que no es reactivo. `main.js` envuelve `guardarAjustes()` y `alternarFavorito()` para sumar 1 a `estado.versionAjustes` y `estado.versionFavoritos`; así Vue sabe que debe recalcular (por ejemplo, al mover el umbral en Ajustes).
- **`src/legado.js`** reúne en un único sitio las funciones globales que usan los componentes (nivel de magnitud, tiempo relativo, favoritos…). Cuando esos scripts se migren a módulos, solo cambiará este archivo.
- Vite avisa al compilar de que los scripts de `public/js` "no se pueden empaquetar sin type=module". Es esperado: se copian tal cual a `dist/` y funcionan igual.

## Estructura

```
index.html               HTML de la app; Inicio se monta en #app-inicio
vite.config.js           Plugins (Vue + API local) y rutas relativas
netlify.toml             Configuración de despliegue en Netlify
vite-api.js              /api/noticias (Google News) y /api/lugar (OpenStreetMap) dentro de Vite
src/
  main.js                Punto de entrada: estado → Vue → código vanilla
  estado.js              Estado compartido (reactive) + lógica de filtrado
  legado.js              Puente a las funciones globales de public/js
  components/
    PantallaInicio.vue   Columna de Inicio: compone todo lo de abajo
    HeroSismo.vue        Anillo grande con número animado
    FiltrosInicio.vue    Zona, orden y "Solo guardados"
    DropdownFiltro.vue   Chip desplegable genérico (v-model)
    ListaSismos.vue      Título + rejilla de tarjetas + estado vacío (slot)
    TarjetaSismo.vue     Tarjeta de un sismo con botón de guardar
  vanilla/
    app.js               Orquestador vanilla (detalle, mapa, ajustes, alertas, PWA)
    plan.js              Mi Plan + modo emergencia
public/                  Se copia tal cual a dist/
  css/                   styles.css (tokens, layout, responsive) + leaflet.css
  js/                    api, lugares, favorites, settings, notifications, geo, map
  data/                  sample-quakes.json (respaldo si USGS/EMSC no responden)
  img/, icons/           Fondo, ilustraciones, logo, favicon e iconos de la PWA
  manifest.json, sw.js   PWA instalable
  _redirects             Reglas de Netlify: /api/noticias y /api/lugar
```

## Diseño y comportamiento (sin cambios respecto a la versión vanilla)

- Paleta azul: primario #0E2166, rojo #E0262A, amarillo #FFC300. Escala de magnitud en anillo. Tipografía Barlow Condensed + Nunito Sans.
- <900px: header y tabbar a todo el ancho, contenido en columna de 480px (600px desde 560px) y botón SOS flotante. ≥900px: sidebar, lista + mapa a la vez y bloque "Vigilando · En vivo · Instalar app".
- El logo (header y sidebar) es un enlace que siempre lleva al inicio.
- Onboarding de 4 pasos con el logo, por encima de todo salvo Emergencia y diálogos.
- Sin campana de notificaciones: las alertas en vivo salen a pantalla completa y el permiso se gestiona en el onboarding y en Ajustes.

## Mi Plan (vanilla)

- Países de la región andina: Perú, Bolivia, Chile, Colombia y Ecuador. Cada uno cambia los teléfonos de emergencia, la entidad oficial citada (INDECI, VIDECI, SENAPRED, UNGRD, Secretaría Nacional de Gestión de Riesgos), el nombre del documento de identidad y los ejemplos de teléfono y dirección. "Otro país" funciona igual pero sin teléfonos: avisa de buscar el número local.
- "Avisar que estoy bien" abre los SMS con el mensaje, la hora y los contactos, porque tras un sismo internet suele fallar y los SMS casi siempre llegan. Solo SMS, sin WhatsApp: cada contacto tiene además su propio botón SMS. Los productos que caducan tienen un botón "+ vencimiento" para apuntar la fecha.
- "Instalar app" en Ajustes se ve siempre: instala si el navegador lo permite y, si no (iPhone, por ejemplo), muestra los pasos para ese dispositivo.

## Pendiente

- **Fase 2:** página de detalle del sismo en Vue (pestañas Detalle, Actividad en la zona y Noticias).
- La lista de guardados de Ajustes aún usa la tarjeta vanilla; podría reutilizar `TarjetaSismo.vue`.
- Fuera de alcance: caché offline completa del Service Worker, notificaciones push con la app cerrada (requiere backend) y paginación de la lista.

## Nota sobre la fuente de datos

Se usa la API pública de USGS (sin API key, CORS abierto) en lugar del IGP, porque el IGP no publica una API documentada y abierta, solo páginas de consulta. EMSC complementa con sismos más pequeños. Se explica dentro de la app, en Ajustes → "De dónde vienen los datos".
