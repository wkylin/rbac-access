<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { AlertTriangle } from "lucide-vue-next";
import { answerConfirmation, confirmation } from "../confirmation";

const dialog = ref<HTMLDialogElement | null>(null);

watch(confirmation, async request => {
  if (request) {
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
  } else if (dialog.value?.open) {
    dialog.value.close();
  }
}, { flush: "post" });
</script>

<template>
  <dialog ref="dialog" class="modal" @cancel.prevent="answerConfirmation(false)" @click.self="answerConfirmation(false)">
    <div class="modal-box max-w-lg border border-base-300 bg-base-100 p-6 shadow-2xl">
      <div class="flex items-start gap-4">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-box bg-error/15 text-error"><AlertTriangle :size="22" /></span>
        <div class="min-w-0">
          <h2 class="text-xl font-semibold text-base-content">{{ confirmation?.title }}</h2>
          <p class="mt-2 text-sm leading-6 text-base-content/70">{{ confirmation?.message }}</p>
        </div>
      </div>
      <div class="modal-action mt-7">
        <button class="btn btn-ghost" type="button" @click="answerConfirmation(false)">取消</button>
        <button class="btn" :class="confirmation?.tone === 'error' ? 'btn-error' : 'btn-primary'" type="button" @click="answerConfirmation(true)">{{ confirmation?.confirmText }}</button>
      </div>
    </div>
  </dialog>
</template>
