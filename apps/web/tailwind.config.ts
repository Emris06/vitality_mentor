import type { Config } from 'tailwindcss';

/**
 * AI-Mentor "Clear Sky SaaS" design system.
 * Reference: reference/DESIGN.md + dashboard mocks in reference/.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EBF3FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          500: '#0EA5E9',
          600: '#0284C7',
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
        // Back-compat alias used throughout dashboards.
        ink: {
          50: '#F8FAFF',
          100: '#EEF2FA',
          200: '#CBD5E1',
          300: '#A8B5C7',
          400: '#7B8AA0',
          500: '#64748B',
          600: '#4A5B73',
          700: '#334155',
          800: '#263449',
          900: '#1E293B',
        },
        // Mentora warm theme (v3) — additive, used by InternShell + warm
        // primitives. Cool palettes above remain authoritative for ErpShell.
        mentora: {
          50: '#f1f4ff',
          100: '#e0e7ff',
          200: '#c2cdff',
          300: '#99a8ff',
          400: '#6079ff',
          500: '#3656ff',
          600: '#2046ff', // brand pivot — matches reference/logo_name.jpg
          700: '#1a3cd8',
          800: '#1832ad',
          900: '#16297b',
        },
        coral: {
          50: '#fff5f1',
          100: '#ffe5dd',
          200: '#ffc8b8',
          300: '#ffa088',
          400: '#ff8163',
          500: '#ff7150',
          600: '#ff6b4a', // accent pivot
          700: '#e8553a',
          800: '#b3402a',
          900: '#7d2b1c',
        },
        cream: {
          50: '#fbfaf7',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Sora"', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        // Mentora warm theme (v3) — additive.
        // `jakarta` (not `display`) so the existing Sora binding stays intact.
        jakarta: [
          '"Plus Jakarta Sans"',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        tech: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'mono-tech': [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.07)',
        'card-hover': '0 8px 24px rgba(15,23,42,0.08)',
        pop: '0 24px 64px rgba(15,23,42,0.18)',
        focus: '0 0 0 3px rgba(59, 130, 246, 0.24)',
        // Mentora warm theme (v3) — multi-layer compositions from mockup 06.
        'card-warm':
          '0 1px 0 rgba(14, 17, 48, 0.04), 0 8px 24px -8px rgba(14, 17, 48, 0.10), 0 24px 48px -24px rgba(14, 17, 48, 0.12)',
        'card-warm-sm':
          '0 1px 0 rgba(14, 17, 48, 0.04), 0 4px 16px -6px rgba(14, 17, 48, 0.08)',
        chip:
          '0 1px 0 rgba(14, 17, 48, 0.04), 0 2px 8px -2px rgba(14, 17, 48, 0.06)',
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.2, 0.65, 0.3, 0.95)',
        // Mentora warm theme (v3).
        'bounce-soft': 'bounce-soft 2.6s ease-in-out infinite',
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
        // Mentora warm theme (v3).
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
