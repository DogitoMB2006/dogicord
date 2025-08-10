import { useEffect, useState } from 'react'
import dogicordLogo from '/dogicordlogo.png'

interface LoadingScreenProps {
  isExiting: boolean
}

export default function LoadingScreen({ isExiting }: LoadingScreenProps) {
  const [rotationCount, setRotationCount] = useState(0)

  useEffect(() => {
    const rotationTimer = setInterval(() => {
      setRotationCount(prev => prev + 1)
    }, 800)

    return () => {
      clearInterval(rotationTimer)
    }
  }, [])

  return (
    <div className={`fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center z-50 transition-all duration-1000 ease-in-out ${
      isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
    }`}>
      <div className="relative">
        <div 
          className="w-32 h-32 mb-8"
          style={{
            transform: `rotate(${rotationCount * 360}deg)`,
            transition: 'transform 0.8s ease-in-out'
          }}
        >
          <img 
            src={dogicordLogo} 
            alt="DOGICORD" 
            className="w-full h-full object-contain drop-shadow-2xl animate-gentle-pulse"
          />
        </div>
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wider animate-gentle-pulse">
            DOGICORD
          </h1>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-gentle-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-gentle-bounce" style={{ animationDelay: '200ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-gentle-bounce" style={{ animationDelay: '400ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
