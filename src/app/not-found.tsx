import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-start px-4 py-24">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand-blue uppercase">Photo NationX</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">That page is not on this site.</p>
      <Button asChild className="mt-6 h-11 px-5 hover:bg-brand-red">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
