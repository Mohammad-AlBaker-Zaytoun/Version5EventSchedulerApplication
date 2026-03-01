'use client';

import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authFetch } from '@/lib/auth/client';
import { cn } from '@/lib/utils';
import type { SchedulingAssistantInsight } from '@/lib/types';

export type EventFormValues = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  aiSummary?: string;
  aiAgendaBullets?: string[];
};

type FieldErrors = Partial<Record<keyof EventFormValues, string>>;

const emptyValues: EventFormValues = {
  title: '',
  description: '',
  location: '',
  startsAt: '',
  endsAt: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

function validateEventForm(values: EventFormValues): FieldErrors {
  const nextErrors: FieldErrors = {};

  if (values.title.trim().length < 3) {
    nextErrors.title = 'Use at least 3 characters so the title is clear.';
  }

  if (values.location.trim().length < 2) {
    nextErrors.location = 'Add a location or meeting space for attendees.';
  }

  if (!values.startsAt) {
    nextErrors.startsAt = 'Choose when this event starts.';
  }

  if (!values.endsAt) {
    nextErrors.endsAt = 'Choose when this event ends.';
  }

  if (values.startsAt && values.endsAt) {
    const startsAt = new Date(values.startsAt).getTime();
    const endsAt = new Date(values.endsAt).getTime();

    if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt) && endsAt <= startsAt) {
      nextErrors.endsAt = 'End time should be later than the start time.';
    }
  }

  if (values.timezone.trim().length < 2) {
    nextErrors.timezone = 'Use a valid timezone like UTC or Europe/Lisbon.';
  }

  if (values.description.trim().length < 10) {
    nextErrors.description = 'Add at least 10 characters so attendees know what to expect.';
  }

  return nextErrors;
}

export function EventForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  inviteeEmails = [],
}: {
  initialValues?: Partial<EventFormValues>;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<void>;
  onCancel?: () => void;
  inviteeEmails?: string[];
}) {
  const [values, setValues] = useState<EventFormValues>({
    ...emptyValues,
    ...initialValues,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<SchedulingAssistantInsight | null>(null);

  const canAnalyze = useMemo(
    () =>
      Boolean(
        values.title &&
          values.location &&
          values.startsAt &&
          values.endsAt &&
          values.description.trim().length >= 10,
      ),
    [values],
  );

  function updateField(field: keyof EventFormValues, nextValue: string) {
    setValues((current) => {
      const nextValues = {
        ...current,
        [field]: nextValue,
      };

      if (fieldErrors[field] || field === 'startsAt' || field === 'endsAt') {
        const nextErrors = validateEventForm(nextValues);
        setFieldErrors((currentErrors) => ({
          ...currentErrors,
          [field]: nextErrors[field],
          ...(field === 'startsAt' || field === 'endsAt'
            ? {
                startsAt: nextErrors.startsAt,
                endsAt: nextErrors.endsAt,
              }
            : {}),
        }));
      }

      return nextValues;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextErrors = validateEventForm(values);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError('Review the highlighted fields before saving this event.');
      return;
    }

    setLoading(true);

    try {
      await onSubmit(values);
      if (!initialValues) {
        setValues(emptyValues);
        setAiInsight(null);
        setFieldErrors({});
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save this event.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!canAnalyze || aiLoading) {
      return;
    }

    setAiLoading(true);
    setError(null);

    try {
      const response = await authFetch('/api/ai/scheduling-assistant', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          startsAt: new Date(values.startsAt).toISOString(),
          endsAt: new Date(values.endsAt).toISOString(),
          inviteeEmails,
        }),
      });

      const payload = (await response.json()) as {
        insight?: SchedulingAssistantInsight;
        error?: string;
      };

      if (!response.ok || !payload.insight) {
        throw new Error(payload.error ?? 'Unable to analyze this schedule right now.');
      }

      setAiInsight(payload.insight);
      setValues((current) => ({
        ...current,
        aiSummary: payload.insight?.suggestedSummary ?? current.aiSummary,
        aiAgendaBullets: payload.insight?.agendaBullets ?? current.aiAgendaBullets,
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to analyze this schedule.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Event title</Label>
          <Input
            id="title"
            value={values.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="Quarterly planning workshop"
            aria-invalid={Boolean(fieldErrors.title)}
            className={cn(fieldErrors.title ? 'border-red-400 focus-visible:ring-red-500' : '')}
            required
          />
          {fieldErrors.title ? (
            <p className="text-xs font-medium text-red-600">{fieldErrors.title}</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={values.location}
            onChange={(event) => updateField('location', event.target.value)}
            placeholder="Design studio, Lisbon"
            aria-invalid={Boolean(fieldErrors.location)}
            className={cn(fieldErrors.location ? 'border-red-400 focus-visible:ring-red-500' : '')}
            required
          />
          {fieldErrors.location ? (
            <p className="text-xs font-medium text-red-600">{fieldErrors.location}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts at</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => updateField('startsAt', event.target.value)}
            aria-invalid={Boolean(fieldErrors.startsAt)}
            className={cn(fieldErrors.startsAt ? 'border-red-400 focus-visible:ring-red-500' : '')}
            required
          />
          {fieldErrors.startsAt ? (
            <p className="text-xs font-medium text-red-600">{fieldErrors.startsAt}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endsAt">Ends at</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            value={values.endsAt}
            onChange={(event) => updateField('endsAt', event.target.value)}
            aria-invalid={Boolean(fieldErrors.endsAt)}
            className={cn(fieldErrors.endsAt ? 'border-red-400 focus-visible:ring-red-500' : '')}
            required
          />
          {fieldErrors.endsAt ? (
            <p className="text-xs font-medium text-red-600">{fieldErrors.endsAt}</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={values.timezone}
            onChange={(event) => updateField('timezone', event.target.value)}
            placeholder="Europe/Lisbon"
            aria-invalid={Boolean(fieldErrors.timezone)}
            className={cn(fieldErrors.timezone ? 'border-red-400 focus-visible:ring-red-500' : '')}
            required
          />
          {fieldErrors.timezone ? (
            <p className="text-xs font-medium text-red-600">{fieldErrors.timezone}</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="description">Description</Label>
            <span className="text-xs text-[var(--text-muted)]">
              {values.description.trim().length}/10 minimum
            </span>
          </div>
          <Textarea
            id="description"
            rows={5}
            value={values.description}
            onChange={(event) => updateField('description', event.target.value)}
            placeholder="What is this event about, who is it for, and what should attendees expect?"
            aria-invalid={Boolean(fieldErrors.description)}
            className={cn(fieldErrors.description ? 'border-red-400 focus-visible:ring-red-500' : '')}
            required
          />
          {fieldErrors.description ? (
            <p className="text-xs font-medium text-red-600">{fieldErrors.description}</p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              A useful summary helps invitees decide faster.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">AI scheduling assistant</p>
            <p className="text-xs text-[var(--text-muted)]">
              Analyze likely conflicts and draft a sharper event summary before you save.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleAnalyze()}
            disabled={!canAnalyze}
            loading={aiLoading}
            loadingText="Analyzing..."
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze schedule
          </Button>
        </div>

        {aiInsight ? (
          <div className="space-y-3 rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">AI insight</p>
              <span className="rounded-full bg-[var(--surface-strong)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {aiInsight.conflictLevel} conflict risk
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{aiInsight.summary}</p>
            {aiInsight.suggestedTimeWindows.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Suggested time window
                </p>
                {aiInsight.suggestedTimeWindows.slice(0, 2).map((window) => (
                  <div
                    key={`${window.startsAt}-${window.endsAt}`}
                    className="rounded-xl border border-[var(--border-subtle)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {new Date(window.startsAt).toLocaleString()} to{' '}
                      {new Date(window.endsAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{window.reason}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={loading} loadingText="Saving event...">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
