import type { Pose, Pt } from "../anchor";
import type { Mood } from "../effects/emotion";
import type { CaptionId, SpecialId } from "../captions";
import type { Blendshapes } from "../tracker";

export interface Extras {
  mood: Mood;
  /** 0→1 fade-in of the current mood */
  moodLevel: number;
  /** 0→1 how far the "nod" paw is raised */
  paw: number;
  mirror: boolean;
  /** Palm centers in canvas px (same space as the pose) — only filled for filters with `wantsHands`. */
  hands: Pt[];
  /** the gesture sticker currently showing (e.g. "question"), with its age in seconds */
  gesture: { id: CaptionId; age: number } | null;
}

export interface Filter {
  id: string;
  label: string;
  /** UI accent color while this filter is selected (defaults to ink) */
  accent?: string;
  /** Covers the whole face (skip the global cheek blush). */
  mask?: boolean;
  /** Load hand tracking for this filter (e.g. arms that follow your real hands). */
  wantsHands?: boolean;
  /** Character-specific gesture stickers (question, observe, yay, goforit). */
  specials?: SpecialId[];
  /** Move feature points to where this filter draws them, so particles (hearts, sparkles) line up. */
  remap?(pose: Pose): Pose;
  /** Everything draws on top of the video (there's no segmentation to go behind the face). */
  draw(ctx: CanvasRenderingContext2D, pose: Pose, bs: Blendshapes, t: number, extras: Extras): void;
}

export const OUTLINE = "#5a3a2e";
export const LINE = 0.018; // stroke width in face units
