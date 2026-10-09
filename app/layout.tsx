import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";

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
        <AuthProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto p-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
