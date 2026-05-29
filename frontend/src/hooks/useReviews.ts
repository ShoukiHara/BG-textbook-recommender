import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchReviews, createReview, updateReview, deleteReview } from '../lib/api'

export function useReviews(bookId: string) {
  return useQuery({
    queryKey: ['reviews', bookId],
    queryFn: () => fetchReviews(bookId),
    enabled: !!bookId,
    staleTime: 0,
  })
}

export function useCreateReview(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof createReview>[1]) =>
      createReview(bookId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', bookId] }),
  })
}

export function useUpdateReview(token: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ layer: number; rating: number; comment: string }> }) =>
      updateReview(id, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  })
}

export function useDeleteReview(token: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReview(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  })
}
