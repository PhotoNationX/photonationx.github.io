"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import type { Photo } from "@/lib/content";
import { largestWidth, photoLabel, photoSrc, photoSrcSet } from "@/lib/media";

export function PhotoGrid({ photos, aspect = "4 / 5" }: { photos: Photo[]; aspect?: string }) {
  const [index, setIndex] = useState(-1);
  const described = photos.some((photo) => photo.caption || photo.date);
  const slides = photos.map((photo) => {
    const text = [photo.caption, photo.date].filter(Boolean).join(" · ");
    return {
      src: photoSrc(photo.id, largestWidth(photo.widths)),
      alt: photoLabel(photo),
      width: photo.width,
      height: photo.height,
      srcSet: photo.widths.map((width) => ({
        src: photoSrc(photo.id, width),
        width,
        height: Math.round((photo.height / photo.width) * width),
      })),
      description: text || undefined,
    };
  });

  return (
    <>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 md:gap-2">
        {photos.map((photo, photoIndex) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(photoIndex)}
              className="group block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
              style={{ backgroundColor: photo.color, aspectRatio: aspect }}
            >
              <img
                src={photoSrc(photo.id, photo.widths[0])}
                srcSet={photoSrcSet(photo)}
                sizes="(min-width: 768px) 25vw, 50vw"
                alt={photoLabel(photo)}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </button>
            {photo.caption || photo.date ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {[photo.caption, photo.date].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={Math.max(index, 0)}
        slides={slides}
        plugins={described ? [Zoom, Captions] : [Zoom]}
        captions={{ descriptionTextAlign: "center" }}
        zoom={{ maxZoomPixelRatio: 2, scrollToZoom: true }}
        controller={{ closeOnBackdropClick: true }}
        styles={{ container: { backgroundColor: "rgba(8, 10, 14, 0.96)" } }}
      />
    </>
  );
}
