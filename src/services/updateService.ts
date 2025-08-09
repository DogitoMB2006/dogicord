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
    // In development, always use a timestamp so we can test
    if (process.env.NODE_ENV === 'development') {
      // Store initial version in localStorage for comparison
      const storedVersion = localStorage.getItem('dogicord-app-version')
      if (!storedVersion) {
        const initialVersion = Date.now().toString()
        localStorage.setItem('dogicord-app-version', initialVersion)
        return initialVersion
      }
      return storedVersion
    }

    try {
      // First try to get version from a version.json file (which we'll create)
      const response = await fetch('/version.json')
      if (response.ok) {
        const versionInfo = await response.json()
        console.log('Current version info:', versionInfo)
        return versionInfo.deploymentId || versionInfo.buildNumber || versionInfo.timestamp || '1.0.0'
      }
    } catch (error) {
      console.warn('Could not fetch version from version.json:', error)
    }
    
    // Fallback to build timestamp from meta tag
    const buildTime = document.querySelector('meta[name="build-time"]')?.getAttribute('content')
    if (buildTime) {
      console.log('Using build time from meta tag:', buildTime)
      return buildTime
    }
    
    // Final fallback
    return '1.0.0'
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
        console.log('Latest version info fetched:', versionInfo)
        return versionInfo.deploymentId || versionInfo.buildNumber || versionInfo.timestamp || '1.0.0'
      } else {
        console.warn('Failed to fetch latest version, status:', response.status)
      }
    } catch (error) {
      console.warn('Could not fetch latest version from version.json:', error)
    }
    
    // For development, try to detect manual changes
    if (process.env.NODE_ENV === 'development') {
      // In development, we can simulate a new version by checking a different approach
      const buildTime = document.querySelector('meta[name="build-time"]')?.getAttribute('content')
      if (buildTime) {
        console.log('Development: using build time as latest version:', buildTime)
        return buildTime
      }
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
      console.log('🔍 Checking for updates...')
      this.latestVersion = await this.getLatestVersion()
      
      console.log('Version comparison:', {
        current: this.currentVersion,
        latest: this.latestVersion,
        areEqual: this.currentVersion === this.latestVersion
      })
      
      // Check if versions are different
      const hasUpdate = this.currentVersion !== this.latestVersion
      
      if (hasUpdate && !this.isUpdateAvailable) {
        this.isUpdateAvailable = true
        this.notifyUpdateAvailable()
        console.log('🎉 New update available!', {
          current: this.currentVersion,
          latest: this.latestVersion
        })
      } else if (hasUpdate && this.isUpdateAvailable) {
        console.log('📝 Update already detected, not notifying again')
      } else {
        console.log('✅ No updates available')
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

  // Method to simulate an update (for testing)
  public simulateUpdate(): void {
    console.log('🧪 Simulating update for testing...')
    const simulatedNewVersion = (Date.now() + 1000).toString()
    this.latestVersion = simulatedNewVersion
    this.isUpdateAvailable = true
    this.notifyUpdateAvailable()
    console.log('🎉 Simulated update triggered!', {
      current: this.currentVersion,
      latest: this.latestVersion
    })
  }

  // Method for manual force check (for debugging)
  public async forceCheckForUpdates(): Promise<void> {
    console.log('🔧 Force checking for updates...')
    await this.checkForUpdates()
  }
}

export const updateService = UpdateService.getInstance()
