# Marketplace nearby discovery

Fitly's C12 discovery foundation uses PostGIS without making a member's raw
location part of a listing or public profile.

## Privacy boundary

- `marketplace_set_discovery_location` accepts a device or manually selected
  area coordinate and snaps both values to two decimal places before storage
  (roughly a one-kilometre grid). The unsnapped input is not retained.
- Member and active-listing points live only in
  `private.marketplace_member_locations` and
  `private.marketplace_listing_locations`. Authenticated and anonymous Data API
  roles have no table access.
- `marketplace_listings_nearby` returns a rounded whole-kilometre distance. Its
  result type contains no coordinate fields, and it excludes the caller's own
  listings.
- Locations older than 90 days cannot be used for discovery. Updating a member
  location relocates active listing snapshots; clearing it removes both member
  and listing geography.
- Account-deletion start deletes geography immediately. Location writers share
  the deletion advisory lock and reject writes after a tombstone is committed.

## Query contract

The authenticated nearby RPC accepts a radius from 1–100 km and a page size
from 1–50. Results are ordered by rounded distance, newest listing, then listing
ID. The repository requests one extra row and returns a keyset cursor containing
only `distanceKm`, `createdAt`, and `id`.

The existing non-geospatial discovery RPC remains available during the C12→C13
compatibility window. C13 connects the Market UI to nearby discovery and adds
moderation plus category, size, condition, mode, and availability filters.

## Operational fallback

If PostGIS discovery must be disabled, the client may continue using approved
coarse pickup-area labels through the existing discovery path. Do not move
coordinates into `marketplace_listings`, profiles, analytics, logs, or client
cache as a fallback.
