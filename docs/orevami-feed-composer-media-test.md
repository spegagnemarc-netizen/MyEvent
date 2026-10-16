# Feed composer media — TEST only

Based on the persistence fix deployed as 41f2d9d5f08d108611503a679d790bc826d8f59a (local bc9af57).

- Native file inputs, single photo or video, preview and removal; no capture attribute, so iPhone can offer its gallery.
- Text-only continues using event_feed_posts. Media with optional caption uses existing social_posts / private social-media bucket. Existing rows are unchanged.
- Image files that Safari can decode are converted to JPEG, at most 4096 pixels per longest edge. No HEIC decoder or video transcoder added. Videos retain original format; playback depends on Safari codec support. MP4 H.264 is the compatibility choice.
- Both file input and upload enforce 15 MiB. MP4, QuickTime/MOV and WebM added to the TEST bucket whitelist only; existing photo MIME types, private access and ownership policies retained.
- Media rendering uses the existing camera post identity, reactions, sharing and image viewer. Videos use native controls, playsinline, metadata preload and the existing 250px contain rule, without autoplay.
- Session changes discard private drafts and local preview URLs. Late completion cannot render into a different user's feed. Insert failures clean up the uploaded orphan where permissions permit; provider details are not reflected in messages.
- Added tools and media upload helper fail closed outside exact TEST Preview. Existing text composer stays usable.

## Validation

Six new targeted simulated checks passed: gallery trigger/image conversion/removal/text-only, video with caption/double-click guard, rejected upload preserving draft, unsupported video/session isolation, upload metadata/orphan cleanup, Production and size rejection. JavaScript syntax and diff whitespace checks passed. No real publication created; no previous test campaign repeated.

TEST SQL confirms social_posts already permits image/video and social-media remains private with 15 MiB limit and unchanged ownership policies after migration 20261016051716. Security advisors report no notice naming social_posts or social-media; unrelated existing notices were not altered.

iPhone native gallery, decoding of the user's actual files, keyboard layout and video playback remain user validation items. Agent browser unavailable due native credential resume restriction; no real UI success claimed.

Payments, AdSense, games, event selection, Sortie IA and Production untouched. Sponsorisé remains disabled in TEST as before; no campaign enabled.
