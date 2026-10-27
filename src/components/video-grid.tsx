"use client";

import { useState } from "react";
import { PlayIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Video } from "@/lib/content";
import { formatDuration, largestWidth, posterSrc, posterSrcSet, videoLabel, videoSrc } from "@/lib/media";

export function VideoGrid({ videos }: { videos: Video[] }) {
  const [active, setActive] = useState<Video | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 md:gap-2">
        {videos.map((video) => (
          <li key={video.id}>
            <button
              type="button"
              onClick={() => setActive(video)}
              className="group relative block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
              style={{ backgroundColor: video.poster.color, aspectRatio: "4 / 5" }}
            >
              <img
                src={posterSrc(video.id, video.poster.widths[0])}
                srcSet={posterSrcSet(video)}
                sizes="(min-width: 768px) 25vw, 50vw"
                alt=""
                width={video.width}
                height={video.height}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-brand-blue shadow-sm transition group-hover:bg-brand-red group-hover:text-white">
                  <PlayIcon className="ml-0.5 size-5 fill-current" aria-hidden="true" />
                </span>
              </span>
              {video.duration ? (
                <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
                  {formatDuration(video.duration)}
                </span>
              ) : null}
              <span className="sr-only">Play {videoLabel(video)}</span>
            </button>
            {video.caption || video.date ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {[video.caption, video.date].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="overflow-hidden bg-black p-0 text-white sm:max-w-4xl [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/15">
          <DialogTitle className="sr-only">{active ? videoLabel(active) : "Video"}</DialogTitle>
          {active ? <Player video={active} /> : null}
          {active && (active.caption || active.date) ? (
            <p className="px-4 pb-4 text-sm text-white/80">{[active.caption, active.date].filter(Boolean).join(" · ")}</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Player({ video }: { video: Video }) {
  const frame = frameProps(video);
  if (video.kind === "youtube" && video.embedId) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.embedId)}?autoplay=1&rel=0`}
        title={videoLabel(video)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        {...frame}
      />
    );
  }
  if (video.kind === "vimeo" && video.embedId) {
    const params = new URLSearchParams({ autoplay: "1" });
    if (video.hash) params.set("h", video.hash);
    return (
      <iframe
        src={`https://player.vimeo.com/video/${encodeURIComponent(video.embedId)}?${params.toString()}`}
        title={videoLabel(video)}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        {...frame}
      />
    );
  }
  return (
    <video
      src={videoSrc(video.id)}
      poster={posterSrc(video.id, largestWidth(video.poster.widths))}
      controls
      autoPlay
      playsInline
      preload="none"
      {...frame}
    />
  );
}

function frameProps(video: Video): { className: string; style: { aspectRatio: string } } {
  const style = { aspectRatio: `${video.width} / ${video.height}` };
  if (video.width >= video.height) return { className: "mx-auto w-full bg-black", style };
  return { className: "mx-auto h-[80vh] max-w-full bg-black", style };
}
