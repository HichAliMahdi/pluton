import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../utils/constants';

export type AgentRow = {
   id: string;
   name: string;
   hostname: string;
   platform: string;
   arch: string;
   osVersion: string;
   agentVersion: string;
   status: 'online' | 'offline';
   lastSeenAt: number;
   registeredAt: number;
};

export async function getAgents() {
   const res = await fetch(`${API_URL}/agents`, {
      method: 'GET',
      credentials: 'include',
   });
   const data = await res.json();
   if (!data.success) {
      throw new Error(data.error || 'Failed to load agents');
   }
   return data;
}

export function useGetAgents() {
   return useQuery({
      queryKey: ['agents'],
      queryFn: getAgents,
      refetchOnMount: true,
      retry: false,
   });
}

export async function approvePairingCode(pairingCode: string) {
   const res = await fetch(`${API_URL}/agents/pairing/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: {
         'Content-Type': 'application/json',
         Accept: 'application/json',
      },
      body: JSON.stringify({ pairingCode }),
   });
   const data = await res.json();
   if (!data.success) {
      throw new Error(data.error || 'Failed to approve pairing code');
   }
   return data;
}

export function useApprovePairingCode() {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: approvePairingCode,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['agents'] });
      },
   });
}

export async function downloadAgentInstaller(platform: 'windows' | 'linux') {
   const res = await fetch(`${API_URL}/agents/installers/${platform}`, {
      method: 'GET',
      credentials: 'include',
   });

   if (!res.ok) {
      let errorText = 'Failed to download installer';
      try {
         const data = await res.json();
         errorText = data.error || errorText;
      } catch {
         // ignore parse errors
      }
      throw new Error(errorText);
   }

   const blob = await res.blob();
   const disposition = res.headers.get('content-disposition') || '';
   const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
   const filename = match?.[1] || (platform === 'windows' ? 'pluton-agent.exe' : 'pluton-agent.deb');

   const blobUrl = window.URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = blobUrl;
   a.download = filename;
   document.body.appendChild(a);
   a.click();
   a.remove();
   window.URL.revokeObjectURL(blobUrl);
}

export function useDownloadAgentInstaller() {
   return useMutation({
      mutationFn: downloadAgentInstaller,
   });
}
