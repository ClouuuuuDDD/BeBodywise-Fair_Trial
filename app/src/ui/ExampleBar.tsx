import { useNavigate } from 'react-router-dom';
import { ExampleBanner, type JumpTarget } from './ExampleBanner';
import { enterExample, leaveExample, routeOf, type AnyStop } from '../state/example';

/** "Jump to day" targets, in the order of the example page (copy s22). */
const JUMPS: (JumpTarget & { key: AnyStop })[] = [
  { key: 'check', label: '14 Oct', hint: 'Fit and shelf check' },
  { key: 'day-0', label: 'Day 0', hint: 'Routine and first photo' },
  { key: 'day-9', label: 'Day 9', hint: 'It stings' },
  { key: 'day-23', label: 'Day 23', hint: 'The quiet middle' },
  { key: 'day-40', label: 'Day 40', hint: 'Running low' },
  { key: 'day-56-working', label: 'Day 56', hint: 'Verdict: working' },
  { key: 'day-56-not-for-you', label: 'Day 56, the other ending', hint: 'Verdict: not for you' },
  { key: 'not-for-you-calm', label: 'Not for you, calm trial', hint: 'With the step-up line' },
  { key: 'not-yet', label: 'Not yet', hint: 'More endings' },
  { key: 'cant-call', label: "Can't call it", hint: 'More endings' },
  { key: 'see-doctor', label: 'See a doctor', hint: 'More endings' },
  { key: 'keep-going', label: 'After the verdict', hint: 'Keep going' },
  { key: 'insights', label: 'For Be Bodywise', hint: 'What the shelf tells us' },
];

/** The "Example" tag, "Jump to day" and "Leave the example", shown on every screen in example mode. */
export function ExampleBar() {
  const navigate = useNavigate();
  return (
    <ExampleBanner
      jumps={JUMPS}
      leaveTo="/"
      onLeave={leaveExample}
      onJump={(key) => {
        const stop = key as AnyStop;
        enterExample(stop);
        void navigate(routeOf(stop));
      }}
    />
  );
}
