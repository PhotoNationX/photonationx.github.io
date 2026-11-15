import { getBrand, getPhotos, getSite, logoSources } from "@/lib/content";
import type { Photo } from "@/lib/content";
import { largestWidth, photoSrc, srcSet, withBasePath } from "@/lib/media";

/**
 * Opening banner. `banner.style` in content/site.json:
 * - collage: the supplied collage, cropped and sized by `npm run brand`
 * - grid: five gallery photos around the logo, in the reference collage order
 */
export function HomeBanner() {
  const site = getSite();
  const brand = getBrand();

  if (site.banner.style === "grid") {
    const photos = photosForGrid(getPhotos(), site.banner.gridPhotos);
    if (photos.length > 0) {
      return <GridBanner alt={site.banner.alt} photos={photos} />;
    }
  }

  const largest = brand.banner.sources[brand.banner.sources.length - 1];
  return (
    <section className="bg-[#080808]" aria-label={site.banner.alt}>
      <img
        src={withBasePath(largest.src)}
        srcSet={srcSet(brand.banner.sources)}
        sizes="100vw"
        width={brand.banner.width}
        height={brand.banner.height}
        alt={site.banner.alt}
        fetchPriority="high"
        className="mx-auto h-auto w-full max-w-[1125px]"
      />
    </section>
  );
}

function GridBanner({ alt, photos }: { alt: string; photos: Photo[] }) {
  const site = getSite();
  const brand = getBrand();
  const sources = logoSources(site.header.logo);
  const largest = sources[sources.length - 1];
  // Two rows. The logo is the top-center cell: yacht, logo, two women, then the row below.
  const cells: Array<Photo | null> = [
    photos[0] ?? null,
    null,
    photos[1] ?? null,
    photos[2] ?? null,
    photos[3] ?? null,
    photos[4] ?? null,
  ];

  return (
    <section className="bg-[#080808]" aria-label={alt}>
      {/* 3/2 is the frame of these photographs, so the header shows each one whole. */}
      <div className="mx-auto grid w-full max-w-[1125px] grid-cols-3">
        {cells.map((photo, index) =>
          photo ? (
            <img
              key={photo.id}
              src={photoSrc(photo.id, largestWidth(photo.widths))}
              alt=""
              width={photo.width}
              height={photo.height}
              className="aspect-[3/2] h-full w-full object-cover object-center"
            />
          ) : (
            <div key={`logo-${index}`} className="flex aspect-[3/2] items-center justify-center bg-[#080808] p-3 sm:p-5">
              <img
                src={withBasePath(largest.src)}
                srcSet={srcSet(sources)}
                sizes="30vw"
                width={brand.logo.width}
                height={brand.logo.height}
                alt={index === 1 ? site.name : ""}
                className="h-auto w-full"
              />
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function photosForGrid(photos: Photo[], ids: string[]): Photo[] {
  if (ids.length === 0) return photos.slice(0, 8);
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return ids.flatMap((id) => {
    const photo = byId.get(id);
    return photo ? [photo] : [];
  });
}
