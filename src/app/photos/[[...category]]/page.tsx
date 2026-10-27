import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyNote, PageHeader, PageShell } from "@/components/blocks";
import { PhotoGrid } from "@/components/photo-grid";
import { categoryBySlug, getPhotosByCategory, getSite } from "@/lib/content";
import { cn } from "cn";

export function generateStaticParams() {
  return [
    { category: [] as string[] },
    ...getSite().photoCategories.map((category) => ({ category: [category.slug] })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category?: string[] }>;
}): Promise<Metadata> {
  const { category } = await params;
  const slug = category?.[0];
  const site = getSite();
  if (!slug) {
    return { title: "Photos", description: `Photographs by ${site.name}.` };
  }
  const match = categoryBySlug(slug);
  if (!match) return { title: "Photos" };
  return { title: match.title, description: `${match.title} photographs by ${site.name}.` };
}

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ category?: string[] }>;
}) {
  const { category } = await params;
  if (category && category.length > 1) notFound();
  const slug = category?.[0];
  const match = slug ? categoryBySlug(slug) : undefined;
  if (slug && !match) notFound();

  const site = getSite();
  const photos = getPhotosByCategory(slug);
  const title = match?.title ?? "Photos";

  return (
    <PageShell>
      <PageHeader
        eyebrow={site.name}
        title={title}
        lede={photos.length > 0 ? "Select a photograph to view it larger." : undefined}
      />
      {site.photoCategories.length > 0 ? (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Photo categories">
          <CategoryLink href="/photos/" active={!slug}>
            All photos
          </CategoryLink>
          {site.photoCategories.map((item) => (
            <CategoryLink key={item.slug} href={`/photos/${item.slug}/`} active={item.slug === slug}>
              {item.title}
            </CategoryLink>
          ))}
        </nav>
      ) : null}
      {photos.length > 0 ? (
        <PhotoGrid photos={photos} aspect={tileAspect(site.display.photoTileAspect)} />
      ) : (
        <EmptyNote
          title="No photos in this gallery yet"
          body="Photographs added to this category will show up here."
        />
      )}
    </PageShell>
  );
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium",
        active
          ? "border-brand-blue bg-brand-blue text-white"
          : "border-border bg-white text-foreground hover:border-brand-red hover:text-brand-red",
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function tileAspect(value: string): string {
  return /^\d+\s*\/\s*\d+$/.test(value) ? value.replace(/\s+/g, "") : "4 / 5";
}
