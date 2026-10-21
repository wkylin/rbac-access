<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { clone, effectiveCodes, roleName } from "../domain";
import { demo } from "../store";
import { confirmAction } from "../confirmation";

const query = ref("");
const selectedId = ref(demo.data.value.staff[0]?.id ?? "");
const selected = computed(() => demo.data.value.staff.find(item => item.id === selectedId.value) ?? null);
const selectedRoleNames = computed(() => selected.value?.roles
  .map(id => roleName(demo.data.value, id)).join("、") || "无");
const assignedRoles = computed(() => selected.value?.roles.flatMap(id => {
  const role = demo.data.value.roles.find(item => item.id === id);
  return role ? [role] : [];
}) ?? []);
const roleDraft = ref<string[]>([]);
const showCreate = ref(false);
const form = reactive({ username: "", name: "", email: "" });
watch(() => [selected.value?.id, selected.value?.version], () => { roleDraft.value = clone(selected.value?.roles ?? []); }, { immediate: true });
const rows = computed(() => demo.data.value.staff.filter(item => `${item.name} ${item.username} ${item.email}`.toLowerCase().includes(query.value.toLowerCase())));
const changed = computed(() => JSON.stringify([...roleDraft.value].sort()) !== JSON.stringify([...(selected.value?.roles ?? [])].sort()));
const canAssign = computed(() => demo.hasGlobal("SYS_ADMIN_USER_ASSIGN_ROLE"));
const canEdit = computed(() => demo.hasGlobal("SYS_ADMIN_USER_EDIT"));
const canCreate = computed(() => demo.hasGlobal("SYS_ADMIN_USER_ADD"));
function toggleRole(id: string, checked: boolean) {
  roleDraft.value = checked ? [...new Set([...roleDraft.value, id])] : roleDraft.value.filter(item => item !== id);
}
async function previewRoles() {
  if (selected.value) await demo.previewChange({ operation: "user-roles", targetId: selected.value.id, desired: roleDraft.value });
}
async function statusAction() {
  if (!selected.value) return;
  if (!selected.value.enabled) {
    await demo.previewChange({ operation: "user-status", targetId: selected.value.id, desired: true });
    return;
  }
  if (!await confirmAction({ title: `停用“${selected.value.name}”？`, message: "该账号的登录和有效权限将立即失效。", confirmText: "立即停用", tone: "error" })) return;
  try { demo.immediateDisable("staff", selected.value.id); }
  catch (failure) { demo.error.value = (failure as Error).message; }
}
function addStaff() {
  try {
    demo.createStaff(form);
    showCreate.value = false;
    form.username = form.name = form.email = "";
  } catch (failure) { demo.error.value = (failure as Error).message; }
}
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4"><div><p class="eyebrow">账号与角色</p><h1>员工目录</h1><p>账号、角色和资源范围分开管理；新员工初始停用且没有角色。</p></div><button v-if="canCreate" class="btn btn-primary" type="button" @click="showCreate = !showCreate">{{ showCreate ? '取消创建' : '创建员工' }}</button></div>
    <form v-if="showCreate" class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm create-form" @submit.prevent="addStaff"><div class="panel-heading flex items-start justify-between gap-4"><div><h2>创建员工</h2><p class="hint">创建后需要分别提交角色分配和账号启用提案。</p></div></div><div class="form-grid"><label>登录用户名<input class="input input-ghost" v-model="form.username" autocomplete="off" placeholder="例如 new.operator" /></label><label>姓名<input class="input input-ghost" v-model="form.name" autocomplete="off" placeholder="员工姓名" /></label><label>邮箱<input class="input input-ghost" v-model="form.email" type="email" autocomplete="off" placeholder="name@example.test" /></label></div><button class="btn btn-primary" type="submit">创建停用账号</button></form>
    <div class="staff-layout">
      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm staff-list"><div class="panel-heading flex items-start justify-between gap-4"><div><h2>账号</h2><p class="hint">{{ demo.data.value.staff.length }} 名员工</p></div></div><input class="input input-ghost w-full" v-model="query" type="search" placeholder="搜索姓名、用户名或邮箱" aria-label="搜索员工" /><button v-for="item in rows" :key="item.id" class="btn btn-ghost mt-1 h-auto min-h-0 w-full justify-start gap-3 px-3 py-3 text-left" :class="selectedId === item.id ? 'bg-primary/15 ring-1 ring-primary/40' : ''" type="button" @click="selectedId = item.id"><span class="avatar">{{ item.name.slice(0, 1) }}</span><span class="min-w-0 flex-1"><strong class="block text-sm">{{ item.name }}</strong><small class="mt-1 block truncate text-xs text-base-content/60">{{ item.username }} · {{ item.roles.length }} 个角色</small></span><span class="status shrink-0" :class="item.enabled ? 'status-success' : 'status-error'" /></button></section>
      <div v-if="selected" class="view-stack grid min-w-0 gap-5">
        <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm"><div class="panel-heading flex items-start justify-between gap-4"><div><p class="eyebrow">员工 ID {{ selected.id }}</p><h2>{{ selected.name }}</h2><p class="hint">{{ selected.username }} · {{ selected.email }}</p></div><span class="badge badge-sm badge-soft" :class="selected.enabled ? 'badge-success' : 'badge-error'">{{ selected.enabled ? '账号启用' : '账号停用' }}</span></div>
          <div class="info-metrics"><div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">已分配角色</div><div class="stat-value mt-1 text-sm leading-5">{{ selectedRoleNames }}</div></div><div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">有效权限</div><div class="stat-value mt-1 text-lg">{{ effectiveCodes(demo.data.value, selected.id).length }} 项</div></div><div class="stat rounded-box border border-base-300 bg-base-200 p-3"><div class="stat-title text-xs">登录验证器</div><div class="stat-value mt-1 text-sm">{{ selected.totpEnabled ? '已启用' : '未启用' }}</div></div></div>
          <h3>分配角色</h3><p class="hint">选择的是完整角色列表。提案获批前，员工仍使用原有角色。</p>
          <div class="role-checks"><label v-for="role in demo.data.value.roles" :key="role.id" class="check-row flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 transition-colors has-checked:border-primary/40 has-checked:bg-primary/5 hover:border-primary/50"><input class="checkbox checkbox-primary checkbox-sm" type="checkbox" :checked="roleDraft.includes(role.id)" :disabled="!canAssign || !role.enabled && !roleDraft.includes(role.id)" @change="toggleRole(role.id, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ role.name }}</strong><small>{{ role.code }} · {{ role.scope.mode }}</small></span><em v-if="!role.enabled">停用</em></label></div>
          <div class="panel-footer"><span class="hint">{{ changed ? '角色草稿尚未生效。' : '角色与当前配置一致。' }}</span><div class="button-row flex flex-wrap items-center gap-2"><button class="btn btn-ghost border border-base-300" type="button" :disabled="!changed" @click="roleDraft = clone(selected!.roles)">放弃草稿</button><button class="btn btn-primary" type="button" :disabled="!canAssign || !changed || demo.busy.value" @click="previewRoles">预览角色变更</button></div></div>
        </section>
        <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm"><div class="panel-heading flex items-start justify-between gap-4"><div><h3>账号状态</h3><p class="hint">停用立即生效；重新启用需要独立审批。</p></div><button v-if="canEdit" class="btn" :class="selected.enabled ? 'btn-error btn-soft' : 'btn-ghost border border-base-300'" type="button" :disabled="selected.id === demo.currentId.value" @click="statusAction">{{ selected.enabled ? '立即停用' : '申请重新启用' }}</button></div></section>
        <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm"><div class="panel-heading flex items-start justify-between gap-4"><div><h3>当前有效权限及来源</h3><p class="hint">仅列出启用账号、启用角色、启用权限和有效资源规则共同形成的权限。</p></div></div><div v-if="effectiveCodes(demo.data.value, selected.id).length" class="code-list"><span v-for="code in effectiveCodes(demo.data.value, selected.id)" :key="code" class="badge badge-outline max-w-full font-mono text-xs">{{ code }}</span></div><p v-else class="empty-note">当前没有有效权限。检查账号状态、角色、权限项和资源范围。</p><div v-for="role in assignedRoles" :key="role.id" class="origin-line"><strong>{{ role.name }}</strong><span>{{ role.enabled ? role.scope.mode : '角色停用' }}</span><code>{{ role.permissions.length }} 项配置权限</code></div></section>
      </div>
    </div>
  </div>
</template>
