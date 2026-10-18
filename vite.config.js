import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : 빌드 결과(dist)를 아무 폴더에 복사해도 동작하도록 상대 경로 사용
export default defineConfig({
  base: './',
  plugins: [react()],
});
