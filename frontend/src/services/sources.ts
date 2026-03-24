import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../utils/constants';
import { NewServerSourcePayload } from '../@types/sources';

export async function getAllSources() {
   const res = await fetch(`${API_URL}/sources`, {
      method: 'GET',
      credentials: 'include',
   });
   const data = await res.json();
   if (!data.success) throw new Error(data.error);
   return data;
}

export function useGetSources() {
   return useQuery({
      queryKey: ['sources'],
      queryFn: getAllSources,
      refetchOnMount: true,
      retry: false,
   });
}

export async function createSource(payload: NewServerSourcePayload) {
   const res = await fetch(`${API_URL}/sources`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
   });
   const data = await res.json();
   if (!data.success) throw new Error(data.error);
   return data;
}

export function useCreateSource() {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: createSource,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['sources'] });
      },
   });
}

export async function updateSource(payload: { id: string; data: Partial<NewServerSourcePayload> }) {
   const res = await fetch(`${API_URL}/sources/${payload.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload.data),
   });
   const data = await res.json();
   if (!data.success) throw new Error(data.error);
   return data;
}

export function useUpdateSource() {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: updateSource,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['sources'] });
      },
   });
}

export async function deleteSource(id: string) {
   const res = await fetch(`${API_URL}/sources/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
   });
   const data = await res.json();
   if (!data.success) throw new Error(data.error);
   return data;
}

export function useDeleteSource() {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: deleteSource,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['sources'] });
      },
   });
}
