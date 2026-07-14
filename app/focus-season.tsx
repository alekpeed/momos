"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalmSound, CommandTask, FocusSeason } from "@/lib/inventory-types";

const durationChoices = [5, 10, 15, 25, 45, 60, 90];

function secondsFrom(value: FocusSeason, now = Date.now()) {
  if (!value.running || !value.endsAt) return Math.max(0, value.remainingSeconds);
  return Math.max(0, Math.ceil((new Date(value.endsAt).getTime() - now) / 1000));
}

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function playCalmSound(sound: CalmSound = "chime") {
  try {
    if (sound === "silent") return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
    gain.connect(context.destination);
    const frequencies = sound === "rain" ? [196, 247, 294] : sound === "waves" ? [174, 220, 261.63] : sound === "birds" ? [784, 987.77, 1174.66] : [523.25, 659.25];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.16);
      oscillator.stop(context.currentTime + 0.85);
    });
    window.setTimeout(() => context.close().catch(() => undefined), 1000);
  } catch {
    // A blocked audio context should never stop a completed focus session.
  }
}

type FocusSeasonProps = {
  value: FocusSeason;
  tasks: CommandTask[];
  calmSound: CalmSound;
  onChange: (value: FocusSeason) => void;
  onOpenTask: (task: CommandTask) => void;
  onOpenCalm: () => void;
};

export function FocusSeason({ value, tasks, calmSound, onChange, onOpenTask, onOpenCalm }: FocusSeasonProps) {
  const [now, setNow] = useState(() => Date.now());
  const completedEndRef = useRef<string>("");
  const remainingSeconds = secondsFrom(value, now);
  const activeTask = tasks.find((task) => task.id === value.taskId);
  const timerLabel = value.running ? "Focus season running" : remainingSeconds === 0 && value.completedAt ? "Focus season complete" : "Focus season ready";

  useEffect(() => {
    if (!value.running) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [value.running]);

  useEffect(() => {
    if (!value.running || remainingSeconds > 0 || !value.endsAt || completedEndRef.current === value.endsAt) return;
    completedEndRef.current = value.endsAt;
    onChange({ ...value, running: false, endsAt: undefined, remainingSeconds: 0, completedAt: new Date().toISOString() });
    playCalmSound(calmSound);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus Season complete", { body: activeTask ? activeTask.title : "Your timer is finished." });
    }
  }, [activeTask, calmSound, onChange, remainingSeconds, value]);

  const taskOptions = useMemo(
    () => tasks.filter((task) => !["Done", "Skipped", "Cancelled"].includes(task.status)),
    [tasks]
  );

  function setDuration(minutes: number) {
    if (value.running) return;
    const nextMinutes = Math.max(1, Math.min(180, Math.round(minutes || 1)));
    onChange({ ...value, durationMinutes: nextMinutes, remainingSeconds: nextMinutes * 60, completedAt: undefined, endsAt: undefined });
  }

  function startOrResume() {
    const seconds = remainingSeconds || value.durationMinutes * 60;
    onChange({ ...value, running: true, remainingSeconds: seconds, endsAt: new Date(Date.now() + seconds * 1000).toISOString(), completedAt: undefined });
  }

  function pause() {
    onChange({ ...value, running: false, remainingSeconds, endsAt: undefined });
  }

  function restart() {
    onChange({ ...value, running: false, remainingSeconds: value.durationMinutes * 60, endsAt: undefined, completedAt: undefined });
  }

  return (
    <section className="focus-season" aria-label="Focus Season timer">
      <div className="focus-season-head">
        <div>
          <span className="today-eyebrow">Focus Season</span>
          <h2>{timerLabel}</h2>
        </div>
        <output className="focus-clock" aria-live="polite">{clock(remainingSeconds)}</output>
      </div>

      <div className="focus-controls">
        <label className="focus-field">
          <span>Focus on</span>
          <select value={value.taskId ?? ""} disabled={value.running} onChange={(event) => onChange({ ...value, taskId: event.target.value || undefined })}>
            <option value="">Anything I choose</option>
            {taskOptions.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
          </select>
        </label>
        <label className="focus-field focus-minutes-field">
          <span>Minutes</span>
          <input type="number" min="1" max="180" inputMode="numeric" value={value.durationMinutes} disabled={value.running} onChange={(event) => setDuration(Number(event.target.value))} />
        </label>
      </div>

      <div className="focus-presets" aria-label="Choose timer length">
        {durationChoices.map((minutes) => (
          <button className={value.durationMinutes === minutes ? "active" : ""} type="button" disabled={value.running} key={minutes} onClick={() => setDuration(minutes)}>
            {minutes} min
          </button>
        ))}
      </div>

      <div className="focus-actions">
        {value.running ? <button className="button" type="button" onClick={pause}>Pause</button> : <button className="button" type="button" onClick={startOrResume}>{remainingSeconds && remainingSeconds < value.durationMinutes * 60 ? "Resume" : "Start"}</button>}
        <button className="ghost-button" type="button" onClick={restart}>Restart</button>
        <button className="text-button" type="button" onClick={onOpenCalm}>Calm screen</button>
        {activeTask ? <button className="text-button" type="button" onClick={() => onOpenTask(activeTask)}>Open task</button> : null}
      </div>
      <p className="focus-note">Timer can be set from 1 to 180 minutes. The selected calm sound plays when it ends. Device alerts work while Mom Home is open and alerts are enabled.</p>
    </section>
  );
}
