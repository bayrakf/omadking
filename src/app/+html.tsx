import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const TITLE = 'OMADCoach — meal timing and macros for OMAD + evening training';
const DESCRIPTION =
  'Plan one meal a day around your workout. Get your eating window, macros that scale with session intensity, and meal-prep recipes with reheat instructions.';

/**
 * Background is set before hydration so a dark-mode user doesn't get a white
 * flash while the JS bundle loads.
 */
const PRELOAD_THEME = `
:root { color-scheme: dark; }

/* Titanium Carbon ground: eliminates any white canvas flash */
html, body {
  background-color: #08090C !important;
  color: #F8FAFC !important;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover so the tab bar clears the home indicator on iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta
          name="keywords"
          content="OMAD, one meal a day, intermittent fasting, sports nutrition, meal timing, macro calculator, fasting app"
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        <meta name="theme-color" content="#08090C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="OMADCoach" />
        <meta name="mobile-web-app-capable" content="yes" />

        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="OMADCoach" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: PRELOAD_THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
