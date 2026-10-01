import { useEffect, useId, useRef, useState } from "react";
import {
  convertPhoto,
  loadVideo,
  MEDIA_ACCEPT,
  trimVideo,
  validateMedia,
  type PreparedMedia,
} from "@/lib/media";

export function MediaPicker({
  value,
  onChange,
  disabled,
  onBusyChange,
}: {
  value: PreparedMedia | null;
  onChange: (value: PreparedMedia | null) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const inputId = useId();
  const previewVideo = useRef<HTMLVideoElement>(null);
  const file = source ?? value?.file;
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    onBusyChange(busy || Boolean(source && !value));
  }, [busy, source, value, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  function processing(next: boolean) {
    setBusy(next);
  }
  async function select(file: File) {
    processing(true);
    setError(null);
    setSource(null);
    onChange(null);
    try {
      validateMedia(file);
      if (file.type.startsWith("image/"))
        onChange({ file: await convertPhoto(file), duration: null });
      else {
        const loaded = await loadVideo(file);
        const seconds = loaded.video.duration;
        loaded.dispose();
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 10) {
          throw new Error("Vídeos só podem ter até 10 segundos e 25 MB no máximo.");
        }
        onChange({ file, duration: seconds });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível preparar a mídia.");
    } finally {
      processing(false);
    }
  }
  async function cut() {
    if (!source) return;
    processing(true);
    setError(null);
    try {
      onChange(await trimVideo(source, start, length));
      setSource(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha no corte.");
    } finally {
      processing(false);
    }
  }
  return (
    <fieldset className="media-picker" disabled={disabled || busy}>
      <label className={`media-picker-upload${value ? " is-selected" : ""}`} htmlFor={inputId}>
        <span className="media-picker-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M6.2 6.4h11.6a2.2 2.2 0 0 1 2.2 2.2v6.8a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 15.4V8.6a2.2 2.2 0 0 1 2.2-2.2Zm0 1.8a.4.4 0 0 0-.4.4v6.8c0 .22.18.4.4.4h11.6a.4.4 0 0 0 .4-.4V8.6a.4.4 0 0 0-.4-.4H6.2Z" />
            <path d="M10.2 9.65a.9.9 0 0 1 1.38-.76l4.1 2.35a.88.88 0 0 1 0 1.52l-4.1 2.35a.9.9 0 0 1-1.38-.76v-4.7Z" />
          </svg>
        </span>
        <input
          id={inputId}
          className="media-picker-input"
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (selected) void select(selected);
          }}
        />
      </label>
      {preview &&
        (file?.type.startsWith("video/") ? (
          <video ref={previewVideo} src={preview} controls playsInline className="post-media" />
        ) : (
          <img src={preview} alt="Pré-visualização da foto" className="post-media" />
        ))}
      {source && (
        <div className="media-trim">
          <p>
            Vídeo original: {duration.toFixed(1)} s. Escolha um trecho de até 10 s e aplique o
            corte.
          </p>
          <label>
            Início (segundos)
            <input
              type="number"
              min={0}
              max={Math.max(0, duration - length)}
              step="0.1"
              value={start}
              onChange={(event) => {
                const next = Math.min(
                  Math.max(0, Number(event.target.value)),
                  Math.max(0, duration - length),
                );
                setStart(next);
                onChange(null);
                if (previewVideo.current) previewVideo.current.currentTime = next;
              }}
            />
          </label>
          <label>
            Duração (segundos)
            <input
              type="number"
              min="0.1"
              max={Math.min(10, duration - start)}
              step="0.1"
              value={length}
              onChange={(event) => {
                setLength(
                  Math.min(Math.max(0.1, Number(event.target.value)), 10, duration - start),
                );
                onChange(null);
              }}
            />
          </label>
          <button type="button" onClick={() => void cut()}>
            Aplicar corte
          </button>
        </div>
      )}
      {(source || value) && (
        <button
          type="button"
          onClick={() => {
            setSource(null);
            onChange(null);
            setError(null);
          }}
        >
          Remover mídia
        </button>
      )}
      {busy && <p role="status">Preparando mídia… Mantenha esta página aberta.</p>}
      {error && <p role="alert">{error}</p>}
      {source && !value && !busy && <p role="status">Aplique o corte antes de publicar.</p>}
    </fieldset>
  );
}
