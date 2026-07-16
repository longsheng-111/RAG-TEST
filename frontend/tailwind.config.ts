import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          light: 'var(--brand-soft)',
          dark: 'var(--brand-hover)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        'bg-sidebar': 'var(--bg-panel)',
        'bg-page': 'var(--bg-paper)',
        'bg-card': 'var(--bg-panel)',
        'bg-hover': 'var(--bg-sunken)',
        'text-primary': 'var(--ink)',
        'text-secondary': 'var(--ink-secondary)',
        'text-muted': 'var(--ink-faint)',
        success: 'var(--cite-3)',
        warning: 'var(--cite-4)',
        error: 'var(--brand)',
        info: 'var(--cite-1)',
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          soft: 'var(--brand-soft)',
        },
        cite: {
          1: 'var(--cite-1)',
          2: 'var(--cite-2)',
          3: 'var(--cite-3)',
          4: 'var(--cite-4)',
          5: 'var(--cite-5)',
          6: 'var(--cite-6)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        xl: 'var(--radius)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
  corePlugins: {
    preflight: false, // 避免与 Ant Design 样式冲突
  },
};

export default config;
