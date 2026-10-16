# Notification infrastructure

Fitly's C10 notification layer separates private event state from the Expo Push
transport. Marketplace event production and final-state deep-link handling are
owned by C11; C10 does not manufacture those product events early.

## Mobile registration

- The app uses the Expo SDK 57-compatible `expo-notifications` and `expo-device`
  packages and the `expo-notifications` config plugin.
- Pressing **Profile → Notifications** is the only permission prompt. The app
  does not prompt on launch or sign-in.
- Remote registration requires a physical Fitly development/standalone build.
  Expo Go and simulators return an actionable message before native permission
  APIs are called.
- Android creates the `default` channel before requesting permission. iOS
  authorized, provisional, and ephemeral permission states are accepted.
- A random installation UUID is persisted locally. After explicit opt-in, every
  signed-in startup silently refreshes the existing registration without
  prompting, and an Expo native-token listener re-registers runtime rotations.
  Expo Go and unsupported devices do not install this listener.
- The server owns duplicate-token reassignment, status, last-seen time, and
  invalid receipts. Reassignment creates a new active identity and disables the
  old immutable token row, so historical deliveries can never change owner.
- Sign-out disables the current installation before changing the local account.
  Account-deletion start disables every token and kills queued items in the same
  database transaction.

## Private server state

`private.notification_push_tokens`, `private.notification_outbox`, and
`private.notification_deliveries` are not Data API-readable by members.
Authenticated clients can only register or disable their own installation.
Only `service_role` can enqueue, claim, or complete delivery work.

An immutable `event_key` deduplicates product events. Each active token receives
one delivery row per event. Claimers use `FOR UPDATE SKIP LOCKED`, a recoverable
lease, bounded exponential retry, and a five-attempt poison boundary. A delivery
is durably changed to `sending` before any provider POST and is re-authorized
against the current owner, account-deletion fence, token state, and worker lease
immediately before dispatch. A lost response or abandoned `sending` lease is
terminally marked ambiguous instead of resent; only a confirmed transient
rejection is eligible for retry. Provider tickets and receipts have separate
state, so an accepted message is not resent while its receipt is pending.
Permanent Expo errors disable or stop their delivery as appropriate. Payloads
use generic copy and allow only the `marketplace_inbox`,
`transaction`, or `listing` route schemas.

## Worker operation

Deploy `process-notification-outbox` with JWT verification enabled. It accepts
only a service-role bearer token. The worker is safe to call repeatedly and may
be invoked by the production scheduler established in the operations/release
slice.

Edge Function secrets:

```text
EXPO_PUSH_ENABLED=false
EXPO_ACCESS_TOKEN=
```

Keep `EXPO_PUSH_ENABLED=false` until an EAS development build and Expo project
credentials are available under External Gate D. In this mode claimed rows are
deferred for five minutes without consuming an attempt. Set it to `true` only
after deploying a physical build. `EXPO_ACCESS_TOKEN` is optional unless Expo
enhanced push security is enabled.

## Verification and rollback

The isolated database harness tests immutable token reassignment, RLS, event
deduplication, overlapping claims, abandoned/ambiguous leases, poison isolation,
ticket/receipt state, invalid-token disablement, logout, deletion crossing
prepare→send, database purge, and final Auth deletion. Unit tests cover SDK
capability/permission ordering, startup refresh and runtime rotation, safe
payloads, Expo's 100-message batch limit, provider error classification, and
no-credential operation.

To stop delivery, set `EXPO_PUSH_ENABLED=false`; queued rows remain private and
deferred. A forward rollback may disable the profile action and worker, but must
not expose or rewrite private delivery history.
