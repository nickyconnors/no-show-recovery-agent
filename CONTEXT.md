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

No-show detection filter logic

UPDATE 2026-08-30 (final): A booking counts as a no-show if and only if status === 'NO_SHOW' —
i.e. a staff member explicitly marked it that way in the Square dashboard. No time/grace-period
check is involved at all anymore. See the src/noShowFilter.js entry in "Build progress" below for
the full history of how this logic evolved and why (COMPLETED never existed → ACCEPTED-based
time inference → this).

Original (superseded) plan — a booking counted as a true no-show if BOTH:

status is NOT COMPLETED
The booking's end time has passed by more than a 25-minute grace period (to avoid false positives from appointments running slightly long)

Original (superseded) pseudocode:

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

src/catalog.js — DONE. Exports getServiceName(serviceVariationId) → readable name string,
calling GET /v2/catalog/object/{id}?include_related_objects=true. Gotcha: the ITEM_VARIATION
object itself only has a generic variation name (e.g. "Regular") — the actual service name (e.g.
"Men's haircut") lives on the parent ITEM object, which Square only returns if you pass
include_related_objects=true; it then shows up in the response's related_objects array and has to
be matched by id against the variation's item_variation_data.item_id. Falls back to the variation
name if no matching ITEM is found in related_objects. Verified against the live sandbox on
2026-08-30 — resolved service_variation_id OEOGTN4ESB4225CJQKGZ7S2X to "Men's haircut".

Test it in isolation: npm run test:catalog [service_variation_id] (runs src/test-catalog.js,
defaults to the known sandbox service_variation_id if none passed).

src/noShowFilter.js — DONE, revised 2026-08-30. Exports isNoShow(booking): true only if
status === 'ACCEPTED' AND end_at is more than the 25-minute grace period in the past; false
otherwise (including when end_at is missing). Designed to run directly against the booking objects
src/square.js returns (end_at already calculated — no need to call addEndAt again).

IMPORTANT — this replaced the original "status !== 'COMPLETED'" logic carried over from the
Make.com prototype. Square's Bookings API has no COMPLETED status. The real BookingStatus enum
(confirmed via Square's official API reference, https://developer.squareup.com/reference/square/enums/BookingStatus)
is: PENDING, ACCEPTED, DECLINED, CANCELLED_BY_CUSTOMER, CANCELLED_BY_SELLER, NO_SHOW. There is no
field that distinguishes "customer showed up and was serviced" from "customer never showed and
staff hasn't dealt with it yet" — completion/checkout isn't tracked on the Booking object at all.
Confirmed live in the sandbox on 2026-08-30: marking a booking "Completed" via the Seller Dashboard
updated updated_at but left status as "ACCEPTED" — it never becomes "COMPLETED". Under the old
"!== COMPLETED" logic this was a real bug: any booking with status CANCELLED_BY_CUSTOMER,
CANCELLED_BY_SELLER, or DECLINED would also get incorrectly flagged as a no-show (and receive a
"we missed you, come rebook" text) once its end_at passed, since none of those equal 'COMPLETED'
either. Filtering on status === 'ACCEPTED' instead correctly excludes cancelled/declined bookings
and bookings the seller already manually marked NO_SHOW, only flagging appointments that are still
in limbo (accepted, ended, nothing resolved it) — the actual definition of an unhandled no-show.

Verified with 6 synthetic cases on 2026-08-30, all passing: a true no-show (ACCEPTED, ended 60 min
ago), a still-upcoming booking (ACCEPTED, ends 60 min from now), a booking running slightly long
(ACCEPTED, ended only 10 min ago — correctly not flagged, confirming the grace period), and three
"already resolved" cases all correctly excluded: CANCELLED_BY_CUSTOMER, CANCELLED_BY_SELLER, and
NO_SHOW (all ended 60 min ago, all status !== ACCEPTED).

FINAL PIVOT 2026-08-30: even the ACCEPTED + grace-period logic above was still an inference — it
assumed that if a booking stayed ACCEPTED past its end time with no other resolution, the customer
must not have shown up. But since Square's Booking object has no attended/completed field at all
(confirmed via the official API reference — see the BookingStatus research above), there's no way
to distinguish "customer was serviced and staff just hasn't touched the booking since" from "customer
never showed and staff hasn't dealt with it yet" using status + time alone. Both look identical:
status stays ACCEPTED forever unless someone acts on it.

Square does, however, give sellers a manual "Mark as no-show" action in the dashboard, which sets
status to NO_SHOW — a deliberate, explicit signal with no ambiguity. Decision: drop time-based
inference entirely. isNoShow(booking) now returns true if and only if status === 'NO_SHOW'. The
real-world workflow this implies: staff still make the call on whether a customer no-showed (same
as they always did), and the agent's job is just to catch that explicit signal and automatically
send the recovery message — not to guess who no-showed from a calendar. This trades some autonomy
(no fully hands-off detection) for eliminating an entire class of false positives (texting a
customer who was actually serviced). end_at is still calculated in src/square.js and still used to
give Claude context in the generated message ("it was scheduled for {end_at}") — it's just no
longer part of the flagging decision.

Verified with 6 synthetic cases on 2026-08-30 covering every BookingStatus enum value: NO_SHOW
(expected true — passed) and ACCEPTED, PENDING, DECLINED, CANCELLED_BY_CUSTOMER,
CANCELLED_BY_SELLER (all expected false — all passed).

Test it in isolation: npm run test:no-show-filter (runs src/test-no-show-filter.js against 6
synthetic bookings — no live API call needed since this module is pure logic).

src/claudeMessage.js — DONE. Exports generateNoShowMessage({ customer_name, service_name, end_at })
→ generated SMS text string, calling POST https://api.anthropic.com/v1/messages with model
claude-sonnet-4-5, max_tokens: 150, using the exact prompt proven out in the Make.com prototype.
Headers: x-api-key, anthropic-version: 2023-06-01, content-type: application/json. Response
content comes back as an array of blocks — text blocks are filtered, joined, and trimmed to get
the final message string. Verified against the live Anthropic API on 2026-08-30 with sample data
(customer_name: "Jon Wu", service_name: "Men's haircut") — generated a casual, warm 183-character
message inviting rebooking, well under the 300 char limit.

Test it in isolation: npm run test:claude (runs src/test-claude.js against hardcoded sample data —
makes a real Anthropic API call, no Square data needed).

src/formatEndAt.js — DONE, added 2026-08-30. Exports formatEndAt(isoString, { timeZone, now }) →
human-readable local string like "today at 11:45am" or "Wednesday at 11:45am". Hardcoded default
timeZone: America/Los_Angeles (the business's actual location for now — make configurable later
if multi-location support is ever needed). Uses Intl.DateTimeFormat to get date-only parts in the
target timezone for both the timestamp and "now", diffs them as calendar days (today/tomorrow/
yesterday, else falls back to weekday name), and formats the time separately in the same timezone.

GOTCHA (important): never hand a raw ISO/UTC timestamp to an LLM prompt expecting it to correctly
convert to local time and figure out the relative day itself — it will get both wrong. Found in
production-adjacent testing on 2026-08-30: a booking with end_at "2026-08-30T18:45:00.000Z" (which
is 11:45am Pacific, the same day) generated a message saying "yesterday at 6:45pm" — Claude kept
the raw UTC clock time as if it were local time AND miscalculated the relative day on top of that.
Fix: always pre-format any timestamp into an unambiguous local-time string in code
(src/claudeMessage.js now calls formatEndAt(end_at) before building the prompt) — never pass a raw
timestamp into a prompt and expect correct timezone/day interpretation.

Verified with 5 synthetic cases on 2026-08-30 against a fixed reference "now" (for deterministic
today/tomorrow/yesterday labels): the exact real bug case (18:45 UTC → "today at 11:45am"),
yesterday, tomorrow, a further-out date (falls back to weekday name "Wednesday"), and a timestamp
where the UTC calendar date rolls back a day once converted to Pacific time (02:45 UTC → "yesterday
at 7:45pm") — the case most likely to silently break naive timezone handling. All passed. Also
re-verified live against the Anthropic API with the real bug's timestamp
(2026-08-30T20:00:00Z) — now correctly formats to "today at 1:00pm" and Claude's generated message
reflects that ("We missed you today at 1pm...").

Test it in isolation: npm run test:format-local-date-time (runs src/test-format-local-date-time.js
— pure logic, no live API calls).

UPDATE 2026-08-30: renamed src/formatEndAt.js → src/formatLocalDateTime.js (function formatEndAt →
formatLocalDateTime) after the message wording changed to reference start_at instead of end_at (see
below) — the formatter itself is generic (works on any ISO timestamp), so naming it after "end_at"
specifically became misleading once it was being fed start_at.

src/claudeMessage.js — updated 2026-08-30. generateNoShowMessage() now takes start_at instead of
end_at. Reasoning: "we missed you at your 11:15am appointment" (referencing when it was supposed to
begin) reads more naturally to a customer than referencing when it would have ended — and it also
fits the existing prompt phrase "it was scheduled for {time}" better, since something is naturally
"scheduled for" a start time, not an end time. src/index.js now passes booking.start_at (Square's
own field, no calculation needed — unlike end_at, which src/square.js still calculates and returns
for other potential uses, but is no longer used in the Claude prompt).

src/customers.js — updated. getCustomer(customerId) now also resolves email (customer.email_address,
null if missing), returning { name, phone, email }. Added because the sandbox test customer has no
phone_number on file but does have an email_address, and the Gmail stand-in notification method
needs an email address to send to. Confirmed live: sandbox customer 3S86WTRVS368NS23N8JS29DDCM has
email_address "nickconnors24@gmail.com".

src/notify.js — DONE. Exports sendNotification({ to, subject, body }), sending via Gmail SMTP using
nodemailer (service: 'gmail') authenticated with an App Password (not OAuth — App Password is much
less setup and this is only a stand-in until Twilio SMS clears). Requires 2-Step Verification
enabled on the sending Gmail account and an App Password generated at
https://myaccount.google.com/apppasswords. New dependency: nodemailer. New .env values: GMAIL_USER,
GMAIL_APP_PASSWORD. Verified against live Gmail SMTP on 2026-08-30 — test email delivered
successfully (250 2.0.0 OK).

Test it in isolation: npm run test:notify [to_address] (runs src/test-notify.js, defaults to
sending to GMAIL_USER itself if no address passed — makes a real send).

src/index.js — DONE. Orchestrates the full pipeline end-to-end: getBookings() → isNoShow() filter →
for each flagged booking, getCustomer() + getServiceName() in parallel → generateNoShowMessage() →
sendNotification(). Logs clearly at every stage (fetched bookings, filter results per booking,
resolved customer/service data, generated message, send confirmation) plus a final summary line
(X of Y no-shows notified). Skips notification (with a logged reason) if the customer has no email
on file, since the Gmail stand-in can't send without one. Verified against the live sandbox on
2026-08-30 — fetched 2 bookings, both flagged as no-shows, both resolved to customer "Jon Wu" /
service "Men's haircut", both got distinct Claude-generated messages, both delivered successfully
via Gmail.

Run it: npm start (runs src/index.js — this is a real run against whatever SQUARE_API_BASE points
at, currently the sandbox; will actually send notifications, so be mindful once pointed at
production).

Architecture decision: no node-fetch. The package.json listed node-fetch as a dependency, but
node-fetch v3 is ESM-only while this project is "type": "commonjs" — requiring it would throw.
Node 24 (the version in use) has a native global fetch, so src/square.js and src/customers.js use
that directly and node-fetch can eventually be removed from package.json.

Not yet built (next steps)
Node.js project scaffold (this repo) — DONE
Square API client: fetch bookings with correct headers/params — DONE (src/square.js)
Calculate end_at from start_at + duration — DONE (folded into src/square.js)
Customer lookup call → resolve name/phone — DONE (src/customers.js)
Catalog lookup call → resolve service name — DONE (src/catalog.js)
No-show filter (logic already defined above) — DONE (src/noShowFilter.js)
Claude API call using the proven prompt — DONE (src/claudeMessage.js)
Notification send — Gmail for now (stand-in), swap to Twilio SMS once phone number verification clears (~10 day wait from Twilio) — DONE (src/notify.js)
Full pipeline wiring (fetch → filter → resolve → generate → send) — DONE (src/index.js), verified end-to-end against live sandbox on 2026-08-30
Scheduling — run this on an interval (start with manual runs, then decide on cron/serverless hosting)
Eventually: swap Sandbox for Production Square credentials once tested
Credentials needed (store in .env, never commit)
SQUARE_ACCESS_TOKEN=
SQUARE_API_BASE=https://connect.squareupsandbox.com # switch to production later
SQUARE_LOCATION_ID=
ANTHROPIC_API_KEY=

GMAIL_USER=
GMAIL_APP_PASSWORD=
# Twilio credentials — TBD once phone number verification clears

Key people (business context, not technical)
Nick Connors — engineering/build
Jon — business/product side, co-founder
Target niche: barbershops, starting hyper-local (Bergen County)
Pricing/roadmap context: $79/mo flat pilot pricing, 2–3 hand-built agents before building a real self-serve product (see broader roadmap doc if needed — not included here since it's business strategy, not build-relevant)
