import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';

const RECHECK_MS = 15 * 60 * 1000;
let recheckTimer = null; // module-level so closing the dialog doesn't cancel it

/** Nudge the user to re-test in 15 minutes (works while Sweety is open; also a system notification if allowed). */
export function startRecheckTimer(ms = RECHECK_MS) {
  clearTimeout(recheckTimer);
  recheckTimer = setTimeout(() => {
    toast.warning('Time to recheck your glucose', { description: 'It has been 15 minutes since your low reading.', duration: 20000 });
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Sweety: recheck your glucose', { body: 'It has been 15 minutes since your low reading.' });
    } catch { /* ignore */ }
  }, ms);
}

/**
 * Shown after saving a low reading. `alert` is the server's { level, title, message, steps }.
 * "critical" (under 54 mg/dl) is styled as urgent.
 */
export function LowGlucoseAlert({ alert, onClose }) {
  const [timerSet, setTimerSet] = useState(false);
  if (!alert) return null;
  const critical = alert.level === 'critical';
  const color = critical ? 'var(--destructive)' : 'var(--low)';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        role="alertdialog"
        title={alert.title}
        description={alert.message}
        className="border-t-4"
        style={{ borderTopColor: color }}
      >
        <p className="eyebrow mb-3" style={{ color }}>{critical ? 'Act now' : 'What to do'}</p>
        <ol className="space-y-3 text-sm">
          {alert.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-sm" style={{ borderColor: color, color }}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline" disabled={timerSet}
            onClick={() => { startRecheckTimer(); setTimerSet(true); toast.success('Recheck timer set for 15 minutes'); }}
          >
            <BellRing />{timerSet ? 'Timer running (15 min)' : 'Remind me to recheck'}
          </Button>
          <Button onClick={onClose}>OK, got it</Button>
        </div>
        {timerSet && <p className="mt-2 text-xs text-muted-foreground">We'll nudge you while Sweety is open.</p>}
      </DialogContent>
    </Dialog>
  );
}
