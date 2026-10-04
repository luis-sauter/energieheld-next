"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/types/portal";
import type { MediaState } from "@/lib/company-media";
import { VIDEO_ACCEPT } from "@/lib/profile-video";
import { uploadProfileVideo } from "@/lib/profile-video-upload";
import { ProfileHeaderMedia } from "@/components/portal/profile-header-media";

export function ProfileVideoEditor({ video, name, gallery, save, disabled = false, onBusyChange }: {
  video?: Listing["video"]; name: string; gallery: ReactNode;
  save: (form: FormData) => Promise<MediaState>; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter(), input = useRef<HTMLInputElement>(null), lock = useRef(false);
  const [busy, setBusy] = useState(""), [feedback, setFeedback] = useState<MediaState>({});
  async function mutate(file?: File) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(file ? "Upload wird vorbereitet …" : "Video wird entfernt …"); setFeedback({}); onBusyChange?.(true);
    try {
      const form = new FormData(); form.set("intent", "video-remove");
      const result = file ? await uploadProfileVideo(save, file, setBusy) : await save(form);
      setFeedback(result);
      if (result.success) router.refresh();
    } catch { setFeedback({ error: "Das Video konnte nicht geändert werden. Bitte versuchen Sie es erneut." }); }
    finally { lock.current = false; setBusy(""); onBusyChange?.(false); if (input.current) input.current.value = ""; }
  }
  return <section className="profile-video-editor" aria-label="Profilmedien bearbeiten">
    <ProfileHeaderMedia key={video?.src ?? "gallery"} video={video} name={name} gallery={gallery} />
    <div className="profile-video-actions">
      <button type="button" className="button" disabled={Boolean(busy) || disabled} onClick={() => input.current?.click()}>{video ? "Video ersetzen" : "Video hinzufügen"}</button>
      {video && <button type="button" className="button" disabled={Boolean(busy) || disabled} onClick={() => {
        if (window.confirm("Das Profilvideo entfernen und wieder die Galerie anzeigen?")) void mutate();
      }}>Video entfernen</button>}
      <input ref={input} type="file" accept={VIDEO_ACCEPT} aria-label="Profilvideo auswählen" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void mutate(file); }} />
      <small>MP4 oder WebM · maximal 25 MB · ersetzt die Galerie im Profilkopf</small>
    </div>
    {busy && <p role="status">{busy}</p>}
    {feedback.error && <p role="alert">{feedback.error}</p>}
    {feedback.success && <p role="status">{feedback.success}</p>}
  </section>;
}
