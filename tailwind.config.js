/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          panel: 'var(--bg-panel)',
          header: 'var(--bg-header)',
          input: 'var(--bg-input)',
          hover: 'var(--bg-hover)',
          selection: 'var(--bg-selection)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          accent: 'var(--text-accent)',
        },
        border: {
          DEFAULT: 'var(--border-color)',
        },
        accent: {
          DEFAULT: 'var(--accent-color)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border-color)',
      },

    },
  },
  plugins: [],
}
