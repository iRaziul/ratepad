<script lang="ts">
  import { onMount } from 'svelte'

  // Pre-instantiated formatters to prevent GC thrashing & avoid re-instantiation per keystroke
  const inputFormatter = new Intl.NumberFormat('en-US')
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
    { label: 'C', action: 'clear', isAction: true },
    { label: '0', value: '0' },
    { label: '⌫', action: 'backspace', isAction: true }
  ] as const

  const STORAGE_KEYS = {
    RATE: 'ratepad_rate',
    FROM: 'ratepad_from',
    TO: 'ratepad_to'
  } as const

  let value = $state('')
  let rate = $state(120)
  let from = $state('USD')
  let to = $state('BDT')
  let isSettingsOpen = $state(false)
  let copied = $state(false)
  let isSwapping = $state(false)

  let copyTimeout: ReturnType<typeof setTimeout> | undefined

  // Form states for settings modal
  let formFrom = $state('USD')
  let formTo = $state('BDT')
  let formRate = $state('120')

  // Derived numeric amount and formatted representations
  let amount = $derived(value ? Number(value) : 0)
  let formattedInput = $derived(inputFormatter.format(amount))
  let formattedConverted = $derived(convertedFormatter.format(amount * rate))

  function vibrate(ms = 6) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms)
      } catch {
        // Ignore if vibrations are blocked by permission
      }
    }
  }

  onMount(() => {
    try {
      const savedRate = localStorage.getItem(STORAGE_KEYS.RATE)
      const savedFrom = localStorage.getItem(STORAGE_KEYS.FROM)
      const savedTo = localStorage.getItem(STORAGE_KEYS.TO)

      if (savedRate) {
        const parsed = Number(savedRate)
        if (!isNaN(parsed) && parsed > 0) rate = parsed
      }
      if (savedFrom) from = savedFrom.trim().slice(0, 6).toUpperCase()
      if (savedTo) to = savedTo.trim().slice(0, 6).toUpperCase()
    } catch {
      // Ignore if localStorage is restricted
    }
  })

  function press(num: string) {
    if (value.length >= 10) return
    if (value === '0' && num === '0') return
    vibrate()
    if (value === '0') {
      value = num
      return
    }
    value += num
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
    isSettingsOpen = false

    try {
      localStorage.setItem(STORAGE_KEYS.RATE, String(rate))
      localStorage.setItem(STORAGE_KEYS.FROM, from)
      localStorage.setItem(STORAGE_KEYS.TO, to)
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
    } else if (e.key === 'Backspace') {
      backspace()
    } else if (e.key.toLowerCase() === 'c' || e.key === 'Escape') {
      clearAmount()
    } else if (e.key.toLowerCase() === 's') {
      swapCurrencies()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="app">
  <header class="topbar">
    <div class="logo">RatePad</div>
    <button
      type="button"
      class="settings-btn"
      onclick={openSettings}
      aria-label="Open conversion settings"
    >
      ⚙
    </button>
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
      <button
        type="button"
        class="key"
        class:action={key.isAction}
        onclick={() => handleKey(key)}
        aria-label={key.label === '⌫' ? 'Backspace' : key.label === 'C' ? 'Clear amount' : key.label}
      >
        {key.label}
      </button>
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
      <h2 id="settings-heading">Conversion</h2>

      <form onsubmit={saveSettings}>
        <div class="field">
          <label for="fromInput">FROM</label>
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
          <label for="toInput">TO</label>
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
  }

  .settings-btn {
    border: 0;
    background: #fff;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 19px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    transition: transform 0.15s ease, background-color 0.15s ease;
  }

  .settings-btn:active {
    transform: scale(0.92);
    background: #f0f0ee;
  }

  /* Display Area Improvements */
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
    background: #ffffff;
    border-radius: 20px;
    padding: 14px 18px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.035);
    border: 1px solid rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }

  .output-card {
    cursor: pointer;
  }

  .output-card:hover {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
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
    background: #f0f0ed;
    color: #444;
    font-size: 13px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .currency-badge:hover {
    background: #e5e5e1;
    color: #111;
  }

  .currency-badge.target {
    background: #eef7f2;
    color: #15803d;
  }

  .currency-badge.target:hover {
    background: #dcf1e5;
  }

  .copied-pill {
    font-size: 11px;
    font-weight: 700;
    color: #15803d;
    background: #dcfce7;
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
    color: #111;
  }

  .entered .dimmed {
    color: #bbb;
  }

  .converted {
    font-size: clamp(32px, 9.5vw, 50px);
    font-weight: 750;
    letter-spacing: -1.2px;
    color: #15803d;
  }

  .rate-bar {
    margin-top: 6px;
    color: #8e8e93;
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
    background: rgba(0, 0, 0, 0.08);
  }

  .swap-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
    color: #555;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 10px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    touch-action: manipulation;
    transition: transform 0.2s ease, background-color 0.15s ease, color 0.15s ease;
  }

  .swap-btn:hover {
    background: #f7f7f5;
    color: #111;
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
    background: #fff;
    font-size: 27px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    transition: transform 0.08s ease, background-color 0.08s ease;
  }

  .key:active {
    transform: scale(0.95);
    background: #e9e9e7;
  }

  .key.action {
    background: #deded9;
    font-size: 21px;
  }

  .key.action:active {
    background: #d0d0ca;
  }

  /* Settings Modal */
  .settings-panel {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .sheet {
    width: 100%;
    max-width: 500px;
    background: #fff;
    border-radius: 28px 28px 0 0;
    padding: 22px;
    padding-bottom: max(24px, env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
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
    background: #ddd;
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

  .field label {
    display: block;
    font-size: 13px;
    color: #777;
    font-weight: 600;
    margin-bottom: 7px;
    letter-spacing: 0.3px;
  }

  .field input {
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 14px;
    padding: 15px;
    font-size: 17px;
    outline: none;
    font-family: inherit;
    background: #fafaf9;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .field input:focus {
    border-color: #111;
    background: #fff;
  }

  .save {
    width: 100%;
    margin-top: 10px;
    height: 54px;
    border: 0;
    border-radius: 16px;
    background: #111;
    color: #fff;
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
