import "./style.css";
import { PoseSmoother, pinPose, poseFromLandmarks, type Pose, type Pt } from "./anchor";
import { listCameras, openCamera, pickDefaultCamera } from "./camera";
import { Emotion } from "./effects/emotion";
import { Gestures } from "./effects/gestures";
import { Effects } from "./effects/triggers";
import { FILTERS } from "./filters";
import { HandTracker, Tracker, type Blendshapes } from "./tracker";
import { initGuide } from "./guide";
import { BG_DEFAULT, buildUi, loadSettings, renderUi, saveSettings } from "./ui";

const canvas = document.getElementById("out") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const status = document.getElementById("status")!;
const statusMsg = status.querySelector(".msg")!;
const fpsEl = document.getElementById("fps")!;
const fpsTxt = fpsEl.querySelector(".txt")!;

/** Loading / error card over the video; empty text hides it. */
function setStatus(text: string, kind: "loading" | "error" = "loading") {
  status.dataset.kind = text ? kind : "";
  statusMsg.textContent = text;
}
const video = document.createElement("video");
video.muted = true;
video.playsInline = true;

const params = new URLSearchParams(location.search);
const mirrorParam = params.get("mirror");
const settings = loadSettings();
if (params.get("filter")) settings.filter = params.get("filter")!;
if (params.get("captions")) settings.captions = params.get("captions") !== "0";
// ?bg=00B140 → solid color behind the mascot, ?bg=0 → camera
const bgParam = params.get("bg");
if (bgParam) settings.bg = /^#?[0-9a-f]{6}$/i.test(bgParam) ? "#" + bgParam.replace("#", "").toUpperCase() : null;
if (params.get("pin")) settings.pin = params.get("pin") !== "0";
let lastBg = settings.bg ?? BG_DEFAULT;

let clean = params.get("clean") === "1";
// Meeting apps mirror your self-view already, so send an unmirrored picture in meeting mode.
const defaultMirror = () => (mirrorParam !== null ? mirrorParam === "1" : !clean);
let mirror = defaultMirror();
let cams: MediaDeviceInfo[] = [];
let camId: string | undefined;

const effects = new Effects();
const emotion = new Emotion();
const gestures = new Gestures();
const smoother = new PoseSmoother();
let pose: Pose | null = null;
let blendshapes: Blendshapes = {};
let lastSeen = -Infinity;

function refreshUi() {
  document.body.classList.toggle("clean", clean);
  renderUi(settings, mirror, cams, camId);
  saveSettings(settings);
}

async function switchCamera(id?: string) {
  await openCamera(video, id).catch((err) => {
    if (!id || (err as Error).name !== "OverconstrainedError") throw err;
    return openCamera(video); // saved camera was unplugged
  });
  camId = (video.srcObject as MediaStream).getVideoTracks()[0]?.getSettings().deviceId ?? id;
  cams = await listCameras(); // labels are only available after permission
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  smoother.reset();
}

const guide = initGuide({ onUse(id) { settings.filter = id; refreshUi(); guide.close(); } });

buildUi({
  onFilter(id) { settings.filter = id; refreshUi(); },
  onGuide() { guide.toggle(settings.filter); },
  onEscape() { if (guide.isOpen()) guide.close(); else { clean = !clean; mirror = defaultMirror(); refreshUi(); } },
  onEffects() { settings.effects = !settings.effects; refreshUi(); },
  onCaptions() { settings.captions = !settings.captions; refreshUi(); },
  onBg(color) { settings.bg = color; if (color) lastBg = color; refreshUi(); },
  onBgToggle() { settings.bg = settings.bg ? null : lastBg; refreshUi(); },
  onMirror() { mirror = !mirror; refreshUi(); },
  onPin() { settings.pin = !settings.pin; refreshUi(); },
  onClean() { if (guide.isOpen()) guide.close(); clean = !clean; mirror = defaultMirror(); refreshUi(); },
  async onCamera(id) {
    settings.camera = id;
    await switchCamera(id).catch(showError);
    refreshUi();
  },
});

function showError(err: unknown) {
  console.error("[CuteCam]", err);
  const name = (err as Error)?.name;
  setStatus(
    name === "NotAllowedError" ? "ยังไม่ได้รับอนุญาตให้ใช้กล้อง กดอนุญาตที่แถบที่อยู่ แล้วรีโหลดหน้านี้" :
    name === "NotFoundError" ? "ไม่พบกล้อง ลองเสียบกล้องแล้วรีโหลดหน้านี้" :
    `เปิดกล้องไม่สำเร็จ: ${(err as Error)?.message ?? err}`,
    "error",
  );
}

// hand tracking is loaded lazily, only when a filter wants it (it costs extra CPU/GPU)
let handTracker: HandTracker | null = null;
let handLoading = false;
let hands: Pt[] = [];
let handTick = 0;

function ensureHands() {
  if (handTracker || handLoading) return;
  handLoading = true;
  HandTracker.create()
    .then((h) => (handTracker = h))
    .catch((err) => console.warn("[CuteCam] hand tracking unavailable", err));
}

// pinned mascot: face center at this fraction of the height, face width as a fraction of the height
const PIN_Y = 0.6;
const PIN_SIZE = 0.3;

let lastVideoTime = -1;
let lastFrame = performance.now();
let frames = 0, fpsT = performance.now();

function loop(tracker: Tracker) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = now / 1000;
  const W = canvas.width, H = canvas.height;

  const filter = FILTERS.find((f) => f.id === settings.filter) ?? FILTERS[0];
  if (filter.wantsHands) ensureHands();
  else hands = [];

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    // hands every other frame is plenty for arm poses
    if (filter.wantsHands && handTracker && handTick++ % 2 === 0) hands = handTracker.detect(video, now, W, H);
    const res = tracker.detect(video, now);
    if (res) {
      pose = smoother.update(poseFromLandmarks(res.landmarks, W, H));
      blendshapes = res.blendshapes;
      lastSeen = t;
    } else if (t - lastSeen > 0.3) {
      pose = null;
      blendshapes = {};
      smoother.reset();
    }
  }

  emotion.update(pose ? blendshapes : null, t, dt);
  const sm = emotion.smooth;
  const smile = ((sm.mouthSmileLeft ?? 0) + (sm.mouthSmileRight ?? 0)) / 2;
  const browDown = ((sm.browDownLeft ?? 0) + (sm.browDownRight ?? 0)) / 2;
  gestures.update(pose, emotion.mood, t, {
    specials: filter.specials,
    browUp: Math.max(sm.browInnerUp ?? 0, ((sm.browOuterUpLeft ?? 0) + (sm.browOuterUpRight ?? 0)) / 2),
    handsUp: pose ? hands.filter((h) => h.y < pose!.chin.y).length : 0,
    laugh: smile > 0.6 && (sm.jawOpen ?? 0) > 0.3,
    determined: browDown > 0.4 && smile > 0.35,
  });
  // gestures above read the real face (nod / lean / hands); everything drawn uses the pinned one
  const drawPose = pose && settings.pin ? pinPose(pose, { x: W / 2, y: H * PIN_Y }, H * PIN_SIZE) : pose;
  const fxPose = drawPose && filter.remap ? filter.remap(drawPose) : drawPose;
  if (settings.effects) effects.update(fxPose, blendshapes, t, dt, filter.id === "none" || filter.mask ? 0 : 0.25);

  ctx.save();
  if (mirror) ctx.setTransform(-1, 0, 0, 1, W, 0);
  // solid background: hide the camera picture so only the mascot shows (tracking still reads the video)
  if (settings.bg) {
    ctx.fillStyle = settings.bg;
    ctx.fillRect(0, 0, W, H);
  } else ctx.drawImage(video, 0, 0, W, H);
  // blush sits on your real cheeks, so skip it when there's no face to sit on
  if (settings.effects && !filter.mask && !settings.bg) effects.drawBlush(ctx, fxPose);
  if (drawPose) {
    filter.draw(ctx, drawPose, emotion.smooth, t, {
      mood: emotion.mood, moodLevel: emotion.level, paw: gestures.paw(t), mirror, hands, gesture: gestures.current(t),
    });
  }
  if (settings.effects) effects.draw(ctx);
  ctx.restore();
  // captions are drawn unmirrored so the text always reads correctly
  // (gestures still run with captions off, so ❓ / 🔍 / bounces etc. keep playing)
  if (filter.id !== "none" && settings.captions) gestures.drawHud(ctx, drawPose, mirror, t);

  frames++;
  if (now - fpsT > 1000) {
    fpsEl.dataset.face = pose ? "1" : "0";
    fpsTxt.textContent = `${frames} fps · ${pose ? "พบใบหน้า" : "ไม่พบใบหน้า"}`;
    frames = 0;
    fpsT = now;
  }
  requestAnimationFrame(() => loop(tracker));
}

async function start() {
  refreshUi();
  if (params.get("guide")) guide.open(params.get("guide")!);
  // canvas text doesn't trigger web-font loading on its own
  document.fonts?.load('700 40px "Mitr"').catch(() => {});
  try {
    setStatus("กำลังเปิดกล้อง");
    await switchCamera(settings.camera ?? undefined);
    // If the first pick was a virtual cam (e.g. OBS), switch to a real one.
    const preferred = pickDefaultCamera(cams, settings.camera);
    if (preferred && preferred !== camId) await switchCamera(preferred);
    refreshUi();
  } catch (err) {
    return showError(err);
  }
  try {
    setStatus("กำลังโหลดโมเดลจับใบหน้า");
    const tracker = await Tracker.create();
    setStatus("");
    loop(tracker);
  } catch (err) {
    console.error("[CuteCam]", err);
    setStatus(`โหลดตัวจับใบหน้าไม่สำเร็จ ลองรีโหลดหน้านี้ หรือเปิดการเร่งกราฟิก (hardware acceleration) ในเบราว์เซอร์ · ${(err as Error)?.message ?? err}`, "error");
  }
}

start();
