import Link from "next/link";
import { HomeBanner } from "@/components/home-banner";
import { PhotoGrid } from "@/components/photo-grid";
import { VideoGrid } from "@/components/video-grid";
import { EmptyNote, SectionHeading } from "@/components/blocks";
import { Button } from "@/components/ui/button";
import { getPhotos, getSite, getVideos, isSampleContent } from "@/lib/content";

export default function HomePage() {
  const site = getSite();
  const photos = getPhotos();
  const videos = getVideos();
  const recentPhotos = photos.slice(0, 8);
  const recentVideos = videos.slice(0, 4);
  const samples = isSampleContent([...photos, ...videos]);

  return (
    <>
      <HomeBanner />
      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-blue uppercase">{site.home.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">{site.home.heading}</h1>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">{site.home.intro}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 px-5 hover:bg-brand-red">
            <Link href="/photos/">Browse photos</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-5 hover:border-brand-red hover:bg-white hover:text-brand-red">
            <Link href="/videos/">Watch videos</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-5 hover:border-brand-red hover:bg-white hover:text-brand-red">
            <Link href="/contact/">Book a session</Link>
          </Button>
        </div>
        {samples ? (
          <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
            Sample images are filling the galleries until the photo library is imported.
          </p>
        ) : null}
      </section>

      <section className="bg-brand-sky/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-14">
          <SectionHeading title="Recent photos" href="/photos/" action="All photos" />
          {recentPhotos.length > 0 ? (
            <PhotoGrid photos={recentPhotos} aspect={tileAspect(site.display.photoTileAspect)} />
          ) : (
            <EmptyNote title="No photos yet" body="New photographs will show up here." />
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:py-14">
        <SectionHeading title="Videos" href="/videos/" action="All videos" />
        {recentVideos.length > 0 ? (
          <VideoGrid videos={recentVideos} />
        ) : (
          <EmptyNote title="No videos yet" body="Videos will show up here, and each one plays when you select it." />
        )}
      </section>

      <section className="bg-brand-sky/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 md:flex-row md:items-end md:justify-between md:py-14">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">{site.about.heading}</h2>
            <p className="mt-3 text-muted-foreground">{site.about.paragraphs[0]}</p>
          </div>
          <Button asChild variant="outline" className="h-11 w-fit bg-white px-5 hover:border-brand-red hover:text-brand-red">
            <Link href="/about/">About</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
        <h2 className="text-2xl font-semibold tracking-tight">{site.contact.heading}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{site.contact.intro}</p>
        <Button asChild size="lg" className="mt-6 h-11 px-5 hover:bg-brand-red">
          <Link href="/contact/">Get in touch</Link>
        </Button>
      </section>
    </>
  );
}

function tileAspect(value: string): string {
  return /^\d+\s*\/\s*\d+$/.test(value) ? value.replace(/\s+/g, "") : "4 / 5";
}
