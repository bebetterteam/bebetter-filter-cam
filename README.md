# 🐱 Cute Cam: a cute camera filter for Discord / MS Teams

A web app that adds animal ears 🐱🐶🐰🐻 plus effects that react to your face, using MediaPipe Face Landmarker. It sends the picture into meetings through the **OBS Virtual Camera**.

## Running it
```bash
npm install
npm run dev        # http://localhost:5173
```

## 💙 Blue Cat (mask over your face)
A blue cat covers your face and follows your head, eyes (blinks, winks, gaze), eyebrows and mouth, plus your **mood**:
😊 happy → closed-happy eyes + pink cheeks + faster tail wag · 😮 surprised → ❗ · 😠 angry → 💢 + ears back · 😢 sad → 💧 · close your eyes > 1.5s → 💤

**Sticker labels from gestures** (edit the wording in `src/captions.ts`):
| Gesture | Label |
|---|---|
| Nod 1–2 times | **รับทราบ** (แต่ไม่รับรอง) + cat raises a paw |
| Shake head | **ไม่เอาาา** |
| Tilt head and hold | **หืมมม?** |
| Surprised / angry / sad face | ห๊ะ!? / หงุดหงิดนะ / เศร้าแป๊บ |

## Effects that react to your face
| Do this | You get |
|---|---|
| Open your mouth wide | 💕 hearts float out (the dog filter also sticks its tongue out) |
| Close your eyes for a moment (longer than a normal blink) | ✨ sparkles around your eyes |
| Smile | 🌸 pinker cheeks |
| Raise your eyebrows | ⭐ stars above your head |

## Keyboard shortcuts
`1`–`6` switch filters (blue cat / cat / dog / bunny / bear / none) · `E` turn effects on/off · `M` mirror left/right · `H` meeting mode (hides the UI)

URL params: `?clean=1` start in meeting mode · `?filter=bunny` · `?mirror=0|1`

## 🚀 Quick start before a meeting (double-click)
Double-click **`start-cutecam.command`** in Finder. It will:
1. start the filter server
2. open the blue cat window in meeting mode
3. open OBS and **Start Virtual Camera** for you

Then just turn on your camera in Discord/Teams as usual (pick **OBS Virtual Camera** once; it's remembered).
Close the Terminal window when the meeting is over.

> The OBS setup below (adding the window source) is only needed once.

## Using it in Discord / MS Teams (macOS)
1. Install [OBS Studio](https://obsproject.com/) (free).
2. Open Cute Cam as a dedicated window with no address bar (the flags stop Chrome from pausing the page when the window is covered):
   ```bash
   open -na "Google Chrome" --args --app="http://localhost:5173/?clean=1" \
     --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
     --user-data-dir=/tmp/cutecam-chrome
   ```
   Allow camera access when asked.
3. In OBS → Sources → **+** → **macOS Screen Capture** → Method: *Window* → pick the Cute Cam window.
   Right-click the source → Transform → **Fit to screen**. Set the canvas to 1280×720 under Settings → Video.
4. Click **Start Virtual Camera** (bottom right).
5. In Discord: Settings → Voice & Video → Camera → **OBS Virtual Camera**.
   In Teams: Settings → Devices → Camera → **OBS Virtual Camera**.
   If it doesn't show up, fully quit Discord/Teams (⌘Q) and open it again.

> In meeting mode the picture is **not mirrored**, because Discord/Teams already mirror your self-view. Other people see you the right way round.
> The Cute Cam window should not be minimized. It can sit behind other windows.
