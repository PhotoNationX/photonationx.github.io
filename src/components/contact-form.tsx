"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Status = "idle" | "submitting" | "success" | "opened" | "error";

export function ContactForm({
  accessKey,
  email,
  subject,
}: {
  accessKey: string;
  email: string;
  subject: string;
}) {
  const [status, setStatus] = useState<Status>("idle");

  if (status === "success" || status === "opened") {
    return (
      <p className="rounded-lg bg-brand-sky/45 px-4 py-5 text-sm" role="status">
        {status === "success"
          ? "Message sent. Photo NationX will reply by email."
          : "Your email app is opening with this message, addressed to Photo NationX. Send it there to finish."}
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (String(data.get("_honey") || "").trim()) {
      setStatus("success");
      return;
    }
    const name = String(data.get("name") || "");
    const from = String(data.get("email") || "");
    const message = String(data.get("message") || "");
    setStatus("submitting");
    try {
      const response = accessKey
        ? await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              access_key: accessKey,
              subject,
              name,
              email: from,
              message,
              botcheck: "",
            }),
          })
        : await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              name,
              email: from,
              message,
              _replyto: from,
              _subject: subject,
              _template: "table",
              _captcha: "false",
              _honey: "",
            }),
          });
      const json = (await response.json()) as { success?: boolean | string };
      const ok = json.success === true || json.success === "true";
      if (!response.ok || !ok) throw new Error("send failed");
      form.reset();
      setStatus("success");
    } catch {
      if (!accessKey && email) {
        const body = `Name: ${name}\nEmail: ${from}\n\n${message}`;
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setStatus("opened");
        return;
      }
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="_honey" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {accessKey ? null : (
        <>
          <input type="hidden" name="_subject" value={subject} />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_captcha" value="false" />
        </>
      )}
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
        <p className="text-sm text-muted-foreground">Sending without JavaScript opens the form service’s confirmation page.</p>
      </noscript>
    </form>
  );
}
