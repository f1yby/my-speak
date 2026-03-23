export interface VoiceUser {
  socketId: string;
  username: string;
  sendTransportId?: string;
  recvTransportId?: string;
  producerId?: string;
}

export class VoiceChannelManager {
  private channels = new Map<string, Map<string, VoiceUser>>();

  getUsers(channelId: string): Map<string, VoiceUser> | undefined {
    return this.channels.get(channelId);
  }

  ensureChannel(channelId: string): Map<string, VoiceUser> {
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Map());
    }
    return this.channels.get(channelId)!;
  }

  addUser(channelId: string, socketId: string, username: string): void {
    const users = this.ensureChannel(channelId);
    users.set(socketId, { socketId, username });
  }

  removeUser(channelId: string, socketId: string): VoiceUser | undefined {
    const users = this.channels.get(channelId);
    if (!users) return undefined;

    const user = users.get(socketId);
    if (user) {
      users.delete(socketId);
      if (users.size === 0) {
        this.channels.delete(channelId);
      }
    }
    return user;
  }

  getUser(channelId: string, socketId: string): VoiceUser | undefined {
    return this.channels.get(channelId)?.get(socketId);
  }

  updateUser(channelId: string, socketId: string, update: Partial<VoiceUser>): void {
    const user = this.getUser(channelId, socketId);
    if (user) {
      Object.assign(user, update);
    }
  }

  isChannelEmpty(channelId: string): boolean {
    const users = this.channels.get(channelId);
    return !users || users.size === 0;
  }

  getExistingProducers(channelId: string, excludeSocketId: string): Array<{
    socketId: string;
    username: string;
    producerId: string;
  }> {
    const users = this.channels.get(channelId);
    if (!users) return [];

    return Array.from(users.values())
      .filter(u => u.socketId !== excludeSocketId && u.producerId)
      .map(u => ({
        socketId: u.socketId,
        username: u.username,
        producerId: u.producerId!,
      }));
  }
}
