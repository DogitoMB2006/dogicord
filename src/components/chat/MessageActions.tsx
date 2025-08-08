import { useState, useRef, useEffect } from 'react'

interface MessageActionsProps {
  isOwnMessage: boolean
  canManageMessages: boolean
  onEdit: () => void
  onDelete: () => void
  isMobile: boolean
}

export default function MessageActions({ 
  isOwnMessage, 
  canManageMessages, 
  onEdit, 
  onDelete,
  isMobile 
}: MessageActionsProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleEdit = () => {
    onEdit()
    setShowMenu(false)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this message?')) {
      onDelete()
      setShowMenu(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`p-1 text-gray-400 hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-95 ${
          showMenu || isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } ${isMobile ? 'mobile-button mobile-touch-feedback' : ''}`}
      >
        <svg className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {showMenu && (
        <div className={`absolute ${isMobile ? 'right-0 top-8' : 'right-0 top-6'} bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 py-1 min-w-32 transform transition-all duration-200 animate-in slide-in-from-top-2 ${isMobile ? 'mobile-dark-bg mobile-rounded' : ''}`}>
          {isOwnMessage && (
            <>
              <button
                onClick={handleEdit}
                className={`w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-800 transition-all duration-200 flex items-center space-x-2 transform hover:scale-105 active:scale-95 ${
                  isMobile ? 'text-sm' : 'text-sm'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit</span>
              </button>
              <button
                onClick={handleDelete}
                className={`w-full px-3 py-2 text-left text-red-400 hover:bg-red-900/30 transition-all duration-200 flex items-center space-x-2 transform hover:scale-105 active:scale-95 ${
                  isMobile ? 'text-sm' : 'text-sm'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
            </>
          )}
          
          {!isOwnMessage && canManageMessages && (
            <button
              onClick={handleDelete}
              className={`w-full px-3 py-2 text-left text-red-400 hover:bg-red-900/30 transition-all duration-200 flex items-center space-x-2 transform hover:scale-105 active:scale-95 ${
                isMobile ? 'text-sm' : 'text-sm'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Message</span>
            </button>
          )}

          {!isOwnMessage && !canManageMessages && (
            <div className={`px-3 py-2 text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
              No actions available
            </div>
          )}
        </div>
      )}
    </div>
  )
}