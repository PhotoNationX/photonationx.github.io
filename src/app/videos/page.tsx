import type { Metadata } from "next";
import { EmptyNote, PageHeader, PageShell } from "@/components/blocks";
import { VideoGrid } from "@/components/video-grid";
import { getSite, getVideos } from "@/lib/content";

export const metadata: Metadata = {
  title: "Videos",
  description: `Videos by ${getSite().name}. Select a video to play it.`,
};

export default function VideosPage() {
  const site = getSite();
  const videos = getVideos();

  return (
    <PageShell>
      <PageHeader
        eyebrow={site.name}
        title="Videos"
        lede={videos.length > 0 ? "Select a video to play it. Nothing plays until you do." : undefined}
      />
      {videos.length > 0 ? (
        <VideoGrid videos={videos} />
      ) : (
        <EmptyNote title="No videos yet" body="New videos will show up here as posters. Select one to play it." />
      )}
    </PageShell>
  );
}
