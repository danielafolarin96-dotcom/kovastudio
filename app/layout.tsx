import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-poppins" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} | Be anyone, live`, template: `%s | ${APP_NAME}` },
  description:
    "Upload a character and become it live on your webcam. Record, stream through OBS, or go live anywhere. Right in your browser.",
};

export const viewport: Viewport = { themeColor: "#07060a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
