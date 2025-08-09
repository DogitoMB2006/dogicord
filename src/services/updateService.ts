class UpdateService {
  private static instance: UpdateService
  private updateCallbacks: Set<() => void> = new Set()
  private isUpdateAvailable = false
  private checkInterval: NodeJS.Timeout | null = null
  private currentVersion: string | null = null
  private latestVersion: string | null = null
  
  private constructor() {
    this.initializeVersionCheck()
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService()
    }
    return UpdateService.instance
  }

  private async initializeVersionCheck(): Promise<void> {
    // Get current version from package.json or build info
    this.currentVersion = await this.getCurrentVersion()
    
    // Start periodic checks
    this.startPeriodicCheck()
    
    // Also check immediately
    this.checkForUpdates()
  }

  private async getCurrentVersion(): Promise<string> {
    try {
      // First try to get version from a version.json file (which we'll create)
      const response = await fetch('/version.json')
      if (response.ok) {
        const versionInfo = await response.json()
        return versionInfo.version || versionInfo.timestamp || '1.0.0'
      }
    } catch (error) {
      console.warn('Could not fetch version from version.json:', error)
    }
    
    try {
      // Fallback to package.json
      const response = await fetch('/package.json')
      if (response.ok) {
        const packageInfo = await response.json()
        return packageInfo.version || '1.0.0'
      }
    } catch (error) {
      console.warn('Could not fetch current version from package.json:', error)
    }
    
    // Fallback to build timestamp from meta tag
    const buildTime = document.querySelector('meta[name="build-time"]')?.getAttribute('content')
    if (buildTime) {
      return buildTime
    }
    
    // Final fallback
    return process.env.NODE_ENV === 'production' 
      ? '1.0.0' 
      : Date.now().toString()
  }

  private async getLatestVersion(): Promise<string> {
    try {
      // Check if there's a new deployment by fetching version.json with cache-busting
      const timestamp = Date.now()
      const response = await fetch(`/version.json?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (response.ok) {
        const versionInfo = await response.json()
        return versionInfo.version || versionInfo.timestamp || '1.0.0'
      }
    } catch (error) {
      console.warn('Could not fetch latest version from version.json:', error)
    }
    
    try {
      // Fallback to package.json
      const timestamp = Date.now()
      const response = await fetch(`/package.json?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (response.ok) {
        const packageInfo = await response.json()
        return packageInfo.version || '1.0.0'
      }
    } catch (error) {
      console.warn('Could not fetch latest version from package.json:', error)
    }
    
    return this.currentVersion || '1.0.0'
  }

  private startPeriodicCheck(): void {
    // Check for updates every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkForUpdates()
    }, 5 * 60 * 1000)
  }

  public async checkForUpdates(): Promise<boolean> {
    try {
      this.latestVersion = await this.getLatestVersion()
      
      // Check if versions are different
      const hasUpdate = this.currentVersion !== this.latestVersion
      
      if (hasUpdate && !this.isUpdateAvailable) {
        this.isUpdateAvailable = true
        this.notifyUpdateAvailable()
        console.log('🎉 New update available!', {
          current: this.currentVersion,
          latest: this.latestVersion
        })
      }
      
      return hasUpdate
    } catch (error) {
      console.error('Error checking for updates:', error)
      return false
    }
  }

  public subscribeToUpdates(callback: () => void): () => void {
    this.updateCallbacks.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  private notifyUpdateAvailable(): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Error in update callback:', error)
      }
    })
  }

  public applyUpdate(): void {
    // Force a hard refresh to get the latest version
    window.location.reload()
  }

  public getVersionInfo(): { current: string | null; latest: string | null; hasUpdate: boolean } {
    return {
      current: this.currentVersion,
      latest: this.latestVersion,
      hasUpdate: this.isUpdateAvailable
    }
  }

  public dismissUpdate(): void {
    this.isUpdateAvailable = false
  }

  public cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.updateCallbacks.clear()
  }
}

export const updateService = UpdateService.getInstance()
