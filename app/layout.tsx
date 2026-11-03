import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Social Engine • Automated Publishing',
  description: 'Automated social media engine using Zernio and MongoDB',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090D16] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

