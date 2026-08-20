<script lang="ts">
  export type ThemeMode = 'system' | 'light' | 'dark'

  interface Props {
    isOpen: boolean
    from: string
    to: string
    rate: number
    themeMode: ThemeMode
    onclose: () => void
    onsave: (settings: { from: string; to: string; rate: number; theme: ThemeMode }) => void
  }

  let { isOpen, from, to, rate, themeMode, onclose, onsave }: Props = $props()

  let formFrom = $state('')
  let formTo = $state('')
  let formRate = $state('')
  let formTheme = $state<ThemeMode>('system')

  $effect(() => {
    if (isOpen) {
      formFrom = from
      formTo = to
      formRate = String(rate)
      formTheme = themeMode
    }
  })

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const cleanFrom = formFrom.trim().toUpperCase() || 'USD'
    const cleanTo = formTo.trim().toUpperCase() || 'BDT'
    const parsedRate = Number(formRate)
    const cleanRate = !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : 1

    onsave({
      from: cleanFrom,
      to: cleanTo,
      rate: cleanRate,
      theme: formTheme
    })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      onclose()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 bg-sheet-backdrop flex items-end justify-center z-50 backdrop-blur-xs"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose()
    }}
  >
    <div
      class="w-full max-w-[500px] bg-sheet text-main rounded-t-[28px] p-[22px] pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl animate-slide-up before:block before:w-[42px] before:h-[5px] before:bg-handle before:rounded-full before:mx-auto before:mb-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
    >
      <h2 id="settings-heading" class="m-0 mb-5 text-2xl font-bold">Settings</h2>

      <form onsubmit={handleSubmit}>
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

        <button type="submit" class="w-full mt-2.5 h-[54px] border-0 rounded-2xl bg-save-btn text-save-btn-text font-bold text-[17px] cursor-pointer font-sans touch-manipulation transition-all active:scale-[0.98] active:opacity-90">
          Save
        </button>
      </form>
    </div>
  </div>
{/if}
