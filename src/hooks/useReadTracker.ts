import { useEffect, useRef, useCallback } from 'react'
import { notificationService } from '../services/notificationService'

interface UseReadTrackerOptions {
  serverId: string
  channelId: string
  isActive?: boolean
  messages?: any[]
  currentUserId?: string
}

export const useReadTracker = ({
  serverId,
  channelId,
  isActive = true,
  messages = []
}: UseReadTrackerOptions) => {
  const readTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActiveTimeRef = useRef<number>(Date.now())
  const isPageVisibleRef = useRef<boolean>(true)
  const hasMarkedAsReadRef = useRef<boolean>(false)

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden
      
      if (isPageVisibleRef.current) {
        lastActiveTimeRef.current = Date.now()
        // When page becomes visible again, check if we should mark as read
        if (isActive && serverId && channelId && !hasMarkedAsReadRef.current) {
          scheduleMarkAsRead()
        }
      } else {
        // When page becomes hidden, cancel any pending read marking
        if (readTimeoutRef.current) {
          clearTimeout(readTimeoutRef.current)
          readTimeoutRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isActive, serverId, channelId])

  // Track user activity (mouse movement, keyboard, scroll)
  useEffect(() => {
    const updateActivity = () => {
      lastActiveTimeRef.current = Date.now()
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
    }
  }, [])

  const scheduleMarkAsRead = useCallback(() => {
    // Clear any existing timeout
    if (readTimeoutRef.current) {
      clearTimeout(readTimeoutRef.current)
      readTimeoutRef.current = null
    }

    // Only mark as read if:
    // 1. Channel is active
    // 2. Page is visible
    // 3. User has been active recently (within last 30 seconds)
    // 4. There are unread messages
    const shouldMarkAsRead = 
      isActive && 
      isPageVisibleRef.current && 
      serverId && 
      channelId &&
      (Date.now() - lastActiveTimeRef.current < 30000) && // User active in last 30 seconds
      notificationService.hasUnreadInChannel(serverId, channelId)

    if (!shouldMarkAsRead) {
      return
    }

    // Schedule marking as read after 2 seconds of viewing
    readTimeoutRef.current = setTimeout(() => {
      // Double-check conditions before marking as read
      if (
        isActive && 
        isPageVisibleRef.current && 
        serverId && 
        channelId &&
        notificationService.hasUnreadInChannel(serverId, channelId)
      ) {
        console.log(`📖 Marking channel ${channelId} as read after viewing`)
        
        // Store last read message if we have messages
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1]
          const lastReadKey = `last-read-${serverId}-${channelId}`
          localStorage.setItem(lastReadKey, lastMessage.id)
          
          // Mark as read with the specific message ID and timestamp
          notificationService.markMessagesAsReadUpTo(
            serverId, 
            channelId, 
            lastMessage.id, 
            lastMessage.timestamp?.getTime() || Date.now()
          )
        } else {
          // No messages, just mark channel as completely read
          notificationService.markChannelAsRead(serverId, channelId)
        }
        
        hasMarkedAsReadRef.current = true
      }
      readTimeoutRef.current = null
    }, 2000) // 2 seconds delay
  }, [isActive, serverId, channelId, messages])

  // Mark as read when channel becomes active or when new messages arrive
  useEffect(() => {
    if (isActive && serverId && channelId) {
      hasMarkedAsReadRef.current = false
      scheduleMarkAsRead()
    } else {
      // Clear timeout when channel becomes inactive
      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current)
        readTimeoutRef.current = null
      }
      hasMarkedAsReadRef.current = false
    }

    return () => {
      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current)
        readTimeoutRef.current = null
      }
    }
  }, [isActive, serverId, channelId, scheduleMarkAsRead])

  // Re-schedule when messages change (new messages arrive)
  useEffect(() => {
    if (isActive && serverId && channelId && messages.length > 0) {
      hasMarkedAsReadRef.current = false
      scheduleMarkAsRead()
    }
  }, [messages.length, isActive, serverId, channelId, scheduleMarkAsRead])

  // Manual mark as read function
  const markAsReadNow = useCallback(() => {
    if (serverId && channelId) {
      console.log(`📖 Manually marking channel ${channelId} as read`)
      
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        const lastReadKey = `last-read-${serverId}-${channelId}`
        localStorage.setItem(lastReadKey, lastMessage.id)
        
        // Mark as read with the specific message ID and timestamp
        notificationService.markMessagesAsReadUpTo(
          serverId, 
          channelId, 
          lastMessage.id, 
          lastMessage.timestamp?.getTime() || Date.now()
        )
      } else {
        // No messages, just mark channel as completely read
        notificationService.markChannelAsRead(serverId, channelId)
      }
      
      hasMarkedAsReadRef.current = true
    }
  }, [serverId, channelId, messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current)
      }
    }
  }, [])

  return {
    markAsReadNow,
    isPageVisible: isPageVisibleRef.current
  }
}
