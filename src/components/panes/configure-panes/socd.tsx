import {FC, useEffect, useState} from 'react';
import styled from 'styled-components';
import {faArrowsLeftRight} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {CenterPane} from '../pane';
import {ControlRow, Detail, Label, SpanOverflowCell} from '../grid';
import {AccentSelect} from '../../inputs/accent-select';
import {AccentButton} from '../../inputs/accent-button';
import {ErrorMessage} from '../../styled';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getSelectedKeyboardAPI} from 'src/store/devicesSlice';
import {
  getSelectedDefinition,
  getSelectedKeyDefinitions,
} from 'src/store/definitionsSlice';
import {
  getExtraSelectedKeys,
  getSelectedKey,
  updateSelectedKey,
} from 'src/store/keymapSlice';
import {
  InputPriorityPair,
  NUM_INPUT_PRIORITY_PAIRS,
  PAIR_DISABLED,
  PairProfile,
  PairResolution,
  getInputPriorityPair,
  setInputPriorityPair,
} from 'src/utils/hall-effect';

const SocdPane = styled(CenterPane)`
  height: 100%;
  background: var(--color_dark_grey);
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

const HelpText = styled.div`
  font-size: 14px;
  color: var(--color_label);
  margin-top: 4px;
  max-width: 420px;
`;

const Buttons = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const PROFILE_OPTIONS = [
  {label: 'Default profile', value: PairProfile.Default},
  {label: 'Custom profile', value: PairProfile.Custom},
  {label: 'Both profiles', value: PairProfile.All},
];

const RESOLUTION_OPTIONS = [
  {label: 'Last input wins', value: PairResolution.Last},
  {label: 'First key wins', value: PairResolution.Primary},
  {label: 'Second key wins', value: PairResolution.Secondary},
  {label: 'Neutral (both off)', value: PairResolution.Neutral},
  {label: 'Deeper press wins', value: PairResolution.Depth},
];

// Pairs saved by older firmware can hold values that the current firmware ignores.
const isValidPair = (pair: InputPriorityPair) =>
  pair.profile <= PairProfile.All && pair.resolution <= PairResolution.Depth;

const profilesOverlap = (a: number, b: number) =>
  a === b || a === PairProfile.All || b === PairProfile.All;

const pairKeys = (pair: InputPriorityPair) => [
  `${pair.primaryRow},${pair.primaryCol}`,
  `${pair.secondaryRow},${pair.secondaryCol}`,
];

const DISABLED_PAIR: InputPriorityPair = {
  profile: PAIR_DISABLED,
  primaryRow: PAIR_DISABLED,
  primaryCol: PAIR_DISABLED,
  secondaryRow: PAIR_DISABLED,
  secondaryCol: PAIR_DISABLED,
  resolution: PAIR_DISABLED as PairResolution,
};

export const Pane: FC = () => {
  const api = useAppSelector(getSelectedKeyboardAPI);
  const definition = useAppSelector(getSelectedDefinition);
  const keys = useAppSelector(getSelectedKeyDefinitions);
  const selectedKey = useAppSelector(getSelectedKey);
  const extraSelectedKeys = useAppSelector(getExtraSelectedKeys);
  const dispatch = useAppDispatch();
  const [pairs, setPairs] = useState<InputPriorityPair[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selection =
    selectedKey !== null ? [selectedKey, ...extraSelectedKeys] : [];
  const rowsPerHand = (definition?.matrix.rows ?? 0) / 2;

  useEffect(
    () => () => {
      dispatch(updateSelectedKey(null));
    },
    [],
  );

  const loadPairs = async () => {
    if (!api) {
      return;
    }
    const loaded = [];
    for (let index = 0; index < NUM_INPUT_PRIORITY_PAIRS; index++) {
      loaded.push(await getInputPriorityPair(api, index));
    }
    setPairs(loaded);
  };

  useEffect(() => {
    loadPairs().catch((e) => setError(String(e)));
  }, [api]);

  // The firmware gives a shared key to only one pair, so reject overlaps here.
  const findConflict = (index: number, pair: InputPriorityPair) => {
    const keysOfPair = pairKeys(pair);
    const other = pairs?.findIndex(
      (existing, i) =>
        i !== index &&
        isValidPair(existing) &&
        profilesOverlap(existing.profile, pair.profile) &&
        pairKeys(existing).some((key) => keysOfPair.includes(key)),
    );
    return other !== undefined && other >= 0
      ? `Pair ${other + 1} already uses one of these keys in the same profile.`
      : null;
  };

  const writePair = async (index: number, pair: InputPriorityPair) => {
    if (!api) {
      return;
    }
    const conflict =
      pair.profile !== PAIR_DISABLED ? findConflict(index, pair) : null;
    if (conflict) {
      setError(conflict);
      return;
    }
    try {
      await setInputPriorityPair(api, index, pair);
      setError(null);
    } catch (e) {
      setError(`Pair ${index + 1} was not saved. ${String(e)}`);
    }
    try {
      await loadPairs();
    } catch (e) {
      setError(`Could not read pairs from the keyboard. ${String(e)}`);
    }
  };

  // The selected key is the first key of the pair and the Ctrl+clicked key is the second.
  const pairFromSelection = (
    current: InputPriorityPair,
  ): InputPriorityPair | string => {
    if (selection.length !== 2) {
      return 'Select exactly two keys: click one, then Ctrl+click the other.';
    }
    const [first, second] = selection.map((idx) => keys[idx]);
    if (
      Math.floor(first.row / rowsPerHand) !==
      Math.floor(second.row / rowsPerHand)
    ) {
      return 'Both keys must be on the same half of the keyboard.';
    }
    const isEnabled = isValidPair(current);
    return {
      profile: isEnabled ? current.profile : PairProfile.All,
      primaryRow: first.row,
      primaryCol: first.col,
      secondaryRow: second.row,
      secondaryCol: second.col,
      resolution: isEnabled ? current.resolution : PairResolution.Last,
    };
  };

  const assignSelection = (index: number, current: InputPriorityPair) => {
    const pair = pairFromSelection(current);
    if (typeof pair === 'string') {
      setError(pair);
      return;
    }
    writePair(index, pair);
  };

  return (
    <SpanOverflowCell>
      <SocdPane>
        <Container>
          <ControlRow>
            <Label>
              SOCD (input priority)
              <HelpText>
                Decides what happens when both keys of a pair are held, for
                example A and D. Each pair applies in the Default profile, the
                Custom profile, or both. Click a key, Ctrl+click a second key on
                the same half, then click Use selected keys.
              </HelpText>
            </Label>
          </ControlRow>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {pairs?.map((pair, index) => {
            const isEnabled = isValidPair(pair);
            const isStored = pair.profile !== PAIR_DISABLED;
            return (
              <ControlRow key={index}>
                <Label>
                  Pair {index + 1}
                  <HelpText>
                    {isEnabled
                      ? `Keys ${pair.primaryRow},${pair.primaryCol} and ${pair.secondaryRow},${pair.secondaryCol}`
                      : isStored
                        ? 'Inactive: saved by older firmware. Use selected keys or Remove.'
                        : 'Not used'}
                  </HelpText>
                </Label>
                <Detail>
                  <Buttons>
                    {isEnabled && (
                      <>
                        <AccentSelect
                          value={PROFILE_OPTIONS[pair.profile]}
                          options={PROFILE_OPTIONS}
                          onChange={(option: any) =>
                            writePair(index, {...pair, profile: option.value})
                          }
                        />
                        <AccentSelect
                          value={RESOLUTION_OPTIONS[pair.resolution]}
                          options={RESOLUTION_OPTIONS}
                          onChange={(option: any) =>
                            writePair(index, {
                              ...pair,
                              resolution: option.value,
                            })
                          }
                        />
                      </>
                    )}
                    <AccentButton onClick={() => assignSelection(index, pair)}>
                      Use selected keys
                    </AccentButton>
                    {isStored && (
                      <AccentButton
                        onClick={() => writePair(index, DISABLED_PAIR)}
                      >
                        Remove
                      </AccentButton>
                    )}
                  </Buttons>
                </Detail>
              </ControlRow>
            );
          })}
        </Container>
      </SocdPane>
    </SpanOverflowCell>
  );
};

export const Icon = () => <FontAwesomeIcon icon={faArrowsLeftRight} />;
export const Title = 'SOCD';
