import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/blocks";
import { ContactForm } from "@/components/contact-form";
import { contactAccessKey, getSite } from "@/lib/content";

const site = getSite();

export const metadata: Metadata = {
  title: "Contact",
  description: site.contact.intro,
};

export default function ContactPage() {
  return (
    <PageShell className="max-w-3xl">
      <PageHeader eyebrow={site.name} title={site.contact.heading} lede={site.contact.intro} />
      <ContactForm accessKey={contactAccessKey()} subject={site.contact.subject} />
    </PageShell>
  );
}
