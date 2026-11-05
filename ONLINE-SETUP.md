# Weiß Schwarz online beta

Published frontend: https://yumekazaki.github.io/weiss-schwarz-studio/

Backend project: `gzbladuexyqnjqiemlya` (Supabase, US East Ohio). The browser contains only the project URL and publishable key. Supabase Auth manages password hashing, sessions and recovery. No service-role key or account password is in this repository.

## Required email configuration

Sign in to the Supabase account that owns **vanguardgame0@gmail.com's Org**, then open this project:

1. [Auth URL Configuration](https://supabase.com/dashboard/project/gzbladuexyqnjqiemlya/auth/url-configuration): set Site URL to `https://yumekazaki.github.io/weiss-schwarz-studio/` and add that exact address to Redirect URLs.
2. [Auth Email / SMTP](https://supabase.com/dashboard/project/gzbladuexyqnjqiemlya/auth/smtp): configure a mail sender you control. Enter SMTP credentials only in Supabase, never in this repository or chat. Supabase's default mail sender is restricted and is not a general-purpose sender for friends' accounts.
3. Keep email/password signup and email confirmation enabled. Account creation and password-reset delivery remain unverified until this is configured and confirmation/recovery messages are received.

## Implementation

`backend/schema.sql` creates own-user RLS policies for decks and service-only rooms and join-attempt records. Room passwords are bcrypt hashes created/checked inside PostgreSQL. Browser roles cannot read the room table, hashes, canonical state, deck submissions, or receipts. The only online match endpoint is `ws-online`.

The Edge Function verifies every caller through Supabase Auth, derives their seat from the stored user IDs, and validates commands against canonical state. Version compare-and-swap serializes all actions and automatic checks. Full-match action IDs prevent duplicate submissions. Canonical state, pending choices, server-owned shuffles, card order and undo snapshots persist in PostgreSQL. Both clients poll seat-projected state; neither browser is an authority. Reconnection resumes that state without replaying actions.

Normal responses hide both deck orders and the opponent's hand/stock identities, omit the resolver queue and private decisions, and redact private movement events. Explicit private searches require a visible manual-effect window and are limited to the caller's own piles. Deck searches return sorted cards, never shuffled order. Ready decks are validated from trusted card definitions pinned to a repository commit, not client-supplied card text.

The online board keeps each player's own side nearest them. The current turn, resolution step and waiting player are visible. A player may pause for manual effects; effects instructing the opponent open controls for that opponent. Only the decision owner can answer a response, target, level-up or other supported choice. Manual movement, ordering, drawing, shuffling, orientation, reveal, stock payment, cost suspension, modifiers, separate damage and phase correction are checked for ownership. Undo restores the complete prior state only after the opponent agrees and warns about revealed information.

## Automation and limitations

The shared resolver retains the practice game's limited automation: normal stand/draw and end cleanup; front/side/direct attacks; printed soul; recognized global/self/assist and entry/attack modifiers; supported Backup and manually resolved eligible counter events; soul/draw/pool/return/comeback/gate/treasure/standby/choice/shot triggers; separate damage instances, cancellation, clock, level choices, refresh and loss conditions. Attack-type soul changes expire after the attack. Unsupported abilities and trigger types stay manual. Players must check additional card requirements, complex costs, replacements, combinations and unencoded effects; this is not a universal card engine or tournament certification. Imported construction restrictions and conditional exceptions still require review against official lists. English/Japanese catalog coverage gaps remain as documented in the site's Sources & coverage.

Disconnections are detected by heartbeats; occupied match seats remain bound to their original accounts. The room code is for joining a lobby; account sessions restore an existing seat. A player who leaves a running match can reconnect through their saved room identifier. There is no spectator feature or third-player seat.

## Verification status

Completed: syntax checks; local reducer checks for both seats attacking, triggers, opponent-owned decisions, opponent-directed draws, level-up, refresh, conservation, projection and duplicate-attack rejection; public live endpoint checks denying unauthenticated room/deck access; live account-dialog navigation. Supabase security advisor reports only the intentional service-only RLS tables with no browser policies.

**The user waived the independent two-account live test.** Account sign-in/out, cross-device deck sync, room passwords/readiness, full synchronized match flow, reconnection, concurrency and account-to-account isolation have implementation but have not been verified end to end in two independent browser sessions. Email confirmation/recovery delivery is also unverified. Do not describe this beta as completed or fully rules-compliant until these checks pass. No temporary privileged provisioning endpoint was deployed and no internal Auth-table test fixtures were inserted.

## Updating

Frontend: edit the plain source modules, run `node build-assets.mjs`, commit and push `main`; GitHub Pages publishes the root. The build script creates fingerprinted browser assets.

Backend: deploy `backend/index.ts` as Supabase Edge Function `ws-online` with `online-core.mjs`, `engine.mjs`, and `automation.mjs` at their relative paths. It requires Supabase's server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment values. It authenticates bearer tokens itself using `auth.getUser`; gateway `verify_jwt` is disabled for compatibility with current signing keys. Never remove the function's authentication or seat checks. Deploy the backend whenever shared rules or online controller code changes. Catalog URLs are pinned to a committed trusted snapshot.

References: [official comprehensive rules v2.10](https://en.ws-tcg.com/wordpress/wp-content/uploads/2025/09/17165346/WSE-Comprehensive-Rules-v2.10.pdf), [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).
