// Copy MediaPipe wasm runtime into public/ so it's served locally (matches installed version).
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/wasm", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/wasm", { recursive: true });
