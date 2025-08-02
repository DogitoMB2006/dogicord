// src/components/chat/MessageEditor.tsx
import { useState, useRef, useEffect } from 'react'

interface MessageEditorProps {
  initialContent: string
  onSave: (newContent: string) => Promise<void>
  onCancel: () => void
  isMobile: boolean
}

export default function MessageEditor({ initialContent, onSave, onCancel, isMobile }: MessageEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(content.length, content.length)
      
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  const handleSave = async () => {
    if (content.trim() === '') {
      alert('Message cannot be empty')
      return
    }

    if (content.trim() === initialContent.trim()) {
      onCancel()
      return
    }

    setSaving(true)
    try {
      await onSave(content.trim())
    } catch (error) {
      console.error('Failed to save message:', error)
      alert('Failed to save message')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={`w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed resize-none ${
            isMobile ? 'text-sm' : 'text-base'
          }`}
          placeholder="Edit your message..."
          maxLength={2000}
          style={{ minHeight: '40px', maxHeight: '200px' }}
        />
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
          {content.length}/2000 • Press Enter to save, Esc to cancel
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className={`px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded transition-colors ${
              isMobile ? 'text-xs' : 'text-sm'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || content.trim() === ''}
            className={`px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center space-x-1 ${
              isMobile ? 'text-xs' : 'text-sm'
            }`}
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}