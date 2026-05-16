# Backup Demo Video — Recording + Playback Instructions

If the live system dies on stage, you fall back to a 90-second screen
recording of the same flow. This file is the recipe to record it once,
keep it tight, and play it inline without leaving the browser.

> **Rule: no editing.** Record it once, in one take. If it goes wrong,
> reset the demo (`pnpm demo:setup:win`) and record again. Cutting
> clips together always shows on stage.

---

## Storage location

Save the final file to:

```
infra/demo/backup-90s.mp4
```

Keep a USB-stick copy with the laptop the day of the demo. Do **not**
rely on cloud sync the morning of the stage — venue Wi-Fi is famously
unreliable.

---

## What goes in the 90 seconds

Compress `RUNBOOK.md` Beats 1-5 into 90 seconds. Beat 6 is on the
slide; you'll deliver it live regardless. Target shot count:

| 00:00-00:15 | Landing in Uzbek → locale switch to Russian → back to Uzbek           |
| 00:15-00:40 | Chat: type the Uzbek KYC question, watch tokens stream, click a citation |
| 00:40-01:05 | Simulator: 5 steps, score lands on 88                                 |
| 01:05-01:20 | HR Dashboard: Aziz appears, click Assign, picker shows Dilshoda at top |
| 01:20-01:30 | `/me` profile: streak ring + first_kyc badge                          |

No voiceover. Captions in English burned in, **bottom-third only**, so
the operator can talk over the video without competing audio.

---

## Recording — Windows (OBS Studio)

Install: <https://obsproject.com/> (current LTS).

1. **Scene**: 1 scene named `Demo`. Add a **Display Capture** source
   pointing at the laptop's primary display.
2. **Window**: full-screen the browser (F11). Browser zoom 100%.
3. **Output settings**:
   - Mode: Simple
   - Recording path: `infra/demo/`
   - Recording format: `mp4`
   - Encoder: `Hardware (NVENC)` if you have an NVIDIA GPU,
     otherwise `Software (x264)`.
   - CRF: 23 (default is fine).
4. **Video settings**:
   - Base (Canvas) Resolution: `1920 x 1080`
   - Output (Scaled) Resolution: `1920 x 1080`
   - FPS: `30`
5. **Audio**: **disable** the mic and desktop audio. Silent video.
6. **Hotkey**: bind Start/Stop Recording to `Ctrl+F12`.
7. Hit `Ctrl+F12`, run the demo, hit `Ctrl+F12` again.
8. Rename the output file to `backup-90s.mp4` and drop it under
   `infra/demo/`.

---

## Recording — macOS (QuickTime Player)

QuickTime is preinstalled and good enough; no install needed.

1. Open **QuickTime Player** → `File` → `New Screen Recording`.
2. In the floating control: **Options** → **Microphone: None**.
   Silent video.
3. Choose **Record Selected Portion** and drag a 1920×1080 box over
   the browser window (full-screen the browser first with `Ctrl+Cmd+F`).
4. Click **Record**. Run the demo. Click the stop icon in the menu bar.
5. `File` → `Export As` → `1080p`. Save as `backup-90s.mp4` under
   `infra/demo/`.
   - If your macOS exports `.mov` only, run:
     `ffmpeg -i backup-90s.mov -c copy backup-90s.mp4`
     in a terminal (Homebrew: `brew install ffmpeg`).

---

## Playback during the demo

Keep a **7th browser tab** preloaded with the local file. The cleanest
inline player is the browser itself — no external app, no app switcher
visible to the audience.

1. Drag `infra/demo/backup-90s.mp4` into a new browser tab. Confirm it
   plays.
2. Right-click the video → **Picture in Picture** is OFF. **Loop** is
   OFF. **Controls** is ON.
3. Pause at frame 0.
4. If you need to fall back during the live demo: switch to this tab,
   click play, do not touch anything else.
5. Talk over it. The captions cover the on-screen actions; you
   deliver Beat 6's three non-negotiables live.

---

## TODO (human)

- [ ] Record `infra/demo/backup-90s.mp4` (≤ 90 seconds, silent, 1080p).
- [ ] Burn English captions into the bottom third with OBS's
      built-in text source OR with `ffmpeg -vf subtitles=...`.
- [ ] Copy the final file to a USB stick. Label it "Vitality demo
      backup — YYYY-MM-DD".
- [ ] Test playback on the actual stage laptop the day before.
