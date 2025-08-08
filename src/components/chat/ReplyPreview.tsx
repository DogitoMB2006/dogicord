import { X } from 'lucide-react'
import type { Message } from '../../services/messageService'

interface ReplyPreviewProps {
  replyToMessage: Message
  onCancel: () => void
  isMobile: boolean
}

export default function ReplyPreview({ replyToMessage, onCancel, isMobile }: ReplyPreviewProps) {
  const isGifUrl = (url: string): boolean => {
    return url.includes('tenor.com') || url.includes('.gif') || url.match(/\.(gif|webp)(\?|$)/i) !== null
  }

  const truncateContent = (content: string, maxLength: number = 100): string => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <div className={`bg-gray-600/50 border-l-4 border-blue-500 p-3 mx-3 mb-2 rounded-r-lg ${isMobile ? 'mobile-rounded-sm' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <svg className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className={`text-blue-400 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Replying to {replyToMessage.authorName}
            </span>
          </div>
          <div className={`text-gray-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isGifUrl(replyToMessage.content) ? (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="italic">GIF</span>
              </div>
            ) : (
              <span>{truncateContent(replyToMessage.content)}</span>
            )}
          </div>
        </div>
        <button
          onClick={onCancel}
          className={`p-1 text-gray-400 hover:text-white transition-colors duration-200 flex-shrink-0 ml-2 ${isMobile ? 'mobile-touch-target' : ''}`}
        >
          <X className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
        </button>
      </div>
    </div>
  )
}
