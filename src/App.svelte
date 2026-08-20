<script lang="ts">
  import { onMount } from 'svelte'
  import InstallPrompt from './InstallPrompt.svelte'
  import { pwa } from './pwaState.svelte'

  // Pre-instantiated formatter for output conversion
  const convertedFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })

  interface KeyDef {
    label: string
    value?: string
    action?: 'clear' | 'backspace'
    isAction?: boolean
  }

  const KEYS: readonly KeyDef[] = [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '.', value: '.' },
    { label: '0', value: '0' },
    { label: '⌫', action: 'backspace', isAction: true }
  ] as const

  const STORAGE_KEYS = {
    RATE: 'ratepad_rate',
    FROM: 'ratepad_from',
    TO: 'ratepad_to',
    THEME: 'ratepad_theme'
  } as const

  type ThemeMode = 'system' | 'light' | 'dark'

  let value = $state('')
  let rate = $state(120)
  let from = $state('USD')
  let to = $state('BDT')
  let isSettingsOpen = $state(false)
  let copied = $state(false)
  let isSwapping = $state(false)

  function getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null
        if (saved && ['system', 'light', 'dark'].includes(saved)) {
          return saved
        }
      } catch {
        // Ignore
      }
    }
    return 'system'
  }

  function getInitialPrefersDark(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  }

  // Theme states (initialized synchronously to avoid any dark mode flash)
  let themeMode = $state<ThemeMode>(getInitialTheme())
  let systemPrefersDark = $state(getInitialPrefersDark())

  let activeTheme = $derived<'light' | 'dark'>(
    themeMode === 'system'
      ? (systemPrefersDark ? 'dark' : 'light')
      : themeMode
  )

  let copyTimeout: ReturnType<typeof setTimeout> | undefined
  let backspaceTimer: ReturnType<typeof setTimeout> | undefined

  // Form states for settings modal
  let formFrom = $state('USD')
  let formTo = $state('BDT')
  let formRate = $state('120')
  let formTheme = $state<ThemeMode>('system')

  // Derived numeric amount and formatted representations
  let amount = $derived(value ? Number(value) : 0)

  let formattedInput = $derived.by(() => {
    if (!value) return '0'
    const parts = value.split('.')
    const intFormatted = Number(parts[0] || '0').toLocaleString('en-US')
    if (parts.length > 1) {
      return `${intFormatted}.${parts[1]}`
    }
    return intFormatted
  })

  let formattedConverted = $derived(convertedFormatter.format(amount * rate))

  function vibrate(ms = 6) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms)
      } catch {
        // Ignore if vibrations are blocked
      }
    }
  }

  function applyTheme(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      const isDark = theme === 'dark'
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.style.backgroundColor = isDark ? '#0f0f12' : '#f4f4f2'
      document.documentElement.style.color = isDark ? '#f3f4f6' : '#111113'
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#0f0f12' : '#f4f4f2')
      }
    }
  }

  $effect(() => {
    applyTheme(activeTheme)
  })

  onMount(() => {
    // 1. Check system color scheme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark = mediaQuery.matches

    const handleMediaChange = (e: MediaQueryListEvent) => {
      systemPrefersDark = e.matches
    }
    mediaQuery.addEventListener('change', handleMediaChange)

    // 2. Load saved settings from localStorage
    try {
      const savedRate = localStorage.getItem(STORAGE_KEYS.RATE)
      const savedFrom = localStorage.getItem(STORAGE_KEYS.FROM)
      const savedTo = localStorage.getItem(STORAGE_KEYS.TO)
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null

      if (savedRate) {
        const parsed = Number(savedRate)
        if (!isNaN(parsed) && parsed > 0) rate = parsed
      }
      if (savedFrom) from = savedFrom.trim().slice(0, 6).toUpperCase()
      if (savedTo) to = savedTo.trim().slice(0, 6).toUpperCase()
      if (savedTheme && ['system', 'light', 'dark'].includes(savedTheme)) {
        themeMode = savedTheme
      }
    } catch {
      // Ignore if localStorage is restricted
    }

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  })

  function toggleQuickTheme() {
    vibrate(8)
    const nextTheme: ThemeMode = activeTheme === 'dark' ? 'light' : 'dark'
    themeMode = nextTheme
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, nextTheme)
    } catch {
      // Ignore
    }
  }

  function press(char: string) {
    if (char === '.') {
      if (value.includes('.')) return
      vibrate()
      if (value === '') {
        value = '0.'
      } else {
        value += '.'
      }
      return
    }

    if (value.length >= 12) return

    // Limit to 2 decimal places when typing decimals
    if (value.includes('.')) {
      const parts = value.split('.')
      if (parts[1] && parts[1].length >= 2) return
    }

    if (value === '0' && char === '0') return

    vibrate()
    if (value === '0') {
      value = char
      return
    }
    value += char
  }

  function clearAmount() {
    if (value !== '') {
      vibrate(10)
      value = ''
    }
  }

  function backspace() {
    if (value.length > 0) {
      vibrate()
      value = value.slice(0, -1)
    }
  }

  function handleKey(key: KeyDef) {
    if (key.action === 'clear') {
      clearAmount()
    } else if (key.action === 'backspace') {
      backspace()
    } else if (key.value) {
      press(key.value)
    }
  }

  function handleBackspaceStart() {
    backspace()
    backspaceTimer = setTimeout(() => {
      clearAmount()
    }, 600)
  }

  function handleBackspaceEnd() {
    if (backspaceTimer) clearTimeout(backspaceTimer)
  }

  function swapCurrencies() {
    vibrate(12)
    isSwapping = true
    setTimeout(() => { isSwapping = false }, 300)

    const prevFrom = from
    const prevTo = to
    from = prevTo
    to = prevFrom

    if (rate > 0) {
      const inverted = 1 / rate
      rate = inverted >= 1 ? Number(inverted.toFixed(4)) : Number(inverted.toFixed(6))
    }

    try {
      localStorage.setItem(STORAGE_KEYS.RATE, String(rate))
      localStorage.setItem(STORAGE_KEYS.FROM, from)
      localStorage.setItem(STORAGE_KEYS.TO, to)
    } catch {
      // Ignore localStorage errors
    }
  }

  async function copyConverted() {
    const rawVal = Number((amount * rate).toFixed(2)).toString()
    try {
      await navigator.clipboard.writeText(rawVal)
      vibrate(12)
      copied = true
      if (copyTimeout) clearTimeout(copyTimeout)
      copyTimeout = setTimeout(() => {
        copied = false
      }, 1800)
    } catch {
      // Fallback
    }
  }

  function openSettings() {
    formFrom = from
    formTo = to
    formRate = String(rate)
    formTheme = themeMode
    isSettingsOpen = true
  }

  function closeSettings() {
    isSettingsOpen = false
  }

  function saveSettings(e?: SubmitEvent) {
    if (e) e.preventDefault()
    from = formFrom.trim().toUpperCase() || 'USD'
    to = formTo.trim().toUpperCase() || 'BDT'
    const parsedRate = Number(formRate)
    rate = !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : 1
    themeMode = formTheme
    isSettingsOpen = false

    try {
      localStorage.setItem(STORAGE_KEYS.RATE, String(rate))
      localStorage.setItem(STORAGE_KEYS.FROM, from)
      localStorage.setItem(STORAGE_KEYS.TO, to)
      localStorage.setItem(STORAGE_KEYS.THEME, formTheme)
    } catch {
      // Ignore localStorage write errors
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    if (isSettingsOpen) {
      if (e.key === 'Escape') {
        closeSettings()
      }
      return
    }

    if (e.key >= '0' && e.key <= '9') {
      press(e.key)
    } else if (e.key === '.' || e.key === ',') {
      press('.')
    } else if (e.key === 'Backspace') {
      backspace()
    } else if (e.key.toLowerCase() === 'c' || e.key === 'Escape' || e.key === 'Delete') {
      clearAmount()
    } else if (e.key.toLowerCase() === 's') {
      swapCurrencies()
    } else if (e.key.toLowerCase() === 't') {
      toggleQuickTheme()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="flex items-center justify-between h-12 shrink-0">
  <h1 class="text-xl font-[750] tracking-[-0.5px] text-main m-0">RatePad</h1>
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="size-10 rounded-full border border-btn-border bg-btn text-btn-text shadow-xs flex items-center justify-center cursor-pointer touch-manipulation transition-all hover:bg-btn-hover hover:text-main active:scale-90 text-[19px]"
      onclick={toggleQuickTheme}
      aria-label="Toggle {activeTheme === 'dark' ? 'Light' : 'Dark'} theme (Press T)"
      title="Toggle {activeTheme === 'dark' ? 'Light' : 'Dark'} mode"
    >
      {#if activeTheme === 'dark'}
        <!-- Sun icon -->
        <svg class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      {:else}
        <!-- Moon icon -->
        <svg class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      {/if}
    </button>

    <button
      type="button"
      class="size-10 rounded-full border border-btn-border bg-btn text-btn-text shadow-xs flex items-center justify-center cursor-pointer touch-manipulation transition-all hover:bg-btn-hover hover:text-main active:scale-90 text-[19px]"
      onclick={openSettings}
      aria-label="Open conversion settings"
      title="Settings"
    >
      ⚙
    </button>
  </div>
</header>

<section class="flex-1 flex flex-col justify-center gap-2 min-h-0 py-3" aria-live="polite">
  <!-- Input Card (Flattened DOM) -->
  <div class="bg-card rounded-[20px] p-[14px_18px] shadow-sm border border-card-border flex flex-col justify-center transition-all">
    <div class="flex items-center justify-between min-h-6 mb-1.5">
      <button
        type="button"
        class="border-0 bg-badge text-badge-text text-[13px] font-bold py-[3px] px-[9px] rounded-lg cursor-pointer font-sans transition-colors hover:bg-badge-hover hover:text-main"
        onclick={openSettings}
        title="Click to edit currency"
      >
        {from}
      </button>

      {#if value}
        <button
          type="button"
          class="size-[22px] rounded-full border-0 bg-badge text-muted text-[11px] font-bold flex items-center justify-center cursor-pointer touch-manipulation transition-colors hover:bg-badge-hover hover:text-main"
          onclick={clearAmount}
          aria-label="Clear entered amount"
          title="Clear amount (Press C)"
        >
          ✕
        </button>
      {/if}
    </div>

    <div class="flex items-baseline tabular-nums leading-tight overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(34px,10vw,54px)] font-bold tracking-[-1.5px] transition-colors {value ? 'text-main' : 'text-dimmed'}" title="{formattedInput} {from}">
      {formattedInput}
    </div>
  </div>

  <!-- Divider with Swap Action (Flattened: pseudo before/after replaces 2 line divs) -->
  <div class="flex items-center justify-center relative py-0.5 before:flex-1 before:h-px before:bg-divider after:flex-1 after:h-px after:bg-divider">
    <button
      type="button"
      class="size-8 rounded-full border border-btn-border bg-btn text-btn-text flex items-center justify-center mx-2.5 cursor-pointer shadow-xs touch-manipulation transition-all hover:bg-btn-hover hover:text-main active:scale-90"
      onclick={swapCurrencies}
      aria-label="Swap currencies"
      title="Swap currencies (Press S)"
    >
      <svg class="size-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] {isSwapping ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
      </svg>
    </button>
  </div>

  <!-- Output Card (Flattened DOM) -->
  <div
    class="bg-card rounded-[20px] p-[14px_18px] shadow-sm border border-card-border flex flex-col justify-center transition-all cursor-pointer active:scale-[0.99]"
    role="button"
    tabindex="0"
    onclick={copyConverted}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') copyConverted() }}
    title="Click to copy amount"
  >
    <div class="flex items-center justify-between min-h-6 mb-1.5">
      <button
        type="button"
        class="border-0 bg-badge-target text-badge-target-text text-[13px] font-bold py-[3px] px-[9px] rounded-lg cursor-pointer font-sans transition-colors hover:bg-badge-target-hover"
        onclick={(e) => { e.stopPropagation(); openSettings() }}
        title="Click to edit currency"
      >
        {to}
      </button>
      {#if copied}
        <span class="text-[11px] font-bold text-copied-text bg-copied-bg py-0.5 px-[7px] rounded-md animate-fade-in">Copied!</span>
      {/if}
    </div>

    <div class="flex items-baseline tabular-nums leading-tight overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(32px,9.5vw,50px)] font-[750] tracking-[-1.2px] text-converted" title="{formattedConverted} {to}">
      {formattedConverted}
    </div>

    <div class="mt-1.5 text-muted text-xs font-medium">
      1 {from} = {rate} {to}
    </div>
  </div>
</section>

<section class="keypad" aria-label="Keypad">
  {#each KEYS as key (key.label)}
    {#if key.action === 'backspace'}
      <button
        type="button"
        data-action="true"
        onpointerdown={handleBackspaceStart}
        onpointerup={handleBackspaceEnd}
        onpointerleave={handleBackspaceEnd}
        aria-label="Backspace (Hold to clear)"
        title="Backspace (Hold to clear)"
      >
        {key.label}
      </button>
    {:else}
      <button
        type="button"
        data-action={key.isAction ? 'true' : undefined}
        onclick={() => handleKey(key)}
        aria-label={key.label === '.' ? 'Decimal point' : key.label}
      >
        {key.label}
      </button>
    {/if}
  {/each}
</section>

{#if isSettingsOpen}
  <div
    class="fixed inset-0 bg-sheet-backdrop flex items-end justify-center z-50 backdrop-blur-xs"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeSettings()
    }}
  >
    <div
      class="w-full max-w-[500px] bg-sheet text-main rounded-t-[28px] p-[22px] pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl animate-slide-up before:block before:w-[42px] before:h-[5px] before:bg-handle before:rounded-full before:mx-auto before:mb-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
    >
      <h2 id="settings-heading" class="m-0 mb-5 text-2xl font-bold">Settings</h2>

      <form onsubmit={saveSettings}>
        <div class="mb-4">
          <label for="fromInput" class="block text-[13px] text-muted font-semibold mb-[7px] tracking-wide">FROM CURRENCY</label>
          <input
            id="fromInput"
            bind:value={formFrom}
            maxlength="6"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            required
            class="w-full border border-input-border rounded-[14px] p-[15px] text-[17px] outline-none font-sans bg-input text-input-text transition-colors focus:border-input-focus-border focus:bg-input-focus-bg"
          />
        </div>

        <div class="mb-4">
          <label for="toInput" class="block text-[13px] text-muted font-semibold mb-[7px] tracking-wide">TO CURRENCY</label>
          <input
            id="toInput"
            bind:value={formTo}
            maxlength="6"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            required
            class="w-full border border-input-border rounded-[14px] p-[15px] text-[17px] outline-none font-sans bg-input text-input-text transition-colors focus:border-input-focus-border focus:bg-input-focus-bg"
          />
        </div>

        <div class="mb-4">
          <label for="rateInput" class="block text-[13px] text-muted font-semibold mb-[7px] tracking-wide">CONVERSION RATE</label>
          <input
            id="rateInput"
            type="number"
            inputmode="decimal"
            bind:value={formRate}
            step="any"
            min="0.000001"
            required
            class="w-full border border-input-border rounded-[14px] p-[15px] text-[17px] outline-none font-sans bg-input text-input-text transition-colors focus:border-input-focus-border focus:bg-input-focus-bg"
          />
        </div>

        <div class="mb-4">
          <span class="block text-[13px] text-muted font-semibold mb-[7px] tracking-wide">THEME</span>
          <div class="flex bg-input border border-input-border rounded-xl p-1 gap-1" role="radiogroup" aria-label="Appearance theme">
            <button
              type="button"
              class="flex-1 h-[38px] border-0 rounded-lg text-sm font-semibold cursor-pointer font-sans touch-manipulation transition-all {formTheme === 'system' ? 'bg-card text-main shadow-xs' : 'bg-transparent text-muted'}"
              onclick={() => { formTheme = 'system' }}
            >
              System
            </button>
            <button
              type="button"
              class="flex-1 h-[38px] border-0 rounded-lg text-sm font-semibold cursor-pointer font-sans touch-manipulation transition-all {formTheme === 'light' ? 'bg-card text-main shadow-xs' : 'bg-transparent text-muted'}"
              onclick={() => { formTheme = 'light' }}
            >
              Light
            </button>
            <button
              type="button"
              class="flex-1 h-[38px] border-0 rounded-lg text-sm font-semibold cursor-pointer font-sans touch-manipulation transition-all {formTheme === 'dark' ? 'bg-card text-main shadow-xs' : 'bg-transparent text-muted'}"
              onclick={() => { formTheme = 'dark' }}
            >
              Dark
            </button>
          </div>
        </div>

        <div class="mb-4">
          <span class="block text-[13px] text-muted font-semibold mb-[7px] tracking-wide">APP INSTALLATION</span>
          {#if pwa.isStandalone || pwa.isInstalled}
            <div class="flex items-center justify-between gap-3 bg-badge-target border border-emerald-500/25 rounded-[14px] p-[12px_14px] text-[13px]">
              <div class="size-[26px] rounded-full bg-converted text-white text-[13px] font-extrabold flex items-center justify-center shrink-0" aria-hidden="true">✓</div>
              <div class="flex-1 min-w-0">
                <strong class="block text-[13.5px] text-main mb-0.5">Installed (Offline Ready)</strong>
                <p class="m-0 text-xs text-muted leading-snug">RatePad is installed and ready for full offline use.</p>
              </div>
            </div>
          {:else}
            <div class="flex items-center justify-between gap-3 bg-input border border-input-border rounded-[14px] p-[12px_14px] text-[13px]">
              <div class="flex-1 min-w-0">
                <strong class="block text-[13.5px] text-main mb-0.5">Install App</strong>
                <p class="m-0 text-xs text-muted leading-snug">Add to your home screen for quick offline access.</p>
              </div>
              <button
                type="button"
                class="border-0 bg-save-btn text-save-btn-text text-[13px] font-bold py-2 px-3.5 rounded-xl cursor-pointer font-sans touch-manipulation whitespace-nowrap transition-transform active:scale-95"
                onclick={() => {
                  isSettingsOpen = false
                  pwa.promptInstall()
                }}
              >
                Install
              </button>
            </div>
          {/if}
        </div>

        <button type="submit" class="w-full mt-2.5 h-[54px] border-0 rounded-2xl bg-save-btn text-save-btn-text font-bold text-[17px] cursor-pointer font-sans touch-manipulation transition-all active:scale-[0.98] active:opacity-90">
          Save
        </button>
      </form>
    </div>
  </div>
{/if}

<InstallPrompt />
