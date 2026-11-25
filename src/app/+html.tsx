/**
 * Static web HTML wrapper (`npx expo export --platform web`).
 *
 * Preloads the actual typography stack (`Archivo`, `Hanken Grotesk`,
 * `JetBrains Mono`) so telemetry figures never jump, and sets an initial
 * surface polarity without `!important` locks so user-selected Light/Dark/
 * System themes take effect immediately after hydration.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const PRELOAD_STYLE = `
:root { color-scheme: dark light; }
html, body {
  margin: 0;
  padding: 0;
  background-color: #090B0E;
  color: #F3F5F8;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#root { min-height: 100%; display: flex; flex-direction: column; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>OMADCoach</title>
        <meta name="theme-color" content="#090B0E" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: PRELOAD_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
