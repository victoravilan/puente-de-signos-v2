import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "puente-signos-favoritos";

export interface FavoriteItem {
  id: string;
  text: string;
  category?: string;
  createdAt: number;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const add = useCallback((text: string, category?: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setFavorites(prev => [{ id, text, category, createdAt: Date.now() }, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  const isFav = useCallback((text: string) => {
    return favorites.some(f => f.text.toLowerCase() === text.toLowerCase());
  }, [favorites]);

  const toggle = useCallback((text: string, category?: string) => {
    if (isFav(text)) {
      setFavorites(prev => prev.filter(f => f.text.toLowerCase() !== text.toLowerCase()));
    } else {
      add(text, category);
    }
  }, [isFav, add]);

  return { favorites, add, remove, isFav, toggle };
}
