import Link from "next/link";
import { cn } from "cn";

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-10 md:py-14", className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="mb-8 max-w-3xl">
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-blue uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{title}</h1>
      {lede ? <p className="mt-3 text-base text-pretty text-muted-foreground md:text-lg">{lede}</p> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  href,
  action,
}: {
  title: string;
  href: string;
  action: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <Link href={href} className="text-sm font-medium text-brand-blue hover:text-brand-red">
        {action}
      </Link>
    </div>
  );
}

export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
