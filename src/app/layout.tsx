import type { Metadata } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SageMate",
  description: "Generate and grade your own revision questions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full" suppressHydrationWarning>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
