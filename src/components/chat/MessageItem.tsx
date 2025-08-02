// src/components/chat/MessageItem.tsx
import { useState } from 'react'
import type { Message } from '../../services/messageService'
import MessageActions from './MessageActions'
import MessageEditor from './MessageEditor'

interface MessageItemProps {
  message: Message
  currentUserId: string
  canManageMessages: boolean
  onEditMessage: (messageId: string, newContent: string) => Promise<void>
  onDeleteMessage: (messageId: string) => Promise<void>
  onUserClick?: (userId: string) => void
  isMobile: boolean
}

export default function MessageItem({
  message,
  currentUserId,
  canManageMessages,
  onEditMessage,
  onDeleteMessage,
  onUserClick,
  isMobile
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwnMessage = message.authorId === currentUserId
  const isGifUrl = (url: string): boolean => {
    return url.includes('tenor.com') || url.includes('.gif') || url.match(/\.(gif|webp)(\?|$)/i) !== null
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const handleEdit = async (newContent: string) => {
    try {
      await onEditMessage(message.id, newContent)
      setIsEditing(false)
    } catch (error) {
      throw error
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDeleteMessage(message.id)
    } catch (error) {
      console.error('Failed to delete message:', error)
      setIsDeleting(false)
    }
  }

  if (isDeleting) {
    return (
      <div className={`flex space-x-2 md:space-x-3 px-1 md:px-2 py-2 md:py-1.5 rounded opacity-50`}>
        <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0`}>
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-gray-500 italic">Deleting message...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex space-x-2 md:space-x-3 hover:bg-gray-800/30 px-1 md:px-2 py-2 md:py-1.5 rounded group`}>
      <div 
        onClick={() => onUserClick && onUserClick(message.authorId)}
        className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-slate-500 transition-all`}
      >
        {message.authorAvatarUrl ? (
          <img
            src={message.authorAvatarUrl}
            alt={message.authorName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`text-white font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {message.authorName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline space-x-2">
          <span 
            onClick={() => onUserClick && onUserClick(message.authorId)}
            className={`font-medium text-white cursor-pointer hover:underline ${isMobile ? 'text-sm' : 'text-base'}`}
          >
            {message.authorName}
          </span>
          <span className={`text-gray-400 group-hover:text-gray-300 ${isMobile ? 'text-xs' : 'text-xs'}`}>
            {formatTime(message.timestamp)}
            {message.edited && (
              <span className="ml-1 text-xs text-gray-500">(edited)</span>
            )}
          </span>
          
          {!isEditing && (isOwnMessage || canManageMessages) && (
            <div className="ml-auto">
              <MessageActions
                isOwnMessage={isOwnMessage}
                canManageMessages={canManageMessages}
                onEdit={() => setIsEditing(true)}
                onDelete={handleDelete}
                isMobile={isMobile}
              />
            </div>
          )}
        </div>

        <div className={`mt-0.5 ${isMobile ? 'text-sm' : 'text-base'}`}>
          {isEditing ? (
            <MessageEditor
              initialContent={message.content}
              onSave={handleEdit}
              onCancel={() => setIsEditing(false)}
              isMobile={isMobile}
            />
          ) : (
            <div className="text-gray-200 break-words leading-relaxed">
              {isGifUrl(message.content) ? (
                <img
                  src={message.content}
                  alt="GIF"
                  className={`${isMobile ? 'max-w-48 max-h-32' : 'max-w-xs max-h-48'} rounded-lg`}
                  loading="lazy"
                />
              ) : (
                message.content
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}