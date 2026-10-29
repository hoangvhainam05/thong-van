"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const data = await api("/api/categories");
      setCategories(data);
      setError("");
    } catch (err) { setError(err.message || "Không tải được danh mục."); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { categories, error, reload };
}
