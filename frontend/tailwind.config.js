/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        page: 'var(--bg-page)',
        border: 'var(--border)',
        subtle: 'var(--fill-subtle)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        brand: {
          navy: 'var(--brand-navy)',
          steel: 'var(--brand-steel)',
        },
        decision: {
          continue: {
            DEFAULT: 'var(--decision-continue-solid)',
            text: 'var(--decision-continue-text)',
            tint: 'var(--decision-continue-tint)',
            border: 'var(--decision-continue-border)',
            solid: 'var(--decision-continue-solid)',
          },
          stepup: {
            DEFAULT: 'var(--decision-stepup-solid)',
            text: 'var(--decision-stepup-text)',
            tint: 'var(--decision-stepup-tint)',
            border: 'var(--decision-stepup-border)',
            solid: 'var(--decision-stepup-solid)',
          },
          endcall: {
            DEFAULT: 'var(--decision-endcall-solid)',
            text: 'var(--decision-endcall-text)',
            tint: 'var(--decision-endcall-tint)',
            border: 'var(--decision-endcall-border)',
            solid: 'var(--decision-endcall-solid)',
          },
        },
        mode: {
          real: 'var(--brand-navy)',
          cached: 'var(--brand-steel)',
          demo: {
            text: 'var(--mode-demo-text)',
            bg: 'var(--mode-demo-bg)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
