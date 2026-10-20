// ✏️ Edit the sticker wording here
export interface Caption { title: string; sub?: string }

export const CAPTIONS: Record<string, Caption | Caption[]> = {
  nod: { title: "รับทราบ", sub: "(แต่ไม่รับรอง)" },
  shake: { title: "ไม่เอาาา", sub: "(ขอผ่าน)" },
  tilt: { title: "หืมมม?", sub: "(งงนิดนึง)" },
  surprised: { title: "ห๊ะ!?" },
  angry: { title: "หงุดหงิดนะ", sub: "(อย่าเพิ่งคุย)" },
  sad: { title: "เศร้าแป๊บ", sub: "(เดี๋ยวก็หาย)" },
  // Manow: raise brows + tilt head → one of these at random (the question everyone's thinking)
  question: [
    { title: "เดี๋ยวนะ...?", sub: "(ขอถามหน่อย)" },
    { title: "แล้วถ้า...?" },
    { title: "ทำไมล่ะ?", sub: "(อยากรู้จริงๆ)" },
    { title: "จริงเหรอ?" },
    { title: "หมายความว่าไง?" },
    { title: "แล้วใครทำ?", sub: "(ถามเฉยๆ)" },
  ],
  // Manow: lean in toward the camera → magnifying glass + one of these
  observe: [
    { title: "อืมมม...", sub: "(ขอดูใกล้ๆ)" },
    { title: "น่าสนใจ...", sub: "(จดไว้ก่อน)" },
    { title: "เดี๋ยวนะ!", sub: "(เห็นอะไรบางอย่าง)" },
    { title: "ตรงนี้ไง!" },
  ],
  // Som: both hands up, or a big laugh → bounce + confetti
  yay: [
    { title: "เย้!!", sub: "(สุดยอดดด)" },
    { title: "ไปเลยยย!" },
    { title: "ดีใจจัง!", sub: "(กระโดดเลย)" },
  ],
  // Som: furrowed brows + a smile (มุ่งมั่น) → fist pump + energy sparks
  goforit: [
    { title: "ลุยเลย!", sub: "(คิดทีหลัง)" },
    { title: "จัดไป!" },
    { title: "ได้อยู่แล้ว!", sub: "(มั้งนะ)" },
  ],
};

/** Gesture stickers only some characters have. */
export type SpecialId = "question" | "observe" | "yay" | "goforit";
export type CaptionId = "nod" | "shake" | "tilt" | "surprised" | "angry" | "sad" | SpecialId;
