import {FC, KeyboardEvent, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import {faMagnet} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {CenterPane} from '../pane';
import {ControlRow, Detail, Label, SpanOverflowCell} from '../grid';
import {AccentRange} from '../../inputs/accent-range';
import {AccentSelect} from '../../inputs/accent-select';
import {AccentButton} from '../../inputs/accent-button';
import {ErrorMessage} from '../../styled';
import {NumberInput} from './submenus/macros/keycode-sequence-components';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getSelectedKeyboardAPI} from 'src/store/devicesSlice';
import {getSelectedKeyDefinitions} from 'src/store/definitionsSlice';
import {
  getExtraSelectedKeys,
  getSelectedKey,
  setSelectedKeys,
  updateSelectedKey,
} from 'src/store/keymapSlice';
import {
  Actuation,
  RESET_AT_ACTUATION,
  RapidTriggerMode,
  getActuation,
  mmToUnits,
  setActuation,
  unitsToMm,
} from 'src/utils/hall-effect';

const HallEffectPane = styled(CenterPane)`
  height: 100%;
  background: var(--color_dark_grey);
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

const PROFILE_OPTIONS = [
  {label: 'Universal', value: 0},
  {label: 'Special layer', value: 1},
];

const RT_OPTIONS = [
  {label: 'Off', value: RapidTriggerMode.Off},
  {label: 'Rapid Trigger', value: RapidTriggerMode.On},
  {label: 'Continuous', value: RapidTriggerMode.Continuous},
];

// The firmware rejects actuation below 8 units (0.11 mm).
const ACTUATION_MM = {min: 0.2, max: 3.4, step: 0.1};
const RT_MM = {min: 0.1, max: 1.0, step: 0.05};
const DEFAULT_RT_MM = 0.2;

const roundMm = (mm: number) => Math.round(mm * 100) / 100;

const SliderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MmInput = styled(NumberInput)`
  width: 70px;
`;

type MmRange = {min: number; max: number; step: number};

// A slider plus a text field. The text field applies on Enter or blur.
const MmSlider: FC<
  MmRange & {units: number; onChange: (units: number) => void}
> = ({min, max, step, units, onChange}) => {
  const mm = roundMm(unitsToMm(units));
  const [draft, setDraft] = useState(String(mm));
  useEffect(() => setDraft(String(mm)), [mm]);

  const commit = () => {
    const value = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(value)) {
      setDraft(String(mm));
      return;
    }
    const clamped = Math.min(max, Math.max(min, value));
    setDraft(String(roundMm(clamped)));
    onChange(mmToUnits(clamped));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(String(mm));
    }
  };

  return (
    <SliderRow>
      <AccentRange
        min={min}
        max={max}
        step={step}
        value={mm}
        onChange={(value) => onChange(mmToUnits(value))}
      />
      <MmInput
        min={min}
        max={max}
        step={0.01}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </SliderRow>
  );
};
const formatMm = (units: number) => `${unitsToMm(units).toFixed(2)} mm`;

const HelpText = styled.div`
  font-size: 14px;
  color: var(--color_label);
  margin-top: 4px;
  max-width: 420px;
`;

const StoredValue: FC<{
  name: string;
  help: string;
  value: string;
  raw: number;
}> = ({name, help, value, raw}) => (
  <ControlRow>
    <Label>
      {name}
      <HelpText>{help}</HelpText>
    </Label>
    <Detail>
      {value} (raw {raw})
    </Detail>
  </ControlRow>
);

// Shows each stored field in mm next to the raw byte the firmware keeps.
const StoredValues: FC<{actuation: Actuation}> = ({actuation}) => {
  const rtOn = actuation.rtMode !== RapidTriggerMode.Off;
  return (
    <>
      <ControlRow>
        <Label>
          Stored on the keyboard
          <HelpText>
            The firmware stores travel as 0 to 255 over 3.5 mm. 1 raw unit is
            about 0.014 mm.
          </HelpText>
        </Label>
      </ControlRow>
      <StoredValue
        name="Actuation point"
        help="The key presses when it goes deeper than this point."
        value={formatMm(actuation.actuationPoint)}
        raw={actuation.actuationPoint}
      />
      <StoredValue
        name="Release point"
        help="The key releases when it comes back above this point. Raw 255 means about 0.1 mm above the actuation point."
        value={
          actuation.resetPoint === RESET_AT_ACTUATION
            ? 'Automatic'
            : formatMm(actuation.resetPoint)
        }
        raw={actuation.resetPoint}
      />
      <StoredValue
        name="Rapid Trigger mode"
        help="Raw 0 is off, 1 is Rapid Trigger, 2 is Continuous."
        value={RT_OPTIONS[actuation.rtMode]?.label ?? 'Unknown'}
        raw={actuation.rtMode}
      />
      {rtOn && (
        <>
          <StoredValue
            name="Press sensitivity"
            help="After a release, the key presses again when it moves down by this distance."
            value={formatMm(actuation.rtPress)}
            raw={actuation.rtPress}
          />
          <StoredValue
            name="Release sensitivity"
            help="After a press, the key releases when it moves up by this distance. Raw 0 means the same as press sensitivity."
            value={
              actuation.rtRelease === 0
                ? 'Same as press'
                : formatMm(actuation.rtRelease)
            }
            raw={actuation.rtRelease}
          />
        </>
      )}
    </>
  );
};

export const Pane: FC = () => {
  const api = useAppSelector(getSelectedKeyboardAPI);
  const keys = useAppSelector(getSelectedKeyDefinitions);
  const selectedKey = useAppSelector(getSelectedKey);
  const extraSelectedKeys = useAppSelector(getExtraSelectedKeys);
  const dispatch = useAppDispatch();
  const [profile, setProfile] = useState(0);
  const [actuation, setLocalActuation] = useState<Actuation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const key = selectedKey !== null ? keys[selectedKey] : null;
  const selection =
    selectedKey !== null ? [selectedKey, ...extraSelectedKeys] : [];

  useEffect(
    () => () => {
      dispatch(updateSelectedKey(null));
    },
    [],
  );

  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;

  // Keep the current key first so its values stay in the editor.
  const selectAll = () => {
    const all = keys.flatMap((k, i) => (k.d || k.ei !== undefined ? [] : [i]));
    dispatch(
      setSelectedKeys(
        selectedKey === null
          ? all
          : [selectedKey, ...all.filter((i) => i !== selectedKey)],
      ),
    );
  };

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'a' &&
        !target?.closest('input, textarea, [contenteditable="true"]')
      ) {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keys, selectedKey]);

  useEffect(() => {
    setLocalActuation(null);
    setError(null);
    if (!api || !key) {
      return;
    }
    getActuation(api, profile, key.row, key.col)
      .then(setLocalActuation)
      .catch((e) => setError(String(e)));
  }, [api, key?.row, key?.col, profile]);

  const save = async () => {
    if (!api || !key || !actuation) {
      return;
    }
    const primary = selectedKey;
    const targets = [...selection];
    let saved = 0;
    setSaving(true);
    try {
      // Write only the fields this pane edits. Each key keeps its own release values.
      for (const idx of targets) {
        const {row, col} = keys[idx];
        const current = await getActuation(api, profile, row, col);
        await setActuation(api, profile, row, col, {
          ...current,
          actuationPoint: actuation.actuationPoint,
          rtMode: actuation.rtMode,
          rtPress: actuation.rtPress,
        });
        saved++;
      }
      setError(null);
    } catch (e) {
      setError(`Saved ${saved} of ${targets.length} keys. ${String(e)}`);
    } finally {
      setSaving(false);
    }
    if (selectedKeyRef.current === primary) {
      setLocalActuation(await getActuation(api, profile, key.row, key.col));
    }
  };

  const update = (change: Partial<Actuation>) =>
    actuation && setLocalActuation({...actuation, ...change});

  const setRtMode = (rtMode: RapidTriggerMode) =>
    update({
      rtMode,
      rtPress:
        rtMode !== RapidTriggerMode.Off && actuation?.rtPress === 0
          ? mmToUnits(DEFAULT_RT_MM)
          : actuation?.rtPress,
    });

  return (
    <SpanOverflowCell>
      <HallEffectPane>
        <Container>
          <ControlRow>
            <Label>Profile</Label>
            <Detail>
              <AccentSelect
                value={PROFILE_OPTIONS[profile]}
                options={PROFILE_OPTIONS}
                onChange={(option: any) => setProfile(option.value)}
              />
            </Detail>
          </ControlRow>
          <ControlRow>
            <Label>
              {!key &&
                'Click a key. Ctrl+click selects more keys. Ctrl+A selects all.'}
              {key && selection.length === 1 && `Key ${key.row}, ${key.col}`}
              {key &&
                selection.length > 1 &&
                `${selection.length} keys (showing ${key.row}, ${key.col})`}
            </Label>
            <Detail>
              <AccentButton onClick={selectAll}>Select all</AccentButton>
              <AccentButton onClick={() => dispatch(updateSelectedKey(null))}>
                Clear
              </AccentButton>
            </Detail>
          </ControlRow>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {key && actuation && (
            <>
              <ControlRow>
                <Label>
                  Actuation (mm)
                  <HelpText>Depth at which the key presses.</HelpText>
                </Label>
                <Detail>
                  <MmSlider
                    {...ACTUATION_MM}
                    units={actuation.actuationPoint}
                    onChange={(units) => update({actuationPoint: units})}
                  />
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>Rapid Trigger</Label>
                <Detail>
                  <AccentSelect
                    value={RT_OPTIONS[actuation.rtMode]}
                    options={RT_OPTIONS}
                    onChange={(option: any) => setRtMode(option.value)}
                  />
                </Detail>
              </ControlRow>
              {actuation.rtMode !== RapidTriggerMode.Off && (
                <ControlRow>
                  <Label>
                    Sensitivity (mm)
                    <HelpText>
                      How far the key must move in the other direction to press
                      or release again.
                    </HelpText>
                  </Label>
                  <Detail>
                    <MmSlider
                      {...RT_MM}
                      units={actuation.rtPress}
                      onChange={(units) => update({rtPress: units})}
                    />
                  </Detail>
                </ControlRow>
              )}
              <StoredValues actuation={actuation} />
              <ControlRow>
                <Label />
                <Detail>
                  <AccentButton disabled={saving} onClick={save}>
                    {saving
                      ? 'Saving...'
                      : `Save to ${selection.length} key${
                          selection.length > 1 ? 's' : ''
                        }`}
                  </AccentButton>
                </Detail>
              </ControlRow>
            </>
          )}
        </Container>
      </HallEffectPane>
    </SpanOverflowCell>
  );
};

export const Icon = () => <FontAwesomeIcon icon={faMagnet} />;
export const Title = 'Hall Effect';
