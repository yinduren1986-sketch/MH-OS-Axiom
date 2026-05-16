/**
 * evaluator.ts — OSC Phase 4 Day 11
 *
 * Parses and evaluates CONDITION expressions from HEARTBEAT.md rules.
 *
 * Syntax:
 *   <var> <op> <value>              e.g. pending_count > 0, status == "idle"
 *   <var> <op> <value> AND <var> <op> <value>
 *   <var> <op> <value> OR <var> <op> <value>
 *
 * Environment vars are resolved from the env parameter.
 */

export type EnvVars = Record<string, string | number | boolean>;

export interface SimpleCondition {
  varName: string;
  operator: "<" | ">" | "<=" | ">=" | "==" | "!=";
  value: string | number | boolean;
}

export interface ParsedCondition {
  type: "simple" | "and" | "or";
  left?: SimpleCondition;
  right?: ParsedCondition;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  const regex = /[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?|"[^"]*"|'[^']*'|&&|\|\||[<>!=]=|[<>]/g;
  let match;
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function parseSimple(tokens: string[]): SimpleCondition | null {
  if (tokens.length < 3) return null;
  const varName = tokens[0];
  const operator = tokens[1] as SimpleCondition["operator"];
  const rawValue = tokens[2];
  if (!["<", ">", "<=", ">=", "==", "!="].includes(operator)) return null;

  let value: string | number | boolean = rawValue;
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    value = rawValue.slice(1, -1);
  } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    value = rawValue.slice(1, -1);
  } else if (!isNaN(Number(rawValue))) {
    value = Number(rawValue);
  } else if (rawValue === "true") {
    value = true;
  } else if (rawValue === "false") {
    value = false;
  }

  return { varName, operator, value };
}

function parseCondition(expr: string): ParsedCondition | null {
  const s = expr.trim();
  // OR (lowest precedence)
  let depth = 0,
    orPos = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (depth === 0 && i + 1 < s.length && s.slice(i, i + 2) === "OR") {
      orPos = i;
      break;
    }
  }
  if (orPos > 0) {
    return {
      type: "or",
      left: parseCondition(s.slice(0, orPos)) ?? undefined,
      right: parseCondition(s.slice(orPos + 2)) ?? undefined,
    } as ParsedCondition;
  }

  // AND
  depth = 0;
  let andPos = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (depth === 0 && i + 2 < s.length && s.slice(i, i + 3) === "AND") {
      andPos = i;
      break;
    }
  }
  if (andPos > 0) {
    return {
      type: "and",
      left: parseCondition(s.slice(0, andPos)) ?? undefined,
      right: parseCondition(s.slice(andPos + 3)) ?? undefined,
    } as ParsedCondition;
  }

  // Simple
  const simple = parseSimple(tokenize(s));
  if (simple) return { type: "simple", left: simple };
  return null;
}

export { parseCondition };

export function evaluateCondition(parsed: ParsedCondition, env: EnvVars): boolean {
  if (parsed.type === "simple" && parsed.left) {
    const { varName, operator, value } = parsed.left;
    const envVal = env[varName];
    if (envVal === undefined) return false;

    const envNum = typeof envVal === "number" ? envVal : Number(envVal);
    const valNum = typeof value === "number" ? value : Number(value);
    const bothNumeric = !isNaN(envNum) && !isNaN(valNum);

    if (bothNumeric) {
      switch (operator) {
        case ">":
          return envNum > valNum;
        case "<":
          return envNum < valNum;
        case ">=":
          return envNum >= valNum;
        case "<=":
          return envNum <= valNum;
        case "==":
          return envNum === valNum;
        case "!=":
          return envNum !== valNum;
      }
    } else {
      const strEnv = String(envVal);
      const strVal = String(value);
      switch (operator) {
        case "==":
          return strEnv === strVal;
        case "!=":
          return strEnv !== strVal;
        default:
          return false;
      }
    }
  }

  if (parsed.type === "and" && parsed.left && parsed.right) {
    return evaluateCondition(parsed.left, env) && evaluateCondition(parsed.right, env);
  }
  if (parsed.type === "or" && parsed.left && parsed.right) {
    return evaluateCondition(parsed.left, env) || evaluateCondition(parsed.right, env);
  }

  return false;
}

/** Parse a CONDITION line and evaluate it against env vars */
export function evaluateLine(conditionLine: string, env: EnvVars): boolean {
  const stripped = conditionLine.trim().replace(/^CONDITION:\s*/i, "");
  const parsed = parseCondition(stripped);
  if (!parsed) return false;
  return evaluateCondition(parsed, env);
}
