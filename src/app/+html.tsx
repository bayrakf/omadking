/**
 * Mobile-native HTML shell (`npx expo export --platform web`).
 *
 * - Safe-area support (`viewport-fit=cover`, `interactive-widget=resizes-content`)
 *   without disabling accessibility pinch-zoom.
 * - Dual-scheme `theme-color` & `color-scheme` so status bar / browser chrome
 *   match Light (`#F2F2F7`) and Dark (`#0E0F12`) before hydration.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const PRELOAD_STYLE = `
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  html, body { background-color: #0E0F12; color: #F5F5F7; }
}
@media (prefers-color-scheme: light) {
  html, body { background-color: #F2F2F7; color: #1C1C1E; }
}
html, body {
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#root { min-height: 100%; min-height: 100dvh; display: flex; flex-direction: column; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F2F7" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0E0F12" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <title>OMADCoach</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: PRELOAD_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
