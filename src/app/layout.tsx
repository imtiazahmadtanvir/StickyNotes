import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sticky Notes',
  description: 'Fast, offline-first Microsoft Sticky Notes clone with cloud sync',
  icons: {
    icon: '/app-logo.png',
    shortcut: '/app-logo.png',
    apple: '/app-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/app-logo.png" />
        <link rel="apple-touch-icon" href="/app-logo.png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
