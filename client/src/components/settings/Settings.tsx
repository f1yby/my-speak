import React from 'react';
import { X, Volume2 } from 'lucide-react';
import { AudioSettings } from './AudioSettings';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-white font-medium">Audio Settings</h3>
          </div>

          <AudioSettings />
        </div>
      </div>
    </div>
  );
};