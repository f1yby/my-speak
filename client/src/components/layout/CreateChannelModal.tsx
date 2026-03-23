import React, { useState } from 'react';
import { Hash, Volume2 } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  defaultType?: 'TEXT' | 'VOICE';
  onClose: () => void;
  onCreate: (name: string, type: 'TEXT' | 'VOICE') => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  defaultType = 'TEXT',
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'TEXT' | 'VOICE'>(defaultType);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), type);
    setName('');
    setType('TEXT');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96">
        <h2 className="text-lg font-semibold text-white mb-4">Create Channel</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Channel Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="TEXT"
                  checked={type === 'TEXT'}
                  onChange={() => setType('TEXT')}
                  className="mr-2"
                />
                <Hash className="w-4 h-4 mr-1" />
                Text
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="VOICE"
                  checked={type === 'VOICE'}
                  onChange={() => setType('VOICE')}
                  className="mr-2"
                />
                <Volume2 className="w-4 h-4 mr-1" />
                Voice
              </label>
            </div>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white mb-4 focus:outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary px-4 py-2"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
