<script lang="ts">
  import { onMount } from 'svelte'
  import InstallPrompt from './InstallPrompt.svelte'
  import SettingsDrawer, { type ThemeMode } from './SettingsDrawer.svelte'
  import {
    evaluateExpression,
    formatExpression,
    appendInput,
    backspaceInput,
    collapseExpression,
    hasCalculation
  } from './calc'

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
    isOp?: boolean
  }

  const KEYS: readonly KeyDef[] = [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '÷', value: '÷', isOp: true },

    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '×', value: '×', isOp: true },

    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '−', value: '-', isOp: true },

    { label: '.', value: '.' },
    { label: '0', value: '0' },
    { label: '⌫', action: 'backspace', isAction: true },
    { label: '+', value: '+', isOp: true }
  ] as const

  const STORAGE_KEYS = {
    RATE: 'ratepad_rate',
    FROM: 'ratepad_from',
    TO: 'ratepad_to',
    THEME: 'ratepad_theme'
  } as const

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

  // Derived numeric amount and formatted representations
  let amount = $derived(evaluateExpression(value))
  let isCalculating = $derived(hasCalculation(value))
  let calculatedTotalFormatted = $derived(convertedFormatter.format(amount))
  let formattedInput = $derived(formatExpression(value))
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
    vibrate()
    value = appendInput(value, char)
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
      value = backspaceInput(value)
    }
  }

  function handleEquals() {
    if (hasCalculation(value)) {
      vibrate(10)
      value = collapseExpression(value)
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
    isSettingsOpen = true
  }

  function handleSaveSettings(newSettings: { from: string; to: string; rate: number; theme: ThemeMode }) {
    from = newSettings.from
    to = newSettings.to
    rate = newSettings.rate
    themeMode = newSettings.theme
    isSettingsOpen = false

    try {
      localStorage.setItem(STORAGE_KEYS.RATE, String(rate))
      localStorage.setItem(STORAGE_KEYS.FROM, from)
      localStorage.setItem(STORAGE_KEYS.TO, to)
      localStorage.setItem(STORAGE_KEYS.THEME, themeMode)
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
        isSettingsOpen = false
      }
      return
    }

    if (e.key >= '0' && e.key <= '9') {
      press(e.key)
    } else if (e.key === '.' || e.key === ',') {
      press('.')
    } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/' || e.key === 'x' || e.key === 'X') {
      press(e.key)
    } else if (e.key === 'Enter' || e.key === '=') {
      handleEquals()
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

    <div class="flex items-baseline tabular-nums leading-tight overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(32px,9vw,52px)] font-bold tracking-[-1.2px] transition-colors {value ? 'text-main' : 'text-dimmed'}" title="{formattedInput} {from}">
      {formattedInput}
    </div>

    <div class="mt-1.5 text-muted text-xs font-medium h-4 flex items-center">
      {#if isCalculating}
        <button
          type="button"
          class="border-0 bg-transparent p-0 text-muted hover:text-main text-xs font-medium cursor-pointer font-sans tabular-nums transition-colors animate-fade-in"
          onclick={handleEquals}
          title="Click to collapse calculation (or press Enter)"
        >
          {calculatedTotalFormatted}
        </button>
      {/if}
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

    <div class="mt-1.5 text-muted text-xs font-medium h-4 flex items-center">
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
        data-op={key.isOp ? 'true' : undefined}
        onclick={() => handleKey(key)}
        aria-label={key.label === '.' ? 'Decimal point' : key.label}
      >
        {key.label}
      </button>
    {/if}
  {/each}
</section>

<SettingsDrawer
  isOpen={isSettingsOpen}
  {from}
  {to}
  {rate}
  {themeMode}
  onclose={() => { isSettingsOpen = false }}
  onsave={handleSaveSettings}
/>

<InstallPrompt />
