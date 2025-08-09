

interface UnreadData {
  serverId: string
  channelId: string
  count: number
  lastMessageId: string
  lastMessageTimestamp: number
  lastReadMessageId?: string
  lastReadTimestamp?: number
}

class NotificationService {
  private readonly UNREAD_KEY = 'dogicord-unread-messages'
  private listeners = new Set<() => void>()

  getUnreadData(): Record<string, UnreadData> {
    try {
      const stored = localStorage.getItem(this.UNREAD_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  private saveUnreadData(data: Record<string, UnreadData>): void {
    try {
      localStorage.setItem(this.UNREAD_KEY, JSON.stringify(data))
      this.notifyListeners()
    } catch (error) {
      console.warn('Failed to save unread data:', error)
    }
  }

  private getChannelKey(serverId: string, channelId: string): string {
    return `${serverId}-${channelId}`
  }

  addUnreadMessage(serverId: string, channelId: string, messageId: string, timestamp: number): void {
    const data = this.getUnreadData()
    const key = this.getChannelKey(serverId, channelId)
    
    if (data[key]) {
      data[key].count++
      data[key].lastMessageId = messageId
      data[key].lastMessageTimestamp = timestamp
    } else {
      data[key] = {
        serverId,
        channelId,
        count: 1,
        lastMessageId: messageId,
        lastMessageTimestamp: timestamp
      }
    }
    
    this.saveUnreadData(data)
  }

  markChannelAsRead(serverId: string, channelId: string, lastReadMessageId?: string): void {
    const data = this.getUnreadData()
    const key = this.getChannelKey(serverId, channelId)
    
    if (data[key]) {
      // If we have a specific message ID, update the read tracking
      if (lastReadMessageId) {
        data[key].lastReadMessageId = lastReadMessageId
        data[key].lastReadTimestamp = Date.now()
        data[key].count = 0 // Reset count to 0
      } else {
        // Complete removal - no unread messages
        delete data[key]
      }
      this.saveUnreadData(data)
    }
  }

  // New method to mark messages as read up to a specific message
  markMessagesAsReadUpTo(serverId: string, channelId: string, messageId: string, messageTimestamp: number): void {
    const data = this.getUnreadData()
    const key = this.getChannelKey(serverId, channelId)
    
    if (data[key]) {
      // Only mark as read if the message is newer than or equal to what we're marking as read
      if (messageTimestamp >= (data[key].lastReadTimestamp || 0)) {
        data[key].lastReadMessageId = messageId
        data[key].lastReadTimestamp = messageTimestamp
        
        // Recalculate unread count based on messages after this timestamp
        // For now, we'll just set count to 0 since the user has seen up to this message
        data[key].count = 0
        this.saveUnreadData(data)
      }
    }
  }

  // Check if a specific message should be considered unread
  isMessageUnread(serverId: string, channelId: string, _messageId: string, messageTimestamp: number, authorId: string, currentUserId?: string): boolean {
    // Don't mark own messages as unread
    if (authorId === currentUserId) {
      return false
    }

    const data = this.getUnreadData()
    const key = this.getChannelKey(serverId, channelId)
    
    if (!data[key]) {
      return false // No unread data means all messages are considered read
    }

    // If we have a last read message timestamp, compare with that
    if (data[key].lastReadTimestamp) {
      return messageTimestamp > data[key].lastReadTimestamp
    }

    // Fallback to checking if this message is after our last recorded unread
    return messageTimestamp > (data[key].lastMessageTimestamp || 0)
  }

  getUnreadCountForChannel(serverId: string, channelId: string): number {
    const data = this.getUnreadData()
    const key = this.getChannelKey(serverId, channelId)
    return data[key]?.count || 0
  }

  getUnreadCountForServer(serverId: string): number {
    const data = this.getUnreadData()
    return Object.values(data)
      .filter(unread => unread.serverId === serverId)
      .reduce((total, unread) => total + unread.count, 0)
  }

  hasUnreadInServer(serverId: string): boolean {
    return this.getUnreadCountForServer(serverId) > 0
  }

  hasUnreadInChannel(serverId: string, channelId: string): boolean {
    return this.getUnreadCountForChannel(serverId, channelId) > 0
  }

  clearAllUnread(): void {
    localStorage.removeItem(this.UNREAD_KEY)
    this.notifyListeners()
  }

  clearServerUnread(serverId: string): void {
    const data = this.getUnreadData()
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([, unread]) => unread.serverId !== serverId)
    )
    this.saveUnreadData(filtered)
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback())
  }

  cleanup(): void {
    const data = this.getUnreadData()
    const now = Date.now()
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([, unread]) => 
        now - unread.lastMessageTimestamp < ONE_WEEK
      )
    )

    if (Object.keys(filtered).length !== Object.keys(data).length) {
      this.saveUnreadData(filtered)
    }
  }
}

export const notificationService = new NotificationService()

setInterval(() => {
  notificationService.cleanup()
}, 60 * 60 * 1000)
