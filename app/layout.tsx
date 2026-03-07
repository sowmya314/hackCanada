import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BulkBridge",
  description: "Coordinate Costco bulk splits across your community.",
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
