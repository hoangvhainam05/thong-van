"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import RemoteTracking from "@/components/RemoteTracking";
import { Field, Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";
import { Search, PackageSearch, Phone, ShieldCheck, Sparkles } from "lucide-react";

function Tracker() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [phone, setPhone] = useState(params.get("phone") || "");
  const [query, setQuery] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query) return;
    let active = true;
    async function fetchTracking(initial = false) {
      if (initial) setLoading(true);
      try {
        const result = await api(`/api/tracking/${encodeURIComponent(query.code)}`, {
          method: "POST",
          body: { phone: query.phone },
        });
        if (active) {
          setTracking(result);
          setError("");
        }
      } catch (e) {
        if (active) {
          setTracking(null);
          setError(
            e.status === 404
              ? "Không tìm thấy đơn với mã và số điện thoại này."
              : "Chưa tra cứu được đơn. Vui lòng kiểm tra lại kết nối và thử lại."
          );
        }
      } finally {
        if (active && initial) setLoading(false);
      }
    }
    fetchTracking(true);
    const timer = setInterval(() => fetchTracking(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [query]);

  // If URL params exist on initial mount, trigger lookup
  useEffect(() => {
    const initialCode = params.get("code");
    const initialPhone = params.get("phone");
    if (initialCode && initialPhone) {
      setQuery({
        code: initialCode.trim().toUpperCase(),
        phone: initialPhone.replace(/\s/g, ""),
      });
    }
  }, [params]);

  function lookup(e) {
    e.preventDefault();
    playTap(800, 0.04);
    const q = { code: code.trim().toUpperCase(), phone: phone.replace(/\s/g, "") };
    if (!q.code || !q.phone) {
      setQuery(null);
      setTracking(null);
      setError("Nhập cả mã đơn và số điện thoại đã dùng khi đặt hàng.");
      return;
    }
    setTracking(null);
    setQuery(q);
  }

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div>
        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 6 }}>
          <PackageSearch size={24} color="var(--signal)" />
          <h1>Tra cứu đơn hàng trực tiếp</h1>
        </div>
        <p className="muted">
          Không cần đăng nhập. Nhập mã đơn và số điện thoại để xem trực tiếp vị trí xe, thứ tự điểm giao và thời gian dự kiến tới nhà bạn.
        </p>
      </div>

      <form
        className="panel panel-pad row"
        style={{
          alignItems: "flex-end",
          gap: 16,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.06)",
        }}
        onSubmit={lookup}
      >
        <div className="grow">
          <Field label="Mã đơn hàng">
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: TV101435"
              required
            />
          </Field>
        </div>
        <div className="grow">
          <Field label="Số điện thoại đặt hàng">
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xx xxx xxx"
              inputMode="tel"
              required
            />
          </Field>
        </div>
        <button
          className="btn lg btn-glow row"
          style={{ gap: 8, minHeight: 44 }}
          disabled={loading}
        >
          <Search size={16} />
          <span>{loading ? "Đang tra cứu…" : "Tra cứu"}</span>
        </button>
      </form>

      {error && <div className="notice bad animate-pop-in">{error}</div>}

      {tracking && query && (
        <RemoteTracking
          key={tracking.code}
          tracking={tracking}
          proofRequest={{
            path: `/api/tracking/${encodeURIComponent(query.code)}/proof`,
            options: { method: "POST", body: { phone: query.phone } },
          }}
        />
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<Loading message="Đang khởi tạo công cụ tra cứu…" />}>
      <Tracker />
    </Suspense>
  );
}
