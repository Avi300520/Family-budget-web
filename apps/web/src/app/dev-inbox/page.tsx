"use client";

import Link from "next/link";
import { ImagePlus, RefreshCw, Send, ShieldAlert, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import type { OutboxMessage, WebhookEvent, WhatsAppMessage } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { api } from "../../lib/api";

export default function DevInboxPage() {
  const [phone, setPhone] = useState("+972501234567");
  const [text, setText] = useState("57 במכולת");
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [magicLinks, setMagicLinks] = useState<Array<{ phone: string; link: string; createdAt: string; expiresAt: string; consumedAt?: string }>>([]);
  const [lastEventId, setLastEventId] = useState<string>();
  const [error, setError] = useState<string>();

  async function load() {
    try {
      const inbox = await api.devInbox();
      setOutbox(inbox.outbox);
      setMessages(inbox.whatsappMessages);
      setWebhooks(inbox.webhookEvents);
      setMagicLinks(inbox.magicLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת dev inbox");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function inbound(messageType: "text" | "image", duplicate = false, simulateFailure = false) {
    const eventId = duplicate && lastEventId ? lastEventId : `dev_${Date.now()}`;
    setLastEventId(eventId);
    await api.sendMockWhatsapp({ phone, messageType, text: messageType === "text" ? text : undefined, imageLabel: "mock receipt", eventId, duplicateOfEventId: duplicate ? eventId : undefined, simulateFailure });
    await load();
  }

  async function process(simulateFailure = false) {
    await api.processOutbox(simulateFailure);
    await load();
  }

  return (
    <AppShell>
      <div className="row between">
        <h1 className="page-title">Dev inbox</h1>
        <button className="button secondary" onClick={load}>
          <RefreshCw size={18} aria-hidden />
          רענון
        </button>
      </div>
      {error && <div className="status error">{error}</div>}
      <section className="panel">
        <h2>Mock WhatsApp</h2>
        <div className="row">
          <input className="input" style={{ maxWidth: 220 }} value={phone} onChange={(event) => setPhone(event.target.value)} />
          <input className="input" style={{ maxWidth: 320 }} value={text} onChange={(event) => setText(event.target.value)} />
          <button className="button" onClick={() => inbound("text")}>
            <Send size={18} aria-hidden />
            טקסט
          </button>
          <button className="button secondary" onClick={() => inbound("image")}>
            <ImagePlus size={18} aria-hidden />
            קבלה
          </button>
          <button className="button secondary" onClick={() => inbound("text", true)}>
            <Webhook size={18} aria-hidden />
            Duplicate
          </button>
          <button className="button warn" onClick={() => inbound("text", false, true)}>
            <ShieldAlert size={18} aria-hidden />
            Failure
          </button>
        </div>
      </section>
      <section className="grid two" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="row between">
            <h2>Outbox</h2>
            <div className="row">
              <button className="button secondary" onClick={() => process(false)}>Process</button>
              <button className="button warn" onClick={() => process(true)}>Fail</button>
            </div>
          </div>
          <div className="list">
            {outbox.map((item) => {
              const text = String(item.payload.text ?? item.payload.type ?? "");
              const urlMatch = text.match(/https?:\/\/\S+/);
              const localPath = urlMatch ? urlMatch[0].replace(/https?:\/\/[^/]+/, "") : undefined;
              return (
                <div className="item-card" key={item.id}>
                  <div className="row between">
                    <strong dir="ltr">{item.channel} · {item.destination}</strong>
                    <span className={`status ${item.status === "failed" ? "error" : item.status === "pending" ? "warn" : ""}`}>{item.status}</span>
                  </div>
                  <div className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{text}</div>
                  {localPath && (
                    <Link className="button secondary" href={localPath} style={{ textDecoration: "none", marginTop: 8, alignSelf: "flex-start" }}>
                      פתח קישור
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel">
          <h2>Magic links</h2>
          <div className="list">
            {magicLinks.length === 0 && <div className="muted">אין קישורי קסם פעילים.</div>}
            {magicLinks.map((link) => {
              const localPath = link.link.replace(/https?:\/\/[^/]+/, "");
              return (
                <div className="item-card row between" key={link.link}>
                  <div>
                    <div className="muted" dir="ltr">{link.phone}</div>
                    {link.consumedAt && <span className="status warn">נצרך</span>}
                  </div>
                  <Link className="button secondary" href={localPath} style={{ textDecoration: "none" }}>
                    פתח קישור
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="grid two" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Webhook events</h2>
          <div className="list">
            {webhooks.slice(0, 8).map((event) => (
              <div className="item-card row between" key={event.id}>
                <span>{event.provider} · {event.eventType}</span>
                <span className={`status ${event.status === "failed" ? "error" : event.status === "duplicate" ? "warn" : ""}`}>{event.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Messages</h2>
          <div className="list">
            {messages.slice(0, 8).map((message) => (
              <div className="item-card" key={message.id}>
                <strong>{message.direction} · {message.messageType}</strong>
                <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{message.normalizedText}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
