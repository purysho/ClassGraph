/**
 * Chinese for the descriptive messages ClassGraph's analysis and planning code writes in English
 * (spreadsheet import problems, constraint checks, candidate explanations, grouping details).
 * Those modules stay in English because they are shared with exports and tests; the interface
 * translates their messages at the point of display. A message with no pattern is shown as is.
 */

type Replacement = string | ((...groups: string[]) => string)

const ROLE: Record<string, string> = {
  'student-id': '学号',
  'display-name': '姓名',
  tags: '标签',
}

const KIND: Record<string, string> = {
  number: '数值',
  ordinal: '等级',
  category: '类别',
  boolean: '是/否',
  text: '文本',
}

const NEIGHBOUR: Record<string, string> = {
  orthogonal: '前后左右',
  king: '前后左右或斜向',
}

export const ZH_SERVER_PATTERNS: [RegExp, Replacement][] = [
  // Spreadsheet import
  [/^"(.*)" is not a number$/, '“$1” 不是数字'],
  [/^"(.*)" is not yes\/no$/, '“$1” 不是“是/否”'],
  [/^"(.*)" is not one of the categories \((.*)\)$/, '“$1” 不在可选类别中（$2）'],
  [/^"(.*)" is not on the scale \((.*)\)$/, '“$1” 不在等级中（$2）'],
  [/^Only one column can be the (.+)\.$/, (role) => `只能有一列作为${ROLE[role] ?? role}列。`],
  [
    /^Updating an existing class needs a student ID column to match students\.$/,
    '更新已有班级时，需要有一列学号来对应学生。',
  ],
  [/^Choose at least one column to import\.$/, '请至少选择一列导入。'],
  [/^Two columns use the metric key "(.*)"\.$/, '有两列使用了同一个指标键“$1”。'],
  [
    /^Metric key "(.*)" already exists as a (\w+) metric\.$/,
    (key, kind) => `指标键“${key}”已存在，类型为${KIND[kind] ?? kind}。`,
  ],
  [/^Metric "(.*)" is not in this class\.$/, '这个班级没有指标“$1”。'],
  [/^Every imported metric needs a label\.$/, '每个导入的指标都需要名称。'],
  [/^A category metric needs at least one category\.$/, '类别指标至少需要一个类别。'],
  [/^An ordinal metric needs its scale in order\.$/, '等级指标需要按顺序填写各个等级。'],
  [/^This row has no student ID\.$/, '这一行没有学号。'],
  [/^Student ID "(.*)" also appears on row (\d+)\.$/, '学号“$1”在第 $2 行也出现了。'],
  [/^The sheet has no student rows\.$/, '表格中没有学生行。'],

  // Seating candidates
  [
    /^Create a room before generating seating candidates\.$/,
    '生成座位候选方案前，请先创建教室座位网格。',
  ],
  [/^Enabled capacity is (\d+) seats for (\d+) students\.$/, '已启用 $1 个座位，但有 $2 名学生。'],
  [
    /^Required assignment references unknown student (.+)\.$/,
    '必须保留的安排指向了不存在的学生 $1。',
  ],
  [/^Required seat (.+) is not enabled\.$/, '必须使用的座位 $1 未启用。'],
  [
    /^Rule (.+) requires seat tag "(.*)", but no enabled seat has that tag\.$/,
    '规则 $1 需要带“$2”标签的座位，但没有已启用的座位带这个标签。',
  ],
  [/^(.+) is fixed to (.+)\.$/, '$1 已固定在 $2。'],
  [/^(.+) must be fixed to (.+)\.$/, '$1 必须固定在 $2。'],
  [/^(.+) is in a seat tagged (.+)\.$/, '$1 坐在带“$2”标签的座位上。'],
  [/^(.+) is not in a seat tagged (.+)\.$/, '$1 没有坐在带“$2”标签的座位上。'],
  [/^(.+) requires a seat tagged (.+)\.$/, '$1 需要坐在带“$2”标签的座位上。'],
  [
    /^(.+) and (.+) are not (\w+) neighbours\.$/,
    (a, b, mode) => `${a} 和 ${b} 不是${NEIGHBOUR[mode] ?? mode}相邻。`,
  ],
  [
    /^(.+) and (.+) must not be (\w+) neighbours\.$/,
    (a, b, mode) => `${a} 和 ${b} 不能${NEIGHBOUR[mode] ?? mode}相邻。`,
  ],
  [/^Seat distance is ([\d.]+)\.$/, '座位距离为 $1。'],
  [/^One or both students are not assigned\.$/, '至少有一名学生还没有安排座位。'],
  [
    /^Row mean spread is (-?[\d.]+); (\d+) assignment\(s\) lacked a recorded value and were ignored\.$/,
    '各行平均值的极差为 $1；有 $2 个安排缺少已记录的数值，已忽略。',
  ],
  [/^All hard constraints are satisfied\.$/, '所有硬性约束都已满足。'],
  [
    /^No soft objectives are selected; candidates differ only by seeded arrangement\.$/,
    '没有选择软性目标；各候选方案只在由随机种子决定的排列上不同。',
  ],
  [
    /^No arrangement satisfied every hard constraint in (\d+) deterministic attempts\.$/,
    '在 $1 次确定性尝试中，没有一种排列能满足全部硬性约束。',
  ],
  [
    /^Hard rule (.+) was violated in (\d+) of (\d+) tested arrangements\.$/,
    '在测试的 $3 种排列中，硬性规则 $1 有 $2 种未满足。',
  ],
  [
    /^(\S+) \((.+)\) penalty (-?[\d.]+): (.+)$/,
    (kind, rule, penalty, details) =>
      `${kind}（${rule}）惩罚分 ${penalty}：${translateServerMessage(details)}`,
  ],

  // Graphs
  [
    /^Association is not causation\. This figure describes how the recorded values move together in this class only\.$/,
    '相关不等于因果。这个数值只描述这个班级中已记录的数值如何一起变化。',
  ],

  // Groups
  [/^Largest-smallest group size difference is (\d+)\.$/, '人数最多和最少的组相差 $1 人。'],
  [
    /^Group mean spread for (.+) is (-?[\d.]+); (\d+) student\(s\) lacked a recorded value and were ignored\.$/,
    '各组 $1 平均值的极差为 $2；有 $3 名学生缺少已记录的数值，已忽略。',
  ],
]

/** Translates one English message from ClassGraph's analysis code, or returns it unchanged. */
export function translateServerMessage(message: string): string {
  for (const [pattern, replacement] of ZH_SERVER_PATTERNS) {
    const match = pattern.exec(message)
    if (!match) continue
    if (typeof replacement === 'function') return replacement(...match.slice(1))
    return message.replace(pattern, replacement)
  }
  return message
}
