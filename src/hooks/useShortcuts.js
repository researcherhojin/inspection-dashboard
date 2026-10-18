// 키보드 단축키 (글자 입력 중이거나 안내 창이 열려 있으면 쉼)
import { useEffect } from 'react';

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// actions: { undo, help, next, prev, nextPending, search, allOk } — 검사 화면 전용 키는 inspect 가 true 일 때만
export function useShortcuts({ enabled, paused, inspect, actions }) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (paused) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (isTyping(document.activeElement)) return; // 입력칸은 브라우저 기본 되돌리기
        e.preventDefault();
        return actions.undo();
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      if (e.key === '?') return actions.help();
      if (!inspect) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        actions.next();
      } else if (k === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        actions.prev();
      } else if (k === 'n') actions.nextPending();
      else if (e.key === '/') {
        e.preventDefault();
        actions.search();
      } else if (k === 'a') actions.allOk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, paused, inspect, actions]);
}
