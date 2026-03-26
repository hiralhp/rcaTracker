/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slds: {
          blue: '#0176D3',
          'dark-blue': '#032D60',
          'light-bg': '#F3F3F3',
          'border': '#DDDBDA',
          'text': '#181818',
          'text-weak': '#3E3E3C',
        },
      },
      fontFamily: {
        sans: ['"Salesforce Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        slds: '4px',
      },
      boxShadow: {
        card: '0 2px 2px 0 rgba(0,0,0,.10), 0 2px 4px 0 rgba(0,0,0,.08)',
        'card-hover': '0 4px 8px 0 rgba(0,0,0,.12), 0 2px 4px 0 rgba(0,0,0,.08)',
      },
    },
  },
  plugins: [],
};
