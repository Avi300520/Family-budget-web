# Unfurl-Cache Purge Runbook

How to get a fresh link-preview card after changing any `og:` metadata (image, title, description) on a public page.

## Rule 1: never change an og:image in place — always a new filename

Every unfurling platform (Facebook, WhatsApp, LinkedIn, Telegram, Slack, Discord) caches preview
data keyed by URL, and image caches in particular can be very sticky. Changing the file at an
existing path is not guaranteed to show up even after a manual re-scrape. Ship a new filename
(e.g. `og-pingtally-v2.jpg`) and repoint the metadata at it instead.

## After any og change, purge in this order

1. **Facebook / WhatsApp shared cache** — https://developers.facebook.com/tools/debug/ → enter
   the URL → "Scrape Again". Requires any Facebook developer login. WhatsApp shares Facebook's
   crawler/cache for link previews, so this is also the WhatsApp purge path.
2. **LinkedIn** — https://www.linkedin.com/post-inspector/ → inspect the URL (this re-scrapes it).
3. **Telegram** — message the URL to `@WebpageBot` (up to 10 links per message).

## WhatsApp caveat

The in-app preview cache on a phone that has already seen the URL cannot be force-purged — the
Facebook debugger refresh only helps *new* shares going forward. For testing a change, always use
a fresh variant WhatsApp has never seen, e.g. `https://pingtally.com/?v=N` (bump `N` each test).

## X (Twitter)

No public card validator since 2022. Cards refresh on their own within a few days. To check sooner,
tweet the URL from a test account, or paste it into Discord (Discord fetches the same `og:` tags
live, so it's a fast way to eyeball the card without waiting on X).

## Standing constraint

Never add a Cloudflare bot challenge or UA block for `facebookexternalhit`, `WhatsApp`,
`Twitterbot`, `LinkedInBot`, `TelegramBot`, `Slackbot`, or `Discordbot` — link-preview crawlers hit
the site once, unauthenticated, and any challenge silently breaks the unfurl (the requesting
platform doesn't retry or report the failure back to us).
