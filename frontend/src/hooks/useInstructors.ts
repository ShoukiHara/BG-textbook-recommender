import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchInstructors, createInstructor, deleteInstructor } from '../lib/api'

export function useInstructors() {
  return useQuery({
    queryKey: ['instructors'],
    queryFn: fetchInstructors,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateInstructor(token: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createInstructor(name, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instructors'] }),
  })
}

export function useDeleteInstructor(token: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstructor(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instructors'] }),
  })
}
