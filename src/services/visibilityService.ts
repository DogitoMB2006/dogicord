class VisibilityService {
  private listeners = new Set<(visible: boolean) => void>()
  private isVisible = !document.hidden
  private isFocused = document.hasFocus()

  constructor() {
    this.setupListeners()
    
    // Debug function
    ;(window as any).getVisibilityStatus = () => this.getStatus()
  }

  private setupListeners(): void {
    // Page visibility change (minimize/restore, tab switch)
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isVisible
      this.isVisible = !document.hidden
      
      console.log('👁️ Visibility changed:', { 
        from: wasVisible ? 'visible' : 'hidden',
        to: this.isVisible ? 'visible' : 'hidden',
        hidden: document.hidden
      })
      
      this.notifyListeners()
    })

    // Window focus/blur (clicking outside window, alt+tab)
    window.addEventListener('focus', () => {
      const wasFocused = this.isFocused
      this.isFocused = true
      
      console.log('🎯 Window focused:', { wasFocused, nowFocused: true })
      this.notifyListeners()
    })

    window.addEventListener('blur', () => {
      const wasFocused = this.isFocused
      this.isFocused = false
      
      console.log('🎯 Window blurred:', { wasFocused, nowFocused: false })
      this.notifyListeners()
    })

    // Additional page lifecycle events
    document.addEventListener('freeze', () => {
      console.log('🧊 Page frozen (mobile background)')
      this.notifyListeners()
    })

    document.addEventListener('resume', () => {
      console.log('▶️ Page resumed (mobile foreground)')
      this.notifyListeners()
    })

    // Page hide/show (mobile app switching)
    window.addEventListener('pagehide', () => {
      console.log('👋 Page hidden (mobile)')
      this.notifyListeners()
    })

    window.addEventListener('pageshow', () => {
      console.log('👋 Page shown (mobile)')
      this.notifyListeners()
    })
  }

  private notifyListeners(): void {
    const isFullyVisible = this.isPageFullyVisible()
    this.listeners.forEach(listener => {
      try {
        listener(isFullyVisible)
      } catch (error) {
        console.error('Error in visibility listener:', error)
      }
    })
  }

  isPageFullyVisible(): boolean {
    // Page is fully visible if it's not hidden AND window is focused
    return !document.hidden && document.hasFocus()
  }

  isPageHidden(): boolean {
    return document.hidden
  }

  isWindowFocused(): boolean {
    return document.hasFocus()
  }

  getStatus() {
    return {
      isVisible: this.isVisible,
      isFocused: this.isFocused,
      isFullyVisible: this.isPageFullyVisible(),
      isPageHidden: this.isPageHidden(),
      documentHidden: document.hidden,
      documentHasFocus: document.hasFocus()
    }
  }

  // Subscribe to visibility changes
  subscribe(callback: (visible: boolean) => void): () => void {
    this.listeners.add(callback)
    
    // Call immediately with current state
    callback(this.isPageFullyVisible())
    
    return () => {
      this.listeners.delete(callback)
    }
  }

  cleanup(): void {
    this.listeners.clear()
  }
}

export const visibilityService = new VisibilityService()
export default visibilityService
