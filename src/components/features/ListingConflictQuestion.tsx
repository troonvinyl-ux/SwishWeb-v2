import { useEffect, useState } from 'react';
import type { ListingConflict, ListingConflictAnswer } from '@/types/listingConflict';

interface ListingConflictQuestionProps {
  conflict: ListingConflict;
  disabled: boolean;
  onResolve: (conflict: ListingConflict, answer: ListingConflictAnswer) => Promise<void>;
}

/** The seller chooses a factual correction. Nothing is inferred, saved or published on mount. */
export default function ListingConflictQuestion({ conflict, disabled, onResolve }: ListingConflictQuestionProps) {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // Never carry an answer across different questions or newly observed evidence.
    setValue('');
    setNotes('');
    setError('');
  }, [conflict.id, conflict.detail]);

  const needsNotes = (conflict.field === 'play_tested' && value === 'yes') ||
    (conflict.field === 'tracklisting' && value === 'manual');
  const canResolve = value.trim().length > 0 &&
    (!conflict.options.length || conflict.options.some(option => option.value === value)) &&
    (!needsNotes || notes.trim().length >= 5);
  const resolve = async () => {
    if (disabled || saving || !canResolve) return;
    setSaving(true);
    setError('');
    try {
      await onResolve(conflict, { value: value.trim(), notes: notes.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your correction was not saved. Review and retry.');
    } finally {
      setSaving(false);
    }
  };

  return <fieldset disabled={disabled || saving} className="space-y-3 rounded-xl border border-border p-4">
    <legend className="px-1 font-semibold">{conflict.question}</legend>
    <p className="text-sm text-muted-foreground">{conflict.detail}</p>
    {conflict.options.length ? (
      <div className="space-y-2">
        {conflict.options.map(option => (
          <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3">
            <input type="radio" name={`conflict-${conflict.id}`} checked={value === option.value}
              onChange={() => setValue(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    ) : (
      <label className="block space-y-2">
        <span className="text-sm font-medium">Your corrected information</span>
        <textarea className="input-field min-h-24 w-full" value={value}
          onChange={event => setValue(event.target.value)}
          placeholder="Enter only facts you have personally checked" />
      </label>
    )}
    {needsNotes && <label className="block space-y-2">
      <span className="text-sm font-medium">{conflict.field === 'play_tested' ? 'Actual playback findings' : 'Complete corrected tracklisting'}</span>
      <textarea className="input-field min-h-24 w-full" value={notes}
        onChange={event => setNotes(event.target.value)}
        placeholder="Record your observations; do not infer untested facts" />
    </label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <button type="button" className="btn-secondary min-h-11" onClick={() => void resolve()}
      disabled={disabled || saving || !canResolve}>
      {saving ? 'Saving correction…' : 'Use this answer & recheck'}
    </button>
  </fieldset>;
}
