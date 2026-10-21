<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { X, LockKeyhole, ArrowRight } from "lucide-vue-next";
import { OPERATION_LABELS, staffName } from "../domain";
import { demo } from "../store";

const reason = ref("");
const password = ref("");
const dialog = ref<HTMLDialogElement | null>(null);
const preview = computed(() => demo.staged.value);
const eligible = computed(() => preview.value && demo.currentId.value
  ? demo.eligibleReviewers(demo.data.value, preview.value, demo.currentId.value) : []);
const affectedStaffNames = computed(() => preview.value?.affectedStaffIds
  .map(id => staffName(demo.data.value, id)).join("、") || "暂无");
watch(preview, async value => {
  reason.value = "";
  password.value = "";
  if (value) {
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
  }
}, { flush: "post" });
const format = (value: unknown) => JSON.stringify(value, null, 2);
async function submit() {
  await demo.propose(reason.value, password.value);
  password.value = "";
}
function close() {
  if (!demo.busy.value) demo.staged.value = null;
}
</script>

<template>
  <dialog v-if="preview" ref="dialog" class="modal" aria-labelledby="preview-title" @cancel.prevent="close" @click.self="close">
    <section class="modal-box max-h-[90vh] w-11/12 max-w-5xl overflow-y-auto border border-base-300 bg-base-100 p-6 shadow-2xl">
      <header class="flex items-start justify-between gap-4">
        <div><p class="eyebrow">变更预览 · 第 1 步</p><h2 id="preview-title">先确认准确变更</h2></div>
        <button class="btn btn-ghost btn-square btn-sm" type="button" aria-label="关闭预览" :disabled="demo.busy.value" @click="close"><X :size="20" /></button>
      </header>
      <p class="hint">提交后只保存提案。审核员批准前，现有角色和权限保持不变。</p>
      <div class="review-facts">
        <div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">操作</div><div class="stat-value mt-2 text-sm leading-5">{{ OPERATION_LABELS[preview.operation] }}</div></div>
        <div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">目标 ID</div><code class="mt-2 block break-all text-xs">{{ preview.targetId }}</code></div>
        <div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">受影响员工</div><div class="stat-value mt-2 text-sm leading-5">{{ affectedStaffNames }}</div></div>
      </div>
      <div class="diff-grid">
        <div class="diff-panel"><span class="diff-label">审批前</span><pre>{{ format(preview.before) }}</pre></div>
        <div class="diff-arrow"><ArrowRight :size="20" /></div>
        <div class="diff-panel diff-panel--next"><span class="diff-label">申请状态</span><pre>{{ format(preview.desired) }}</pre></div>
      </div>
      <p class="hash-line">影响指纹 <code>{{ preview.impactHash }}</code></p>
      <div class="alert alert-soft my-4 text-sm" :class="eligible?.length ? 'alert-success' : 'alert-error'">
        <LockKeyhole :size="18" />
        <span v-if="eligible?.length">可独立审批：{{ eligible.map(item => item.name).join('、') }}。发起人和受影响员工不可审批。</span>
        <span v-else>当前没有符合条件的独立审核员，无法提交这项变更。</span>
      </div>
      <form class="form-stack" @submit.prevent="submit">
        <label>变更原因<textarea class="textarea textarea-ghost" v-model="reason" maxlength="500" rows="3" placeholder="说明为什么需要这项准确变更" /></label>
        <label>当前操作员密码<input class="input input-ghost" v-model="password" type="password" autocomplete="current-password" placeholder="输入演示密码以确认提案" /></label>
        <footer class="modal-action border-t border-base-300 pt-4">
          <button class="btn btn-ghost" type="button" @click="close">取消</button>
          <button class="btn btn-primary" type="submit" :disabled="demo.busy.value || !eligible?.length || !reason.trim() || !password">提交独立审批</button>
        </footer>
      </form>
    </section>
  </dialog>
</template>
