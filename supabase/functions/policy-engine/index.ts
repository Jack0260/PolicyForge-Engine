import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EngineRule {
  id: string;
  name: string;
  description: string;
  actor: string;
  resource: string;
  condition: any;
  action: "ALLOW" | "DENY";
  priority: number;
  enabled: boolean;
}

interface ScenarioInput {
  [field: string]: string | number | boolean;
}

function compareValues(
  actual: string | number | boolean | undefined,
  operator: string,
  expected: string | number | boolean,
): boolean {
  if (actual === undefined || actual === null) return false;
  switch (operator) {
    case ">": return Number(actual) > Number(expected);
    case "<": return Number(actual) < Number(expected);
    case ">=": return Number(actual) >= Number(expected);
    case "<=": return Number(actual) <= Number(expected);
    case "==": return actual == expected;
    case "!=": return actual != expected;
    default: return false;
  }
}

function isConditionGroup(c: any): boolean {
  return c && c.logic !== undefined;
}

function evaluateCondition(condition: any, inputs: ScenarioInput): { passed: boolean; evaluations: any[] } {
  if (isConditionGroup(condition)) {
    let allEvals: any[] = [];
    let results: boolean[] = [];
    for (const child of condition.conditions) {
      const result = evaluateCondition(child, inputs);
      allEvals = allEvals.concat(result.evaluations);
      results.push(result.passed);
    }
    const passed = condition.logic === "AND" ? results.every((r) => r === true) : results.some((r) => r === true);
    return { passed, evaluations: allEvals };
  }
  const actualValue = inputs[condition.field];
  const passed = compareValues(actualValue, condition.operator, condition.value);
  return {
    passed,
    evaluations: [{
      conditionId: condition.id,
      passed,
      field: condition.field,
      operator: condition.operator,
      expectedValue: condition.value,
      actualValue: actualValue,
      description: `${condition.field} ${condition.operator} ${condition.value} → actual: ${actualValue ?? "undefined"}`,
    }],
  };
}

function evaluateRules(rules: EngineRule[], inputs: ScenarioInput, policyVersion: number) {
  const activeRules = rules.filter((r) => r.enabled);
  activeRules.sort((a, b) => b.priority - a.priority);

  const matchedRules: EngineRule[] = [];
  let allConditionEvaluations: any[] = [];

  for (const rule of activeRules) {
    const conditionResult = rule.condition ? evaluateCondition(rule.condition, inputs) : { passed: true, evaluations: [] };
    allConditionEvaluations = allConditionEvaluations.concat(conditionResult.evaluations);
    if (conditionResult.passed) matchedRules.push(rule);
  }

  let decision = "AMBIGUOUS";
  let matchedRule: EngineRule | null = null;
  const reasoning: string[] = [];

  if (matchedRules.length === 0) {
    decision = "AMBIGUOUS";
    reasoning.push("No rules matched the given input scenario.");
  } else if (matchedRules.length === 1) {
    matchedRule = matchedRules[0];
    decision = matchedRule.action;
    reasoning.push(`Rule "${matchedRule.name}" (priority ${matchedRule.priority}) matched and resulted in ${matchedRule.action}.`);
  } else {
    const allowRules = matchedRules.filter((r) => r.action === "ALLOW");
    const denyRules = matchedRules.filter((r) => r.action === "DENY");
    if (allowRules.length > 0 && denyRules.length > 0) {
      decision = "CONFLICT";
      reasoning.push(`Conflict: ${allowRules.length} rule(s) say ALLOW and ${denyRules.length} rule(s) say DENY.`);
      matchedRule = matchedRules[0];
    } else {
      matchedRule = matchedRules[0];
      decision = matchedRule.action;
      reasoning.push(`${matchedRules.length} rules matched, all agree: ${matchedRule.action}.`);
    }
  }

  return {
    decision,
    evidence: {
      decision,
      matchedRule,
      matchedRules,
      inputs,
      conditionEvaluations: allConditionEvaluations,
      policyVersion,
      timestamp: new Date().toISOString(),
      reasoning,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { policyId, inputs } = body as { policyId: string; inputs: ScenarioInput };

    if (!policyId || !inputs) {
      return new Response(
        JSON.stringify({ error: "policyId and inputs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: policy, error } = await supabase
      .from("policies")
      .select("*, versions(*)")
      .eq("id", policyId)
      .maybeSingle();

    if (error || !policy) {
      return new Response(
        JSON.stringify({ error: "Policy not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currentVersion = policy.versions?.find((v: any) => v.id === policy.current_version_id);
    if (!currentVersion) {
      return new Response(
        JSON.stringify({ error: "No active version found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = evaluateRules(currentVersion.rules as EngineRule[], inputs, currentVersion.version);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
