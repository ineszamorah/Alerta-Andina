<!--
  ListaSismos — título de sección + rejilla de tarjetas, o un mensaje si
  no hay nada que mostrar. Se usa para "En tu zona" y "En el mundo".
  El mensaje vacío se puede personalizar con el slot "vacio".
-->
<script setup>
import TarjetaSismo from "./TarjetaSismo.vue";

defineProps({
  titulo: { type: String, required: true },
  etiqueta: { type: String, default: "" },
  sismos: { type: Array, required: true },
  idSeleccionado: { type: String, default: null },
});
const emit = defineEmits(["elegir"]);
</script>

<template>
  <section>
    <div class="section-title">
      <span>{{ titulo }}</span>
      <span v-if="etiqueta" class="tag">{{ etiqueta }}</span>
    </div>
    <div class="quakes-grid">
      <TarjetaSismo
        v-for="(s, i) in sismos"
        :key="s.id"
        :sismo="s"
        :indice="i"
        :seleccionado="s.id === idSeleccionado"
        @elegir="emit('elegir', $event)"
      />
      <div v-if="!sismos.length" class="empty-state" style="grid-column: 1 / -1">
        <slot name="vacio" />
      </div>
    </div>
  </section>
</template>
