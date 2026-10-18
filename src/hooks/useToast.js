// 화면 아래 잠깐 뜨는 알림 (3초 뒤 사라짐)
import { useCallback, useEffect, useState } from 'react';

export function useToast(ms = 3000) {
  const [toast, setToast] = useState(null);
  const notify = useCallback((msg) => setToast({ msg, at: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  return { toast, notify };
}
