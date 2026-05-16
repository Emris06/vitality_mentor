import type { Config } from 'tailwindcss';

/**
 * AI-Mentor design system — clean SaaS CRM tokens.
 * Aligned to the reference dashboards in `reference/`:
 * white cards on soft slate-50, blue primary, status colors,
 * DM Sans display + Geist body + JetBrains Mono numerics.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF4FF',
          100: '#D9E5FF',
          200: '#B4CAFE',
          300: '#85A8FD',
          400: '#5A85FB',
          500: '#3D6BFE',
          600: '#2D6BFE',
          700: '#1E4FCC',
          800: '#163F9E',
          900: '#102D70',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        warn: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        accent: {
          purple: '#7C3AED',
          orange: '#F97316',
          pink: '#EC4899',
          teal: '#14B8A6',
        },
        // Back-compat aliases — existing components use `ink-*`; keep them
        // pointed at the new slate scale so they inherit the refresh.
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"IBM Plex Serif"', '"IBM Plex Sans"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 1px 0 rgba(15, 23, 42, 0.02)',
        'card-hover': '0 4px 12px 0 rgba(15, 23, 42, 0.08)',
        pop: '0 8px 24px 0 rgba(15, 23, 42, 0.10), 0 2px 4px 0 rgba(15, 23, 42, 0.04)',
        focus: '0 0 0 3px rgba(45, 107, 254, 0.18)',
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.2, 0.65, 0.3, 0.95)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
