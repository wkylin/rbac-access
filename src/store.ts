import { computed, ref } from "vue";
import {
  DEMO_PASSWORD, MAKER_PERMISSION, OPERATION_LABELS, affectedStaffIds, checkAccess, clone, effectiveCodes,
  emptyQuery, hasGlobal, seedData,
  type AccessInput, type AccessPreview, type AccessRequest, type DemoData, type Permission, type Role,
  type RoleScope, type Staff,
} from "./domain";
import { createSecret, verifyCode } from "./totp";

const STORAGE_KEY = "rbac-access-demo-v1";
const LEGACY_STORAGE_SUFFIX = "-rbac-access-demo-v1";
const LEGACY_CONTENT_CODES: Record<string, string> = {
  JACKPOT_VIEW: "CONTENT_VIEW",
  JACKPOT_EDIT: "CONTENT_EDIT",
  JACKPOT_APPROVE: "CONTENT_APPROVE",
};

function legacyStorageKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.endsWith(LEGACY_STORAGE_SUFFIX)) keys.push(key);
  }
  return keys;
}

function migrateContentPermissions(value: DemoData): boolean {
  // A pending proposal is frozen with its original codes and impact hash.
  if (value.requests.some(request => request.status === "pending")) return false;
  let changed = false;
  const rename = (code: string) => LEGACY_CONTENT_CODES[code] ?? code;
  for (const permission of value.permissions) {
    const code = LEGACY_CONTENT_CODES[permission.code];
    if (!code) continue;
    permission.code = code;
    permission.name = permission.name.replace(/^奖池/, "内容");
    permission.module = "内容管理";
    permission.version++;
    changed = true;
  }
  for (const role of value.roles) {
    let roleChanged = false;
    const permissions = role.permissions.map(rename);
    if (permissions.some((code, index) => code !== role.permissions[index])) {
      role.permissions = permissions;
      roleChanged = true;
    }
    for (const rule of role.scope.rules) {
      const codes = rule.permissionCodes.map(rename);
      if (codes.some((code, index) => code !== rule.permissionCodes[index])) {
        rule.permissionCodes = codes;
        roleChanged = true;
      }
    }
    if (roleChanged) {
      role.version++;
      changed = true;
    }
  }
  return changed;
}

function loadData(): DemoData {
  try {
    let sourceKey = STORAGE_KEY;
    let saved = localStorage.getItem(STORAGE_KEY);
    const legacyKeys = legacyStorageKeys();
    if (!saved && legacyKeys.length) {
      sourceKey = legacyKeys[0]!;
      saved = localStorage.getItem(sourceKey);
    }
    if (saved) {
      const value = JSON.parse(saved) as DemoData;
      if (value.schema === 1 && Array.isArray(value.staff) && Array.isArray(value.roles) &&
        Array.isArray(value.permissions) && Array.isArray(value.requests) && Array.isArray(value.audit)) {
        let migrated = migrateContentPermissions(value);
        if (sourceKey !== STORAGE_KEY) migrated = true;
        const account = value.staff.find(item => item.id === "2000000004" && item.username === "wubin");
        if (account) {
          account.username = "wk";
          if (account.name === "Wubin") account.name = "wk";
          if (account.email === "wubin@example.test") account.email = "wk@example.test";
          migrated = true;
        }
        if (migrated || legacyKeys.length) try {
          if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
          for (const key of legacyKeys) localStorage.removeItem(key);
        }
        catch { /* Keep migrated demo data for this session if storage is unavailable. */ }
        return value;
      }
    }
  } catch { /* A malformed local demo snapshot is replaced with its documented seed. */ }
  return seedData();
}

const data = ref<DemoData>(loadData());
const currentId = ref<string | null>(null);
const staged = ref<AccessPreview | null>(null);
const busy = ref(false);
const message = ref("");
const error = ref("");

const currentStaff = computed(() => data.value.staff.find(item => item.id === currentId.value) ?? null);
const currentCodes = computed(() => currentId.value ? effectiveCodes(data.value, currentId.value) : []);
const pendingCount = computed(() => data.value.requests.filter(item => item.status === "pending").length);

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function put(next: DemoData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  data.value = next;
  if (currentId.value && !effectiveCodes(next, currentId.value).length) {
    currentId.value = null;
    staged.value = null;
  }
}

function actorId(): string {
  if (!currentId.value) throw new Error("请先登录演示账号。");
  return currentId.value;
}

function requireGlobal(code: string): string {
  const id = actorId();
  if (!hasGlobal(data.value, id, code)) throw new Error(`当前账号缺少全局权限：${code}。`);
  return id;
}

function checkPassword(password: string) {
  if (password !== DEMO_PASSWORD) throw new Error("演示密码错误。请使用页面给出的演示密码。");
}

function audit(next: DemoData, actor: string, action: string, detail: string, requestId: string | null = null) {
  next.audit.unshift({ id: uuid(), at: Date.now(), actorId: actor, action, detail, requestId });
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function targetState(data: DemoData, input: AccessInput): { before: unknown; version: number } {
  if (input.operation === "user-roles" || input.operation === "user-status") {
    const staff = data.staff.find(item => item.id === input.targetId);
    if (!staff) throw new Error("目标员工不存在。");
    return { before: input.operation === "user-roles" ? [...staff.roles].sort() : staff.enabled, version: staff.version };
  }
  if (input.operation === "permission-status") {
    const permission = data.permissions.find(item => item.code === input.targetId);
    if (!permission) throw new Error("目标权限项不存在。");
    return { before: permission.enabled, version: permission.version };
  }
  const role = data.roles.find(item => item.id === input.targetId);
  if (!role) throw new Error("目标角色不存在。");
  const before = input.operation === "role-permissions" ? [...role.permissions].sort()
    : input.operation === "role-scope" ? clone(role.scope) : role.enabled;
  return { before, version: role.version };
}

function normalizedScope(data: DemoData, role: Role, value: RoleScope): RoleScope {
  if (!value || !["GLOBAL", "RESTRICTED", "DENY"].includes(value.mode)) throw new Error("请选择明确的资源范围模式。");
  if (value.expiresAt !== null && (!Number.isSafeInteger(value.expiresAt) || value.expiresAt <= Date.now())) throw new Error("有效期必须晚于现在。");
  if (value.mode !== "RESTRICTED") return { mode: value.mode, expiresAt: value.expiresAt, rules: [] };
  if (!Array.isArray(value.rules) || !value.rules.length || value.rules.length > 10) throw new Error("受限范围至少需要一条规则，最多 10 条。");
  const rules = value.rules.map(rule => {
    if (!Array.isArray(rule.permissionCodes) || !rule.permissionCodes.length ||
      rule.permissionCodes.some(code => !role.permissions.includes(code) || !data.permissions.some(item => item.code === code))) {
      throw new Error("资源规则必须选择这个角色已有的权限项。");
    }
    const resources = { site: [], product: [], competition: [], provider: [], account: [] } as RoleScope["rules"][number]["resources"];
    for (const key of Object.keys(resources) as (keyof typeof resources)[]) {
      const values = rule.resources?.[key];
      if (!Array.isArray(values)) throw new Error("资源 ID 列表格式错误。");
      resources[key] = [...new Set(values.map(value => value.trim()).filter(Boolean))];
    }
    if (!Object.values(resources).some(values => values.length)) throw new Error("受限规则至少要指定一种资源 ID。");
    const maxAmount = rule.maxAmount?.trim() ?? "";
    const currency = rule.currency?.trim().toUpperCase() ?? "";
    if (maxAmount && (!/^\d+(\.\d{1,2})?$/.test(maxAmount) || Number(maxAmount) <= 0 || !/^[A-Z]{3}$/.test(currency))) throw new Error("金额上限需要正数金额和三位币种代码。");
    return { permissionCodes: [...new Set(rule.permissionCodes)].sort(), resources, maxAmount, currency };
  });
  return { mode: value.mode, expiresAt: value.expiresAt, rules };
}

function normalizeInput(data: DemoData, input: AccessInput): AccessInput {
  const operation = input.operation;
  if (operation === "user-roles") {
    if (!Array.isArray(input.desired)) throw new Error("请选择完整的角色列表。");
    const desired = [...new Set(input.desired)].sort();
    if (desired.some(id => !data.roles.some(role => role.id === id && role.enabled))) throw new Error("不能分配不存在或已停用的角色。");
    return { operation, targetId: input.targetId, desired };
  }
  if (operation === "role-permissions") {
    if (!Array.isArray(input.desired)) throw new Error("请选择完整的权限列表。");
    const role = data.roles.find(item => item.id === input.targetId);
    if (!role) throw new Error("目标角色不存在。");
    const desired = [...new Set(input.desired)].sort();
    if (desired.some(code => !data.permissions.some(item => item.code === code) && !role.permissions.includes(code))) throw new Error("不能添加权限目录之外的代码。");
    return { operation, targetId: input.targetId, desired };
  }
  if (operation === "role-scope") {
    const role = data.roles.find(item => item.id === input.targetId);
    if (!role) throw new Error("目标角色不存在。");
    return { operation, targetId: input.targetId, desired: normalizedScope(data, role, input.desired as RoleScope) };
  }
  if (input.desired !== true) throw new Error("此操作只支持明确启用。");
  return { operation, targetId: input.targetId, desired: true };
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function frozenPreview(snapshot: DemoData, input: AccessInput): Promise<AccessPreview> {
  const normalized = normalizeInput(snapshot, input);
  const { before, version } = targetState(snapshot, normalized);
  if (same(before, normalized.desired)) throw new Error("所选内容与当前状态相同，无需提交提案。");
  if (normalized.operation.endsWith("status") && before !== false) throw new Error("目标当前并未停用。");
  const affected = affectedStaffIds(snapshot, normalized.operation, normalized.targetId);
  const impactHash = await sha256({ operation: normalized.operation, targetId: normalized.targetId,
    before, desired: normalized.desired, affected, targetVersion: version });
  return { ...normalized, before, affectedStaffIds: affected, targetVersion: version, impactHash };
}

function eligibleReviewers(snapshot: DemoData, preview: AccessPreview, makerId: string): Staff[] {
  return snapshot.staff.filter(staff => staff.id !== makerId && !preview.affectedStaffIds.includes(staff.id)
    && hasGlobal(snapshot, staff.id, "SYS_ACCESS_APPROVE"));
}

function ensureControlPlane(snapshot: DemoData) {
  const makers = snapshot.staff.filter(staff => hasGlobal(snapshot, staff.id, "SYS_ROLE_ASSIGN_PERM") &&
    hasGlobal(snapshot, staff.id, "SYS_ADMIN_USER_ASSIGN_ROLE"));
  const checkers = snapshot.staff.filter(staff => hasGlobal(snapshot, staff.id, "SYS_ACCESS_APPROVE"));
  if (!makers.some(maker => checkers.some(checker => checker.id !== maker.id))) {
    throw new Error("此变更会使演示环境失去独立的发起人或审核员，已阻止应用。");
  }
}

function applyChange(next: DemoData, preview: AccessPreview) {
  const { operation, targetId, desired } = preview;
  if (operation === "user-roles" || operation === "user-status") {
    const staff = next.staff.find(item => item.id === targetId)!;
    if (operation === "user-roles") staff.roles = clone(desired as string[]);
    else staff.enabled = true;
    staff.version++;
  } else if (operation === "permission-status") {
    const permission = next.permissions.find(item => item.code === targetId)!;
    permission.enabled = true;
    permission.version++;
  } else {
    const role = next.roles.find(item => item.id === targetId)!;
    if (operation === "role-permissions") role.permissions = clone(desired as string[]);
    else if (operation === "role-scope") role.scope = clone(desired as RoleScope);
    else role.enabled = true;
    role.version++;
  }
}

function setFeedback(fn: () => Promise<void>): Promise<void> {
  busy.value = true; error.value = ""; message.value = "";
  return fn().catch(failure => { error.value = failure instanceof Error ? failure.message : String(failure); })
    .finally(() => { busy.value = false; });
}

async function login(username: string, password: string, code: string) {
  return setFeedback(async () => {
    const staff = data.value.staff.find(item => item.username.toLowerCase() === username.trim().toLowerCase());
    if (!staff) throw new Error("演示账号不存在。");
    checkPassword(password);
    if (!staff.enabled) throw new Error("账号已停用。");
    if (!effectiveCodes(data.value, staff.id).length) throw new Error("该账号没有任何有效后台权限，无法登录。");
    if (staff.totpEnabled && (!staff.totpSecret || !(await verifyCode(staff.totpSecret, code)))) {
      throw new Error("请输入验证器当前生成的 6 位验证码。");
    }
    currentId.value = staff.id;
    staged.value = null;
    message.value = `已切换为 ${staff.name}。`;
  });
}

function logout() {
  currentId.value = null;
  staged.value = null;
  error.value = "";
  message.value = "";
}

async function previewChange(input: AccessInput) {
  return setFeedback(async () => {
    requireGlobal(MAKER_PERMISSION[input.operation]);
    staged.value = await frozenPreview(data.value, input);
    message.value = "已生成准确变更预览，当前权限尚未改变。";
  });
}

async function propose(reason: string, password: string) {
  return setFeedback(async () => {
    const preview = staged.value;
    if (!preview) throw new Error("请先生成变更预览。");
    const makerId = requireGlobal(MAKER_PERMISSION[preview.operation]);
    checkPassword(password);
    if (!reason.trim() || reason.trim().length > 500) throw new Error("请填写不超过 500 字的变更原因。");
    const fresh = await frozenPreview(data.value, preview);
    if (fresh.impactHash !== preview.impactHash) throw new Error("目标状态已变化，请重新预览。");
    if (!eligibleReviewers(data.value, preview, makerId).length) throw new Error("当前没有独立且不受本次变更影响的审核员。请选择其他目标或先配置审核员。");
    const next = clone(data.value);
    const id = uuid();
    next.requests.unshift({ id, status: "pending", preview: clone(preview), makerId,
      reason: reason.trim(), createdAt: Date.now(), decisionId: null, reviewerId: null,
      decisionReason: null, decidedAt: null, receipt: null });
    audit(next, makerId, "提交访问变更", `${OPERATION_LABELS[preview.operation]} · ${preview.targetId}`, id);
    put(next);
    staged.value = null;
    message.value = `提案 ${id.slice(0, 8)} 已保存。独立审批前，权限保持不变。`;
  });
}

async function decide(requestId: string, decision: "approve" | "decline", reason: string, password: string) {
  return setFeedback(async () => {
    const reviewerId = requireGlobal("SYS_ACCESS_APPROVE");
    checkPassword(password);
    if (!reason.trim() || reason.trim().length > 500) throw new Error("请填写不超过 500 字的审批理由。");
    const request = data.value.requests.find(item => item.id === requestId);
    if (!request || request.status !== "pending") throw new Error("提案不存在或已被处理，请刷新列表。");
    if (reviewerId === request.makerId || request.preview.affectedStaffIds.includes(reviewerId)) {
      throw new Error("发起人或受影响员工不能审批此提案。");
    }
    if (!hasGlobal(data.value, request.makerId, MAKER_PERMISSION[request.preview.operation])) {
      throw new Error("发起人已失去发起此类变更的权限，请重新提交提案。");
    }
    const fresh = await frozenPreview(data.value, request.preview);
    if (fresh.impactHash !== request.preview.impactHash) throw new Error("目标、成员或权限已变化；原提案保持待处理，必须重新发起准确变更。");
    const next = clone(data.value);
    const stored = next.requests.find(item => item.id === requestId)!;
    const decisionId = uuid();
    if (decision === "approve") { applyChange(next, stored.preview); ensureControlPlane(next); }
    stored.status = decision === "approve" ? "confirmed" : "declined";
    stored.decisionId = decisionId;
    stored.reviewerId = reviewerId;
    stored.decisionReason = reason.trim();
    stored.decidedAt = Date.now();
    stored.receipt = decision === "approve" ? { requestId, decisionId,
      impactHash: stored.preview.impactHash, appliedAt: stored.decidedAt,
      appliedById: reviewerId, applied: clone(stored.preview.desired) } : null;
    audit(next, reviewerId, decision === "approve" ? "批准并应用" : "拒绝提案",
      `${OPERATION_LABELS[stored.preview.operation]} · ${stored.preview.targetId}`, requestId);
    put(next);
    message.value = decision === "approve" ? "已批准并应用准确变更，回执已记录。" : "已拒绝提案，访问权限保持不变。";
  });
}

function immediateDisable(kind: "staff" | "role" | "permission", targetId: string) {
  const required = kind === "staff" ? "SYS_ADMIN_USER_EDIT" : kind === "role" ? "SYS_ROLE_EDIT" : "SYS_PERMISSION_EDIT";
  const actor = requireGlobal(required);
  if (kind === "staff" && actor === targetId) throw new Error("不能停用自己的账号。");
  const next = clone(data.value);
  const target = kind === "staff" ? next.staff.find(item => item.id === targetId)
    : kind === "role" ? next.roles.find(item => item.id === targetId)
      : next.permissions.find(item => item.code === targetId);
  if (!target || !target.enabled) throw new Error("目标不存在或已停用。");
  target.enabled = false;
  target.version++;
  ensureControlPlane(next);
  audit(next, actor, "立即停用", `${kind} · ${targetId}`);
  put(next);
  message.value = "已停用。重新启用必须经过独立审批。";
}

function createStaff(input: { username: string; name: string; email: string }) {
  const actor = requireGlobal("SYS_ADMIN_USER_ADD");
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,29}$/.test(username)) throw new Error("账号名需为 3–30 位小写字母、数字或 ._-。");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("请填写姓名和有效邮箱。");
  if (data.value.staff.some(item => item.username === username || item.email === email)) throw new Error("账号名或邮箱已存在。");
  const next = clone(data.value);
  const id = String(Math.max(...next.staff.map(item => Number(item.id))) + 1);
  next.staff.push({ id, username, name, email, enabled: false, roles: [], totpSecret: null, totpEnabled: false, version: 1 });
  audit(next, actor, "创建员工", `${username} · 初始停用且无角色`);
  put(next);
  message.value = "员工已创建。请分别发起角色分配和账号启用提案。";
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  for (const key of legacyStorageKeys()) localStorage.removeItem(key);
  data.value = seedData();
  logout();
  message.value = "演示数据已恢复初始状态。";
}

async function beginTotp() {
  return setFeedback(async () => {
    const actor = actorId();
    const staff = data.value.staff.find(item => item.id === actor)!;
    if (staff.totpEnabled) throw new Error("验证器已启用。请先用当前验证码停用，再重新绑定。");
    const next = clone(data.value);
    const target = next.staff.find(item => item.id === actor)!;
    target.totpSecret = createSecret();
    target.version++;
    audit(next, actor, "生成验证器密钥", "旧的待绑定密钥已失效");
    put(next);
    message.value = "新密钥已生成。导入验证器后，请用当前 6 位码完成启用。";
  });
}

async function enableTotp(code: string) {
  return setFeedback(async () => {
    const actor = actorId();
    const staff = data.value.staff.find(item => item.id === actor)!;
    if (!staff.totpSecret || staff.totpEnabled) throw new Error("请先生成待绑定密钥。");
    if (!(await verifyCode(staff.totpSecret, code))) throw new Error("验证码不正确。请检查密钥及设备时间，输入当前 6 位码。");
    const next = clone(data.value);
    next.staff.find(item => item.id === actor)!.totpEnabled = true;
    audit(next, actor, "启用登录验证器", "后续登录需提供动态验证码");
    put(next);
    message.value = "验证器已启用。下次登录需要动态验证码。";
  });
}

async function disableTotp(code: string) {
  return setFeedback(async () => {
    const actor = actorId();
    const staff = data.value.staff.find(item => item.id === actor)!;
    if (!staff.totpEnabled || !staff.totpSecret || !(await verifyCode(staff.totpSecret, code))) {
      throw new Error("请输入当前验证器生成的 6 位验证码。");
    }
    const next = clone(data.value);
    const target = next.staff.find(item => item.id === actor)!;
    target.totpEnabled = false;
    target.totpSecret = null;
    target.version++;
    audit(next, actor, "停用登录验证器", "原密钥已删除，可重新绑定");
    put(next);
    message.value = "验证器已停用，原密钥已作废。可重新生成密钥绑定。";
  });
}

window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY) return;
  data.value = loadData();
  staged.value = null;
  if (currentId.value && !effectiveCodes(data.value, currentId.value).length) {
    logout();
    message.value = "当前账号已失去有效后台权限，请重新登录。";
  }
  else message.value = "其他标签页修改了演示数据；本页已同步，请重新预览变更。";
});

export const demo = {
  data, currentId, currentStaff, currentCodes, pendingCount, staged, busy, message, error,
  login, logout, previewChange, propose, decide, eligibleReviewers,
  immediateDisable, createStaff, resetDemo, beginTotp, enableTotp, disableTotp,
  hasGlobal: (code: string) => !!currentId.value && hasGlobal(data.value, currentId.value, code),
  check: (staffId: string, code: string, query = emptyQuery()) => checkAccess(data.value, staffId, code, query),
};
