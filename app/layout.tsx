import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Queue Management System",
  description: "Full multi-tenant queue orchestration platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </body>
    </html>
  );
}
