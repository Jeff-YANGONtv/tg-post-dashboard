import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '../components/pwa-register';

export const metadata: Metadata = {
  title: 'Signal Relay',
  description: 'Telegram content distribution control room',
  applicationName: 'Signal Relay',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Signal Relay',
  },
};

export const viewport: Viewport = {
  themeColor: '#08111f',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
