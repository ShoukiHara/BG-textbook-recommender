import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
})

// ---- 型定義 ----

export interface Book {
  id: string
  title: string
  subject: string
  created_at: string
}

export interface Review {
  id: string
  instructor_name: string
  book_title: string
  layer: number
  rating: number
  period: string
  before_connection: string
  after_connection: string
  usage_feel: string
  explanation_quality: string
  problem_volume: string
  strengthens_weaknesses: string
  target_deviation: string
  completion_period: string
  self_study_suitability: string
  created_at: string
}

export interface Instructor {
  id: string
  name: string
  enrollment_year: string
  review_count: number
  created_at: string
}

export interface RankingItem {
  rank: number
  book_id: string
  title: string
  score: number
  avg_rating: number
  review_count: number
  english_category: string
  math_category: string
}

export interface DiagnoseRequest {
  subject: string
  grade: string
  target_department: string
  mock_score: string
  books_history: string
  weak_points: string
  learning_style: string
  english_weak_areas: string[]
  math_weak_areas: string[]
}

export interface RecommendedBook {
  book_id: string
  title: string
  reason: string
}

export interface DiagnoseResponse {
  layer: number
  diagnosis_reason: string
  recommended_books: RecommendedBook[]
}

// ---- API 関数 ----

export const fetchBooks = (params?: { subject?: string; sort?: string; reviewed_only?: boolean }) =>
  apiClient.get<Book[]>('/api/v1/books', { params }).then(r => r.data)

export const fetchBook = (id: string) =>
  apiClient.get<Book>(`/api/v1/books/${id}`).then(r => r.data)

export const createBook = (data: { title: string; subject: string }) =>
  apiClient.post<Book[]>('/api/v1/books', data).then(r => r.data)

export const fetchReviews = (bookId: string) =>
  apiClient.get<Review[]>(`/api/v1/books/${bookId}/reviews`).then(r => r.data)

export const fetchReviewsFiltered = (params: { book_id?: string; instructor_id?: string }, token: string) =>
  apiClient.get<Review[]>('/api/v1/reviews', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)

export const createReview = (bookId: string, data: {
  instructor_id: string
  layer_ratings: Array<{ layer: number; rating: number }>
  period: string
  before_connection: string
  after_connection: string
  usage_feel: string
  explanation_quality: string
  problem_volume: string
  strengthens_weaknesses: string
  target_deviation: string
  completion_period: string
  self_study_suitability: string
  english_category: string
  math_category: string
}) => apiClient.post<Review[]>(`/api/v1/books/${bookId}/reviews`, data).then(r => r.data)

export const updateReview = (reviewId: string, data: Partial<{
  layer: number
  rating: number
  period: string
  before_connection: string
  after_connection: string
  usage_feel: string
  explanation_quality: string
  problem_volume: string
  strengthens_weaknesses: string
  target_deviation: string
  completion_period: string
  self_study_suitability: string
}>, token: string) =>
  apiClient.patch<Review>(`/api/v1/reviews/${reviewId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)

export const deleteReview = (reviewId: string, token: string) =>
  apiClient.delete(`/api/v1/reviews/${reviewId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

export const fetchInstructors = () =>
  apiClient.get<Instructor[]>('/api/v1/instructors').then(r => r.data)

export const createInstructor = (name: string, token: string, enrollment_year = '') =>
  apiClient.post<Instructor>('/api/v1/instructors', { name, enrollment_year }, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)

export const updateInstructor = (id: string, enrollment_year: string, token: string) =>
  apiClient.patch<Instructor>(`/api/v1/instructors/${id}`, { enrollment_year }, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)

export const deleteInstructor = (id: string, token: string) =>
  apiClient.delete(`/api/v1/instructors/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

export const fetchRanking = (subject: string, layer: number) =>
  apiClient.get<RankingItem[]>('/api/v1/ranking', { params: { subject, layer } }).then(r => r.data)

export const diagnose = (data: DiagnoseRequest) =>
  apiClient.post<DiagnoseResponse>('/api/v1/ai/diagnose', data).then(r => r.data)

export const fetchBookGuide = (bookId: string) =>
  apiClient.get<{ guide: string }>(`/api/v1/ai/book-guide/${bookId}`).then(r => r.data)

export interface AIDiagnosisFeedbackCreate {
  subject: string
  grade: string
  target_department: string
  mock_score: string
  books_history: string
  weak_points: string
  learning_style: string
  diagnosed_layer: number
  diagnosis_reason: string
  recommended_books: RecommendedBook[]
  score: number
  feedback_comment: string
}

export interface AIDiagnosisFeedbackOut {
  id: string
  subject: string
  grade: string
  target_department: string
  mock_score: string
  books_history: string
  weak_points: string
  learning_style: string
  diagnosed_layer: number
  diagnosis_reason: string
  recommended_books: RecommendedBook[]
  score: number
  feedback_comment: string
  created_at: string
}

export interface FeedbackSummaryItem {
  subject: string
  diagnosed_layer: number
  avg_score: number
  count: number
}

export const submitAIFeedback = (data: AIDiagnosisFeedbackCreate) =>
  apiClient.post('/api/v1/ai/feedback', data).then(r => r.data)

export const fetchAIFeedbackList = (params: { subject?: string; min_score?: number; max_score?: number }, token: string) =>
  apiClient.get<AIDiagnosisFeedbackOut[]>('/api/v1/ai/feedback', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)

export const fetchAIFeedbackSummary = (token: string) =>
  apiClient.get<FeedbackSummaryItem[]>('/api/v1/ai/feedback/summary', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)

export const login = (password: string) =>
  apiClient.post<{ access_token: string; token_type: string }>('/api/v1/auth/login', { password }).then(r => r.data)

export const generateAllGuides = (token: string) =>
  apiClient.post<{ queued: number }>('/api/v1/ai/generate-all-guides', {}, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data)
