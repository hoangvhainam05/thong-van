"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled, playTap } from "@/lib/audio-juice";

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    const handler = (e) => setEnabled(e.detail.enabled);
    window.addEventListener("thongvan_sound_change", handler);
    return () => window.removeEventListener("thongvan_sound_change", handler);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) playTap(900, 0.05);
  };

  return (
    <button
      type="button"
      className="sound-toggle-btn"
      onClick={toggle}
      title={enabled ? "Âm thanh hiệu ứng: Đang bật" : "Âm thanh hiệu ứng: Đã tắt"}
      aria-label="Bật/Tắt âm thanh hiệu ứng"
    >
      {enabled ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
      <span className="sound-toggle-label">{enabled ? "Âm thanh" : "Tắt âm"}</span>
    </button>
  );
}
