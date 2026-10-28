import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/blocks";
import { Button } from "@/components/ui/button";
import { getSite } from "@/lib/content";

const site = getSite();

export const metadata: Metadata = {
  title: "About",
  description: site.about.paragraphs[0],
};

export default function AboutPage() {
  const press = site.about.press ?? [];
  const links = site.about.links ?? [];

  return (
    <PageShell className="max-w-3xl">
      <PageHeader eyebrow={site.name} title={site.about.heading} />
      <div className="grid gap-4 text-base leading-7 text-foreground/90">
        {site.about.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {press.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Interviews</h2>
          <ul className="mt-4 grid gap-3">
            {press.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border bg-white px-4 py-3 transition hover:border-brand-blue"
                >
                  <span className="text-xs font-semibold tracking-[0.16em] text-brand-blue uppercase">
                    {item.publication}
                    {item.date ? ` · ${item.date}` : ""}
                  </span>
                  <span className="mt-1 block font-medium group-hover:text-brand-red">{item.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {links.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Watch and follow</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {links.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center rounded-md border bg-white px-4 font-medium hover:border-brand-blue hover:text-brand-red"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button asChild className="mt-8 h-11 px-5 hover:bg-brand-red">
        <Link href="/contact/">Contact</Link>
      </Button>
    </PageShell>
  );
}
