import { useState, useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { audioManager } from "@/lib/audio-manager";
import {
  UI_SOUND_CATEGORIES,
  UI_SOUND_CUES,
  type UISound,
  type UISoundCategory,
} from "@/lib/ui-sound-catalog";

export function AudioSettings() {
  const [previewSound, setPreviewSound] = useState<UISound>("click");
  const preferences = useSyncExternalStore(
    audioManager.subscribe,
    audioManager.getSnapshot,
    audioManager.getServerSnapshot,
  );
  return (
    <section
      className="settings-panel ui-audio-settings"
      aria-labelledby="ui-audio-title"
      data-ui-sound="none"
    >
      <div className="ui-audio-heading">
        <Volume2 size={18} aria-hidden="true" />
        <div>
          <h2 id="ui-audio-title">Sons da interface</h2>
          <p className="workspace-helper">
            Feedback discreto para suas ações. Preferências salvas neste dispositivo.
          </p>
        </div>
      </div>
      <label className="settings-toggle">
        <span>Ativar sons da interface</span>
        <input
          type="checkbox"
          checked={!preferences.muted}
          onChange={(event) => audioManager.setPreferences({ muted: !event.target.checked })}
        />
      </label>
      <label className="ui-audio-volume">
        <span>
          Volume geral <output>{Math.round(preferences.volume * 100)}%</output>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(preferences.volume * 100)}
          aria-label="Volume dos sons da interface"
          onChange={(event) =>
            audioManager.setPreferences({ volume: Number(event.target.value) / 100 })
          }
        />
      </label>
      <label className="settings-toggle">
        <span>Silenciar quando o sistema pede menos movimento</span>
        <input
          type="checkbox"
          checked={preferences.respectReducedMotion}
          onChange={(event) =>
            audioManager.setPreferences({ respectReducedMotion: event.target.checked })
          }
        />
      </label>
      <p className="workspace-helper">
        Com esta opção, a preferência de acessibilidade do sistema também silencia os sons.
      </p>
      <details>
        <summary>Ajustar por categoria</summary>
        {(Object.entries(UI_SOUND_CATEGORIES) as [UISoundCategory, string][]).map(
          ([category, label]) => (
            <label key={category} className="ui-audio-volume">
              <span>
                {label} <output>{Math.round(preferences.categories[category] * 100)}%</output>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(preferences.categories[category] * 100)}
                aria-label={`Volume: ${label}`}
                onChange={(event) =>
                  audioManager.setCategoryVolume(category, Number(event.target.value) / 100)
                }
              />
            </label>
          ),
        )}
        <p className="workspace-helper">Use 0% para silenciar uma categoria.</p>
      </details>
      <label className="ui-audio-preview-choice">
        <span>Som de exemplo</span>
        <select
          value={previewSound}
          onChange={(event) => setPreviewSound(event.target.value as UISound)}
        >
          <option value="click">Clique</option>
          <option value="primary">Ação principal</option>
          <option value="like">Reação</option>
          <option value="navigation">Navegação</option>
          <option value="messageSent">Envio de mensagem</option>
          <option value="notification">Notificação</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
          <option value="premium">Pro</option>
        </select>
      </label>
      <button
        className="ui-audio-preview"
        type="button"
        disabled={
          preferences.muted ||
          preferences.volume === 0 ||
          preferences.categories[UI_SOUND_CUES[previewSound].category] === 0
        }
        onClick={() => audioManager.play(previewSound)}
      >
        Ouvir exemplo
      </button>
    </section>
  );
}
