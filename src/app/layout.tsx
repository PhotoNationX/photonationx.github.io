import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrand, getMetadataBase, getSite, logoSources } from "@/lib/content";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const site = getSite();
const brand = getBrand();

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.name,
    description: site.description,
    images: [
      {
        url: brand.banner.ogImage.src,
        width: brand.banner.ogImage.width,
        height: brand.banner.ogImage.height,
        alt: site.banner.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
    images: [brand.banner.ogImage.src],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const logo = logoSources(site.header.logo);
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <SiteHeader
          name={site.name}
          logo={{ sources: logo, width: brand.logo.width, height: brand.logo.height }}
          nav={site.header.nav}
          categories={site.photoCategories}
        />
        <main id="content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
