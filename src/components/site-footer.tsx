import Link from "next/link";
import { getSite } from "@/lib/content";

export function SiteFooter() {
  const site = getSite();
  const year = process.env.NEXT_PUBLIC_BUILD_YEAR;

  return (
    <footer className="mt-auto border-t bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {site.name}
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {site.header.nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-brand-red">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
