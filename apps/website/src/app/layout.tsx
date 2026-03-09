import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import './globals.css'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

const SITE_URL = 'https://stripe402.com'
const TITLE = 'stripe402 — HTTP 402 Payments with Stripe'
const DESCRIPTION =
  'An open standard for internet-native API and agentic payments using HTTP 402 and Stripe. No signup, no API keys — payment is the authentication. AI agents pay for APIs on their first request.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'stripe402',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'stripe402 — HTTP 402 Payments with Stripe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@stripe402',
    creator: '@stripe402',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  other: {
    'theme-color': '#0A2540',
  },
  keywords: [
    'HTTP 402',
    'payment required',
    'API monetization',
    'Stripe payments',
    'agentic payments',
    'AI agent payments',
    'micropayments',
    'API billing',
    'machine-to-machine payments',
    'payment protocol',
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'stripe402',
  description: DESCRIPTION,
  url: SITE_URL,
  codeRepository: 'https://github.com/stripe402/stripe402',
  programmingLanguage: 'TypeScript',
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Cross-platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${hanken.variable} ${jetbrains.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-[family-name:var(--font-hanken)]">{children}</body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  )
}
