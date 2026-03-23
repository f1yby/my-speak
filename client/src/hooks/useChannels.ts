import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelApi, type Channel, type CreateChannelInput } from '../services/channel-api';

export function useChannels() {
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ['channels'],
    queryFn: channelApi.getChannels,
  });

  const createChannelMutation = useMutation({
    mutationFn: (input: CreateChannelInput) => channelApi.createChannel(input),
    onSuccess: (newChannel) => {
      queryClient.setQueryData<Channel[]>(['channels'], (old) =>
        old ? [...old, newChannel] : [newChannel]
      );
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: string) => channelApi.deleteChannel(channelId),
    onSuccess: (_, channelId) => {
      queryClient.setQueryData<Channel[]>(['channels'], (old) =>
        old ? old.filter((c) => c.id !== channelId) : []
      );
    },
  });

  const textChannels = (channelsQuery.data ?? []).filter((c) => c.type === 'TEXT');
  const voiceChannels = (channelsQuery.data ?? []).filter((c) => c.type === 'VOICE');

  return {
    channels: channelsQuery.data ?? [],
    textChannels,
    voiceChannels,
    isLoading: channelsQuery.isLoading,
    error: channelsQuery.error,
    createChannel: createChannelMutation.mutateAsync,
    deleteChannel: deleteChannelMutation.mutateAsync,
    isCreating: createChannelMutation.isPending,
    isDeleting: deleteChannelMutation.isPending,
  };
}
