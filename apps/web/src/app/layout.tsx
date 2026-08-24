import type { Metadata, Viewport } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: {
    default: "Thutha — Tũgĩe Hamwe",
    template: "%s · Thutha",
  },
  description: "The modern digital gathering place for Agĩkũyũ stories, creators, conversations, and commerce.",
  applicationName: "Thutha",
  keywords: ["Kikuyu", "Agikuyu", "Kenya", "social network", "creators", "community"],
};

export const viewport: Viewport = {
  themeColor: "#071a15",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
