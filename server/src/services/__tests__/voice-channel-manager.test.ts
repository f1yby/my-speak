import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceChannelManager } from '../voice-channel-manager';

describe('VoiceChannelManager', () => {
  let manager: VoiceChannelManager;

  beforeEach(() => {
    manager = new VoiceChannelManager();
  });

  describe('addUser / getUser', () => {
    it('should add a user to a channel', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      const user = manager.getUser('ch1', 'socket1');
      expect(user).toEqual({
        socketId: 'socket1',
        username: 'alice',
      });
    });

    it('should return undefined for unknown user', () => {
      expect(manager.getUser('ch1', 'unknown')).toBeUndefined();
    });
  });

  describe('removeUser', () => {
    it('should remove user and return their data', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      const removed = manager.removeUser('ch1', 'socket1');
      expect(removed?.username).toBe('alice');
      expect(manager.getUser('ch1', 'socket1')).toBeUndefined();
    });

    it('should auto-delete channel when last user leaves', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      manager.removeUser('ch1', 'socket1');
      expect(manager.isChannelEmpty('ch1')).toBe(true);
    });

    it('should return undefined when removing from empty channel', () => {
      expect(manager.removeUser('ch1', 'unknown')).toBeUndefined();
    });
  });

  describe('updateUser', () => {
    it('should update user properties', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      manager.updateUser('ch1', 'socket1', { producerId: 'prod-1', sendTransportId: 'trans-1' });

      const user = manager.getUser('ch1', 'socket1');
      expect(user?.producerId).toBe('prod-1');
      expect(user?.sendTransportId).toBe('trans-1');
    });

    it('should be no-op for non-existent user', () => {
      manager.updateUser('ch1', 'unknown', { producerId: 'prod-1' });
      // No error = success
    });
  });

  describe('isChannelEmpty', () => {
    it('should return true for non-existent channel', () => {
      expect(manager.isChannelEmpty('ch1')).toBe(true);
    });

    it('should return false when channel has users', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      expect(manager.isChannelEmpty('ch1')).toBe(false);
    });
  });

  describe('getExistingProducers', () => {
    it('should return users with producers excluding given socket', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      manager.addUser('ch1', 'socket2', 'bob');
      manager.updateUser('ch1', 'socket1', { producerId: 'prod-1' });
      manager.updateUser('ch1', 'socket2', { producerId: 'prod-2' });

      const producers = manager.getExistingProducers('ch1', 'socket1');
      expect(producers).toHaveLength(1);
      expect(producers[0]).toEqual({
        socketId: 'socket2',
        username: 'bob',
        producerId: 'prod-2',
      });
    });

    it('should exclude users without producers', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      manager.addUser('ch1', 'socket2', 'bob');
      manager.updateUser('ch1', 'socket1', { producerId: 'prod-1' });

      const producers = manager.getExistingProducers('ch1', 'socket2');
      expect(producers).toHaveLength(1);
    });

    it('should return empty array for non-existent channel', () => {
      expect(manager.getExistingProducers('unknown', 'socket1')).toEqual([]);
    });
  });

  describe('ensureChannel', () => {
    it('should create channel if not exists', () => {
      const users = manager.ensureChannel('ch1');
      expect(users).toBeDefined();
      expect(users.size).toBe(0);
    });

    it('should return existing channel map', () => {
      manager.addUser('ch1', 'socket1', 'alice');
      const users = manager.ensureChannel('ch1');
      expect(users.size).toBe(1);
    });
  });
});
