import { useState, useEffect } from 'react'
import type { Message } from '../../services/messageService'
import { serverService } from '../../services/serverService'
import type { Role } from '../../types/permissions'
import MessageActions from './MessageActions'
import MessageEditor from './MessageEditor'
import { Reply } from 'lucide-react'

interface MessageItemProps {
  message: Message
  currentUserId: string
  canManageMessages: boolean
  onEditMessage: (messageId: string, newContent: string) => Promise<void>
  onDeleteMessage: (messageId: string) => Promise<void>
  onUserClick?: (userId: string) => void
  onReply?: (message: Message) => void
  isMobile: boolean
  serverId?: string
}

export default function MessageItem({
  message,
  currentUserId,
  canManageMessages,
  onEditMessage,
  onDeleteMessage,
  onUserClick,
  onReply,
  isMobile,
  serverId
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userRoleColor, setUserRoleColor] = useState('#ffffff')
  const [showActions, setShowActions] = useState(false)
  const [showReplyButton, setShowReplyButton] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)

  const isOwnMessage = message.authorId === currentUserId
  const isOptimistic = message.id.startsWith('temp-')
  
  const isGifUrl = (url: string): boolean => {
    return url.includes('tenor.com') || url.includes('.gif') || url.match(/\.(gif|webp)(\?|$)/i) !== null
  }

  useEffect(() => {
    const loadUserRoleColor = async () => {
      try {
        const messageServerId = serverId || message.serverId
        if (!messageServerId) return

        const userRoles = await serverService.getUserRoles(messageServerId, message.authorId)
        const highestRole = getHighestRole(userRoles)
        setUserRoleColor(highestRole.color)
      } catch (error) {
        console.error('Failed to load user role color:', error)
      }
    }

    loadUserRoleColor()
  }, [serverId, message.serverId, message.authorId])

  const getHighestRole = (roles: Role[]): Role => {
    const nonEveryoneRoles = roles.filter(role => role.name !== '@everyone')
    if (nonEveryoneRoles.length === 0) {
      return roles.find(role => role.name === '@everyone') || { 
        id: 'default', 
        name: 'Member', 
        color: '#99AAB5', 
        permissions: [], 
        position: 0, 
        mentionable: false, 
        createdAt: new Date() 
      }
    }
    
    return nonEveryoneRoles.reduce((highest, current) => 
      current.position > highest.position ? current : highest
    )
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

  const handleLongPressStart = () => {
    if (isMobile && onReply) {
      const timer = setTimeout(() => {
        setShowReplyButton(true)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }, 500) 
      setLongPressTimer(timer)
    }
  }

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const handleReply = () => {
    if (onReply) {
      onReply(message)
      setShowReplyButton(false)
    }
  }

  const handleTouchStart = () => {
    handleLongPressStart()
  }

  const handleTouchEnd = () => {
    handleLongPressEnd()
  }

  const handleMouseDown = () => {
    if (!isMobile) {
      handleLongPressStart()
    }
  }

  const handleMouseUp = () => {
    if (!isMobile) {
      handleLongPressEnd()
    }
  }

  const truncateContent = (content: string, maxLength: number = 50): string => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  if (isDeleting) {
    return (
      <div className={`flex space-x-2 md:space-x-3 px-1 md:px-2 py-2 md:py-1.5 rounded opacity-50 transition-all duration-300 animate-pulse`}>
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
    <div>
      {message.replyTo && (
        <div className="ml-8 md:ml-12 mb-1 pl-3 border-l-2 border-gray-600">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Reply className="w-3 h-3" />
            <span>@{message.replyTo.authorName}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {isGifUrl(message.replyTo.content) ? (
              <span className="italic">GIF</span>
            ) : (
              <span>{truncateContent(message.replyTo.content)}</span>
            )}
          </div>
        </div>
      )}

      <div 
        className={`flex space-x-2 md:space-x-3 hover:bg-gray-800/30 px-1 md:px-2 py-2 md:py-1.5 rounded group transition-all duration-200 relative ${
          isOptimistic ? 'opacity-70 mobile-message-optimistic' : 'mobile-message-enter'
        } ${isOwnMessage ? 'hover:bg-blue-900/20' : ''} ${isMobile ? 'mobile-performance' : ''}`}
        onMouseEnter={() => {
          setShowActions(true)
          if (!isMobile && onReply) {
            setShowReplyButton(true)
          }
        }}
        onMouseLeave={() => {
          setShowActions(false)
          if (!isMobile) {
            setShowReplyButton(false)
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div 
          onClick={() => onUserClick && onUserClick(message.authorId)}
          className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 transition-all duration-200 transform hover:scale-105 ${isMobile ? 'mobile-touch-target mobile-touch-feedback' : ''}`}
          style={{ '--tw-ring-color': userRoleColor } as React.CSSProperties}
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
              className={`font-medium cursor-pointer hover:underline transition-colors duration-200 ${isMobile ? 'text-sm' : 'text-base'}`}
              style={{ color: userRoleColor }}
            >
              {message.authorName}
            </span>
            <span className={`text-gray-400 group-hover:text-gray-300 transition-colors duration-200 ${isMobile ? 'text-xs' : 'text-xs'}`}>
              {formatTime(message.timestamp)}
              {message.edited && (
                <span className="ml-1 text-xs text-gray-500">(edited)</span>
              )}
            </span>
            
            {!isEditing && (
              <div className="ml-auto flex items-center space-x-1">
                {onReply && showReplyButton && (
                  <button
                    onClick={handleReply}
                    className={`p-1 text-gray-400 hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                      isMobile ? 'mobile-button mobile-touch-feedback' : ''
                    }`}
                    title="Reply"
                  >
                    <Reply className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
                  </button>
                )}
                
                {(isOwnMessage || canManageMessages) && (
                  <div className={`transition-all duration-200 ${showActions || isMobile ? 'opacity-100' : 'opacity-0'}`}>
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
            )}
          </div>

          <div className={`mt-0.5 ${isMobile ? 'text-sm' : 'text-base'}`}>
            {isEditing ? (
              <div className="transition-all duration-200">
                <MessageEditor
                  initialContent={message.content}
                  onSave={handleEdit}
                  onCancel={() => setIsEditing(false)}
                  isMobile={isMobile}
                />
              </div>
            ) : (
              <div className="text-gray-200 break-words leading-relaxed transition-all duration-200">
                {isGifUrl(message.content) ? (
                  <div className="transition-all duration-200 transform hover:scale-105">
                    <img
                      src={message.content}
                      alt="GIF"
                      className={`${isMobile ? 'max-w-48 max-h-32' : 'max-w-xs max-h-48'} rounded-lg shadow-lg`}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <span className="select-text">{message.content}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}