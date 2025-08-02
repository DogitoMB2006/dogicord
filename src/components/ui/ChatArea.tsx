import { useState, useRef, useEffect } from 'react'
import type { Message } from '../../services/messageService'

interface ChatAreaProps {
  channelName: string
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
  isMobile: boolean
  onBackToChannels?: () => void
  serverName: string
  onShowMobileNav?: () => void
  onHideMobileNav?: () => void
  onToggleMemberList?: () => void
  onUserClick?: (userId: string) => void
}

export default function ChatArea({ 
  channelName, 
  messages, 
  onSendMessage, 
  isMobile, 
  onBackToChannels,
  serverName,
  onShowMobileNav,
  onHideMobileNav,
  onToggleMemberList,
  onUserClick
}: ChatAreaProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isScrolledUp])

  useEffect(() => {
    if (isMobile && onHideMobileNav) {
      onHideMobileNav()
    }
  }, [isMobile, onHideMobileNav])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50
    setIsScrolledUp(!isAtBottom)
    
    if (isMobile && onShowMobileNav && !isAtBottom) {
      onShowMobileNav()
    } else if (isMobile && onHideMobileNav && isAtBottom) {
      onHideMobileNav()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !sending) {
      setSending(true)
      try {
        await onSendMessage(message.trim())
        setMessage('')
      } catch (error) {
        console.error('Failed to send message:', error)
      } finally {
        setSending(false)
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const messageDate = new Date(date)
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today'
    }
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    })
  }

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage?: Message) => {
    if (!previousMessage) return true
    
    const currentDate = new Date(currentMessage.timestamp).toDateString()
    const previousDate = new Date(previousMessage.timestamp).toDateString()
    
    return currentDate !== previousDate
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-700 h-full relative">
      <div className={`${isMobile ? 'h-14 fixed top-0 left-0 right-0 z-30' : 'h-12'} border-b border-gray-600 flex items-center justify-between px-4 bg-gray-700 relative`}>
        <div className="flex items-center">
          {isMobile && onBackToChannels && (
            <button
              onClick={() => {
                onBackToChannels()
                if (onShowMobileNav) onShowMobileNav()
              }}
              className="mr-3 p-1 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="text-gray-400 mr-2">#</span>
              <h3 className={`text-white font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>{channelName}</h3>
            </div>
            {isMobile && (
              <span className="text-xs text-gray-400">{serverName}</span>
            )}
          </div>
        </div>
        
        <button
          onClick={onToggleMemberList}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </button>
      </div>

      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-2 md:px-4 py-2 md:py-4 ${isMobile ? 'pb-20 pt-16' : ''}`}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <span className={`${isMobile ? 'text-lg' : 'text-2xl'}`}>#</span>
              </div>
              <h4 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-white mb-2`}>Welcome to #{channelName}!</h4>
              <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>This is the start of the #{channelName} channel.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, index) => {
              const previousMessage = index > 0 ? messages[index - 1] : undefined
              const showDateSeparator = shouldShowDateSeparator(msg, previousMessage)
              
              return (
                <div key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex items-center my-4 md:my-6">
                      <div className="flex-1 h-px bg-gray-600"></div>
                      <span className={`px-4 text-xs text-gray-400 bg-gray-700 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                        {formatDate(msg.timestamp)}
                      </span>
                      <div className="flex-1 h-px bg-gray-600"></div>
                    </div>
                  )}
                  
                  <div className={`flex space-x-2 md:space-x-3 hover:bg-gray-800/30 px-1 md:px-2 py-2 md:py-1.5 rounded group`}>
                    <div 
                      onClick={() => onUserClick && onUserClick(msg.authorId)}
                      className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-slate-500 transition-all`}
                    >
                      {msg.authorAvatarUrl ? (
                        <img
                          src={msg.authorAvatarUrl}
                          alt={msg.authorName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className={`text-white font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {msg.authorName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2">
                        <span 
                          onClick={() => onUserClick && onUserClick(msg.authorId)}
                          className={`font-medium text-white cursor-pointer hover:underline ${isMobile ? 'text-sm' : 'text-base'}`}
                        >
                          {msg.authorName}
                        </span>
                        <span className={`text-gray-400 group-hover:text-gray-300 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className={`text-gray-200 break-words mt-0.5 leading-relaxed ${isMobile ? 'text-sm' : 'text-base'}`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`${isMobile ? 'fixed bottom-0 left-0 right-0 bg-gray-700 border-t border-gray-600 z-20' : ''} p-2 md:p-4 ${isMobile ? 'pb-4' : ''}`}>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message #${channelName}`}
              disabled={sending}
              className={`w-full px-3 md:px-4 py-2 md:py-3 pr-10 md:pr-12 bg-gray-600 border-none rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-700 disabled:cursor-not-allowed ${isMobile ? 'text-sm' : 'text-base'}`}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={!message.trim() || sending}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 md:p-2 text-gray-400 hover:text-white disabled:text-gray-500 transition-colors`}
            >
              {sending ? (
                <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} border-2 border-gray-400 border-t-transparent rounded-full animate-spin`}></div>
              ) : (
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <div className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>
            {message.length}/2000
          </div>
        </form>
      </div>
    </div>
  )
}