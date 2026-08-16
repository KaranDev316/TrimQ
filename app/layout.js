import "./globals.css";

export const metadata = {
  title: "HairQueue",
  description: "A fair first-come-first-served queue for one barber.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
