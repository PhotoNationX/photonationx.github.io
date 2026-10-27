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
  return (
    <PageShell className="max-w-3xl">
      <PageHeader eyebrow={site.name} title={site.about.heading} />
      <div className="grid gap-4 text-base leading-7 text-foreground/90">
        {site.about.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <Button asChild className="mt-8 h-11 px-5 hover:bg-brand-red">
        <Link href="/contact/">Contact</Link>
      </Button>
    </PageShell>
  );
}
