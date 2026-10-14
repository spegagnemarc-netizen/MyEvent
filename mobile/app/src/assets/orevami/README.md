# ORÉVAMI Mobile assets

Official logo reused from `origin/main:assets/orevami`, commit `83c9b2ea273e22d4c457e3379e3c99b4ec4fc595`. Source rules prohibit generation/redrawing. These are deterministic format exports of the existing brand system, not AI-generated artwork.

- `icon.png`: unchanged official 512 × 512 source, opaque white background.
- `icon-1024.png`: 1024 × 1024 RGB PNG, resized from that source, no alpha or baked-in corner mask. Valid dimensions do not make a new high-resolution master.
- `adaptive-foreground.png`: 1024 × 1024 transparent canvas, official icon resized proportionally to 580 × 580, centered at (222,222), no redraw. Expo background is white; the source white background merges with that layer. Do not promise a separated vector mark or add a fake monochrome layer.
- `splash.png`: unchanged transparent official wordmark, 2170 × 725. Expo scales it at runtime over #07131c; system splash behavior varies by platform/version.
- `mobile/store/google-play-feature.png`: 1024 × 500 opaque dark canvas, official wordmark fitted inside 720 × 300 and centered. No product screenshot fabricated.

Exports used Sharp; no creative transformation. A vector/high-resolution original from the designer would improve small details, but existing artwork and proportions remain intact.
