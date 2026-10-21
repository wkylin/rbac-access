<script setup lang="ts">
import { computed, ref } from "vue";
import { OPERATION_LABELS, staffName, type AccessRequest } from "../domain";
import { demo } from "../store";

const selectedId = ref("");
const lookup = ref("");
const filter = ref<"pending" | "all">("pending");
const reason = ref("");
const password = ref("");
const requests = computed(() => demo.data.value.requests.filter(item => filter.value === "all" || item.status === "pending"));
const selected = computed(() => demo.data.value.requests.find(item => item.id === selectedId.value) ?? requests.value[0] ?? null);
const affectedStaffNames = computed(() => selected.value?.preview.affectedStaffIds
  .map(id => staffName(demo.data.value, id)).join("、") || "暂无");
const canDecide = computed(() => !!selected.value && selected.value.status === "pending" &&
  !!demo.currentId.value && demo.hasGlobal("SYS_ACCESS_APPROVE") &&
  selected.value.makerId !== demo.currentId.value &&
  !selected.value.preview.affectedStaffIds.includes(demo.currentId.value));
const format = (value: unknown) => JSON.stringify(value, null, 2);
function loadById() {
  const found = demo.data.value.requests.find(item => item.id === lookup.value.trim());
  if (!found) { demo.error.value = "没有找到此提案 ID。请粘贴完整的 UUID。"; return; }
  filter.value = "all";
  selectedId.value = found.id;
  demo.error.value = "";
}
async function decide(decision: "approve" | "decline") {
  if (!selected.value) return;
  await demo.decide(selected.value.id, decision, reason.value, password.value);
  password.value = "";
  if (!demo.error.value) reason.value = "";
}
function statusText(request: AccessRequest): string {
  return request.status === "pending" ? "待审批" : request.status === "confirmed" ? "已批准" : "已拒绝";
}
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4"><div><p class="eyebrow">访问变更</p><h1>独立审批</h1><p>发起人冻结变更，独立且不受影响的审核员作出决定。</p></div><span class="badge badge-primary badge-soft px-3 py-3 text-xs">{{ demo.pendingCount.value }} 项待审批</span></div>
    <div class="alert alert-info alert-soft text-sm">审批时重新核对发起人权限、审核员权限、受影响人员和目标版本。只有批准确认后，模拟状态与审批回执才一起保存。</div>
    <div class="review-layout">
      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm review-list"><div class="panel-heading flex items-start justify-between gap-4"><div><h2>提案列表</h2><p class="hint">可通过完整 ID 恢复查看</p></div></div><div class="lookup-row"><input class="input input-ghost" v-model="lookup" placeholder="粘贴完整提案 UUID" aria-label="提案 ID" @keyup.enter="loadById" /><button class="btn btn-sm btn-ghost border border-base-300" type="button" @click="loadById">查找</button></div><div class="join mb-3 w-full"><button class="btn btn-sm join-item flex-1" :class="filter === 'pending' ? 'btn-primary' : 'btn-ghost border border-base-300'" type="button" @click="filter = 'pending'">待审批</button><button class="btn btn-sm join-item flex-1" :class="filter === 'all' ? 'btn-primary' : 'btn-ghost border border-base-300'" type="button" @click="filter = 'all'">全部</button></div><button v-for="request in requests" :key="request.id" class="btn btn-ghost request-option h-auto min-h-0 w-full whitespace-normal text-left" :class="selected?.id === request.id ? 'bg-primary/15 ring-1 ring-primary/40' : ''" type="button" @click="selectedId = request.id"><span><strong>{{ OPERATION_LABELS[request.preview.operation] }}</strong><small>{{ staffName(demo.data.value, request.makerId) }} · {{ new Date(request.createdAt).toLocaleString('zh-CN') }}</small></span><span class="badge badge-sm badge-soft" :class="request.status === 'pending' ? 'badge-warning' : request.status === 'confirmed' ? 'badge-success' : 'badge-error'">{{ statusText(request) }}</span><code>{{ request.id.slice(0, 8) }}</code></button><p v-if="!requests.length" class="empty-note">还没有这类提案。先去角色或员工页面预览并提交变更。</p></section>
      <section v-if="selected" class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm review-detail"><div class="panel-heading flex items-start justify-between gap-4"><div><p class="eyebrow">{{ selected.id }}</p><h2>{{ OPERATION_LABELS[selected.preview.operation] }}</h2><p class="hint">目标 {{ selected.preview.targetId }} · 目标版本 {{ selected.preview.targetVersion }}</p></div><span class="badge badge-sm badge-soft" :class="selected.status === 'pending' ? 'badge-warning' : selected.status === 'confirmed' ? 'badge-success' : 'badge-error'">{{ statusText(selected) }}</span></div>
        <div class="review-facts"><div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">发起人</div><div class="stat-value mt-2 text-sm leading-5">{{ staffName(demo.data.value, selected.makerId) }}</div></div><div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">受影响员工</div><div class="stat-value mt-2 text-sm leading-5">{{ affectedStaffNames }}</div></div><div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">提案理由</div><div class="stat-value mt-2 text-sm leading-5">{{ selected.reason }}</div></div></div>
        <div class="diff-grid"><div class="diff-panel"><span class="diff-label">冻结前状态</span><pre>{{ format(selected.preview.before) }}</pre></div><div class="diff-arrow">→</div><div class="diff-panel diff-panel--next"><span class="diff-label">冻结目标状态</span><pre>{{ format(selected.preview.desired) }}</pre></div></div>
        <p class="hash-line">影响指纹 <code>{{ selected.preview.impactHash }}</code></p>
        <template v-if="selected.status === 'pending'"><div v-if="!canDecide" class="alert alert-warning alert-soft my-4 text-sm">此账号不能审批：需要全局审批权限，且不能是发起人或受影响员工。</div><form v-else class="form-stack" @submit.prevent="decide('approve')"><label>审批理由<textarea class="textarea textarea-ghost" v-model="reason" rows="3" maxlength="500" placeholder="记录批准或拒绝的依据" /></label><label>当前审核员密码<input class="input input-ghost" v-model="password" type="password" autocomplete="current-password" placeholder="输入演示密码复核" /></label><div class="button-row flex flex-wrap items-center gap-2"><button class="btn btn-error btn-soft" type="button" :disabled="demo.busy.value || !reason.trim() || !password" @click="decide('decline')">拒绝提案</button><button class="btn btn-primary" type="submit" :disabled="demo.busy.value || !reason.trim() || !password">批准并应用</button></div></form></template>
        <div v-else class="alert alert-soft mt-4 block text-sm" :class="selected.status === 'confirmed' ? 'alert-success' : 'alert-error'"><strong>{{ selected.status === 'confirmed' ? '已批准并应用' : '已拒绝，未应用变更' }}</strong><p class="mt-2">审核员：{{ staffName(demo.data.value, selected.reviewerId ?? '') }} · {{ selected.decisionReason }}</p><template v-if="selected.receipt"><p>回执 ID：<code>{{ selected.receipt.decisionId }}</code></p><p>应用时间：{{ new Date(selected.receipt.appliedAt).toLocaleString('zh-CN') }}</p></template></div>
      </section>
      <section v-else class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm empty-panel"><h2>选择一项提案</h2><p>预览和提交后，提案会出现在这里。</p></section>
    </div>
  </div>
</template>
