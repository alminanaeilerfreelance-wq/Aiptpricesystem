import type { Metadata } from 'next';
import './globals.css';
import EmotionCacheProvider from '@/components/layout/EmotionCacheProvider';

export const metadata: Metadata = {
  title: 'IP Law Firm Quotation System',
  description: 'Enterprise IP Law Firm Quotation Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EmotionCacheProvider>{children}</EmotionCacheProvider>
      </body>
    </html>
  );
}
