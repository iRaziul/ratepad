// src/pwaState.svelte.ts

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

const STORAGE_DISMISSED_KEY = 'ratepad_pwa_dismissed_at'
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 1 day

class PWAState {
  isStandalone = $state(false)
  isInstalled = $state(false)
  canPromptNative = $state(false)
  isIOS = $state(false)
  showBanner = $state(false)
  showIosGuide = $state(false)
  showOtherGuide = $state(false)
  showSuccessToast = $state(false)

  private deferredPrompt: BeforeInstallPromptEvent | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null

  init() {
    if (typeof window === 'undefined') return () => {}

    // 1. Detect standalone mode
    this.checkStandalone()

    // 2. Detect iOS / iPadOS
    const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || ''
    this.isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    // 3. Listen for display-mode standalone changes
    const matchMediaStandalone = window.matchMedia('(display-mode: standalone)')
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        this.isStandalone = true
        this.showBanner = false
      }
    }
    matchMediaStandalone.addEventListener('change', handleDisplayChange)

    // 4. Listen for beforeinstallprompt event (Chromium, Android, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      this.deferredPrompt = e as BeforeInstallPromptEvent
      this.canPromptNative = true

      if (!this.isStandalone && !this.isInstalled && !this.isRecentlyDismissed()) {
        this.showBanner = true
      }
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 5. Listen for appinstalled event
    const handleAppInstalled = () => {
      this.isInstalled = true
      this.isStandalone = true
      this.showBanner = false
      this.showIosGuide = false
      this.showOtherGuide = false
      this.deferredPrompt = null
      this.canPromptNative = false
      this.showToast()
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    // 6. Show banner promptly on non-standalone browsers
    if (!this.isStandalone && !this.isInstalled && !this.isRecentlyDismissed()) {
      setTimeout(() => {
        if (!this.isStandalone && !this.isInstalled) {
          this.showBanner = true
        }
      }, 200)
    }

    return () => {
      matchMediaStandalone.removeEventListener('change', handleDisplayChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }

  private checkStandalone() {
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches
    const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
    const isAndroidApp = document.referrer.includes('android-app://')
    this.isStandalone = isStandaloneDisplay || isIOSStandalone || isAndroidApp
  }

  private isRecentlyDismissed(): boolean {
    try {
      const dismissedStr = localStorage.getItem(STORAGE_DISMISSED_KEY)
      if (!dismissedStr) return false
      const dismissedAt = Number(dismissedStr)
      if (isNaN(dismissedAt)) return false
      return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
    } catch {
      return false
    }
  }

  async promptInstall() {
    this.showBanner = false

    if (this.deferredPrompt) {
      try {
        await this.deferredPrompt.prompt()
        const choice = await this.deferredPrompt.userChoice
        if (choice.outcome === 'accepted') {
          this.isInstalled = true
          this.deferredPrompt = null
          this.canPromptNative = false
          this.showToast()
        }
      } catch (err) {
        console.error('Error triggering PWA installation:', err)
      }
    } else if (this.isIOS) {
      this.showIosGuide = true
    } else {
      this.showOtherGuide = true
    }
  }

  dismissBanner() {
    this.showBanner = false
    try {
      localStorage.setItem(STORAGE_DISMISSED_KEY, String(Date.now()))
    } catch {
      // ignore
    }
  }

  resetDismissed() {
    try {
      localStorage.removeItem(STORAGE_DISMISSED_KEY)
    } catch {
      // ignore
    }
    if (!this.isStandalone && !this.isInstalled) {
      this.showBanner = true
    }
  }

  closeIosGuide() {
    this.showIosGuide = false
  }

  closeOtherGuide() {
    this.showOtherGuide = false
  }

  showToast() {
    this.showSuccessToast = true
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      this.showSuccessToast = false
    }, 4000)
  }

  closeToast() {
    this.showSuccessToast = false
    if (this.toastTimer) clearTimeout(this.toastTimer)
  }
}

export const pwa = new PWAState()
