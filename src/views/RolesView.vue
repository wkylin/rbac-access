<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { clone, roleName, type Role } from "../domain";
import { demo } from "../store";
import { confirmAction } from "../confirmation";
import ScopeEditor from "../components/ScopeEditor.vue";

const selectedId = ref(demo.data.value.roles[0]?.id ?? "");
const role = computed(() => demo.data.value.roles.find(item => item.id === selectedId.value) ?? null);
const draft = ref<string[]>([]);
const query = ref("");
watch(() => [role.value?.id, role.value?.version], () => { draft.value = clone(role.value?.permissions ?? []); }, { immediate: true });
const canEdit = computed(() => demo.hasGlobal("SYS_ROLE_ASSIGN_PERM"));
const canStatus = computed(() => demo.hasGlobal("SYS_ROLE_EDIT"));
const dirty = computed(() => JSON.stringify([...draft.value].sort()) !== JSON.stringify([...(role.value?.permissions ?? [])].sort()));
const catalog = computed(() => demo.data.value.permissions.filter(item => item.module &&
  (!query.value || `${item.name} ${item.code} ${item.module}`.toLowerCase().includes(query.value.toLowerCase()))));
const grouped = computed(() => {
  const groups: Record<string, typeof catalog.value> = {};
  for (const item of catalog.value) (groups[item.module!] ??= []).push(item);
  return Object.entries(groups);
});
const retained = computed(() => role.value?.permissions.filter(code => !demo.data.value.permissions.some(item => item.code === code && item.module)) ?? []);
function toggle(code: string, checked: boolean) {
  draft.value = checked ? [...new Set([...draft.value, code])] : draft.value.filter(item => item !== code);
}
async function previewPermissions() {
  if (!role.value) return;
  await demo.previewChange({ operation: "role-permissions", targetId: role.value.id, desired: draft.value });
}
async function toggleStatus(target: Role) {
  if (!target.enabled) { await demo.previewChange({ operation: "role-status", targetId: target.id, desired: true }); return; }
  if (!await confirmAction({ title: `停用角色“${target.name}”？`, message: "其成员会立即失去该角色提供的有效权限。", confirmText: "立即停用", tone: "error" })) return;
  try { demo.immediateDisable("role", target.id); } catch (error) { demo.error.value = (error as Error).message; }
}
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4"><div><p class="eyebrow">角色与权限</p><h1>角色权限矩阵</h1><p>精确编辑权限代码，审批通过后才会更新有效授权。</p></div><span class="badge badge-primary badge-soft px-3 py-3 text-xs">{{ demo.data.value.roles.length }} 个角色</span></div>
    <div class="role-layout">
      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm role-rail"><div class="panel-heading flex items-start justify-between gap-4"><div><h2>角色目录</h2><p class="hint">选择一个角色查看其成员与授权</p></div></div>
        <div class="role-options">
          <button v-for="item in demo.data.value.roles" :key="item.id" class="btn btn-ghost h-auto min-h-0 w-full flex-col items-stretch gap-1 rounded-box px-3 py-3 text-left" :class="item.id === selectedId ? 'bg-primary/15 ring-1 ring-primary/40' : ''" type="button" @click="selectedId = item.id">
            <span class="role-option-top"><strong>{{ item.name }}</strong><small class="badge badge-sm badge-soft" :class="item.enabled ? 'badge-success' : 'badge-error'">{{ item.enabled ? '启用' : '停用' }}</small></span>
            <code class="block font-mono text-xs text-base-content/55">{{ item.code }}</code><span class="text-xs text-base-content/60">{{ demo.data.value.staff.filter(staff => staff.roles.includes(item.id)).length }} 名成员 · {{ item.permissions.length }} 项授权</span>
          </button>
        </div>
      </section>
      <div v-if="role" class="view-stack grid min-w-0 gap-5">
        <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm">
          <div class="panel-heading flex items-start justify-between gap-4"><div><p class="eyebrow">{{ role.code }}</p><h2>{{ roleName(demo.data.value, role.id) }}</h2><p class="hint">{{ role.description }} · 版本 {{ role.version }}</p></div><button v-if="canStatus" class="btn" :class="role.enabled ? 'btn-error btn-soft' : 'btn-ghost border border-base-300'" type="button" @click="toggleStatus(role)">{{ role.enabled ? '立即停用' : '申请重新启用' }}</button></div>
          <div class="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200 px-4 py-3 text-xs"><span class="text-base-content/60">当前成员</span><strong>{{ demo.data.value.staff.filter(staff => staff.roles.includes(role!.id)).map(staff => staff.name).join('、') || '暂无成员' }}</strong></div>
          <div class="matrix-tools"><div><h3>权限项</h3><p class="hint">勾选后形成草稿，未映射代码始终保留。</p></div><input class="input input-ghost" v-model="query" type="search" placeholder="搜索模块或权限代码" aria-label="搜索权限项" /></div>
          <div v-for="[module, items] in grouped" :key="module" class="permission-group"><h4>{{ module }}</h4><div class="permission-list"><label v-for="item in items" :key="item.code" class="permission-item flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 transition-colors has-checked:border-primary/40 has-checked:bg-primary/5 hover:border-primary/50"><input class="checkbox checkbox-primary checkbox-sm" type="checkbox" :checked="draft.includes(item.code)" :disabled="!canEdit || !item.enabled && !draft.includes(item.code)" @change="toggle(item.code, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ item.name }}</strong><code>{{ item.code }}</code></span><small class="badge badge-ghost badge-sm">{{ item.action === 'view' ? '查看' : item.action === 'edit' ? '编辑' : '审批' }}</small><em v-if="!item.enabled">权限项停用</em></label></div></div>
          <p v-if="retained.length" class="preserved-note">原样保留的未映射权限：<code>{{ retained.join('、') }}</code></p>
          <div class="panel-footer"><span class="hint">{{ dirty ? `待变更：${draft.filter(code => !role!.permissions.includes(code)).length} 项添加，${role.permissions.filter(code => !draft.includes(code)).length} 项移除` : '权限与当前生效配置一致。' }}</span><div class="button-row flex flex-wrap items-center gap-2"><button class="btn btn-ghost border border-base-300" type="button" :disabled="!dirty" @click="draft = clone(role!.permissions)">放弃草稿</button><button class="btn btn-primary" type="button" :disabled="!canEdit || !dirty || demo.busy.value" @click="previewPermissions">预览权限变更</button></div></div>
        </section>
        <ScopeEditor :role="role" />
      </div>
    </div>
  </div>
</template>
