import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { BUNDLE_IDENTITY } from "@/generated/bundle-identity";

export const metadata: Metadata = {
  title: "Zylod — B2B Wholesale Marketplace",
  description: "Bangladesh's premier B2B wholesale marketplace connecting retailers with verified suppliers.",
  icons: { icon: "/zylod-logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* F1/F5 provenance: the deployed bundle's identity, set BEFORE any
            hydration so the native shells can verify exactly which web bundle
            they are executing (window.__ZylodBundleIdentity). Inert in
            browsers. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ZylodBundleIdentity=${JSON.stringify(BUNDLE_IDENTITY)};`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
