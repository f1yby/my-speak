import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">My-Speak</h1>
        <p className="text-gray-400 mb-6">语音交流软件</p>
        <button
          onClick={() => setCount((count) => count + 1)}
          className="btn-primary"
        >
          count is {count}
        </button>
        <p className="mt-4 text-sm text-gray-500">
          React + TypeScript + Vite + Tailwind CSS
        </p>
      </div>
    </div>
  )
}

export default App
