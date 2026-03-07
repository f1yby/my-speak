import { useAuthStore } from '../../stores/auth-store';

export function MainLayout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">My-Speak</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">欢迎, {user?.displayName || user?.username}</span>
            <button
              onClick={logout}
              className="btn-secondary text-sm"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>
      
      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">欢迎来到 My-Speak</h2>
          <p className="text-gray-400 mb-4">
            这是一个语音交流软件。功能正在开发中...
          </p>
          
          <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold mb-2">用户信息</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-400">用户名:</span> {user?.username}</p>
              <p><span className="text-gray-400">邮箱:</span> {user?.email}</p>
              <p><span className="text-gray-400">注册时间:</span> {user?.createdAt && new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-center">
              🚧 服务器和频道功能即将上线
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
