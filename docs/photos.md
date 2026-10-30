# Photos

How profile photos are processed, stored and accessed, and why. Photos are the most sensitive data in the app, so the rules here are deliberately conservative. **Update this file when the pipeline changes.**

## Summary

- Users add up to **6 photos**. The first is the **main photo**; the order is the display order.
- Every photo is **cropped to a square, resized and re-encoded to JPEG in the browser** before upload. Two versions are uploaded: `full` (**1080×1080**) and `thumb` (**600×600**).
- **1080×1080 is the largest thing we ever store, and original files are never stored.**
- Files live in the private `photos` bucket; the ordered photo ids are the `photos uuid[]` column on `profiles` (there is no photos table).

## Dimensions and why

All images are square. A square looks good in search, where two photos sit side by side, and it doesn't take over too much of the screen in the profile view (a portrait crop would fill most of a phone screen and push the text out of view). It also means one crop works everywhere we show a photo (the onboarding grid, search cards, the profile): the "main" photo is just a bigger square.

| Version | Size        | Format / quality | Typical file size | Used for                                    |
| ------- | ----------- | ---------------- | ----------------- | ------------------------------------------- |
| `full`  | 1080×1080   | JPEG, ~0.85      | 150–350 kB (up to ~900 kB for grainy photos) | Profile view, anywhere a photo is shown large |
| `thumb` | 600×600     | JPEG, ~0.8       | 40–70 kB          | Search (two photos side by side), lists, chat, onboarding grid |

The numbers come from how large photos are actually displayed, at typical phone pixel density (2–3×):

- **The page is at most 430 CSS px wide**, so content is at most about 382 px (24 px padding each side). A full-width photo at 2.5–3× density needs roughly 950–1150 px. **1080** is in that range (and a common convention). More would only add file size, since no screen we target shows it.
- **Search shows two photos side by side**, about 185 CSS px each. At 3× density that is about 555 px, so the thumbnail is **600**. The earlier thought of 480 px would be sharp on 2× screens but slightly soft on 3× phones, and search is the screen people scan longest.
- Using the 1080 image in a 185 px search slot would download nearly 6× more pixels than needed (~5 MB for 20 cards), which is why a separate thumbnail exists. A third size isn't needed: profile views use `full`.

If the search layout changes (edge-to-edge cards, three columns), revisit the thumbnail size.

**Originals are never stored.**
- Drawing to a canvas and re-encoding **strips EXIF data, including GPS location**, which matters for privacy.
- It keeps storage and bandwidth small.
- The asymmetry to remember: we can always derive smaller images from the 1080 master, but never larger. So `full` should err generous, and any future size (say a 720 px card size) has to be generated from it, not from an original.
- A crop smaller than 1080 px is not upscaled. Source photos whose short side is under 600 px (`MIN_SOURCE_SIZE`, the thumbnail size) are rejected ("photo too small").

## Where resizing happens

**In the browser, not on the server.**

- Supabase's image transformation API (resize by URL parameter) is a Pro-plan feature and is off in the local config, so it would not run locally or in CI.
- Client-side processing works on any plan, needs no extra infrastructure, and lets us strip EXIF before the file ever leaves the device.
- The trade-off is that the server can't verify dimensions or content. The bucket enforces only size and type (below), and an admin sees every photo during vetting. If we ever need server-side validation or processing, a storage webhook / edge function can be added without changing the layout.

## Cropping

The user picks a photo and a **crop sheet** (a bottom sheet, like the other pickers) opens every time. It follows the pattern of the big dating apps rather than a draggable crop box: a **fixed square viewport shows exactly what the photo will look like**, and the full photo moves underneath it. Drag to move; pinch or mouse wheel to zoom (a hint says so; there is no zoom slider); rule-of-thirds guidelines are drawn over the square. The photo always covers the square (no empty edges), and zoom is capped so the visible part never falls below the 600 px minimum.

Gestures are handled by [`@panzoom/panzoom`](https://github.com/timmywil/panzoom) (`contain: 'outside'`, which keeps the photo covering its parent). The sheet reads its pan and scale, computes the visible square in source pixels (`visibleSquare` in `photo-processor.ts`), and renders `full` and `thumb` **directly from the original decoded photo**, so each image is encoded once (no re-encoding of an already compressed crop). Browsers apply EXIF orientation when decoding, so photos taken sideways come out upright.

Processing rule for file size: the client targets about 1 MB or less for `full` and re-encodes at a lower JPEG quality if a photo (grainy night shots, foliage) comes out larger.

## Storage layout

- Private bucket **`photos`**, created in the init migration with `file_size_limit` **2 MiB** and `allowed_mime_types` **`image/jpeg`**. The limit is a safety net rather than the compression control (see above): typical files are far below it.
- Object paths: `<user id>/<photo id>/full.jpg` and `<user id>/<photo id>/thumb.jpg`. The **photo id is a uuid generated by the client**, and the paths are always derived from the user id and photo id, so nothing else has to store them.
- **`profiles.photos uuid[]`** is the ordered list of photo ids (first = main photo), with a database check limiting it to **6**. There is deliberately no `profile_photos` table: photos are never queried on their own, order is just array order, and the limit is a plain constraint. If we ever need per-photo data (say individual photo moderation), that is the point to move to a table.
- Photos are uploaded during onboarding, **before a profile row exists**; the ids are kept in the onboarding draft (see `docs/database.md`) and written to `profiles.photos` when onboarding is submitted.
- **Upload flow:** "Use photo" in the crop sheet renders both images, uploads them (in parallel, with a spinner in the sheet; the sheet can't be dismissed meanwhile) and only then closes and adds the photo id to the draft. If either upload fails, neither file is left behind and the sheet shows an error so the user can retry. Removing a photo deletes both files, then drops the id from the draft.
- **Reordering:** photos are dragged into place in the grid with the Angular CDK's drag and drop, which works with mouse and touch. On touch a photo is picked up by touching and holding it for a moment (200 ms), so a quick swipe still scrolls the page. The order is the order of `photos` in the draft; the first photo is the **main** photo, shown as the big tile with the MAIN label, so dragging a photo to the first spot makes it the main one. There is no keyboard alternative yet.
- **The grid shows the stored photos, not local copies:** it fetches signed URLs for the thumbnails by id, so photos also appear after a page reload (the draft is in localStorage, the images in the bucket). A draft id whose files no longer exist (say, after a local database reset) is dropped silently.

## Access and privacy

- The bucket is **private**. Row-level security allows a user to read, write and delete only objects under their own `<user id>/` folder. Admins (profile status `admin`, see `docs/database.md`) can also read every photo, for vetting, but not change or delete them. `active` members can read the photos of other `active` members (below). Photos are displayed through **signed URLs** (`createSignedUrls`, about an hour), from `PhotoStorageService` (`core/`), which signs many at once, of any owner (the policies decide which work).
- **Where each version shows:** the profile grid (`shared/profile-grid/`, used for vetting and search) signs the main photo's `thumb` for every tile in one request. The profile (`shared/profile-view/`) first shows that same cached thumbnail, so the photo can morph from the tile without a blank frame, then swaps in the `full` versions of all its photos once they're signed; the browser keeps the old image until the new one has loaded.
- **Members seeing each other's photos:** the storage policy `photos_select_members` (with the helper `is_member_photo()`) lets an `active` member read a photo if its owner is `active` and the photo is listed in the owner's `profiles.photos`. So suspended, disabled and deleted profiles stop being visible as soon as their status changes (a URL already signed still works until it expires, about an hour), and files that were uploaded but never submitted stay private.
- **The policy checks statuses, not who may see whom.** Which members may see each other is decided by `search_profiles()`, including "Only show me to these genders" and dismissals, and the policy doesn't repeat those rules. What protects someone from a member they hide from is that the photo ids are random uuids, which that member only gets from `search_profiles()` or `get_connected_profiles()`. Someone who saw a profile before its owner turned on `hide_by_gender` could still sign that photo with the ids they already have.
- Deleting a profile should clear `photos` and remove the files (see the deletion note in `docs/database.md`).

## Known gaps

- **Orphaned files.** Removing a photo in the UI deletes both files, but photos uploaded by someone who never submits onboarding (or who signs out, which clears the draft) stay in storage. Planned fix: a server-side sweep that deletes objects not referenced by any `profiles.photos` after a grace period. Until then this is accepted; the files are unreachable without a signed URL.
- **No server-side image validation** (dimensions, real content). See "Where resizing happens".
