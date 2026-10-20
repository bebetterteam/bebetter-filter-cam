import { bear } from "./bear";
import { bee } from "./bebetter/bee";
import { manow } from "./bebetter/manow";
import { bunny } from "./bunny";
import { cat } from "./cat";
import { dog } from "./dog";
import type { Filter } from "./types";

const none: Filter = { id: "none", icon: "🚫", label: "ไม่มี", draw() {} };

export const FILTERS: Filter[] = [bee, manow, cat, dog, bunny, bear, none];
