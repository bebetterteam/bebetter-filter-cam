import { bear } from "./bear";
import { bluecat } from "./bluecat";
import { bunny } from "./bunny";
import { cat } from "./cat";
import { dog } from "./dog";
import type { Filter } from "./types";

const none: Filter = { id: "none", icon: "🚫", label: "ไม่มี", draw() {} };

export const FILTERS: Filter[] = [bluecat, cat, dog, bunny, bear, none];
