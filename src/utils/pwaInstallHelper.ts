interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

class PWAInstallHelper {
  private deferredPrompt: BeforeInstallPromptEvent | null = null
  private isInstalled = false

  constructor() {
    this.init()
  }

  private init() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('💾 PWA install prompt available')
      e.preventDefault()
      this.deferredPrompt = e as BeforeInstallPromptEvent
      this.showInstallBanner()
    })

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully')
      this.isInstalled = true
      this.hideInstallBanner()
    })

    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true
      console.log('📱 Running as installed PWA')
    }

    // Debug functions
    ;(window as any).installPWA = () => this.promptInstall()
    ;(window as any).isPWAInstalled = () => this.isInstalled
    ;(window as any).getPWAStatus = () => this.getInstallStatus()
  }

  private showInstallBanner() {
    // Create install banner
    const banner = document.createElement('div')
    banner.id = 'pwa-install-banner'
    banner.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: #7c3aed;
        color: white;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: system-ui, sans-serif;
        max-width: 400px;
        margin: 0 auto;
      ">
        <div style="flex: 1;">
          <div style="font-weight: bold; margin-bottom: 4px;">📱 Instalar Dogicord</div>
          <div style="font-size: 14px; opacity: 0.9;">Recibe notificaciones push incluso cuando la app esté cerrada</div>
        </div>
        <div style="margin-left: 16px;">
          <button id="pwa-install-btn" style="
            background: white;
            color: #7c3aed;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            margin-right: 8px;
          ">Instalar</button>
          <button id="pwa-dismiss-btn" style="
            background: transparent;
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
          ">×</button>
        </div>
      </div>
    `

    document.body.appendChild(banner)

    // Add event listeners
    document.getElementById('pwa-install-btn')?.addEventListener('click', () => {
      this.promptInstall()
    })

    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
      this.hideInstallBanner()
    })
  }

  private hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner')
    if (banner) {
      banner.remove()
    }
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      this.showManualInstallInstructions()
      return false
    }

    try {
      await this.deferredPrompt.prompt()
      const { outcome } = await this.deferredPrompt.userChoice
      
      console.log(`PWA install outcome: ${outcome}`)
      
      if (outcome === 'accepted') {
        this.isInstalled = true
        this.hideInstallBanner()
        return true
      }
      
      return false
    } catch (error) {
      console.error('PWA install error:', error)
      return false
    }
  }

  private showManualInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)

    let instructions = ''
    
    if (isIOS) {
      instructions = `
        📱 <strong>Instalar en iOS:</strong><br>
        1. Toca el botón de compartir <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 16 16'%3E%3Cpath d='M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z'/%3E%3Cpath d='M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z'/%3E%3C/svg%3E" style="display: inline; width: 16px; height: 16px;"><br>
        2. Selecciona "Añadir a pantalla de inicio"<br>
        3. Toca "Añadir" para instalar Dogicord
      `
    } else if (isAndroid) {
      instructions = `
        📱 <strong>Instalar en Android:</strong><br>
        1. Toca el menú (⋮) en Chrome<br>
        2. Selecciona "Instalar aplicación" o "Añadir a pantalla de inicio"<br>
        3. Toca "Instalar" para confirmar
      `
    } else {
      instructions = `
        💻 <strong>Instalar en escritorio:</strong><br>
        1. Busca el icono de instalación en la barra de direcciones<br>
        2. O ve al menú → "Instalar Dogicord"
      `
    }

    // Show modal with instructions
    const modal = document.createElement('div')
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      ">
        <div style="
          background: white;
          padding: 24px;
          border-radius: 12px;
          max-width: 400px;
          width: 100%;
          color: #333;
          font-family: system-ui, sans-serif;
        ">
          <h3 style="margin: 0 0 16px 0; color: #7c3aed;">Instalar Dogicord</h3>
          <div style="margin-bottom: 20px; line-height: 1.5;">
            ${instructions}
          </div>
          <div style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 14px;">
            <strong>🔔 ¿Por qué instalar?</strong><br>
            • Notificaciones push en tiempo real<br>
            • Funciona incluso cuando esté cerrada<br>
            • Acceso rápido desde tu pantalla de inicio<br>
            • Mejor rendimiento
          </div>
          <button id="close-install-modal" style="
            background: #7c3aed;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            font-weight: bold;
          ">Entendido</button>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    document.getElementById('close-install-modal')?.addEventListener('click', () => {
      modal.remove()
    })
  }

  getInstallStatus() {
    return {
      isInstalled: this.isInstalled,
      canPrompt: !!this.deferredPrompt,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      platform: this.getPlatform()
    }
  }

  private getPlatform() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios'
    if (/Android/.test(navigator.userAgent)) return 'android'
    return 'desktop'
  }
}

export const pwaInstallHelper = new PWAInstallHelper()
export default pwaInstallHelper
