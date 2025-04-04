import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aura Plus - AI Therapy Companion",
  description: "Your AI-powered therapy companion for mental wellness and personal growth.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b border-gray-200">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
              <span className="font-bold text-xl">Aura Plus</span>
            </div>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm font-medium hover:text-blue-600">
                Home
              </Link>
              <Link href="/about" className="text-sm font-medium hover:text-blue-600">
                About
              </Link>
              <Link href="/login" className="text-sm font-medium hover:text-blue-600">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Sign Up
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-gray-200 py-6 md:py-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-2 mb-4 md:mb-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
                <span className="font-bold">Aura Plus</span>
              </div>
              <div className="text-center md:text-right text-sm text-gray-500">
                <p>© 2024 Aura Plus. All rights reserved.</p>
                <p className="mt-1">Your AI therapy companion for better mental health.</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
