"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm({ accessKey, subject }: { accessKey: string; subject: string }) {
  const [status, setStatus] = useState<Status>("idle");

  if (!accessKey) {
    return (
      <p className="rounded-lg bg-brand-sky/45 px-4 py-5 text-sm text-foreground">
        The contact form is not available yet. Please check back soon.
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="rounded-lg bg-brand-sky/45 px-4 py-5 text-sm" role="status">
        Message sent. Photo NationX will reply by email.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("submitting");
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject,
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          botcheck: data.get("botcheck") || "",
        }),
      });
      const json = (await response.json()) as { success?: boolean };
      if (!response.ok || !json.success) {
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate={false}>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="botcheck" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" className="h-10" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" required minLength={2} className="min-h-36" />
      </div>
      {status === "error" ? (
        <p className="text-sm text-brand-red" role="alert">
          The message could not be sent. Please try again in a moment.
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={status === "submitting"} className="h-11 w-fit px-5 hover:bg-brand-red">
        {status === "submitting" ? "Sending…" : "Send message"}
      </Button>
      <noscript>
        <p className="text-sm text-muted-foreground">The contact form needs JavaScript enabled.</p>
      </noscript>
    </form>
  );
}
