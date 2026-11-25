import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import apiAlertaAndina from "./vite-api.js";

// https://vite.dev/config/
export default defineConfig({
  // vue(): componentes .vue
  // apiAlertaAndina(): /api/noticias y /api/lugar (ver vite-api.js)
  plugins: [vue(), apiAlertaAndina()],
  // Rutas relativas en el build: la carpeta dist/ funciona en cualquier
  // servidor o subcarpeta (y como artefacto publicado).
  base: "./",
  server: { port: 5173 },
});
