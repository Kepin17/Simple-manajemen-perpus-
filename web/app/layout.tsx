import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { BackdropOrnament } from "@/components/ornament";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Perpustakaan",
  description: "Katalog, peminjaman, dan keterlambatan perpustakaan.",
};

// Terapkan tema tersimpan sebelum render agar tidak berkedip.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <BackdropOrnament />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-sm text-muted">
          <div className="flex items-center gap-2 border-t border-line pt-4">
            <span aria-hidden="true" className="ornament orn-parang h-4 w-16 bg-gold opacity-70" />
            <span>Perpustakaan</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
