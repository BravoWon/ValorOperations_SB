import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        // Valor brand extras
        navy: {
          darkest: 'hsl(var(--navy-darkest))',
          medium: 'hsl(var(--navy-medium))',
          light: 'hsl(var(--navy-light))',
        },
        gold: {
          DEFAULT: 'hsl(var(--gold))',
          light: 'hsl(var(--gold-light))',
          bright: 'hsl(var(--gold-bright))',
          dark: 'hsl(var(--gold-dark))',
        },
        cyan: { DEFAULT: 'hsl(var(--cyan))' },
        green: { DEFAULT: 'hsl(var(--green))' },
        red: { DEFAULT: 'hsl(var(--red))' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Zodiak', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Satoshi', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        sans: ['var(--font-body)', 'Satoshi', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.7)',
        'glass-lg': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 40px 80px -32px rgba(0,0,0,0.8)',
        'gold-glow': '0 0 0 1px rgba(201,168,76,0.3), 0 0 24px -6px rgba(201,168,76,0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
