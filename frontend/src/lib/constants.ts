export const SUBJECTS = [
  "英語", "文系数学", "理系数学", "現代文", "古文", "漢文",
  "物理", "化学", "生物", "日本史", "世界史", "地理", "倫理・政治経済",
] as const

export const SUBJECTS_WITH_COMMON = [...SUBJECTS, "文理共通数学"] as const

export const LAYERS: Record<number, string> = {
  1: "予習・初学フェーズ",
  2: "基礎力完成フェーズ (地方国公立ゴール)",
  3: "応用・発展フェーズ (阪大以上ゴール)",
}

export const GRADES = ["高1", "高2", "高3", "浪人"] as const

export const ENGLISH_CATEGORIES = ["文法", "単語", "長文", "解釈", "英作文"] as const

export const MATH_CATEGORIES = [
  "教科書的知識",
  "典型解法（青チャートレベル）",
  "典型解法（地方国公立2次レベル）",
  "初見の難問",
] as const

export const MATH_SUBJECTS = ["文系数学", "理系数学"] as const

export const SCIENCE_CATEGORIES = [
  "教科書的知識",
  "共通テスト・私大標準レベルの得点力",
  "国公立2次レベルの得点力",
  "難関国立大レベルの得点力",
] as const

export const SCIENCE_SUBJECTS = ["物理", "化学", "生物"] as const

export function getSubjectCategory(subject: string): 'english' | 'math' | 'science' | null {
  if (subject === '英語') return 'english'
  if ((MATH_SUBJECTS as readonly string[]).includes(subject)) return 'math'
  if ((SCIENCE_SUBJECTS as readonly string[]).includes(subject)) return 'science'
  return null
}

