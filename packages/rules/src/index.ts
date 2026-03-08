import type { Rule, Transaction, TransactionTag } from "@german-bank/shared-types";

export const builtInRules: Rule[] = [
  ["Cash", "contains", "bargeldausz", "Cash", "Variable", 10],
  ["Real estate recurring", "contains", "dauerauftrag weg", "Real estate", "Fixed", 20],
  ["Real estate posting", "contains", "buchung beleglos", "Real estate", "Fixed", 30],
  ["Real estate loan", "contains", "darl.-leistung", "Real estate", "Fixed", 40],
  ["Transport tax", "contains", "bundeskasse kfz-steuer", "Transport", "Variable", 50],
  ["Subscriptions payment", "contains", "paypal", "Subscriptions", "Variable", 60],
  ["Sport club", "contains", "judo-club", "Sport", "Variable", 70],
  ["Saving fees", "contains", "depotgebuehren", "Saving", "Saving", 80]
].map(([name, matchType, pattern, category, defaultTag, priority], index) => ({
  id: `builtin-${index + 1}`,
  name,
  matchType: matchType as Rule["matchType"],
  pattern,
  category,
  defaultTag: defaultTag as TransactionTag,
  priority,
  isBuiltIn: true,
  isEnabled: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
}));

export function applyRules(
  transaction: Pick<Transaction, "description" | "categoryOverride" | "tagOverride">,
  userRules: Rule[],
  categoryTagMapping: Record<string, TransactionTag>
) {
  if (transaction.categoryOverride || transaction.tagOverride) {
    return {
      category: transaction.categoryOverride ?? "Other",
      tag: transaction.tagOverride ?? "Variable",
      ruleSource: "manual" as const
    };
  }

  const ordered = [...userRules.filter((r) => r.isEnabled), ...builtInRules].sort((a, b) => a.priority - b.priority);
  const lowered = transaction.description.toLowerCase();

  const hit = ordered.find((rule) => {
    if (rule.matchType === "contains") return lowered.includes(rule.pattern.toLowerCase());
    if (rule.matchType === "exact") return lowered === rule.pattern.toLowerCase();
    return new RegExp(rule.pattern, "i").test(transaction.description);
  });

  if (!hit) {
    return { category: "Other", tag: categoryTagMapping.Other ?? "Variable", ruleSource: "fallback" as const };
  }

  return {
    category: hit.category,
    tag: categoryTagMapping[hit.category] ?? hit.defaultTag,
    ruleSource: (hit.isBuiltIn ? "built-in" : "user-rule") as const
  };
}
