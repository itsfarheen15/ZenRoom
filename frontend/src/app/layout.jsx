import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
export const metadata = {
    title: "Developer Zen Room — Less noise. More flow.",
    description: "A quiet workspace for your developer day. News, ideas, tasks, and a little room to think.",
    icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }) {
    return (<html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>);
}
