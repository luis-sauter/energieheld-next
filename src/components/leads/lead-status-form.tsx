"use client";
import { useActionState } from "react";
import { changeLeadStatus } from "@/app/(energieheld)/firma/anfragen/actions";
import { leadStatuses } from "@/lib/company-leads";
import styles from "./leads.module.css";
export function LeadStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(changeLeadStatus, {});
  return (
    <form action={action} className={styles.statusForm}>
      <input type="hidden" name="lead_id" value={id} />
      <label htmlFor={`status-${id}`}>Status</label>
      <select
        id={`status-${id}`}
        name="status"
        defaultValue={status}
        disabled={pending}
      >
        {Object.entries(leadStatuses).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button className="button" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Speichern"}
      </button>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className={styles.success}>
          {state.success}
        </p>
      )}
    </form>
  );
}
