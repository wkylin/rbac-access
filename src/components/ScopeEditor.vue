<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DIMENSIONS, DIMENSION_LABELS, clone, emptyRule, type Role, type RoleScope, type ScopeRule } from "../domain";
import { demo } from "../store";
import AppDatePicker from "./AppDatePicker.vue";
import AppSelect, { type SelectOption } from "./AppSelect.vue";

const { role } = defineProps<{ role: Role }>();
const draft = ref<RoleScope>(clone(role.scope));
watch(() => [role.id, role.version], () => { draft.value = clone(role.scope); });
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(role.scope));
const canEdit = computed(() => demo.hasGlobal("SYS_ROLE_ASSIGN_PERM"));
const availableCodes = computed(() => role.permissions.filter(code =>
  demo.data.value.permissions.some(item => item.code === code)));
const expiryDate = computed({
  get: () => {
    if (draft.value.expiresAt === null) return "";
    const date = new Date(draft.value.expiresAt);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  },
  set: value => {
    if (!value) {
      draft.value.expiresAt = null;
      return;
    }
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return;
    const previous = draft.value.expiresAt === null ? null : new Date(draft.value.expiresAt);
    draft.value.expiresAt = new Date(year, month - 1, day, previous?.getHours() ?? 23, previous?.getMinutes() ?? 59).getTime();
  },
});
const expiryHour = computed({
  get: () => String(draft.value.expiresAt === null ? 23 : new Date(draft.value.expiresAt).getHours()).padStart(2, "0"),
  set: value => {
    if (draft.value.expiresAt === null) return;
    const date = new Date(draft.value.expiresAt);
    date.setHours(Number(value));
    draft.value.expiresAt = date.getTime();
  },
});
const expiryMinute = computed({
  get: () => String(draft.value.expiresAt === null ? 59 : new Date(draft.value.expiresAt).getMinutes()).padStart(2, "0"),
  set: value => {
    if (draft.value.expiresAt === null) return;
    const date = new Date(draft.value.expiresAt);
    date.setMinutes(Number(value));
    draft.value.expiresAt = date.getTime();
  },
});
const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));
const modeOptions: SelectOption[] = [
  { value: "GLOBAL", label: "全局 · 已有权限不受资源限制" },
  { value: "RESTRICTED", label: "受限 · 按规则匹配" },
  { value: "DENY", label: "拒绝 · 不允许受保护操作" },
];
const hourOptions = hours.map(value => ({ value, label: value }));
const minuteOptions = minutes.map(value => ({ value, label: value }));
function updateMode(value: string | string[]) {
  if (typeof value !== "string") return;
  const mode = value as RoleScope["mode"];
  draft.value.mode = mode;
  if (mode !== "RESTRICTED") draft.value.rules = [];
  else if (!draft.value.rules.length) draft.value.rules = [emptyRule()];
}
function updateHour(value: string | string[]) {
  if (typeof value === "string") expiryHour.value = value;
}
function updateMinute(value: string | string[]) {
  if (typeof value === "string") expiryMinute.value = value;
}
function ids(rule: ScopeRule, dimension: keyof ScopeRule["resources"]): string {
  return rule.resources[dimension].join(", ");
}
function setIds(rule: ScopeRule, dimension: keyof ScopeRule["resources"], event: Event) {
  rule.resources[dimension] = [...new Set((event.target as HTMLInputElement).value.split(/[,，\n]/).map(value => value.trim()).filter(Boolean))];
}
function toggleCode(rule: ScopeRule, code: string, checked: boolean) {
  rule.permissionCodes = checked ? [...rule.permissionCodes, code] : rule.permissionCodes.filter(item => item !== code);
}
async function preview() {
  await demo.previewChange({ operation: "role-scope", targetId: role.id, desired: clone(draft.value) });
}
</script>

<template>
  <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm scope-editor">
    <div class="panel-heading flex items-start justify-between gap-4"><div><p class="eyebrow">资源范围</p><h3>{{ role.name }} 能作用于哪里</h3><p class="hint">权限决定能做什么；资源规则决定可以在哪些对象上使用。两个角色的权限与范围不会交叉拼接。</p></div><span class="badge badge-sm badge-soft" :class="role.scope.mode === 'GLOBAL' ? 'badge-success' : role.scope.mode === 'RESTRICTED' ? 'badge-warning' : 'badge-error'">{{ role.scope.mode }}</span></div>
    <div class="scope-grid">
      <label>范围模式<AppSelect :model-value="draft.mode" :options="modeOptions" aria-label="范围模式" :disabled="!canEdit" @update:model-value="updateMode" /></label>
      <div class="scope-expiry">
        <span>有效期（可选）</span>
        <div class="scope-expiry__fields">
          <AppDatePicker v-model="expiryDate" aria-label="有效期日期" placeholder="选择日期" :disabled="!canEdit" />
          <AppSelect class="time-select" :model-value="expiryHour" :options="hourOptions" aria-label="有效期小时" :disabled="!canEdit || !expiryDate" :max-menu-height="250" @update:model-value="updateHour" />
          <span aria-hidden="true">:</span>
          <AppSelect class="time-select" :model-value="expiryMinute" :options="minuteOptions" aria-label="有效期分钟" :disabled="!canEdit || !expiryDate" :max-menu-height="250" @update:model-value="updateMinute" />
        </div>
      </div>
    </div>
    <p v-if="draft.mode === 'GLOBAL'" class="alert alert-info alert-soft text-sm scope-mode-hint">全局范围只解除资源限制，不会增加权限代码。</p>
    <p v-if="draft.mode === 'DENY'" class="alert alert-info alert-soft text-sm scope-mode-hint">拒绝模式会使这个角色已有的权限无法用于受保护操作。</p>
    <template v-if="draft.mode === 'RESTRICTED'">
      <p class="alert alert-info alert-soft text-sm scope-mode-hint">同一条规则的所有资源条件必须同时匹配；不同规则之间任选其一。未指定资源的列表和导出需要全局范围。</p>
      <fieldset v-for="(rule, index) in draft.rules" :key="index" class="fieldset my-4 rounded-box border border-base-300 bg-base-200 p-4" :disabled="!canEdit">
        <legend class="scope-rule__legend"><span class="scope-rule__legend-label">规则 <span class="scope-rule__number">{{ index + 1 }}</span></span></legend>
        <div class="rule-head"><strong>此规则包含的权限</strong><button class="btn btn-link btn-sm h-auto px-0 text-error" type="button" @click="draft.rules.splice(index, 1)">移除规则</button></div>
        <div class="chip-checks">
          <label v-for="code in availableCodes" :key="code" class="badge badge-outline h-auto cursor-pointer gap-2 py-1 font-mono text-xs"><input class="checkbox checkbox-primary checkbox-xs" type="checkbox" :checked="rule.permissionCodes.includes(code)" @change="toggleCode(rule, code, ($event.target as HTMLInputElement).checked)" />{{ code }}</label>
        </div>
        <div class="scope-grid">
          <label v-for="dimension in DIMENSIONS" :key="dimension">{{ DIMENSION_LABELS[dimension] }} ID（逗号分隔）<input class="input input-ghost" :value="ids(rule, dimension)" :placeholder="dimension === 'site' ? '例如 site-a' : '留空表示此维度不限制'" @change="setIds(rule, dimension, $event)" /></label>
          <label>单次金额上限（可选）<input class="input input-ghost" v-model="rule.maxAmount" inputmode="decimal" placeholder="例如 5000" /></label>
          <label>币种（设置金额时必填）<input class="input input-ghost" v-model="rule.currency" maxlength="3" placeholder="例如 EUR" /></label>
        </div>
      </fieldset>
      <button class="btn btn-ghost border border-base-300" type="button" :disabled="!canEdit || draft.rules.length >= 10" @click="draft.rules.push(emptyRule())">添加资源规则</button>
    </template>
    <div class="panel-footer"><span class="hint">{{ dirty ? '草稿尚未生效，需独立审批。' : '当前没有未提交的范围变更。' }}</span><div class="button-row flex flex-wrap items-center gap-2"><button class="btn btn-ghost border border-base-300" type="button" :disabled="!dirty" @click="draft = clone(role.scope)">放弃草稿</button><button class="btn btn-primary" type="button" :disabled="!canEdit || !dirty || demo.busy.value" @click="preview">预览范围变更</button></div></div>
  </section>
</template>
