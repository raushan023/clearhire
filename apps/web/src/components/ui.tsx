import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ApiError, errorMessage } from "../lib/api-client";
import type { PaginationInfo } from "../lib/types";
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">CLEARHIRE / WORKSPACE</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
export const label = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{label(status)}</span>;
}
export function LoadingSpinner() {
  return <span className="loading-spinner" aria-hidden="true" />;
}
export function InlineLoader({ text = "Loading…" }: { text?: string }) {
  return (
    <span className="inline-loader" role="status">
      <LoadingSpinner />
      {text}
    </span>
  );
}
export function PendingButton({
  pending = false,
  pendingText = "Saving…",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingText?: string;
}) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <LoadingSpinner />}
      {pending ? pendingText : children}
    </button>
  );
}
export function LoadingState({
  message = "Loading your workspace…",
}: {
  message?: string;
}) {
  return (
    <div className="panel state loading-state" role="status" aria-live="polite">
      <span className="inline-loader">
        <LoadingSpinner />
        {message}
      </span>
      <div className="skeleton-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel state">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <p>{errorMessage(error)}</p>
      {error instanceof ApiError &&
        Object.entries(error.fields).map(([name, messages]) => (
          <p key={name}>
            <strong>{label(name)}:</strong> {messages.join(" ")}
          </p>
        ))}
      {retry && (
        <button className="secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Feedback({
  error,
  success,
}: {
  error?: unknown;
  success?: string;
}) {
  return (
    <>
      {error != null && <ErrorState error={error} />}
      {success && !error && (
        <p className="success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
export function Pagination({
  info,
  onPage,
  pending = false,
}: {
  info: PaginationInfo;
  pending?: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        {info.total} result{info.total === 1 ? "" : "s"} · Page {info.page} of{" "}
        {Math.max(1, info.totalPages)}
      </span>
      <div className="actions">
        <button
          className="secondary"
          disabled={pending || info.page <= 1}
          onClick={() => onPage(info.page - 1)}
        >
          Previous
        </button>
        <button
          className="secondary"
          disabled={pending || info.page >= info.totalPages}
          onClick={() => onPage(info.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
export function Field({
  label: text,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{
          "aria-labelledby"?: string;
          "aria-invalid"?: boolean;
          "aria-describedby"?: string;
        }>,
        {
          "aria-labelledby": `${id}-label`,
          "aria-invalid": !!error,
          "aria-describedby": error ? id : undefined,
        },
      )
    : children;
  return (
    <label className="field">
      <span id={`${id}-label`}>{text}</span>
      {control}
      {error && (
        <span id={id} className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  action = "Confirm",
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  action?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
      <div className="actions dialog-actions">
        <button className="secondary" disabled={pending} onClick={onCancel}>
          Go back
        </button>
        <PendingButton
          pending={pending}
          pendingText={pendingAction(action)}
          onClick={onConfirm}
        >
          {action}
        </PendingButton>
      </div>
    </dialog>
  );
}

function pendingAction(action: string) {
  const verbs: Record<string, string> = {
    Publish: "Publishing",
    Apply: "Applying",
    Save: "Saving",
    Update: "Updating",
    Delete: "Deleting",
    Upload: "Uploading",
    Accept: "Accepting",
    Decline: "Declining",
    Withdraw: "Withdrawing",
    Cancel: "Cancelling",
    Repost: "Reposting",
    Schedule: "Scheduling",
    Reschedule: "Rescheduling",
  };
  const [verb, ...rest] = action.split(" ");
  return verbs[verb] ? `${verbs[verb]} ${rest.join(" ")}…` : "Updating…";
}
