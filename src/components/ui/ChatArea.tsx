import { useState, useRef, useEffect } from 'react'
import type { Message } from '../../services/messageService'

interface ChatAreaProps {
  channelName: string
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
}

export default function ChatArea({ channelName, messages, onSendMessage }: ChatAreaProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    <div className="flex-1 flex flex-col bg-gray-700">
      <div className="h-12 border-b border-gray-600 flex items-center px-4">
        <span className="text-gray-400 mr-2">#</span>
        <h3 className="text-white font-semibold">{channelName}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">#</span>
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">Welcome to #{channelName}!</h4>
              <p className="text-gray-400">This is the start of the #{channelName} channel.</p>
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
                    <div className="flex items-center my-6">
                      <div className="flex-1 h-px bg-gray-600"></div>
                      <span className="px-4 text-xs text-gray-400 bg-gray-700">
                        {formatDate(msg.timestamp)}
                      </span>
                      <div className="flex-1 h-px bg-gray-600"></div>
                    </div>
                  )}
                  
                  <div className="flex space-x-3 hover:bg-gray-800/30 px-2 py-1.5 rounded group">
                    <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">
                        {msg.authorName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2">
                        <span className="font-medium text-white">{msg.authorName}</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-300">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-200 break-words mt-0.5 leading-relaxed">
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

      <div className="p-4">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message #${channelName}`}
              disabled={sending}
              className="w-full px-4 py-3 pr-12 bg-gray-600 border-none rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-700 disabled:cursor-not-allowed"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={!message.trim() || sending}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-white disabled:text-gray-500 transition-colors"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {message.length}/2000
          </div>
        </form>
      </div>
    </div>
  )
}