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
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <Navbar />
        <main className="max-w-7xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}