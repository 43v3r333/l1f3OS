function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildMemorySnapshot({ weeklyLogs = [], saasTasks = [], skills = {} }) {
  const sortedLogs = [...weeklyLogs]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-30)
  const deepWorkTotal = sortedLogs.reduce((sum, log) => sum + toNumber(log.deep_work_hours), 0)
  const completedCount = sortedLogs.filter((log) => Boolean(log.task_completed)).length
  const completionRate = sortedLogs.length ? Math.round((completedCount / sortedLogs.length) * 100) : 0
  const doneTasks = saasTasks.filter((task) => task.lane === "done").length
  const saasProgress = saasTasks.length ? Math.round((doneTasks / saasTasks.length) * 100) : 0

  const deepWorkDays = sortedLogs.filter((log) => toNumber(log.deep_work_hours) >= 2).map((log) => log.date)
  let streak = 0
  for (let i = deepWorkDays.length - 1; i >= 0; i -= 1) {
    if (i === deepWorkDays.length - 1) {
      streak = 1
      continue
    }
    const current = new Date(deepWorkDays[i + 1])
    const previous = new Date(deepWorkDays[i])
    const diffDays = Math.round((current - previous) / 86400000)
    if (diffDays === 1) streak += 1
    else break
  }

  return {
    performance: {
      deepWorkTotal,
      completionRate,
      saasProgress,
      streak,
    },
    skills: {
      coding: toNumber(skills.coding),
      work: toNumber(skills.work),
      study: toNumber(skills.study),
    },
    patterns: {
      strongExecution: completionRate >= 70 && deepWorkTotal >= 10,
      lowProgress: saasProgress < 35 || completionRate < 40,
      consistency: streak >= 3,
    },
  }
}

export function generateInsights(memory) {
  const insights = []

  if (memory.patterns.lowProgress) {
    insights.push({
      type: "alert",
      title: "Low progress detected",
      message: "Execution dipped this cycle. Pick one high-impact task and close it before adding new work.",
    })
  }

  if (memory.patterns.consistency || memory.patterns.strongExecution) {
    insights.push({
      type: "reward",
      title: "Consistency reward",
      message: "Strong rhythm detected. Keep the same schedule and raise your next sprint target by 10%.",
    })
  }

  if (insights.length === 0) {
    insights.push({
      type: "note",
      title: "Stable baseline",
      message: "No major pattern shifts yet. Continue logging daily to unlock stronger coaching signals.",
    })
  }

  return insights
}
