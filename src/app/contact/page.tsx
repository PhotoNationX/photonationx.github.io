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
      {site.contact.email ? (
        <p className="mb-8 text-base">
          <a href={`mailto:${site.contact.email}`} className="font-medium text-brand-blue hover:text-brand-red">
            {site.contact.email}
          </a>
        </p>
      ) : null}
      <ContactForm
        accessKey={contactAccessKey()}
        email={site.contact.email ?? ""}
        subject={site.contact.subject}
      />
    </PageShell>
  );
}
