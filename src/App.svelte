<script lang="ts">
  import { onMount } from 'svelte'

  // Pre-instantiated formatter for output conversion
  const convertedFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
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

  // Theme states
  let themeMode = $state<ThemeMode>('system')
  let systemPrefersDark = $state(false)

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
      document.documentElement.setAttribute('data-theme', theme)
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f0f12' : '#f4f4f2')
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
    const rawVal = (amount * rate).toFixed(2)
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

<main class="app">
  <header class="topbar">
    <div class="logo">RatePad</div>
    <div class="topbar-actions">
      <button
        type="button"
        class="icon-btn theme-toggle"
        onclick={toggleQuickTheme}
        aria-label="Toggle {activeTheme === 'dark' ? 'Light' : 'Dark'} theme (Press T)"
        title="Toggle {activeTheme === 'dark' ? 'Light' : 'Dark'} mode"
      >
        {#if activeTheme === 'dark'}
          <!-- Sun icon -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {/if}
      </button>

      <button
        type="button"
        class="icon-btn settings-btn"
        onclick={openSettings}
        aria-label="Open conversion settings"
        title="Settings"
      >
        ⚙
      </button>
    </div>
  </header>

  <section class="display" aria-live="polite">
    <!-- Input Card -->
    <div class="amount-card input-card">
      <div class="card-header">
        <button
          type="button"
          class="currency-badge"
          onclick={openSettings}
          title="Click to edit currency"
        >
          {from}
        </button>

        {#if value}
          <button
            type="button"
            class="clear-mini-btn"
            onclick={clearAmount}
            aria-label="Clear entered amount"
            title="Clear amount (Press C)"
          >
            ✕
          </button>
        {/if}
      </div>

      <div class="amount-row entered" title="{formattedInput} {from}">
        <span class="value-text" class:dimmed={!value}>{formattedInput}</span>
      </div>
    </div>

    <!-- Divider with Swap Action -->
    <div class="divider-section">
      <div class="divider-line"></div>
      <button
        type="button"
        class="swap-btn"
        class:spinning={isSwapping}
        onclick={swapCurrencies}
        aria-label="Swap currencies"
        title="Swap currencies (Press S)"
      >
        <svg class="swap-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      </button>
      <div class="divider-line"></div>
    </div>

    <!-- Output Card -->
    <div
      class="amount-card output-card"
      role="button"
      tabindex="0"
      onclick={copyConverted}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') copyConverted() }}
      title="Click to copy amount"
    >
      <div class="card-header">
        <button
          type="button"
          class="currency-badge target"
          onclick={(e) => { e.stopPropagation(); openSettings() }}
          title="Click to edit currency"
        >
          {to}
        </button>
        {#if copied}
          <span class="copied-pill">Copied!</span>
        {/if}
      </div>

      <div class="amount-row converted" title="{formattedConverted} {to}">
        <span class="value-text">{formattedConverted}</span>
      </div>

      <div class="rate-bar">
        <span>1 {from} = {rate} {to}</span>
      </div>
    </div>
  </section>

  <section class="keypad" aria-label="Keypad">
    {#each KEYS as key (key.label)}
      {#if key.action === 'backspace'}
        <button
          type="button"
          class="key action"
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
          class="key"
          class:action={key.isAction}
          onclick={() => handleKey(key)}
          aria-label={key.label === '.' ? 'Decimal point' : key.label}
        >
          {key.label}
        </button>
      {/if}
    {/each}
  </section>
</main>

{#if isSettingsOpen}
  <div
    class="settings-panel"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeSettings()
    }}
  >
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
    >
      <div class="handle" aria-hidden="true"></div>
      <h2 id="settings-heading">Settings</h2>

      <form onsubmit={saveSettings}>
        <div class="field">
          <label for="fromInput">FROM CURRENCY</label>
          <input
            id="fromInput"
            bind:value={formFrom}
            maxlength="6"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            required
          />
        </div>

        <div class="field">
          <label for="toInput">TO CURRENCY</label>
          <input
            id="toInput"
            bind:value={formTo}
            maxlength="6"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            required
          />
        </div>

        <div class="field">
          <label for="rateInput">CONVERSION RATE</label>
          <input
            id="rateInput"
            type="number"
            inputmode="decimal"
            bind:value={formRate}
            step="any"
            min="0.000001"
            required
          />
        </div>

        <div class="field">
          <span class="field-label">THEME</span>
          <div class="theme-segmented-control" role="radiogroup" aria-label="Appearance theme">
            <button
              type="button"
              class="theme-segment"
              class:selected={formTheme === 'system'}
              onclick={() => { formTheme = 'system' }}
            >
              System
            </button>
            <button
              type="button"
              class="theme-segment"
              class:selected={formTheme === 'light'}
              onclick={() => { formTheme = 'light' }}
            >
              Light
            </button>
            <button
              type="button"
              class="theme-segment"
              class:selected={formTheme === 'dark'}
              onclick={() => { formTheme = 'dark' }}
            >
              Dark
            </button>
          </div>
        </div>

        <button type="submit" class="save">
          Save
        </button>
      </form>
    </div>
  </div>
{/if}

<style>
  .app {
    height: 100dvh;
    max-width: 500px;
    margin: auto;
    display: flex;
    flex-direction: column;
    padding:
      max(16px, env(safe-area-inset-top))
      18px
      max(16px, env(safe-area-inset-bottom));
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    flex-shrink: 0;
  }

  .logo {
    font-size: 20px;
    font-weight: 750;
    letter-spacing: -0.5px;
    color: var(--text-main);
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-btn {
    border: 1px solid var(--btn-border);
    background: var(--btn-bg);
    color: var(--btn-text);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 19px;
    cursor: pointer;
    box-shadow: var(--btn-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-main);
  }

  .icon-btn:active {
    transform: scale(0.92);
  }

  /* Display Area */
  .display {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    min-height: 0;
    padding: 12px 0 20px;
  }

  .amount-card {
    background: var(--card-bg);
    border-radius: 20px;
    padding: 14px 18px;
    box-shadow: var(--card-shadow);
    border: 1px solid var(--card-border);
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.2s ease, border-color 0.2s ease;
  }

  .output-card {
    cursor: pointer;
  }

  .output-card:hover {
    box-shadow: var(--card-shadow);
  }

  .output-card:active {
    transform: scale(0.99);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
    margin-bottom: 6px;
  }

  .currency-badge {
    border: 0;
    background: var(--badge-bg);
    color: var(--badge-text);
    font-size: 13px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .currency-badge:hover {
    background: var(--badge-hover-bg);
    color: var(--text-main);
  }

  .currency-badge.target {
    background: var(--badge-target-bg);
    color: var(--badge-target-text);
  }

  .currency-badge.target:hover {
    background: var(--badge-target-hover-bg);
  }

  .clear-mini-btn {
    border: 0;
    background: var(--badge-bg);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .clear-mini-btn:hover {
    background: var(--badge-hover-bg);
    color: var(--text-main);
  }

  .copied-pill {
    font-size: 11px;
    font-weight: 700;
    color: var(--copied-text);
    background: var(--copied-bg);
    padding: 2px 7px;
    border-radius: 6px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .amount-row {
    display: flex;
    align-items: baseline;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entered {
    font-size: clamp(34px, 10vw, 54px);
    font-weight: 700;
    letter-spacing: -1.5px;
    color: var(--text-main);
  }

  .entered .dimmed {
    color: var(--text-dimmed);
  }

  .converted {
    font-size: clamp(32px, 9.5vw, 50px);
    font-weight: 750;
    letter-spacing: -1.2px;
    color: var(--converted-text);
  }

  .rate-bar {
    margin-top: 6px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
  }

  /* Divider Section with Swap Button */
  .divider-section {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 2px 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: var(--divider-color);
  }

  .swap-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--btn-border);
    background: var(--btn-bg);
    color: var(--btn-text);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 10px;
    cursor: pointer;
    box-shadow: var(--btn-shadow);
    touch-action: manipulation;
    transition: transform 0.2s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .swap-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-main);
  }

  .swap-btn:active {
    transform: scale(0.9);
  }

  .swap-btn.spinning .swap-icon {
    transform: rotate(180deg);
  }

  .swap-icon {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Keypad */
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    flex-shrink: 0;
  }

  .key {
    height: min(14.5vw, 70px);
    min-height: 56px;
    border: 0;
    border-radius: 18px;
    background: var(--key-bg);
    color: var(--key-text);
    font-size: 27px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--key-shadow);
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    transition: transform 0.08s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  }

  .key:active {
    transform: scale(0.95);
    background: var(--key-active-bg);
  }

  .key.action {
    background: var(--key-action-bg);
    color: var(--key-action-text);
    font-size: 21px;
  }

  .key.action:active {
    background: var(--key-action-active-bg);
  }

  /* Settings Modal */
  .settings-panel {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }

  .sheet {
    width: 100%;
    max-width: 500px;
    background: var(--sheet-bg);
    color: var(--text-main);
    border-radius: 28px 28px 0 0;
    padding: 22px;
    padding-bottom: max(24px, env(safe-area-inset-bottom));
    box-shadow: var(--sheet-shadow);
    animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .handle {
    width: 42px;
    height: 5px;
    background: var(--handle-bg);
    border-radius: 10px;
    margin: 0 auto 22px;
  }

  .sheet h2 {
    margin: 0 0 20px;
    font-size: 24px;
    font-weight: 700;
  }

  .field {
    margin-bottom: 16px;
  }

  .field label, .field-label {
    display: block;
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 7px;
    letter-spacing: 0.3px;
  }

  .field input {
    width: 100%;
    border: 1px solid var(--input-border);
    border-radius: 14px;
    padding: 15px;
    font-size: 17px;
    outline: none;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--input-text);
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .field input:focus {
    border-color: var(--input-focus-border);
    background: var(--input-focus-bg);
  }

  /* Segmented Theme Picker */
  .theme-segmented-control {
    display: flex;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 12px;
    padding: 4px;
    gap: 4px;
  }

  .theme-segment {
    flex: 1;
    height: 38px;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    touch-action: manipulation;
    transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  }

  .theme-segment.selected {
    background: var(--card-bg);
    color: var(--text-main);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  .save {
    width: 100%;
    margin-top: 10px;
    height: 54px;
    border: 0;
    border-radius: 16px;
    background: var(--save-btn-bg);
    color: var(--save-btn-text);
    font-weight: 700;
    font-size: 17px;
    cursor: pointer;
    font-family: inherit;
    touch-action: manipulation;
    transition: transform 0.08s ease, opacity 0.15s ease;
  }

  .save:active {
    transform: scale(0.98);
    opacity: 0.9;
  }
</style>
