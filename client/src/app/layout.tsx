import { Inter } from "next/font/google";
import "./globals.css";
import { Metadata } from "next";
import HeaderFooter from "@/components/layout/HeaderFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aura Plus - AI Therapy Companion",
  description: "Your AI-powered therapy companion for mental wellness and personal growth.",
  openGraph: {
    title: "Aura Plus - AI Therapy Companion",
    description: "Your AI-powered therapy companion for mental wellness and personal growth.",
    type: "website",
    siteName: "Aura Plus",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aura Plus - AI Therapy Companion",
    description: "Your AI-powered therapy companion for mental wellness and personal growth.",
  },
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <HeaderFooter>{children}</HeaderFooter>
      </body>
    </html>
  );
}
