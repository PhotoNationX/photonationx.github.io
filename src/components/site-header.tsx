"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ImageSource, NavItem, PhotoCategory } from "@/lib/content";
import { srcSet, withBasePath } from "@/lib/media";
import { cn } from "cn";

/**
 * The header is driven by content/site.json: header.logo picks the artwork,
 * header.nav is the menu, and photoCategories become the Photos dropdown.
 */
export function SiteHeader({
  name,
  logo,
  nav,
  categories,
}: {
  name: string;
  logo: { sources: ImageSource[]; width: number; height: number };
  nav: NavItem[];
  categories: PhotoCategory[];
}) {
  const pathname = usePathname();
  const largest = logo.sources[logo.sources.length - 1] ?? logo.sources[0];

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-sm">
      <div className="h-0.5 bg-gradient-to-r from-brand-red via-brand-sky to-brand-blue" />
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 md:h-20 md:gap-6">
        <Link href="/" className="shrink-0">
          <img
            src={withBasePath(largest.src)}
            srcSet={srcSet(logo.sources)}
            sizes="(min-width: 768px) 260px, 180px"
            width={logo.width}
            height={logo.height}
            alt={name}
            className="h-11 w-auto md:h-14"
          />
        </Link>
        <NavigationMenu viewport={false} className="ml-2 hidden max-w-none md:flex">
          <NavigationMenuList className="gap-1">
            {nav.map((item) =>
              isPhotosHref(item.href) && categories.length > 0 ? (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuTrigger className={navClass(isActive(item.href, pathname))}>
                    {item.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-52 gap-0.5 p-1">
                      <li>
                        <NavigationMenuLink asChild className={menuLinkClass(normalize(pathname) === "/photos")}>
                          <Link href="/photos/">All photos</Link>
                        </NavigationMenuLink>
                      </li>
                      {categories.map((category) => (
                        <li key={category.slug}>
                          <NavigationMenuLink
                            asChild
                            className={menuLinkClass(normalize(pathname) === `/photos/${category.slug}`)}
                          >
                            <Link href={`/photos/${category.slug}/`}>{category.title}</Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ) : (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink asChild className={navClass(isActive(item.href, pathname))}>
                    <Link href={item.href}>{item.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ),
            )}
          </NavigationMenuList>
        </NavigationMenu>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="ml-auto size-10 md:hidden" aria-label="Open menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-white">
            <SheetHeader>
              <SheetTitle>{name}</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-1 px-3 pb-6">
              {nav.map((item) => (
                <div key={item.href} className="grid">
                  <SheetClose asChild>
                    <Link href={item.href} className={mobileClass(isActive(item.href, pathname))}>
                      {item.label}
                    </Link>
                  </SheetClose>
                  {isPhotosHref(item.href)
                    ? categories.map((category) => (
                        <SheetClose asChild key={category.slug}>
                          <Link
                            href={`/photos/${category.slug}/`}
                            className={cn(mobileClass(normalize(pathname) === `/photos/${category.slug}`), "pl-8 text-sm")}
                          >
                            {category.title}
                          </Link>
                        </SheetClose>
                      ))
                    : null}
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function normalize(path: string): string {
  if (!path) return "/";
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed || "/";
}

function isPhotosHref(href: string): boolean {
  return normalize(href) === "/photos";
}

function isActive(href: string, pathname: string): boolean {
  const target = normalize(href);
  const current = normalize(pathname);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

function navClass(active: boolean): string {
  return cn(
    "inline-flex h-9 items-center rounded-md bg-transparent px-2.5 text-sm font-medium hover:bg-transparent hover:text-brand-red focus:bg-transparent data-open:bg-transparent data-popup-open:bg-transparent",
    active ? "text-brand-blue" : "text-foreground",
  );
}

function menuLinkClass(active: boolean): string {
  return cn("hover:text-brand-red", active && "text-brand-blue");
}

function mobileClass(active: boolean): string {
  return cn(
    "rounded-md px-3 py-2.5 text-base font-medium hover:bg-brand-sky/50 hover:text-brand-red",
    active ? "text-brand-blue" : "text-foreground",
  );
}
