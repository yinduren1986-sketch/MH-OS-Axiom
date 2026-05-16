/**
 * policyEngine.ts — OSC Phase 4 Day 12-13
 *
 * Safety Gate — evaluates skill calls against policies before execution.
 * Blocks dangerous operations, confirms risky ones, lets safe ones through.
 */

export type PolicyAction = "allow" | "block" | "confirm";

export interface Policy {
  id: string;
  /** Match on skill name or tool call pattern */
  skill?: string;
  pattern?: RegExp;
  /** Additional condition check (optional) */
  condition?: (params: Record<string, unknown>) => boolean;
  action: PolicyAction;
  message?: string;
}

export interface EvaluationResult {
  action: PolicyAction;
  policyId: string;
  message?: string;
}

function matchPolicy(policy: Policy, skillName: string, rawCall: string): boolean {
  if (policy.skill && policy.skill !== skillName) return false;
  if (policy.pattern && !policy.pattern.test(rawCall)) return false;
  return true;
}

export function evaluateSkillCall(
  skillName: string,
  rawCall: string,
  params: Record<string, unknown>,
  policies: Policy[],
): EvaluationResult {
  for (const policy of policies) {
    if (!matchPolicy(policy, skillName, rawCall)) continue;
    if (policy.condition && !policy.condition(params)) continue;
    return {
      action: policy.action,
      policyId: policy.id,
      message: policy.message,
    };
  }
  return { action: "allow", policyId: "default-allow" };
}

/** Default safety policies — blocks known dangerous patterns */
export const DEFAULT_POLICIES: Policy[] = [
  {
    id: "no-rm-rf",
    skill: "shell",
    pattern: /rm\s+(-[rfv]+\s+)*\//,
    action: "block",
    message: "检测到危险命令 rm -rf /，已拦截。如需执行请人工确认。",
  },
  {
    id: "no-rm-rf-specific",
    skill: "exec",
    pattern: /rm\s+(-[rfv]+\s+)*\//,
    action: "block",
    message: "检测到根目录递归删除，已拦截。",
  },
  {
    id: "no-external-data-exfil",
    pattern:
      /(curl|wget|python.*requests|fetch).*(-d|--data|--data-raw).*(api_key|secret|password|token|auth)/i,
    action: "block",
    message: "检测到可能外发凭证的请求，已拦截。",
  },
  {
    id: "high-risk-email",
    skill: "send_email",
    condition: (params) =>
      Boolean((params.attachments as unknown[])?.length > 0) ||
      Boolean((params.cc as string[])?.length > 0),
    action: "confirm",
    message: "邮件包含附件或抄送人，需要确认后才能发送。",
  },
];
