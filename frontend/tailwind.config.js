export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      colors: {
        traffic: {
          green: '#059669',
          amber: '#d97706',
          red: '#dc2626',
          blue: '#2563eb',
          indigo: '#4f46e5'
        }
      },
      boxShadow: {
        'glass': '0 8px 30px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        'glass-hover': '0 14px 38px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        'glass-elevated': '0 20px 48px rgba(0, 0, 0, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        'alert-red': '0 8px 25px rgba(220, 38, 38, 0.12)',
        'alert-amber': '0 8px 25px rgba(217, 119, 6, 0.12)',
        'alert-green': '0 8px 25px rgba(5, 150, 105, 0.12)'
      }
    }
  },
  plugins: []
};
