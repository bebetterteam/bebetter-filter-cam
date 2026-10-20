// ✏️ Edit the sticker wording here
export interface Caption { title: string; sub?: string }

export const CAPTIONS = {
  nod: { title: "รับทราบ", sub: "(แต่ไม่รับรอง)" },
  shake: { title: "ไม่เอาาา", sub: "(ขอผ่าน)" },
  tilt: { title: "หืมมม?", sub: "(งงนิดนึง)" },
  surprised: { title: "ห๊ะ!?" },
  angry: { title: "หงุดหงิดนะ", sub: "(อย่าเพิ่งคุย)" },
  sad: { title: "เศร้าแป๊บ", sub: "(เดี๋ยวก็หาย)" },
} satisfies Record<string, Caption>;

export type CaptionId = keyof typeof CAPTIONS;
