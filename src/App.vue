<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  ArrowRight, BookOpenCheck, ClipboardCheck, Fingerprint, KeyRound, LayoutGrid,
  ListChecks, LogOut, RotateCcw, ScrollText, ShieldCheck, Users, X,
} from "lucide-vue-next";
import ChangePreview from "./components/ChangePreview.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import AppSelect, { type SelectOption } from "./components/AppSelect.vue";
import StaffView from "./views/StaffView.vue";
import RolesView from "./views/RolesView.vue";
import PermissionsView from "./views/PermissionsView.vue";
import ReviewsView from "./views/ReviewsView.vue";
import SecurityView from "./views/SecurityView.vue";
import SimulatorView from "./views/SimulatorView.vue";
import AuditView from "./views/AuditView.vue";
import { DEMO_PASSWORD, roleName, staffName } from "./domain";
import { demo } from "./store";
import { confirmAction } from "./confirmation";

type Section = "overview" | "staff" | "roles" | "permissions" | "reviews" | "security" | "simulator" | "audit";
const section = ref<Section>("overview");
const username = ref("admin");
const password = ref("");
const totpCode = ref("");
const selectedAccount = computed(() => demo.data.value.staff.find(item => item.username === username.value) ?? null);
const accountOptions = computed<SelectOption[]>(() => demo.data.value.staff.map(account => ({
  value: account.username,
  label: `${account.username} · ${account.name}${account.enabled ? "" : "（停用）"}`,
})));
const currentRoleNames = computed(() => demo.currentStaff.value?.roles
  .map(id => roleName(demo.data.value, id)).join("、") ?? "");
const nav = [
  { id: "overview", label: "总览", icon: LayoutGrid, permission: "" },
  { id: "staff", label: "员工目录", icon: Users, permission: "SYS_ADMIN_USER" },
  { id: "roles", label: "角色与授权", icon: BookOpenCheck, permission: "SYS_ROLE" },
  { id: "permissions", label: "权限目录", icon: ListChecks, permission: "SYS_PERMISSION" },
  { id: "reviews", label: "独立审批", icon: ClipboardCheck, permission: "SYS_ACCESS_REVIEW" },
  { id: "security", label: "我的验证器", icon: KeyRound, permission: "" },
  { id: "simulator", label: "权限解释器", icon: Fingerprint, permission: "" },
  { id: "audit", label: "审计轨迹", icon: ScrollText, permission: "SYS_ACCESS_REVIEW" },
] as const;
const visibleNav = computed(() => nav.filter(item => !item.permission || demo.hasGlobal(item.permission) ||
  item.id === "reviews" && demo.hasGlobal("SYS_ACCESS_APPROVE")));
watch(demo.currentId, () => { section.value = "overview"; });
watch(visibleNav, items => { if (!items.some(item => item.id === section.value)) section.value = "overview"; });
watch(section, async () => {
  await nextTick();
  if (window.innerWidth <= 760) {
    document.querySelector('.sidebar nav [aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }
});
async function signIn() {
  await demo.login(username.value, password.value, totpCode.value);
  password.value = "";
  totpCode.value = "";
}
function switchAccount() {
  demo.logout();
  password.value = "";
  totpCode.value = "";
}
function updateUsername(value: string | string[]) {
  if (typeof value === "string") username.value = value;
}
async function reset() {
  const confirmed = await confirmAction({
    title: "恢复初始演示数据？",
    message: "本地的提案、审计记录和验证器密钥都会清除。此操作无法撤销。",
    confirmText: "恢复初始数据",
    tone: "error",
  });
  if (confirmed) demo.resetDemo();
}
</script>

<template>
  <main v-if="!demo.currentStaff.value" class="login-page">
    <div class="login-orbit login-orbit--one" /><div class="login-orbit login-orbit--two" />
    <section class="login-intro"><span class="brand-mark"><ShieldCheck :size="23" /></span><p class="eyebrow">权限实验室 · 本地演示</p><h1>一次变更，<br /><em>两个人确认。</em></h1><p>从角色权限草稿，到独立审批和验证器登录，在一个可运行的中文前端工程中走完流程。</p><div class="login-steps"><span>01 预览</span><span>02 提案</span><span>03 独立审批</span><span>04 生效与回执</span></div></section>
    <form class="card login-card border border-base-300 bg-base-100 shadow-2xl" @submit.prevent="signIn">
      <div class="card-body gap-4">
        <div class="flex size-12 items-center justify-center rounded-box bg-primary/20 text-primary"><KeyRound :size="25" /></div>
        <div>
          <p class="eyebrow">进入演示工作台</p>
          <h2 class="card-title text-xl">选择操作员</h2>
          <p class="mt-2 text-sm leading-6 text-base-content/65">先用管理员发起变更，再切换独立审核员处理提案。</p>
        </div>
        <div class="grid grid-cols-2 gap-2" role="group" aria-label="快速选择操作员">
          <button v-for="account in demo.data.value.staff.filter(item => item.enabled)" :key="account.id" class="btn btn-sm h-auto min-h-11 justify-start gap-2" :class="username === account.username ? 'btn-primary' : 'btn-ghost border border-base-300 bg-base-200'" type="button" :aria-pressed="username === account.username" @click="username = account.username">
            <span class="flex size-6 items-center justify-center rounded-md bg-base-content/10 text-xs">{{ account.name.slice(0, 1) }}</span>{{ account.username }}
          </button>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">用户名</legend>
          <AppSelect :model-value="username" :options="accountOptions" aria-label="选择用户名" @update:model-value="updateUsername" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">演示密码</legend>
          <input v-model="password" class="input input-ghost w-full" type="password" autocomplete="current-password" placeholder="输入演示密码" />
        </fieldset>
        <fieldset v-if="selectedAccount?.totpEnabled" class="fieldset">
          <legend class="fieldset-legend">验证器当前 6 位码</legend>
          <input v-model="totpCode" class="input input-ghost w-full" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="从验证器获取" />
        </fieldset>
        <div class="alert alert-info alert-soft py-2 text-sm" role="note"><span>所有预置账号共用演示密码：<code class="font-bold">{{ DEMO_PASSWORD }}</code></span></div>
        <div v-if="demo.message.value" class="alert alert-success alert-soft text-sm" role="status">{{ demo.message.value }}</div>
        <div v-if="demo.error.value" class="alert alert-error alert-soft text-sm" role="alert">{{ demo.error.value }}</div>
        <button class="btn btn-primary btn-block mt-1 justify-between" type="submit" :disabled="demo.busy.value || !password">进入工作台 <ArrowRight :size="18" /></button>
        <button class="btn btn-link btn-sm mx-auto text-primary" type="button" @click="reset"><RotateCcw :size="14" />恢复初始演示数据</button>
      </div>
    </form>
    <p class="login-disclaimer">纯前端模拟 · 数据只保存在本机浏览器 · 不连接生产服务</p>
  </main>
  <div v-else class="app-shell">
    <aside class="sidebar"><div class="sidebar-brand"><span class="brand-mark"><ShieldCheck :size="21" /></span><div><span class="brand-kicker">ACCESS / LAB 01</span><strong>权限实验室</strong><small>RBAC 与访问审批</small></div></div><div class="sidebar-section-label">工作台 <span>WORKSPACE</span></div><nav aria-label="主导航"><ul class="menu menu-sm w-full gap-1 p-0"><li v-for="item in visibleNav" :key="item.id"><button class="min-h-10 gap-3" :class="section === item.id ? 'menu-active bg-primary/15 text-primary' : ''" type="button" :aria-current="section === item.id ? 'page' : undefined" @click="section = item.id"><component :is="item.icon" :size="18" /><span>{{ item.label }}</span><span v-if="item.id === 'reviews' && demo.pendingCount.value" class="badge badge-primary badge-sm ml-auto">{{ demo.pendingCount.value }}</span></button></li></ul></nav><div class="sidebar-bottom"><div class="sidebar-status"><span class="status-pulse" /><span><strong>本地演示运行中</strong><small>数据保存在当前浏览器</small></span></div><button class="btn btn-ghost btn-sm w-full justify-start" type="button" @click="reset"><RotateCcw :size="17" /><span>恢复初始数据</span></button></div></aside>
    <div class="main-shell"><header class="topbar"><div class="topbar-path"><span class="topbar-path-prefix">ACCESS CONTROL</span><span>/</span> {{ nav.find(item => item.id === section)?.label }}</div><div class="topbar-actions"><span class="live-dot" /><span class="topbar-mode">LOCAL STATE</span><button class="btn btn-ghost account-switch h-auto min-h-11 gap-2 border border-base-300 bg-base-200 px-2" type="button" @click="switchAccount"><span class="topbar-avatar">{{ demo.currentStaff.value.name.slice(0, 1) }}</span><span><strong>{{ demo.currentStaff.value.name }}</strong><small>{{ demo.currentStaff.value.username }}</small></span><LogOut :size="17" /></button></div></header>
      <div class="content"><div class="demo-disclaimer mb-5 flex items-start gap-2 text-sm text-base-content/65"><ShieldCheck :size="17" class="mt-0.5 shrink-0 text-primary" /><span>本地模拟：角色、审批、验证器和记录只保存在当前浏览器；演示凭据不可用于真实系统。</span></div><div v-if="demo.error.value" class="alert alert-error alert-soft dismissible-alert mb-4 text-sm" role="alert"><span>{{ demo.error.value }}</span><button class="btn btn-ghost btn-square btn-sm" type="button" aria-label="关闭错误" @click="demo.error.value = ''"><X :size="17" /></button></div><div v-if="demo.message.value" class="alert alert-success alert-soft dismissible-alert mb-4 text-sm" role="status"><span>{{ demo.message.value }}</span><button class="btn btn-ghost btn-square btn-sm" type="button" aria-label="关闭提示" @click="demo.message.value = ''"><X :size="17" /></button></div>
        <div v-if="section === 'overview'" class="view-stack grid min-w-0 gap-5">
          <div class="page-heading overview-heading flex flex-wrap items-end justify-between gap-4">
            <div><p class="eyebrow">访问控制</p><h1>工作台总览</h1><p>查看当前授权、待处理提案与访问变更流程。</p></div>
            <div class="flex flex-wrap gap-2">
              <button v-if="demo.hasGlobal('SYS_ROLE')" class="btn btn-primary" type="button" @click="section = 'roles'">查看角色授权 <ArrowRight :size="17" /></button>
              <button v-if="demo.hasGlobal('SYS_ACCESS_REVIEW') || demo.hasGlobal('SYS_ACCESS_APPROVE')" class="btn btn-ghost border border-base-300" type="button" @click="section = 'reviews'">处理审批 {{ demo.pendingCount.value ? `· ${demo.pendingCount.value}` : '' }}</button>
            </div>
          </div>
          <div class="stat-grid">
            <div class="stat rounded-box border border-base-300 bg-base-100"><div class="stat-top"><div class="stat-title">员工账号</div><Users :size="18" /></div><div class="stat-value text-3xl">{{ demo.data.value.staff.length }}</div><div class="stat-desc">包含停用账号</div></div>
            <div class="stat rounded-box border border-base-300 bg-base-100"><div class="stat-top"><div class="stat-title">已配置角色</div><BookOpenCheck :size="18" /></div><div class="stat-value text-3xl">{{ demo.data.value.roles.length }}</div><div class="stat-desc">各自拥有权限与资源范围</div></div>
            <div class="stat rounded-box border border-base-300 bg-base-100"><div class="stat-top"><div class="stat-title">待独立审批</div><ClipboardCheck :size="18" /></div><div class="stat-value text-3xl">{{ demo.pendingCount.value }}</div><div class="stat-desc">批准前不影响当前访问权</div></div>
            <div class="stat rounded-box border border-base-300 bg-base-100"><div class="stat-top"><div class="stat-title">我的有效权限</div><ShieldCheck :size="18" /></div><div class="stat-value text-3xl">{{ demo.currentCodes.value.length }}</div><div class="stat-desc">由启用角色及范围决定</div></div>
          </div>
          <section class="card workflow-card border border-base-300 bg-base-100 shadow-sm">
            <div class="card-body gap-4 p-5">
              <div><h2 class="mb-1">访问变更如何生效</h2><p class="hint mb-0">配置先形成草稿，独立审批通过后才更新当前权限。</p></div>
              <ul class="steps steps-vertical w-full text-sm sm:steps-horizontal" aria-label="访问变更流程">
                <li class="step step-primary">预览并提交</li>
                <li class="step step-primary">独立审批</li>
                <li class="step step-primary">生效与回执</li>
              </ul>
              <p class="workflow-note mb-0 text-base-content/65">审核员不能是发起人或受影响员工；批准时会重新核对权限与目标版本。</p>
            </div>
          </section>
          <div class="overview-grid"><section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm"><div class="panel-heading flex items-start justify-between gap-4"><div><p class="eyebrow">当前操作员</p><h2>{{ demo.currentStaff.value.name }}</h2><p class="hint">{{ currentRoleNames }}</p></div><span class="badge badge-sm badge-soft" :class="demo.currentStaff.value.totpEnabled ? 'badge-success' : 'badge-error'">验证器{{ demo.currentStaff.value.totpEnabled ? '已启用' : '未启用' }}</span></div><div class="code-list"><span v-for="code in demo.currentCodes.value.slice(0, 12)" :key="code" class="badge badge-outline max-w-full font-mono text-xs">{{ code }}</span><span v-if="demo.currentCodes.value.length > 12" class="muted">等 {{ demo.currentCodes.value.length }} 项</span></div><p v-if="!demo.currentCodes.value.length" class="empty-note">此账号目前没有有效权限。</p></section><section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm"><div class="panel-heading flex items-start justify-between gap-4"><div><p class="eyebrow">快速理解</p><h2>谁可以审批？</h2></div></div><p class="hint">每项提案先计算受影响员工，再从持有全局 <code>SYS_ACCESS_APPROVE</code> 的其他账号中寻找审核员。</p><div class="card reviewer-mini flex-row items-center gap-3 rounded-box border border-base-300 bg-base-200 p-3"><span class="avatar">审</span><div><strong>{{ staffName(demo.data.value, '2000000002') }}</strong><small>预置独立审核员 · 仅在不受影响时可批准</small></div></div><button class="btn btn-link btn-sm h-auto px-0 text-primary" type="button" @click="section = 'simulator'">查看权限和资源如何共同决定访问 <ArrowRight :size="15" /></button></section></div>
        </div>
        <StaffView v-else-if="section === 'staff'" /><RolesView v-else-if="section === 'roles'" /><PermissionsView v-else-if="section === 'permissions'" /><ReviewsView v-else-if="section === 'reviews'" /><SecurityView v-else-if="section === 'security'" /><SimulatorView v-else-if="section === 'simulator'" /><AuditView v-else-if="section === 'audit'" />
      </div>
    </div>
    <ChangePreview />
  </div>
  <ConfirmDialog />
</template>
