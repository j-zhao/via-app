import type {KeyboardAPI} from './keyboard-api';

// Keep in sync with keyboards/sunder/e70/rp2040/he_via.c in j-zhao/qmk_firmware.
export const HE_KEYBOARD_VPIDS = [0x17717001];

const CUSTOM_CHANNEL = 0;

enum HEValueId {
  Actuation = 1,
  InputPriorityPair = 2,
  Switch = 3,
  CustomProfileLayer = 4,
  Version = 5,
}

export enum RapidTriggerMode {
  Off = 0,
  On = 1,
  Continuous = 2,
}

export const RESET_AT_ACTUATION = 255;

export type Actuation = {
  actuationPoint: number;
  resetPoint: number;
  rtMode: RapidTriggerMode;
  rtPress: number;
  rtRelease: number;
};

// The firmware maps 3.5 mm of travel onto 0..255.
const MM_PER_UNIT = 3.5 / 255;

export const unitsToMm = (units: number) => units * MM_PER_UNIT;
export const mmToUnits = (mm: number) => Math.round(mm / MM_PER_UNIT);

export const isHallEffectKeyboard = (vendorProductId: number) =>
  HE_KEYBOARD_VPIDS.includes(vendorProductId);

export async function getActuation(
  api: KeyboardAPI,
  profile: number,
  row: number,
  col: number,
): Promise<Actuation> {
  const res = await api.getCustomMenuValue([
    CUSTOM_CHANNEL,
    HEValueId.Actuation,
    profile,
    row,
    col,
  ]);
  const [actuationPoint, resetPoint, rtMode, rtPress, rtRelease] = res.slice(1);
  return {actuationPoint, resetPoint, rtMode, rtPress, rtRelease};
}

export async function setActuation(
  api: KeyboardAPI,
  profile: number,
  row: number,
  col: number,
  actuation: Actuation,
): Promise<void> {
  await api.setCustomMenuValue(
    CUSTOM_CHANNEL,
    HEValueId.Actuation,
    profile,
    row,
    col,
    actuation.actuationPoint,
    actuation.resetPoint,
    actuation.rtMode,
    actuation.rtPress,
    actuation.rtRelease,
  );
}

export const PAIR_DISABLED = 255;
export const NUM_INPUT_PRIORITY_PAIRS = 8;

export enum PairResolution {
  Last = 0,
  Primary = 1,
  Secondary = 2,
  Neutral = 3,
  Depth = 4,
}

// Which actuation profile a pair applies in.
export enum PairProfile {
  Default = 0,
  Custom = 1,
  All = 2,
}

export type InputPriorityPair = {
  profile: number;
  primaryRow: number;
  primaryCol: number;
  secondaryRow: number;
  secondaryCol: number;
  resolution: PairResolution;
};

export async function getInputPriorityPair(
  api: KeyboardAPI,
  index: number,
): Promise<InputPriorityPair> {
  const res = await api.getCustomMenuValue([
    CUSTOM_CHANNEL,
    HEValueId.InputPriorityPair,
    index,
  ]);
  const [
    profile,
    primaryRow,
    primaryCol,
    secondaryRow,
    secondaryCol,
    resolution,
  ] = res.slice(1);
  return {
    profile,
    primaryRow,
    primaryCol,
    secondaryRow,
    secondaryCol,
    resolution,
  };
}

export async function setInputPriorityPair(
  api: KeyboardAPI,
  index: number,
  pair: InputPriorityPair,
): Promise<void> {
  await api.setCustomMenuValue(
    CUSTOM_CHANNEL,
    HEValueId.InputPriorityPair,
    index,
    pair.profile,
    pair.primaryRow,
    pair.primaryCol,
    pair.secondaryRow,
    pair.secondaryCol,
    pair.resolution,
  );
}

// The firmware calls this the special layer. 0 turns the Custom profile off.
// Otherwise the value is the layer number plus 1.
export async function getCustomProfileLayer(api: KeyboardAPI): Promise<number> {
  const res = await api.getCustomMenuValue([
    CUSTOM_CHANNEL,
    HEValueId.CustomProfileLayer,
  ]);
  return res[1];
}

export async function setCustomProfileLayer(
  api: KeyboardAPI,
  value: number,
): Promise<void> {
  await api.setCustomMenuValue(
    CUSTOM_CHANNEL,
    HEValueId.CustomProfileLayer,
    value,
  );
}
