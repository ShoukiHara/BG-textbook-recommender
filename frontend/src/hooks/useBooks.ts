import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchBooks, fetchBook, createBook } from '../lib/api'

export function useBooks(params?: { subject?: string; sort?: string; reviewed_only?: boolean }) {
  return useQuery({
    queryKey: ['books', params],
    queryFn: () => fetchBooks(params),
    staleTime: 5 * 60 * 1000,
  })
}

export function useBook(id: string) {
  return useQuery({
    queryKey: ['book', id],
    queryFn: () => fetchBook(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  })
}

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBook,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] }),
  })
}
