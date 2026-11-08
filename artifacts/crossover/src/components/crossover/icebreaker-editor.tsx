import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Check, RefreshCw, Save } from 'lucide-react';
import {
  useEditCrossoverIcebreaker, useRewriteCrossoverIcebreaker, getGetCrossoverConnectionsQueryKey,
  getGetCrossoverStateQueryKey, getGetCrossoverHistoryQueryKey, type Connection, type ConnectionList, type VisitorState,
} from '@workspace/api-client-react';
import { apiErrorText } from '@/lib/api-errors';

const MAX = 299;

export function IcebreakerEditor({ connection, remaining }: { connection: Connection; remaining: number | null }) {
  const qc = useQueryClient();
  const edit = useEditCrossoverIcebreaker();
  const rewrite = useRewriteCrossoverIcebreaker({ mutation: { retry: false } });
  const [draft, setDraft] = useState(connection.icebreaker);
  const saved = useRef(connection.icebreaker);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const busy = edit.isPending || rewrite.isPending;
  const dirty = draft !== saved.current;
  const trimmed = draft.trim();

  // Sync from server only when the user has no unsaved edits.
  useEffect(() => {
    if (draft === saved.current) { saved.current = connection.icebreaker; setDraft(connection.icebreaker); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.icebreaker]);

  const patch = (text: string) => qc.setQueryData<ConnectionList>(getGetCrossoverConnectionsQueryKey(), (old) =>
    old ? { ...old, connections: old.connections.map((c) => (c.id === connection.id ? { ...c, icebreaker: text } : c)) } : old);

  const save = async () => {
    if (!trimmed || draft.length > MAX) { setErr(`Write between 1 and ${MAX} characters.`); return false; }
    setErr(null); setNote(null);
    try {
      const c = await edit.mutateAsync({ id: connection.id, data: { icebreaker: draft } });
      saved.current = c.icebreaker; setDraft(c.icebreaker); patch(c.icebreaker);
      void qc.invalidateQueries({ queryKey: getGetCrossoverStateQueryKey() });
      setNote('Saved.');
      return true;
    } catch (e) { setErr(apiErrorText(e, 'We could not save your draft. Your text is still here.')); return false; }
  };

  const doRewrite = async () => {
    setErr(null); setNote(null); setCopied(false);
    if (dirty && !(await save())) return;
    try {
      const r = await rewrite.mutateAsync({ data: { profile_id: connection.profile.id, connection_id: connection.id } });
      saved.current = r.icebreaker; setDraft(r.icebreaker); patch(r.icebreaker);
      qc.setQueryData<ConnectionList>(getGetCrossoverConnectionsQueryKey(), (o) => (o ? { ...o, remaining_builds: r.remaining_builds } : o));
      qc.setQueryData<VisitorState>(getGetCrossoverStateQueryKey(), (o) => (o ? { ...o, remaining_builds: r.remaining_builds } : o));
      void qc.invalidateQueries({ queryKey: getGetCrossoverHistoryQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetCrossoverConnectionsQueryKey() });
      setNote('Fresh draft ready. Read it before you send.');
    } catch (e) {
      setErr(apiErrorText(e, 'Our AI matchmaker is taking a break. Your info is saved, so try again in a few minutes.'));
      void qc.invalidateQueries({ queryKey: getGetCrossoverStateQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetCrossoverConnectionsQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetCrossoverHistoryQueryKey() });
    }
  };

  const copy = async () => {
    setErr(null); setNote(null); setCopied(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      ta.current?.focus(); ta.current?.select();
      setNote('Copy was blocked. The text is selected, so press Ctrl+C (Cmd+C on Mac) or long-press to copy.');
    }
  };

  const idp = `ice-${connection.id}`;
  return (
    <div className="mt-3" data-testid={`editor-icebreaker-${connection.id}`}>
      <label htmlFor={idp} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your icebreaker draft</label>
      <textarea id={idp} ref={ta} value={draft} maxLength={MAX} readOnly={busy} aria-busy={busy}
        onChange={(e) => { setDraft(e.target.value); setNote(null); setCopied(false); }}
        rows={4} data-testid={`input-icebreaker-${connection.id}`}
        className="mt-1.5 w-full resize-none rounded-2xl border border-input bg-background/60 p-3 text-sm leading-relaxed outline-none transition-colors focus:border-[hsl(var(--ring))] read-only:opacity-70" />
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span data-testid={`status-draft-${connection.id}`}>{busy ? (rewrite.isPending ? 'Rewriting...' : 'Saving...') : dirty ? 'Unsaved changes' : 'Saved'}</span>
        <span className={draft.length >= MAX - 20 ? 'text-[hsl(45_95%_72%)]' : ''} data-testid={`text-count-${connection.id}`}>{draft.length}/{MAX}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={!dirty || busy || !trimmed} data-testid={`button-save-icebreaker-${connection.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-xs font-bold text-background transition-transform active:scale-95 disabled:opacity-40"><Save className="h-3.5 w-3.5" aria-hidden />Save</button>
        <button type="button" onClick={() => void copy()} disabled={busy || !trimmed} data-testid={`button-copy-icebreaker-${connection.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40">
          {copied ? <Check className="h-3.5 w-3.5 text-[hsl(160_85%_62%)]" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}{copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={() => void doRewrite()} disabled={busy || remaining === 0} data-testid={`button-rewrite-icebreaker-${connection.id}`}
          title={dirty ? 'Saves your edits first, then asks AI for a new draft' : 'Ask AI for a new draft'}
          className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(322_85%_62%/.5)] px-3.5 py-2 text-xs font-bold text-[hsl(322_90%_80%)] transition-transform active:scale-95 disabled:opacity-40">
          <RefreshCw className={`h-3.5 w-3.5 ${rewrite.isPending ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
          {dirty ? 'Save and rewrite' : 'Rewrite'}{remaining != null ? ` (${remaining} left)` : ''}
        </button>
      </div>
      <div aria-live="polite" className="sr-only">{copied ? 'Copied to clipboard' : ''}</div>
      {note && <p className="mt-2 text-xs text-muted-foreground" role="status" data-testid={`text-icebreaker-note-${connection.id}`}>{note}</p>}
      {err && <p role="alert" className="mt-2 rounded-2xl bg-[hsl(352_85%_62%/.14)] p-2.5 text-xs text-[hsl(352_90%_82%)]" data-testid={`text-icebreaker-error-${connection.id}`}>{err}</p>}
    </div>
  );
}
