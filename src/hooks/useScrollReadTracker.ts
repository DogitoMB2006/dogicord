import { useEffect, useRef, useCallback } from 'react'
import { notificationService } from '../services/notificationService'

interface UseScrollReadTrackerOptions {
  serverId: string
  channelId: string
  messages: any[]
  currentUserId?: string
  containerRef: React.RefObject<HTMLDivElement>
}

export const useScrollReadTracker = ({
  serverId,
  channelId,
  messages,
  currentUserId,
  containerRef
}: UseScrollReadTrackerOptions) => {
  const lastScrollTimestamp = useRef<number>(0)
  const scrollThrottleRef = useRef<NodeJS.Timeout | null>(null)

  const handleScrollReadUpdate = useCallback(() => {
    if (!containerRef.current || !serverId || !channelId || messages.length === 0) {
      return
    }

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight

    // Calculate how much of the content has been scrolled
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // If user has scrolled to at least 80% of the content, mark messages as read
    if (scrollPercentage >= 0.8) {
      // Find the latest visible message
      const visibleMessages = messages.filter(msg => {
        if (msg.authorId === currentUserId) return false // Don't count own messages
        
        // Simple heuristic: if we're scrolled 80% down, the user has likely seen most messages
        return true
      })

      if (visibleMessages.length > 0) {
        const latestVisibleMessage = visibleMessages[visibleMessages.length - 1]
        
        // Mark messages as read up to this point
        notificationService.markMessagesAsReadUpTo(
          serverId,
          channelId,
          latestVisibleMessage.id,
          latestVisibleMessage.timestamp?.getTime() || Date.now()
        )

        // Also update localStorage
        const lastReadKey = `last-read-${serverId}-${channelId}`
        localStorage.setItem(lastReadKey, latestVisibleMessage.id)

        console.log(`📖 Marked messages as read via scroll (up to ${latestVisibleMessage.id})`)
      }
    }
  }, [serverId, channelId, messages, currentUserId, containerRef])

  // Throttled scroll handler
  const handleScroll = useCallback(() => {
    const now = Date.now()
    
    // Throttle scroll events to avoid too frequent updates
    if (now - lastScrollTimestamp.current < 500) { // 500ms throttle
      return
    }

    lastScrollTimestamp.current = now

    // Clear existing timeout
    if (scrollThrottleRef.current) {
      clearTimeout(scrollThrottleRef.current)
    }

    // Debounce the actual scroll handling
    scrollThrottleRef.current = setTimeout(() => {
      handleScrollReadUpdate()
    }, 300) // 300ms debounce
  }, [handleScrollReadUpdate])

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current
    if (!container || !serverId || !channelId) {
      return
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollThrottleRef.current) {
        clearTimeout(scrollThrottleRef.current)
      }
    }
  }, [handleScroll, serverId, channelId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollThrottleRef.current) {
        clearTimeout(scrollThrottleRef.current)
      }
    }
  }, [])
}
