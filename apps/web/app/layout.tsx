import "./globals.css";
import type { Metadata } from "next";
import { ShieldMark } from "@/components/ShieldMark";

export const metadata: Metadata = {
  title: "zk-trial — private clinical trial matching",
  description:
    "Prove clinical trial eligibility without exposing your medical history. Research/demo MVP using synthetic data only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-void text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 bg-grid-faint bg-grid opacity-40" />
        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-white/5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ShieldMark />
          zk-trial
        </a>
        <nav className="flex items-center gap-6 text-sm text-slate-300">
          <a href="/trials/TRIAL-001" className="hover:text-white">
            Trials
          </a>
          <a href="/sponsor" className="hover:text-white">
            Sponsor Dashboard
          </a>
          <a
            href="https://github.com/"
            className="rounded-md border border-white/10 px-3 py-1.5 hover:border-accent-purple hover:text-white"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
      <p>
        zk-trial is a research/demo prototype using entirely synthetic data. It is not a medical
        device, a clinical trial enrollment system, or a substitute for professional medical
        advice.
      </p>
      <p className="mt-1">Built for a Web3 + Zero-Knowledge Level 4 submission.</p>
    </footer>
  );
}
