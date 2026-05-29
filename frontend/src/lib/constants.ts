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

