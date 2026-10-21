<script setup lang="ts">
import { computed, ref } from "vue";
import { demo } from "../store";
import AppSelect, { type SelectOption } from "../components/AppSelect.vue";
import { confirmAction } from "../confirmation";

const query = ref("");
const moduleFilter = ref("全部模块");
const moduleOptions = computed<SelectOption[]>(() => ["全部模块", ...new Set(demo.data.value.permissions.map(item => item.module ?? "未映射"))].map(module => ({ value: module, label: module })));
function updateModuleFilter(value: string | string[]) {
  if (typeof value === "string") moduleFilter.value = value;
}
const items = computed(() => demo.data.value.permissions.filter(item =>
  (moduleFilter.value === "全部模块" || (item.module ?? "未映射") === moduleFilter.value) &&
  `${item.name} ${item.code}`.toLowerCase().includes(query.value.toLowerCase())));
async function statusAction(code: string, enabled: boolean) {
  if (!enabled) { await demo.previewChange({ operation: "permission-status", targetId: code, desired: true }); return; }
  if (!await confirmAction({ title: `停用权限项 ${code}？`, message: "所有角色中的这项权限都会立即失效。", confirmText: "立即停用", tone: "error" })) return;
  try { demo.immediateDisable("permission", code); }
  catch (failure) { demo.error.value = (failure as Error).message; }
}
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4"><div><p class="eyebrow">权限目录</p><h1>权限项状态</h1><p>角色中配置了权限，不代表权限项本身仍然有效。</p></div><span class="badge badge-primary badge-soft px-3 py-3 text-xs">{{ demo.data.value.permissions.length }} 项</span></div>
    <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm"><div class="matrix-tools"><div><h2>目录</h2><p class="hint">停用即时生效；重新启用必须由独立审核员批准。</p></div><div class="button-row flex flex-wrap items-center gap-2"><AppSelect :model-value="moduleFilter" :options="moduleOptions" aria-label="筛选模块" @update:model-value="updateModuleFilter" /><input class="input input-ghost" v-model="query" type="search" placeholder="搜索权限代码" aria-label="搜索权限代码" /></div></div>
      <div class="overflow-x-auto rounded-box border border-base-300">
        <table class="table table-zebra table-sm">
          <thead><tr><th>权限项</th><th>模块</th><th>操作</th><th>状态</th><th class="text-right">管理</th></tr></thead>
          <tbody>
            <tr v-for="permission in items" :key="permission.code">
              <td><strong class="block text-sm">{{ permission.name }}</strong><code class="mt-1 block text-xs text-base-content/60">{{ permission.code }}</code></td>
              <td>{{ permission.module ?? '未映射' }}</td>
              <td>{{ permission.action === 'view' ? '查看' : permission.action === 'edit' ? '编辑' : '审批' }}</td>
              <td><span class="badge badge-sm badge-soft" :class="permission.enabled ? 'badge-success' : 'badge-error'">{{ permission.enabled ? '启用' : '停用' }}</span></td>
              <td class="text-right"><button v-if="demo.hasGlobal('SYS_PERMISSION_EDIT')" class="btn btn-sm" :class="permission.enabled ? 'btn-error btn-soft' : 'btn-ghost border border-base-300'" type="button" @click="statusAction(permission.code, permission.enabled)">{{ permission.enabled ? '停用' : '申请启用' }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!items.length" class="empty-note">没有匹配的权限项。</p>
    </section>
  </div>
</template>
