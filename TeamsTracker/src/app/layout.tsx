import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Teams Tasks',
  description: 'Teams chat task tracking and follow-up detection',
  icons: { icon: '/teams/favicon.png' },
};

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
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
