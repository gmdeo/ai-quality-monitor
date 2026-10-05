import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Quality Monitor - Track Model Performance Over Time",
  description: "Monitor AI model quality degradation with systematic testing and trend analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
