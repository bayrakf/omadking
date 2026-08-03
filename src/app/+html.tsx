import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>OMADCoach — AI Performance Planner for OMAD & Workout Fueling</title>
        <meta
          name="description"
          content="Optimize your One Meal A Day around evening workouts. AI-calculated meal timing, precise macros & reheatable meal prep recipes."
        />
        <meta name="keywords" content="OMAD, intermittent fasting, sports nutrition, meal timing, macro calculator, fasting app" />

        {/* Open Graph */}
        <meta property="og:title" content="OMADCoach — AI Performance Planner" />
        <meta property="og:description" content="Fuel your fasting & peak workout performance with AI meal timing." />
        <meta property="og:type" content="website" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
