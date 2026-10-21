<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Copy, ExternalLink, KeyRound, RotateCcw, ShieldCheck } from "lucide-vue-next";
import { demo } from "../store";
import { otpauthUri, secondsRemaining } from "../totp";

const code = ref("");
const seconds = ref(secondsRemaining());
const copied = ref("");
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => { timer = setInterval(() => { seconds.value = secondsRemaining(); }, 1000); });
onUnmounted(() => { if (timer) clearInterval(timer); });
const staff = computed(() => demo.currentStaff.value);
const uri = computed(() => staff.value?.totpSecret ? otpauthUri(staff.value.username, staff.value.totpSecret) : "");
async function copy(value: string, label: string) {
  try { await navigator.clipboard.writeText(value); copied.value = label; setTimeout(() => { copied.value = ""; }, 2200); }
  catch { demo.error.value = "浏览器未允许复制。请手动选中文本复制。"; }
}
async function enable() { await demo.enableTotp(code.value); code.value = ""; }
async function disable() { await demo.disableTotp(code.value); code.value = ""; }
</script>

<template>
  <div class="view-stack grid min-w-0 gap-5">
    <div class="page-heading flex flex-wrap items-end justify-between gap-4"><div><p class="eyebrow">当前操作员</p><h1>登录验证器</h1><p>验证器只绑定当前登录账号，后续登录需输入动态 6 位码。</p></div><span class="badge badge-sm badge-soft" :class="staff?.totpEnabled ? 'badge-success' : 'badge-error'">{{ staff?.totpEnabled ? '已启用' : '未启用' }}</span></div>
    <div class="security-layout">
      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm security-card"><div class="security-symbol"><ShieldCheck :size="38" /></div><h2>{{ staff?.totpEnabled ? '验证器正在保护登录' : staff?.totpSecret ? '等待验证绑定' : '为账号添加验证器' }}</h2><p class="hint">{{ staff?.name }} · {{ staff?.username }}</p>
        <template v-if="!staff?.totpEnabled && !staff?.totpSecret"><p>生成密钥后，导入 Mac“密码”App 或其他兼容 TOTP 的验证器，再输入其中的动态验证码。</p><button class="btn btn-primary" type="button" :disabled="demo.busy.value" @click="demo.beginTotp"><KeyRound :size="17" /> 生成绑定密钥</button></template>
        <template v-else-if="staff?.totpEnabled"><p>下次登录演示账号时，除了密码还需要此账号验证器的当前 6 位码。</p><div class="form-stack"><label>当前验证码<input class="input input-ghost" v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位验证码" /></label><button class="btn btn-error btn-soft" type="button" :disabled="demo.busy.value || !/^\d{6}$/.test(code)" @click="disable">使用验证码停用并作废密钥</button></div></template>
        <template v-else><div class="card setup-key rounded-box border border-base-300 bg-base-200 p-4"><small>手动绑定密钥</small><code>{{ staff.totpSecret }}</code><button class="btn btn-sm btn-ghost border border-base-300" type="button" @click="copy(staff.totpSecret!, '密钥')"><Copy :size="14" />复制密钥</button></div><div class="card setup-uri rounded-box border border-base-300 bg-base-200 p-4"><small>验证器 URI</small><code>{{ uri }}</code><div class="button-row flex flex-wrap items-center gap-2"><button class="btn btn-sm btn-ghost border border-base-300" type="button" @click="copy(uri, 'URI')"><Copy :size="14" />复制 URI</button><a class="btn btn-sm btn-ghost border border-base-300" :href="uri"><ExternalLink :size="14" />在验证器中打开</a></div></div><p v-if="copied" class="success-text">已复制{{ copied }}。</p><p class="hint">生成新的待绑定密钥后，旧密钥和旧验证码立即失效。</p><button class="btn btn-link btn-sm h-auto px-0 text-primary" type="button" :disabled="demo.busy.value" @click="demo.beginTotp"><RotateCcw :size="14" />重新生成密钥</button><div class="form-stack totp-verify"><label>验证器生成的当前 6 位码<input class="input input-ghost" v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="输入动态验证码" /></label><button class="btn btn-primary" type="button" :disabled="demo.busy.value || !/^\d{6}$/.test(code)" @click="enable">验证并启用</button></div></template>
      </section>
      <section class="card demo-panel border border-base-300 bg-base-100 p-5 shadow-sm instructions"><p class="eyebrow">设置指引</p><h2>在 Mac“密码”App 中添加</h2><ol><li><strong>准备账号条目</strong><span>先为这个演示站点和登录用户名建立一个密码条目。</span></li><li><strong>导入密钥</strong><span>打开上方 URI 并选择账号条目；或者进入条目“编辑 → 设置验证码”，粘贴手动绑定密钥。</span></li><li><strong>完成启用</strong><span>将“密码”App 显示的当前 6 位码填回左侧。每 30 秒更新，当前时段还剩 {{ seconds }} 秒。</span></li></ol><div class="alert alert-info alert-soft text-sm">本工程是浏览器本地演示：密钥保存在本地数据中，没有服务端安全保证。请勿用于真实员工账号。</div></section>
    </div>
  </div>
</template>
