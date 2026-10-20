# 🐱 Cute Cam: a cute camera filter for Discord / MS Teams

A web app that adds animal ears 🐱🐶🐰🐻 plus effects that react to your face, using MediaPipe Face Landmarker. It sends the picture into meetings through the **OBS Virtual Camera**.

## Running it
Requires **Node.js 20.19+ or 22.12+** (Vite 8). Older Node fails with
`SyntaxError: ... 'node:util' does not provide an export named 'styleText'`.
```bash
npm install
npm run dev        # http://localhost:5173
```

## 🐾 Bee (mask over your face)
Bee the cat from the BeBetter character sheet (`public/ref/BeBetter_sheet_Bee.svg`). The body, ears, tail and arms use the sheet's own paths
(`src/filters/bebetter/bee-geometry.ts`), and the face uses the 10 expressions from the sheet:

| Your face | Bee's expression |
|---|---|
| Normal | calm |
| Smile | happy · big smile → **arms up (ชูแขนดีใจ)** |
| Smile on one side | smirk (half-lidded eyes + dimple) |
| Half-close your eyes | meh (eyelids) · close fully → bliss |
| Open your mouth a little / wide | alert (ตกใจ) / shout (ตะโกน) |
| Pucker your lips | hearts (heart eyes) |
| Frown / furrow your brows | angry (หงุดหงิด) |
| Sad face | sad (เศร้า) |
| **Raise your hand(s)** | Bee's paw follows your real hand (hand tracking, loads only for Bee) |

## 🦜 Manow (mask over your face)
Manow the parrot (`public/ref/BeBetter_sheet_Manow.svg`): crest, wings, tail and feet from the sheet; wings flap and tail wags when happy.
**The crest shows the mood** like a real parrot's: spikes up when surprised/angry, flattens when sad/sleepy, the middle feather hooks when curious.
The beak is a redraw in the sheet's style (the sheet's flat-topped beak read oddly on camera): a hooked upper beak plus a lower mandible that opens with your jaw.

| Your face | Manow's expression |
|---|---|
| Normal | happy |
| Big smile | laugh (ตาหยี ^ ^) · bigger → **wings up** · + open mouth → หัวเราะลั่น |
| Smile on one side | smug |
| Open your mouth | อ้าปาก (the beak opens with your jaw) · wide → ตะโกน |
| Raise your eyebrows | สงสัย (curious) |
| Look hard to one side | เหล่มอง (side-eye) |
| Frown / sad face | หงุดหงิด / เศร้า |
| **Raise your hand(s)** | the **wing** on that side points at your hand (a parrot has no paws) |
| **Lean in toward the camera** (quickly) | 🔍 **observes** — holds a magnifying glass to one eye, squints the other, sticker อืมมม... / น่าสนใจ... (`observe` in `src/captions.ts`) |
| **Raise your brows + tilt your head** (hold ~½ s) | ❓ **asks a question** — a ❓ pops above the crest and a random question sticker shows (เดี๋ยวนะ...? / แล้วถ้า...? / ทำไมล่ะ? …, edit them in `src/captions.ts` → `question`) |

### Adding another BeBetter character
All BeBetter sheets share one template, so a new one is mostly generated:
```bash
python3 scripts/extract-bebetter.py public/ref/BeBetter_sheet_<Name>.svg <name>
```
then add a small `src/filters/bebetter/<name>.ts` (its moving parts + face) like `bee.ts` / `manow.ts`, and register it in `src/filters/index.ts`.

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
`1`–`7` switch filters (Bee / Manow / cat / dog / bunny / bear / none) · `E` turn effects on/off · `M` mirror left/right · `H` meeting mode (hides the UI)

URL params: `?clean=1` start in meeting mode · `?filter=bunny` · `?mirror=0|1`

## 🚀 Quick start before a meeting (double-click)
Double-click **`start-cutecam.command`** in Finder. It will:
1. start the filter server
2. open the Bee window in meeting mode
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
