import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AppShell from "./AppShell";
import ServiceWorker from "./ServiceWorker";

export const metadata: Metadata = {
  title: "Unidesk",
  description: "Esse3 ed Elly da un'unica interfaccia.",
  manifest: "/manifest.webmanifest",
  applicationName: "Unidesk",
  appleWebApp: { capable: true, title: "Unidesk", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/unipr.svg", type: "image/svg+xml" }, { url: "/icon-192.png" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#005eb8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body style={{ margin: 0 }}>
        <AntdRegistry>
          <AppShell>{children}</AppShell>
        </AntdRegistry>
        <ServiceWorker />
      </body>
    </html>
  );
}
