<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { DIMENSIONS, DIMENSION_LABELS, effectiveCodes, emptyQuery, type ResourceQuery } from "../domain";
import { demo } from "../store";
import AppSelect, { type SelectOption } from "../components/AppSelect.vue";

const staffId = ref("2000000003");
const code = ref("OPS_HEALTH_VIEW");
const query = reactive<ResourceQuery>(emptyQuery());
query.site = "site-a";
query.unfiltered = true;
const result = computed(() => demo.check(staffId.value, code.value, query));
const menuVisible = computed(() => effectiveCodes(demo.data.value, staffId.value).includes(code.value));
const staffOptions = computed<SelectOption[]>(() => demo.data.value.staff.map(staff => ({ value: staff.id, label: `${staff.name}（${staff.username}）` })));
const codeOptions = computed<SelectOption[]>(() => demo.data.value.permissions.map(permission => ({ value: permission.code, label: `${permission.code} · ${permission.name}` })));
function updateStaff(value: string | string[]) { if (typeof value === "string") staffId.value = value; }
function updateCode(value: string | string[]) { if (typeof value === "string") code.value = value; }
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">权限解释器</p>
        <h1>菜单与接口为什么不同</h1>
        <p>选择员工、权限代码和资源，观察同一角色的权限来源与 API 结果。</p>
      </div>
    </div>

    <div class="sim-layout">
      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm sim-input-panel">
        <div class="panel-heading flex items-start justify-between gap-4">
          <div>
            <h2>模拟一次受保护请求</h2>
            <p class="hint">预置经理账号与系统健康，便于观察受限范围和无筛选列表的差别。</p>
          </div>
        </div>

        <div class="form-stack">
          <label>
            员工
            <AppSelect :model-value="staffId" :options="staffOptions" aria-label="选择员工" @update:model-value="updateStaff" />
          </label>
          <label>
            权限代码
            <AppSelect :model-value="code" :options="codeOptions" aria-label="选择权限代码" @update:model-value="updateCode" />
          </label>

          <label class="flex cursor-pointer items-center gap-3 rounded-box border border-base-300 bg-base-200 p-4 has-checked:border-primary/60 has-checked:bg-primary/10">
            <input class="checkbox checkbox-primary checkbox-sm" v-model="query.unfiltered" type="checkbox" />
            <span class="min-w-0 flex-1">
              <strong class="block text-sm">无筛选列表或导出</strong>
              <small class="mt-1 block text-sm font-normal leading-5 text-base-content/60">需要全局资源范围；启用后不使用下方资源条件。</small>
            </span>
            <span class="badge badge-sm" :class="query.unfiltered ? 'badge-primary badge-soft' : 'badge-ghost'">{{ query.unfiltered ? '已启用' : '未启用' }}</span>
          </label>

          <fieldset class="fieldset resource-conditions rounded-box border p-4" :disabled="query.unfiltered">
            <legend class="fieldset-legend">资源条件</legend>
            <p class="mb-3 text-sm leading-5 text-base-content/60">{{ query.unfiltered ? '当前按全局范围判断，下方条件不参与请求。' : '填写请求携带的资源 ID；留空表示未指定该条件。' }}</p>
            <div class="form-grid">
              <label v-for="dimension in DIMENSIONS" :key="dimension">
                {{ DIMENSION_LABELS[dimension] }} ID
                <input class="input input-ghost" v-model="query[dimension]" :placeholder="dimension === 'site' ? 'site-a' : '留空'" />
              </label>
              <label>金额（可选）<input class="input input-ghost" v-model="query.amount" inputmode="decimal" placeholder="例如 100" /></label>
              <label>币种（可选）<input class="input input-ghost" v-model="query.currency" placeholder="EUR" maxlength="3" /></label>
            </div>
          </fieldset>
        </div>
      </section>

      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm result-panel">
        <p class="eyebrow">即时判断</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="stat min-w-0 rounded-box border border-base-300 bg-base-200 p-4">
            <div class="stat-title text-xs">菜单条件 · 有效权限代码</div>
            <div class="stat-value mt-2 text-lg" :class="menuVisible ? 'text-success' : 'text-error'">{{ menuVisible ? '可显示菜单' : '不能显示菜单' }}</div>
            <div class="stat-desc mt-2">只判断权限代码</div>
          </div>
          <div class="stat min-w-0 rounded-box border border-base-300 bg-base-200 p-4">
            <div class="stat-title text-xs">API 条件 · 资源范围</div>
            <div class="stat-value mt-2 text-lg" :class="result.allowed ? 'text-success' : 'text-error'">{{ result.allowed ? '允许访问' : '拒绝（403）' }}</div>
            <div class="stat-desc mt-2">继续判断当前资源</div>
          </div>
        </div>

        <div class="mt-6">
          <h3 class="mb-3 text-sm font-semibold">判定原因</h3>
          <div class="alert alert-soft text-sm" :class="result.allowed ? 'alert-success' : 'alert-error'" role="status">{{ result.reason }}</div>
        </div>

        <div class="mt-6">
          <h3 class="mb-2 text-sm font-semibold">角色来源</h3>
          <div v-for="origin in result.origins" :key="origin.role.id" class="border-b border-base-300 py-3 last:border-b-0">
            <div class="flex items-center justify-between gap-3"><strong class="text-sm">{{ origin.role.name }}</strong><span class="badge badge-ghost badge-sm font-mono">{{ origin.role.scope.mode }}</span></div>
            <p class="mb-0 mt-2 text-sm leading-5" :class="origin.matched ? 'text-success' : 'text-error'">{{ origin.reason }}</p>
          </div>
          <p v-if="!result.origins.length" class="empty-note">该账号没有来自任何角色的此项权限。</p>
        </div>

        <div class="alert alert-info alert-soft mt-5 text-sm leading-5">菜单可见表示账号可能拥有权限代码。接口还会检查当前角色的资源范围；无筛选列表和导出需要全局范围。</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sim-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); align-items: start; gap: 18px; }
.result-panel { position: sticky; top: 20px; }
@media (max-width: 1100px) { .sim-layout { grid-template-columns: 1fr; } .result-panel { position: static; } }
</style>
