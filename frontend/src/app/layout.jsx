import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { connection } from "next/server";
export const metadata = {
    title: "Developer Zen Room — Less noise. More flow.",
    description: "A quiet workspace for your developer day. News, ideas, tasks, and a little room to think.",
    icons: { icon: "/icon.svg" },
};
export default async function RootLayout({ children }) {
    // Nonces must belong to this response, never to a cached static document.
    await connection();
    return (<html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>);
}
