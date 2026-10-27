import brandJson from "../../content/brand.json";
import mediaJson from "../../content/media.json";
import siteJson from "../../content/site.json";

export type LogoChoice = "original" | "clean";

export type NavItem = { label: string; href: string };

export type PhotoCategory = { slug: string; title: string };

export type Site = {
  name: string;
  url: string;
  description: string;
  header: { logo: LogoChoice; nav: NavItem[] };
  banner: {
    style: "collage" | "grid";
    alt: string;
    gridPhotos: string[];
  };
  home: { eyebrow: string; heading: string; intro: string };
  about: { heading: string; paragraphs: string[] };
  contact: {
    heading: string;
    intro: string;
    web3formsAccessKey: string;
    subject: string;
  };
  display: {
    captions: boolean;
    dates: boolean;
    photoTileAspect: string;
  };
  photoCategories: PhotoCategory[];
};

export type ImageSource = { src: string; width: number };

export type Brand = {
  logo: {
    width: number;
    height: number;
    variants: Record<LogoChoice, ImageSource[]>;
  };
  banner: {
    width: number;
    height: number;
    color: string;
    sources: ImageSource[];
    ogImage: { src: string; width: number; height: number };
  };
};

export type Photo = {
  id: string;
  width: number;
  height: number;
  widths: number[];
  color: string;
  source?: string;
  sample?: boolean;
  hidden?: boolean;
  category?: string;
  caption?: string;
  date?: string;
};

export type Video = {
  id: string;
  kind: "file" | "youtube" | "vimeo";
  width: number;
  height: number;
  duration?: number;
  bytes?: number;
  embedId?: string;
  hash?: string;
  title?: string;
  poster: { widths: number[]; color: string };
  source?: string;
  sample?: boolean;
  hidden?: boolean;
  caption?: string;
  date?: string;
};

const site = siteJson as Site;
const brand = brandJson as Brand;

function stripText<T extends { caption?: string; date?: string }>(item: T): T {
  const next = { ...item };
  if (!site.display.captions) delete next.caption;
  if (!site.display.dates) delete next.date;
  return next;
}

export function getSite(): Site {
  const key = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim();
  if (!key) return site;
  return { ...site, contact: { ...site.contact, web3formsAccessKey: key } };
}

export function getBrand(): Brand {
  return brand;
}

export function getMetadataBase(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  const url = new URL(site.url);
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  if (base) url.pathname = `${base}/`;
  return url;
}

export function getPhotos(): Photo[] {
  return (mediaJson.photos as Photo[]).filter((photo) => !photo.hidden).map(stripText);
}

export function getVideos(): Video[] {
  return (mediaJson.videos as Video[]).filter((video) => !video.hidden).map(stripText);
}

export function getPhotosByCategory(slug?: string): Photo[] {
  const photos = getPhotos();
  if (!slug) return photos;
  return photos.filter((photo) => photo.category === slug);
}

export function categoryBySlug(slug: string): PhotoCategory | undefined {
  return site.photoCategories.find((category) => category.slug === slug);
}

export function isSampleContent(items: { sample?: boolean }[]): boolean {
  return items.length > 0 && items.every((item) => item.sample === true);
}

export function contactAccessKey(): string {
  return (process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || site.contact.web3formsAccessKey || "").trim();
}

export function logoSources(choice: LogoChoice = site.header.logo): ImageSource[] {
  return brand.logo.variants[choice] ?? brand.logo.variants.clean;
}
