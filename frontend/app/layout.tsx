import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-context";
import { THEME_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

/**
 * Inter for the interface: it holds up at the 13-14px sizes this application
 * uses and has the tabular figures the tables need. JetBrains Mono carries
 * identifiers and slugs.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  title: "Restaurant OS",
  description: "Restaurant management platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
      // The theme is applied by the script below before the first paint, which
      // means the server sends markup this attribute is missing from. React would
      // otherwise report the difference as a hydration error on every load.
      suppressHydrationWarning
    >
      <head>
        {/*
         * Applies the stored theme before anything is painted.
         *
         * Blocking and inline on purpose. The server cannot read localStorage, so
         * the first paint would otherwise use whatever the operating system says,
         * and a manager who chose light would get a dark flash on every single
         * navigation. Deferring it, or waiting for React, is the flash.
         *
         * The source is built in `lib/theme/theme.ts` from the same key and
         * attribute the hook uses, so the two cannot drift.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
