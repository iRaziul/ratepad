<script lang="ts">
  import { onMount } from 'svelte'
  import { pwa } from './pwaState.svelte'

  onMount(() => {
    const cleanup = pwa.init()
    return cleanup
  })

  function handleInstallClick() {
    vibrate(10)
    pwa.promptInstall()
  }

  function handleDismissClick() {
    vibrate(6)
    pwa.dismissBanner()
  }

  function vibrate(ms = 6) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms)
      } catch {
        // Ignore vibration errors
      }
    }
  }
</script>

<!-- Floating Prompt Banner -->
{#if pwa.showBanner && !pwa.isStandalone && !pwa.isInstalled}
  <aside class="fixed top-[max(12px,env(safe-area-inset-top))] inset-x-4 max-w-[480px] mx-auto bg-card border border-card-border rounded-[20px] p-[12px_14px] shadow-[0_10px_32px_rgba(0,0,0,0.16)] flex items-center justify-between gap-3 z-50 backdrop-blur-md animate-banner-slide-down" role="banner" aria-label="Install RatePad as app">
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <div class="size-10 shrink-0 rounded-[10px] overflow-hidden flex items-center justify-center shadow-sm" aria-hidden="true">
        <svg viewBox="0 0 512 512" width="40" height="40">
          <defs>
            <linearGradient id="bannerBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e1e24" />
              <stop offset="100%" stop-color="#0c0c0e" />
            </linearGradient>
            <linearGradient id="bannerGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#34d399" />
              <stop offset="100%" stop-color="#059669" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="120" fill="url(#bannerBg)" />
          <path
            d="M 170 190 L 330 190 M 330 190 L 275 135 M 330 190 L 275 245"
            fill="none"
            stroke="#ffffff"
            stroke-width="40"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M 342 322 L 182 322 M 182 322 L 237 267 M 182 322 L 237 377"
            fill="none"
            stroke="url(#bannerGreen)"
            stroke-width="40"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-sm font-bold text-main leading-tight">Install RatePad</span>
          <span class="text-[10px] font-bold text-converted bg-badge-target py-px px-1.5 rounded-md tracking-wide">Offline Ready</span>
        </div>
        <p class="m-0 mt-0.5 text-xs text-muted leading-tight whitespace-nowrap overflow-hidden text-ellipsis">Instant currency pad right on your home screen</p>
      </div>
    </div>

    <div class="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        class="border-0 bg-save-btn text-save-btn-text font-bold text-[13px] py-2 px-3.5 rounded-xl cursor-pointer inline-flex items-center gap-1.5 font-sans touch-manipulation transition-all active:scale-95"
        onclick={handleInstallClick}
        aria-label="Install RatePad application"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Install</span>
      </button>

      <button
        type="button"
        class="border-0 bg-transparent text-muted text-sm size-8 rounded-full cursor-pointer flex items-center justify-center touch-manipulation transition-colors hover:bg-badge-hover hover:text-main"
        onclick={handleDismissClick}
        aria-label="Dismiss install prompt"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  </aside>
{/if}

<!-- iOS Install Guide Modal -->
{#if pwa.showIosGuide}
  <div
    class="fixed inset-0 bg-sheet-backdrop flex items-end justify-center z-50 backdrop-blur-xs animate-fade-in"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) pwa.closeIosGuide() }}
  >
    <div
      class="w-full max-w-[500px] bg-sheet text-main rounded-t-[28px] p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl animate-slide-up before:block before:w-10 before:h-[5px] before:bg-handle before:rounded-full before:mx-auto before:mb-4.5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-guide-title"
    >
      <div class="flex items-center gap-3.5 mb-5">
        <div class="size-[46px] rounded-[14px] bg-badge-target text-converted flex items-center justify-center shrink-0" aria-hidden="true">
          <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <div>
          <h2 id="ios-guide-title" class="m-0 text-xl font-[750] tracking-tight">Install RatePad on iOS</h2>
          <p class="m-0 mt-0.5 text-[13px] text-muted leading-snug">Follow these quick steps in Safari to add to your Home Screen</p>
        </div>
      </div>

      <div class="flex flex-col gap-3 mb-5.5">
        <!-- Step 1 -->
        <div class="flex items-center gap-3.5 bg-card border border-card-border rounded-2xl p-3 px-3.5 text-[13.5px] leading-snug">
          <span class="size-7 rounded-full bg-badge text-main text-[13px] font-[750] flex items-center justify-center shrink-0">1</span>
          <span class="flex-1 text-main">Tap the <strong>Share</strong> button in the Safari navigation bar.</span>
          <span class="inline-flex items-center gap-1.5 py-1 px-2 bg-badge text-main rounded-lg text-xs font-semibold shrink-0" aria-hidden="true">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>Share</span>
          </span>
        </div>

        <!-- Step 2 -->
        <div class="flex items-center gap-3.5 bg-card border border-card-border rounded-2xl p-3 px-3.5 text-[13.5px] leading-snug">
          <span class="size-7 rounded-full bg-badge text-main text-[13px] font-[750] flex items-center justify-center shrink-0">2</span>
          <span class="flex-1 text-main">Scroll down and select <strong>Add to Home Screen</strong>.</span>
          <span class="inline-flex items-center gap-1.5 py-1 px-2 bg-badge text-main rounded-lg text-xs font-semibold shrink-0" aria-hidden="true">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <span>Add</span>
          </span>
        </div>

        <!-- Step 3 -->
        <div class="flex items-center gap-3.5 bg-card border border-card-border rounded-2xl p-3 px-3.5 text-[13.5px] leading-snug">
          <span class="size-7 rounded-full bg-badge text-main text-[13px] font-[750] flex items-center justify-center shrink-0">3</span>
          <span class="flex-1 text-main">Tap <strong>Add</strong> in the top-right corner to complete.</span>
          <span class="font-bold text-[#007aff] px-1.5 shrink-0" aria-hidden="true">Add</span>
        </div>
      </div>

      <button
        type="button"
        class="w-full h-[50px] border-0 rounded-2xl bg-save-btn text-save-btn-text font-bold text-base cursor-pointer font-sans touch-manipulation transition-all active:scale-[0.98] active:opacity-90"
        onclick={() => pwa.closeIosGuide()}
      >
        Got it
      </button>
    </div>
  </div>
{/if}

<!-- Browser / Desktop Guide Modal -->
{#if pwa.showOtherGuide}
  <div
    class="fixed inset-0 bg-sheet-backdrop flex items-end justify-center z-50 backdrop-blur-xs animate-fade-in"
    role="presentation"
    onclick={(e) => { if (e.target === e.currentTarget) pwa.closeOtherGuide() }}
  >
    <div
      class="w-full max-w-[500px] bg-sheet text-main rounded-t-[28px] p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl animate-slide-up before:block before:w-10 before:h-[5px] before:bg-handle before:rounded-full before:mx-auto before:mb-4.5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="other-guide-title"
    >
      <div class="flex items-center gap-3.5 mb-5">
        <div class="size-[46px] rounded-[14px] bg-badge-target text-converted flex items-center justify-center shrink-0" aria-hidden="true">
          <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div>
          <h2 id="other-guide-title" class="m-0 text-xl font-[750] tracking-tight">Install RatePad App</h2>
          <p class="m-0 mt-0.5 text-[13px] text-muted leading-snug">Use RatePad natively on desktop or mobile</p>
        </div>
      </div>

      <div class="flex flex-col gap-3.5 mb-4.5">
        <div class="flex items-start gap-3 text-[13.5px]">
          <span class="text-xl leading-none shrink-0" aria-hidden="true">⚡</span>
          <div>
            <strong class="block text-main text-sm mb-0.5">Works 100% Offline</strong>
            <p class="m-0 text-muted text-[12.5px] leading-snug">Convert travel prices anytime, even without Wi-Fi or cellular roaming.</p>
          </div>
        </div>
        <div class="flex items-start gap-3 text-[13.5px]">
          <span class="text-xl leading-none shrink-0" aria-hidden="true">🎯</span>
          <div>
            <strong class="block text-main text-sm mb-0.5">Instant Home Screen Access</strong>
            <p class="m-0 text-muted text-[12.5px] leading-snug">One-tap launch with no browser address bars or navigation clutter.</p>
          </div>
        </div>
        <div class="flex items-start gap-3 text-[13.5px]">
          <span class="text-xl leading-none shrink-0" aria-hidden="true">🛡️</span>
          <div>
            <strong class="block text-main text-sm mb-0.5">Zero Fees, Zero Trackers</strong>
            <p class="m-0 text-muted text-[12.5px] leading-snug">Completely private with custom rate memory stored locally.</p>
          </div>
        </div>
      </div>

      <div class="bg-input border border-input-border rounded-xl p-2.5 px-3.5 text-xs text-muted leading-snug mb-5">
        <span>Tip: Look for the install icon (<strong>⊕</strong> or <strong>⭳</strong>) in your browser address bar, or check the browser menu (<strong>⋮</strong>) → <strong>Install RatePad</strong>.</span>
      </div>

      <button
        type="button"
        class="w-full h-[50px] border-0 rounded-2xl bg-save-btn text-save-btn-text font-bold text-base cursor-pointer font-sans touch-manipulation transition-all active:scale-[0.98] active:opacity-90"
        onclick={() => pwa.closeOtherGuide()}
      >
        Close
      </button>
    </div>
  </div>
{/if}

<!-- Success Toast -->
{#if pwa.showSuccessToast}
  <div class="fixed top-[max(16px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[440px] bg-card border border-converted rounded-2xl p-3 px-4 shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex items-center gap-3 z-50 animate-toast-drop" role="status" aria-live="polite">
    <div class="size-7 rounded-full bg-badge-target text-converted text-[15px] font-extrabold flex items-center justify-center shrink-0">✓</div>
    <div class="flex-1 text-[12.5px] leading-snug text-main">
      <strong class="block text-[13.5px] mb-0.5">RatePad installed!</strong>
      <span>Launch anytime from your home screen or apps menu.</span>
    </div>
    <button
      type="button"
      class="border-0 bg-transparent text-muted text-sm size-7 rounded-full cursor-pointer flex items-center justify-center"
      onclick={() => pwa.closeToast()}
      aria-label="Close notification"
    >
      ✕
    </button>
  </div>
{/if}
