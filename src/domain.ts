export type AccessOperation =
  | "user-roles"
  | "role-permissions"
  | "role-scope"
  | "user-status"
  | "role-status"
  | "permission-status";
export type ResourceDimension = "site" | "product" | "competition" | "provider" | "account";
export type ScopeMode = "UNCONFIGURED" | "GLOBAL" | "RESTRICTED" | "DENY";
export type ReviewStatus = "pending" | "confirmed" | "declined";
export type PermissionAction = "view" | "edit" | "approve";

export interface Permission {
  code: string;
  name: string;
  module: string | null;
  action: PermissionAction;
  enabled: boolean;
  version: number;
}
export interface ScopeRule {
  permissionCodes: string[];
  resources: Record<ResourceDimension, string[]>;
  maxAmount: string;
  currency: string;
}
export interface RoleScope {
  mode: ScopeMode;
  expiresAt: number | null;
  rules: ScopeRule[];
}
export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  permissions: string[];
  scope: RoleScope;
  version: number;
}
export interface Staff {
  id: string;
  username: string;
  name: string;
  email: string;
  enabled: boolean;
  roles: string[];
  totpSecret: string | null;
  totpEnabled: boolean;
  version: number;
}
export interface AccessInput {
  operation: AccessOperation;
  targetId: string;
  desired: string[] | RoleScope | true;
}
export interface AccessPreview extends AccessInput {
  before: unknown;
  affectedStaffIds: string[];
  targetVersion: number;
  impactHash: string;
}
export interface AccessReceipt {
  requestId: string;
  decisionId: string;
  impactHash: string;
  appliedAt: number;
  appliedById: string;
  applied: unknown;
}
export interface AccessRequest {
  id: string;
  status: ReviewStatus;
  preview: AccessPreview;
  makerId: string;
  reason: string;
  createdAt: number;
  decisionId: string | null;
  reviewerId: string | null;
  decisionReason: string | null;
  decidedAt: number | null;
  receipt: AccessReceipt | null;
}
export interface AuditItem {
  id: string;
  at: number;
  actorId: string;
  action: string;
  detail: string;
  requestId: string | null;
}
export interface DemoData {
  schema: 1;
  staff: Staff[];
  roles: Role[];
  permissions: Permission[];
  requests: AccessRequest[];
  audit: AuditItem[];
}
export interface ResourceQuery {
  site: string;
  product: string;
  competition: string;
  provider: string;
  account: string;
  amount: string;
  currency: string;
  unfiltered: boolean;
}
export interface AccessResult {
  allowed: boolean;
  reason: string;
  origins: { role: Role; matched: boolean; reason: string }[];
}

export const DIMENSIONS: ResourceDimension[] = ["site", "product", "competition", "provider", "account"];
export const DIMENSION_LABELS: Record<ResourceDimension, string> = {
  site: "站点", product: "产品", competition: "赛事", provider: "供应商", account: "玩家账号",
};
export const OPERATION_LABELS: Record<AccessOperation, string> = {
  "user-roles": "员工角色变更", "role-permissions": "角色权限变更", "role-scope": "角色资源范围变更",
  "user-status": "启用员工账号", "role-status": "启用角色", "permission-status": "启用权限项",
};
export const MAKER_PERMISSION: Record<AccessOperation, string> = {
  "user-roles": "SYS_ADMIN_USER_ASSIGN_ROLE", "role-permissions": "SYS_ROLE_ASSIGN_PERM",
  "role-scope": "SYS_ROLE_ASSIGN_PERM", "user-status": "SYS_ADMIN_USER_EDIT",
  "role-status": "SYS_ROLE_EDIT", "permission-status": "SYS_PERMISSION_EDIT",
};
export const DEMO_PASSWORD = "Demo123!";

const p = (code: string, name: string, module: string | null, action: PermissionAction, enabled = true): Permission =>
  ({ code, name, module, action, enabled, version: 1 });

export const initialPermissions = (): Permission[] => [
  p("DASHBOARD_VIEW", "指挥台查看", "指挥台", "view"),
  p("DASHBOARD_EDIT", "指挥台编辑", "指挥台", "edit"),
  p("DASHBOARD_APPROVE", "指挥台审批", "指挥台", "approve"),
  p("TRADING_VIEW", "交易查看", "赛事交易", "view"),
  p("TRADING_EDIT", "交易编辑", "赛事交易", "edit"),
  p("TRADING_APPROVE", "交易审批", "赛事交易", "approve"),
  p("VIRTUALS_VIEW", "虚拟赛事查看", "虚拟赛事", "view"),
  p("VIRTUALS_EDIT", "虚拟赛事编辑", "虚拟赛事", "edit"),
  p("VIRTUALS_APPROVE", "虚拟赛事审批", "虚拟赛事", "approve"),
  p("REPORTING_VIEW", "报表查看", "报表", "view"),
  p("REPORTING_EDIT", "报表编辑", "报表", "edit"),
  p("REPORTING_APPROVE", "报表审批", "报表", "approve"),
  p("OPS_HEALTH_VIEW", "系统健康查看", "系统健康", "view"),
  p("CONTENT_VIEW", "内容查看", "内容管理", "view", false),
  p("CONTENT_EDIT", "内容编辑", "内容管理", "edit"),
  p("CONTENT_APPROVE", "内容审批", "内容管理", "approve"),
  p("SYS_ADMIN_USER", "员工目录查看", "员工与权限", "view"),
  p("SYS_ADMIN_USER_ADD", "创建员工", "员工与权限", "edit"),
  p("SYS_ADMIN_USER_EDIT", "编辑及停用员工", "员工与权限", "edit"),
  p("SYS_ADMIN_USER_ASSIGN_ROLE", "提出员工角色变更", "员工与权限", "approve"),
  p("SYS_ROLE", "角色目录查看", "员工与权限", "view"),
  p("SYS_ROLE_EDIT", "编辑及停用角色", "员工与权限", "edit"),
  p("SYS_ROLE_ASSIGN_PERM", "提出角色权限和范围变更", "员工与权限", "approve"),
  p("SYS_PERMISSION", "权限目录查看", "员工与权限", "view"),
  p("SYS_PERMISSION_EDIT", "编辑及停用权限项", "员工与权限", "edit"),
  p("SYS_ACCESS_REVIEW", "访问变更提案查看", "访问审批", "view"),
  p("SYS_ACCESS_APPROVE", "独立审批访问变更", "访问审批", "approve"),
  p("LEGACY_UNMAPPED", "未映射的旧权限", null, "view"),
];

export const emptyRule = (): ScopeRule => ({
  permissionCodes: [],
  resources: { site: [], product: [], competition: [], provider: [], account: [] },
  maxAmount: "", currency: "",
});
export const globalScope = (): RoleScope => ({ mode: "GLOBAL", expiresAt: null, rules: [] });

export function seedData(): DemoData {
  const permissions = initialPermissions();
  const allCodes = permissions.map(item => item.code).filter(code => code !== "SYS_ACCESS_APPROVE");
  return {
    schema: 1,
    permissions,
    roles: [
      { id: "1000000001", code: "SUPER_ADMIN", name: "超级管理员", description: "可发起角色和权限变更", enabled: true, permissions: allCodes, scope: globalScope(), version: 1 },
      { id: "1000000002", code: "LOCAL_ACCESS_REVIEWER", name: "独立审核员", description: "独立读取并审批访问变更", enabled: true, permissions: ["SYS_ADMIN_USER", "SYS_ROLE", "SYS_ACCESS_REVIEW", "SYS_ACCESS_APPROVE"], scope: globalScope(), version: 1 },
      { id: "1000000003", code: "MANAGER", name: "经理", description: "受站点范围限制的查看权限", enabled: true, permissions: ["DASHBOARD_VIEW", "REPORTING_VIEW", "OPS_HEALTH_VIEW", "SYS_ADMIN_USER", "SYS_ROLE"], scope: { mode: "RESTRICTED", expiresAt: null, rules: [{ ...emptyRule(), permissionCodes: ["DASHBOARD_VIEW", "REPORTING_VIEW", "OPS_HEALTH_VIEW", "SYS_ADMIN_USER", "SYS_ROLE"], resources: { ...emptyRule().resources, site: ["site-a"] } }] }, version: 1 },
      { id: "1000000004", code: "OPERATOR", name: "操作员", description: "虚拟赛事与交易操作", enabled: true, permissions: ["DASHBOARD_VIEW", "VIRTUALS_VIEW", "VIRTUALS_EDIT", "TRADING_VIEW"], scope: globalScope(), version: 1 },
      { id: "1000000005", code: "EDITOR", name: "编辑（停用）", description: "停用角色不会提供有效权限", enabled: false, permissions: ["REPORTING_VIEW"], scope: globalScope(), version: 1 },
      { id: "1000000006", code: "UNCONFIGURED_ROLE", name: "待配置角色", description: "拥有权限代码，但资源范围未配置", enabled: true, permissions: ["DASHBOARD_VIEW"], scope: { mode: "UNCONFIGURED", expiresAt: null, rules: [] }, version: 1 },
    ],
    staff: [
      { id: "2000000001", username: "admin", name: "超级管理员", email: "admin@example.test", enabled: true, roles: ["1000000001"], totpSecret: null, totpEnabled: false, version: 1 },
      { id: "2000000002", username: "reviewer", name: "独立审核员", email: "reviewer@example.test", enabled: true, roles: ["1000000002"], totpSecret: null, totpEnabled: false, version: 1 },
      { id: "2000000003", username: "manager", name: "经理", email: "manager@example.test", enabled: true, roles: ["1000000003"], totpSecret: null, totpEnabled: false, version: 1 },
      { id: "2000000004", username: "wk", name: "wk", email: "wk@example.test", enabled: true, roles: ["1000000004"], totpSecret: null, totpEnabled: false, version: 1 },
      { id: "2000000005", username: "trainee", name: "待启用员工", email: "trainee@example.test", enabled: false, roles: [], totpSecret: null, totpEnabled: false, version: 1 },
    ],
    requests: [], audit: [],
  };
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const roleName = (data: DemoData, id: string): string => data.roles.find(role => role.id === id)?.name ?? id;
export const staffName = (data: DemoData, id: string): string => data.staff.find(staff => staff.id === id)?.name ?? id;
export const permissionName = (data: DemoData, code: string): string => data.permissions.find(item => item.code === code)?.name ?? code;

function scopeAvailable(scope: RoleScope): boolean {
  return scope.mode !== "DENY" && scope.mode !== "UNCONFIGURED" &&
    (scope.expiresAt === null || scope.expiresAt > Date.now());
}

export function effectiveCodes(data: DemoData, staffId: string): string[] {
  const staff = data.staff.find(item => item.id === staffId);
  if (!staff?.enabled) return [];
  const codes = new Set<string>();
  for (const roleId of staff.roles) {
    const role = data.roles.find(item => item.id === roleId);
    if (!role?.enabled || !scopeAvailable(role.scope)) continue;
    for (const code of role.permissions) {
      if (!data.permissions.some(item => item.code === code && item.enabled)) continue;
      if (role.scope.mode === "GLOBAL" || role.scope.rules.some(rule => rule.permissionCodes.includes(code))) codes.add(code);
    }
  }
  return [...codes].sort();
}

export const emptyQuery = (): ResourceQuery => ({
  site: "", product: "", competition: "", provider: "", account: "", amount: "", currency: "", unfiltered: false,
});

function ruleMatches(rule: ScopeRule, code: string, query: ResourceQuery): boolean {
  if (!rule.permissionCodes.includes(code)) return false;
  if (!DIMENSIONS.every(key => !rule.resources[key]?.length || rule.resources[key].includes(query[key].trim()))) return false;
  if (rule.maxAmount) {
    const requested = Number(query.amount);
    if (!query.amount || !Number.isFinite(requested) || requested < 0 || requested > Number(rule.maxAmount)) return false;
    if (rule.currency && query.currency.trim().toUpperCase() !== rule.currency.toUpperCase()) return false;
  }
  return true;
}

export function checkAccess(data: DemoData, staffId: string, code: string, query: ResourceQuery = emptyQuery()): AccessResult {
  const staff = data.staff.find(item => item.id === staffId);
  if (!staff?.enabled) return { allowed: false, reason: "账号未启用或不存在。", origins: [] };
  const permission = data.permissions.find(item => item.code === code);
  if (!permission?.enabled) return { allowed: false, reason: "权限项未启用或不存在。", origins: [] };
  const origins: AccessResult["origins"] = [];
  for (const roleId of staff.roles) {
    const role = data.roles.find(item => item.id === roleId);
    if (!role || !role.permissions.includes(code)) continue;
    let reason = "";
    let matched = false;
    if (!role.enabled) reason = "角色已停用";
    else if (!scopeAvailable(role.scope)) reason = role.scope.mode === "UNCONFIGURED" ? "资源范围未配置" : role.scope.mode === "DENY" ? "资源范围拒绝" : "资源范围已过期";
    else if (role.scope.mode === "GLOBAL") { matched = true; reason = "该角色以全局范围授予此权限"; }
    else if (query.unfiltered) reason = "无筛选列表或导出需要全局范围";
    else if (role.scope.rules.some(rule => ruleMatches(rule, code, query))) { matched = true; reason = "权限与资源在同一条规则内匹配"; }
    else reason = "该角色的资源规则不匹配";
    origins.push({ role, matched, reason });
  }
  const allowed = origins.some(origin => origin.matched);
  return { allowed, origins, reason: allowed ? "允许：至少一个角色独立满足权限和资源范围。" : origins.length ? "拒绝：有角色权限，但没有任何单个角色满足当前资源范围。" : "拒绝：当前有效角色未授予此权限。" };
}

export const hasGlobal = (data: DemoData, staffId: string, code: string): boolean =>
  checkAccess(data, staffId, code, { ...emptyQuery(), unfiltered: true }).allowed;

export function affectedStaffIds(data: DemoData, operation: AccessOperation, targetId: string): string[] {
  if (operation === "user-roles" || operation === "user-status") return [targetId];
  if (operation === "permission-status") {
    const roleIds = new Set(data.roles.filter(role => role.permissions.includes(targetId)).map(role => role.id));
    return data.staff.filter(item => item.roles.some(id => roleIds.has(id))).map(item => item.id).sort();
  }
  return data.staff.filter(item => item.roles.includes(targetId)).map(item => item.id).sort();
}
