export const defaultAutomationRules = [
  {
    id: "rule-daily-low-deep-work",
    trigger: "daily_log_saved",
    condition: "deep_work_hours_lt_2",
    action: "send_focus_nudge",
    enabled: true,
  },
  {
    id: "rule-task-done-reward",
    trigger: "saas_task_moved",
    condition: "moved_to_done",
    action: "send_reward_message",
    enabled: true,
  },
  {
    id: "rule-note-created-reminder",
    trigger: "note_created",
    condition: "always",
    action: "enqueue_review_note",
    enabled: true,
  },
]

function matchesCondition(rule, payload) {
  if (rule.condition === "always") return true
  if (rule.condition === "deep_work_hours_lt_2") return Number(payload.deep_work_hours || 0) < 2
  if (rule.condition === "moved_to_done") return payload.to_lane === "done"
  return false
}

export function evaluateAutomationRules(rules, event) {
  return rules
    .filter((rule) => rule.enabled && rule.trigger === event.type)
    .filter((rule) => matchesCondition(rule, event.payload))
    .map((rule) => ({
      rule_id: rule.id,
      event_type: event.type,
      action_type: rule.action,
      payload: event.payload,
      status: "queued",
      message:
        rule.action === "send_focus_nudge"
          ? "Deep work dipped below 2h. Protect a 90-minute block next."
          : rule.action === "send_reward_message"
            ? "Great momentum. You moved a SaaS task to Done."
            : "New note captured. Schedule a short review later today.",
    }))
}
