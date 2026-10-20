import "./style.css";
import { PoseSmoother, poseFromLandmarks, type Pose } from "./anchor";
import { listCameras, openCamera, pickDefaultCamera } from "./camera";
import { Emotion } from "./effects/emotion";
import { Gestures } from "./effects/gestures";
import { Effects } from "./effects/triggers";
import { FILTERS } from "./filters";
import { Tracker, type Blendshapes } from "./tracker";
import { buildUi, loadSettings, renderUi, saveSettings } from "./ui";

const canvas = document.getElementById("out") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const status = document.getElementById("status")!;
const fpsEl = document.getElementById("fps")!;
const video = document.createElement("video");
video.muted = true;
video.playsInline = true;

const params = new URLSearchParams(location.search);
const mirrorParam = params.get("mirror");
const settings = loadSettings();
if (params.get("filter")) settings.filter = params.get("filter")!;

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

buildUi({
  onFilter(id) { settings.filter = id; refreshUi(); },
  onEffects() { settings.effects = !settings.effects; refreshUi(); },
  onMirror() { mirror = !mirror; refreshUi(); },
  onClean() { clean = !clean; mirror = defaultMirror(); refreshUi(); },
  async onCamera(id) {
    settings.camera = id;
    await switchCamera(id).catch(showError);
    refreshUi();
  },
});

function showError(err: unknown) {
  console.error("[CuteCam]", err);
  const name = (err as Error)?.name;
  status.textContent =
    name === "NotAllowedError" ? "😿 กรุณาอนุญาตให้ใช้กล้องก่อนนะ" :
    name === "NotFoundError" ? "😿 ไม่พบกล้อง" :
    `😿 เกิดข้อผิดพลาด: ${(err as Error)?.message ?? err}`;
}

let lastVideoTime = -1;
let lastFrame = performance.now();
let frames = 0, fpsT = performance.now();

function loop(tracker: Tracker) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = now / 1000;
  const W = canvas.width, H = canvas.height;

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
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

  const filter = FILTERS.find((f) => f.id === settings.filter) ?? FILTERS[0];
  emotion.update(pose ? blendshapes : null, t, dt);
  gestures.update(pose, emotion.mood, t);
  const fxPose = pose && filter.remap ? filter.remap(pose) : pose;
  if (settings.effects) effects.update(fxPose, blendshapes, t, dt, filter.id === "none" || filter.mask ? 0 : 0.25);

  ctx.save();
  if (mirror) ctx.setTransform(-1, 0, 0, 1, W, 0);
  ctx.drawImage(video, 0, 0, W, H);
  if (settings.effects && !filter.mask) effects.drawBlush(ctx, fxPose);
  if (pose) {
    filter.draw(ctx, pose, emotion.smooth, t, {
      mood: emotion.mood, moodLevel: emotion.level, paw: gestures.paw(t), mirror,
    });
  }
  if (settings.effects) effects.draw(ctx);
  ctx.restore();
  // captions are drawn unmirrored so the text always reads correctly
  if (filter.id !== "none") gestures.drawHud(ctx, pose, mirror, t);

  frames++;
  if (now - fpsT > 1000) {
    fpsEl.textContent = `${frames} fps${pose ? "" : " · ไม่เจอหน้า"}`;
    frames = 0;
    fpsT = now;
  }
  requestAnimationFrame(() => loop(tracker));
}

async function start() {
  refreshUi();
  // canvas text doesn't trigger web-font loading on its own
  document.fonts?.load('700 40px "Mitr"').catch(() => {});
  try {
    status.textContent = "📷 กำลังเปิดกล้อง…";
    await switchCamera(settings.camera ?? undefined);
    // If the first pick was a virtual cam (e.g. OBS), switch to a real one.
    const preferred = pickDefaultCamera(cams, settings.camera);
    if (preferred && preferred !== camId) await switchCamera(preferred);
    refreshUi();

    status.textContent = "🧠 กำลังโหลดโมเดลจับหน้า…";
    const tracker = await Tracker.create();
    status.textContent = "";
    loop(tracker);
  } catch (err) {
    showError(err);
  }
}

start();
