<script setup lang="ts">
import { computed, ref } from "vue";
import { staffName } from "../domain";
import { demo } from "../store";

const query = ref("");
const rows = computed(() => demo.data.value.audit.filter(item => `${item.action} ${item.detail} ${item.requestId ?? ''}`.toLowerCase().includes(query.value.toLowerCase())));
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4">
      <div><p class="eyebrow">操作记录</p><h1>审计轨迹</h1><p>记录提案、决定、状态和验证器操作。密码与密钥不会写入记录。</p></div>
      <span class="badge badge-primary badge-soft px-3 py-3 text-xs">{{ demo.data.value.audit.length }} 条记录</span>
    </div>
    <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm">
      <div class="matrix-tools">
        <div><h2>本地事件</h2><p class="hint">本地存储记录可被浏览器用户修改，仅用于流程演示。</p></div>
        <input v-model="query" class="input input-ghost" type="search" placeholder="搜索事件或提案 ID" aria-label="搜索审计记录" />
      </div>
      <div v-if="rows.length" class="overflow-x-auto rounded-box border border-base-300">
        <table class="table table-zebra table-sm">
          <thead><tr><th>事件</th><th>详情</th><th>操作员</th><th>时间</th></tr></thead>
          <tbody><tr v-for="item in rows" :key="item.id">
            <td><span class="badge badge-primary badge-soft badge-sm">{{ item.action }}</span></td>
            <td class="min-w-60"><p class="mb-1">{{ item.detail }}</p><code v-if="item.requestId" class="text-xs text-base-content/60">提案 {{ item.requestId }}</code></td>
            <td>{{ staffName(demo.data.value, item.actorId) }}</td>
            <td class="whitespace-nowrap text-base-content/60">{{ new Date(item.at).toLocaleString('zh-CN') }}</td>
          </tr></tbody>
        </table>
      </div>
      <p v-else class="empty-note">暂无匹配的操作记录。提交变更提案后会出现在这里。</p>
    </section>
  </div>
</template>
