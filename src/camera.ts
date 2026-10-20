const VIRTUAL_CAM = /obs|virtual|snap camera|mmhmm/i;

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}

/** Prefer a real camera — picking the OBS Virtual Camera would feed our own output back in. */
export function pickDefaultCamera(cams: MediaDeviceInfo[], saved?: string | null): string | undefined {
  if (saved && cams.some((c) => c.deviceId === saved)) return saved;
  return (cams.find((c) => !VIRTUAL_CAM.test(c.label)) ?? cams[0])?.deviceId;
}

export async function openCamera(video: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
  const old = video.srcObject as MediaStream | null;
  old?.getTracks().forEach((t) => t.stop());

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}
