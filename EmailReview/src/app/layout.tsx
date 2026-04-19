import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Email Review',
  description: 'Executive email oversight and follow-up detection',
  icons: { icon: '/eer/favicon.png' },
};

// Inline script that runs before first paint to prevent flash of wrong theme
const themeScript = `
(function() {
  var saved = localStorage.getItem('theme');
  var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  if (window.self !== window.top) document.documentElement.classList.add('in-iframe');
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
