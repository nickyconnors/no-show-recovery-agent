No-Show Recovery Agent — Project Context
What this is

An automation that detects when a barbershop customer misses (no-shows) their Square Appointments booking, and automatically sends them a friendly, AI-generated message inviting them to rebook.

This is Phase 1 of a larger vision: a suite of AI agents for salons/barbershops (No-Show Recovery, Review Responder, eventually a Receptionist agent), built by Nick (engineering) and his business partner Jon, targeting a hyper-local pilot in Bergen County before scaling into a broader "Shopify App Store for AI agents" model.

Why this pivoted from Make.com to custom code

Originally prototyped in Make.com (no-code automation tool). The core logic was fully proven working there — fake data flowing through a Filter into a real Claude-generated message, delivered via email. But Make's UI became a bottleneck for debugging (opaque errors, functions that don't exist, filters losing config when modules are copy/pasted, disconnected modules not sharing data cleanly). Given Nick's CS background, hand-coding this is expected to be faster and far easier to debug (real logs/errors instead of a black-box UI).

Tech stack decision
Language: Node.js (matches Nick's existing TypeScript/JS experience)
Runs as a scheduled script (cron, or hosted on a serverless platform with a free tier — e.g. Vercel Cron, AWS Lambda + EventBridge, or a simple node-cron loop on a small always-on host)
APIs involved: Square (Bookings), Anthropic (Claude), and either Gmail (current stand-in) or Twilio SMS (blocked on phone number verification, ~10 day wait as of last check)
What's already proven to work (from the Make.com prototype)
Claude prompt (confirmed working, generates good messages)
Write a short, friendly SMS (under 300 characters) to a barbershop customer
who missed their appointment. Their name is {customer_name}, they booked a
{service_name}, and it was scheduled for {end_at}. Invite them to rebook this
week. Keep it casual and warm, not corporate. Only output the SMS text,
nothing else.

Called via POST https://api.anthropic.com/v1/messages with model claude-sonnet-4-5, max_tokens: 150. Headers: x-api-key, anthropic-version: 2023-06-01, content-type: application/json.

No-show detection filter logic (confirmed working)

A booking counts as a true no-show if BOTH:

status is NOT COMPLETED
The booking's end time has passed by more than a 25-minute grace period (to avoid false positives from appointments running slightly long)

Pseudocode:

js
function isNoShow(booking) {
const now = new Date();
const gracePeriodMs = 25 _ 60 _ 1000;
const endAt = new Date(booking.end_at); // see note below — must calculate
return booking.status !== 'COMPLETED' && endAt.getTime() < (now.getTime() - gracePeriodMs);
}
Square API — real-world details learned (important, took a while to figure out)
Auth & endpoints
Sandbox base URL: https://connect.squareupsandbox.com
Production base URL: https://connect.squareup.com
Auth header: Authorization: Bearer {SQUARE_ACCESS_TOKEN}
Required header: Square-Version: 2026-01-22 (or current version string)
Required header: Accept: application/json — without this, Square returns a 406 "Not Acceptable" error because it doesn't accept the default Accept header some HTTP clients send.
List Bookings endpoint

GET /v2/bookings

Critical gotcha: by default, this endpoint only returns future bookings. Past bookings (which is literally what a no-show detector needs) are excluded unless you explicitly pass query parameters:

start_at_min — RFC 3339 timestamp, e.g. 2026-08-18T00:00:00Z
start_at_max — if omitted, defaults to 31 days after start_at_min

These must be actual query parameters on the URL, not headers.

Sandbox-specific gotcha

A fresh Square Sandbox test account will return this error until Appointments is manually enabled on it:

json
{"errors":[{"category":"AUTHENTICATION_ERROR","code":"UNAUTHORIZED","detail":"Merchant not onboarded to Appointments"}]}

Fix: log into the Sandbox Seller Dashboard (via Developer Dashboard → Sandbox test accounts → open dashboard) → Add more → Square Appointments → sign up for the Free plan → create at least one service, one staff member, and one test booking.

Real booking object shape (confirmed from live sandbox response)
json
{
"id": "1pg7wzkvu1t7r6",
"version": 0,
"status": "ACCEPTED",
"created_at": "2026-08-19T23:00:15Z",
"updated_at": "2026-08-19T23:00:15Z",
"location_id": "LGNPTA8ZKPY5M",
"customer_id": "3S86WTRVS368NS23N8JS29DDCM",
"start_at": "2026-08-18T23:00:00Z",
"all_day": false,
"appointment_segments": [
{
"duration_minutes": 30,
"service_variation_id": "OEOGTN4ESB4225CJQKGZ7S2X",
"team_member_id": "TMXCmDj12jCAIUYL",
"service_variation_version": 1787179890878
}
]
}

Important gaps vs. what the app needs:

No end_at field — must calculate: end_at = start_at + duration_minutes (in JS: new Date(new Date(start_at).getTime() + duration_minutes \* 60000))
No customer name/phone — only customer_id. Requires a separate call to the Customers API: GET /v2/customers/{customer_id} to resolve name and phone number.
No readable service name — only service_variation_id. Requires a separate call to the Catalog API (GET /v2/catalog/object/{service_variation_id}) to resolve a readable name like "Haircut."
Build progress

src/square.js — DONE. Exports getBookings({ startAtMin, startAtMax }). Handles the Accept header,
start_at_min/start_at_max query params (defaults startAtMin to 30 days ago if omitted), the
"not onboarded to Appointments" error with an inline fix message, and logs a warning (no
implementation yet) if a pagination cursor comes back. Each returned booking also has end_at
calculated (start_at + appointment_segments[0].duration_minutes) before it's returned — bookings
with no segments get end_at: null and a logged warning. Verified against the live sandbox on
2026-08-19 — returned 2 real bookings with correct end_at values.

Test it in isolation: npm run test:square (runs src/test-square.js).

src/customers.js — DONE. Exports getCustomer(customerId) → { name, phone }, calling
GET /v2/customers/{customer_id}. name is given_name + family_name joined (null if missing), phone
is phone_number (null if missing). Verified against the live sandbox on 2026-08-19 — resolved the
sandbox test customer to name "Jon Wu", but that customer has no phone_number on file, so
notification testing will need either a phone number added in the sandbox dashboard or a
null-phone fallback path.

Test it in isolation: npm run test:customers [customer_id] (runs src/test-customers.js, defaults
to the known sandbox customer id if none passed).

Minor noise: dotenv (v17) prints a rotating self-promotional "tip" line to stdout on every
config() call (e.g. pointing at unfamiliar third-party domains). Harmless, but can be silenced
with dotenv.config({ quiet: true }) if it gets annoying.

Architecture decision: no node-fetch. The package.json listed node-fetch as a dependency, but
node-fetch v3 is ESM-only while this project is "type": "commonjs" — requiring it would throw.
Node 24 (the version in use) has a native global fetch, so src/square.js and src/customers.js use
that directly and node-fetch can eventually be removed from package.json.

Not yet built (next steps)
Node.js project scaffold (this repo) — DONE
Square API client: fetch bookings with correct headers/params — DONE (src/square.js)
Calculate end_at from start_at + duration — DONE (folded into src/square.js)
Customer lookup call → resolve name/phone — DONE (src/customers.js)
Catalog lookup call → resolve service name
No-show filter (logic already defined above)
Claude API call using the proven prompt
Notification send — Gmail for now (stand-in), swap to Twilio SMS once phone number verification clears (~10 day wait from Twilio)
Scheduling — run this on an interval (start with manual runs, then decide on cron/serverless hosting)
Eventually: swap Sandbox for Production Square credentials once tested
Credentials needed (store in .env, never commit)
SQUARE_ACCESS_TOKEN=
SQUARE_API_BASE=https://connect.squareupsandbox.com # switch to production later
SQUARE_LOCATION_ID=
ANTHROPIC_API_KEY=

# Gmail or Twilio credentials — TBD once notification method is finalized

Key people (business context, not technical)
Nick Connors — engineering/build
Jon — business/product side, co-founder
Target niche: barbershops, starting hyper-local (Bergen County)
Pricing/roadmap context: $79/mo flat pilot pricing, 2–3 hand-built agents before building a real self-serve product (see broader roadmap doc if needed — not included here since it's business strategy, not build-relevant)
