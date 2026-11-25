<!--
  DropdownFiltro — chip que abre una lista de opciones. Se usa dos veces
  (zona y orden) con distintas opciones: un componente, dos usos.
  Funciona con v-model: <DropdownFiltro v-model="estado.orden" … />
-->
<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  modelValue: { type: String, required: true },
  opciones: { type: Array, required: true }, // [{ valor, texto }]
  textoChip: { type: String, default: "" },  // opcional: sustituye al texto de la opción elegida
});
const emit = defineEmits(["update:modelValue"]);

const abierto = ref(false);
const raiz = ref(null);

const textoVisible = computed(() => {
  if (props.textoChip) return props.textoChip;
  const o = props.opciones.find((x) => x.valor === props.modelValue);
  return o ? o.texto : "";
});

function elegir(valor) {
  abierto.value = false;
  if (valor !== props.modelValue) emit("update:modelValue", valor);
}

// Cerrar al hacer clic fuera o con Escape
function alClicFuera(e) {
  if (raiz.value && !raiz.value.contains(e.target)) abierto.value = false;
}
function alTeclear(e) {
  if (e.key === "Escape") abierto.value = false;
}
onMounted(() => {
  document.addEventListener("click", alClicFuera);
  document.addEventListener("keydown", alTeclear);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", alClicFuera);
  document.removeEventListener("keydown", alTeclear);
});
</script>

<template>
  <div class="dropdown" ref="raiz">
    <button class="chip" :class="{ 'is-open': abierto }" type="button" :aria-expanded="abierto" @click="abierto = !abierto">
      <span>{{ textoVisible }}</span>
      <svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
    </button>
    <div v-if="abierto" class="dropdown-panel" role="listbox">
      <div
        v-for="o in opciones"
        :key="o.valor"
        class="dropdown-option"
        :class="{ selected: o.valor === modelValue }"
        role="option"
        :aria-selected="o.valor === modelValue"
        @click="elegir(o.valor)"
      >
        {{ o.texto }}
      </div>
    </div>
  </div>
</template>
