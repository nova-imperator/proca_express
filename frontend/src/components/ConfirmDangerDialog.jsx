import { useEffect, useRef, useState } from 'react';

/**
 * Modal that forces the user to type a specific word (default "delete")
 * before the destructive action button is enabled. Stops fat-finger
 * mistakes much more effectively than a one-click `confirm()` browser
 * dialog.
 *
 * Props:
 *   open         (bool)   — controls visibility
 *   title        (string) — heading
 *   description  (node)   — body text (can include <strong> with the resource name)
 *   confirmWord  (string) — what the user must type (default "delete", case-insensitive)
 *   actionLabel  (string) — text on the destructive button (default "Delete")
 *   pending      (bool)   — disables the button while the action runs
 *   onConfirm()           — fired when user clicks the destructive button
 *   onClose()             — fired on cancel / backdrop click
 */
export default function ConfirmDangerDialog({
  open,
  title = 'Confirm action',
  description,
  confirmWord = 'delete',
  actionLabel = 'Delete',
  pending = false,
  onConfirm,
  onClose,
}) {
  const dlgRef = useRef(null);
  const [typed, setTyped] = useState('');

  // Open/close the native <dialog> when the `open` prop flips.
  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      setTyped('');
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  if (!open) return null;

  const matches = typed.trim().toLowerCase() === confirmWord.toLowerCase();

  const onSubmit = (e) => {
    e.preventDefault();
    if (!matches || pending) return;
    onConfirm?.();
  };

  return (
    <dialog ref={dlgRef} onClose={onClose}>
      <form onSubmit={onSubmit} className="card" style={{ gap: '0.85rem', minWidth: 380 }}>
        <h3 style={{ margin: 0, color: 'var(--danger)' }}>{title}</h3>
        <div className="muted" style={{ margin: 0, fontSize: '0.92rem', color: 'var(--fg-soft)' }}>
          {description}
        </div>
        <label>
          Type <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 600 }}>{confirmWord}</code> to confirm
          <input
            type="text"
            autoFocus
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmWord}
            style={matches ? { borderColor: 'var(--danger)' } : undefined}
          />
        </label>
        <menu>
          <button type="button" className="btn" onClick={() => onClose?.()}>Cancel</button>
          <button
            type="submit"
            className="btn"
            disabled={!matches || pending}
            style={{
              background: matches ? 'var(--danger)' : undefined,
              borderColor: matches ? 'var(--danger)' : undefined,
              color: matches ? '#fff' : undefined,
            }}
          >
            {pending ? <><span className="spin" /> Working…</> : actionLabel}
          </button>
        </menu>
      </form>
    </dialog>
  );
}
