// 3D 보기 (three.js). 실제 3D 모델(GLB)의 노드 이름 = 부품 번호 → 선택 강조, 클릭 선택, 상태 색 칠하기
// three.js 장면은 React 바깥의 시스템이므로 Effect 로 만들고 정리합니다.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const STATUS_COLOR = { pass: '#1b7a45', fail: '#c0392b', hold: '#c98a00', progress: '#2b5f9e' };

export default function ModelViewer({ url, selectedRef, statusOf, onPick, height = 420, caption, ariaLabel = '3D 모델' }) {
  const host = useRef(null);
  const api = useRef(null);
  const [state, setState] = useState({ loading: !!url, error: null });

  // 장면 만들기 (url 이 바뀔 때만)
  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f1f2');
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8580', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.8);
    sun.position.set(1, 2, 1.5);
    scene.add(sun);
    const group = new THREE.Group();
    scene.add(group);
    const box = new THREE.BoxHelper(undefined, 0x2f6fde);
    box.visible = false;
    scene.add(box);
    const nodes = new Map(); // ref → Object3D
    let raf = 0, alive = true;

    const fit = () => {
      const b = new THREE.Box3().setFromObject(group);
      if (b.isEmpty()) return;
      const size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
      const r = size.length() / 2;
      const d = r / Math.sin((camera.fov * Math.PI) / 360);
      camera.position.copy(center).add(new THREE.Vector3(0.55, 0.75, 0.9).normalize().multiplyScalar(d * 0.78));
      camera.near = d / 100;
      camera.far = d * 10;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    };
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const tick = () => {
      if (!alive) return;
      controls.update();
      if (box.visible) box.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    // 클릭(끌기 아님)으로 부품 선택
    let down = null;
    const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      for (const hit of ray.intersectObjects(group.children, true)) {
        let o = hit.object;
        while (o && !nodes.has(o.name)) o = o.parent;
        if (o) {
          api.current?.onPick?.(o.name);
          break;
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // 원래 색을 기억해 두고, 상태 색·선택 강조를 덧칠
    const remember = (obj) =>
      obj.traverse((m) => {
        if (m.isMesh) {
          m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
          m.userData.base = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.color.clone());
        }
      });
    const paint = (sel, colorOf) => {
      for (const [ref, obj] of nodes) {
        const tint = colorOf?.(ref);
        obj.traverse((m) => {
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat, i) => {
            mat.color.copy(m.userData.base[i]);
            if (tint) mat.color.lerp(new THREE.Color(tint), 0.7);
            mat.emissive?.set(ref === sel ? '#262626' : '#000000'); // 선택은 밝기 + 파란 상자로 — 상태 색을 가리지 않게
          });
        });
      }
      const o = sel && nodes.get(sel);
      el.dataset.selected = o ? sel : '';
      box.visible = !!o;
      if (o) box.setFromObject(o);
    };
    api.current = { paint, onPick: null };
    // 확인용 정보: 불러온 부품 수, 선택 상태, 부품 중심의 화면 좌표 (자동 화면 테스트에서 사용)
    const expose = () => {
      el.dataset.nodes = String(nodes.size);
      el.__project = (ref) => {
        const o = nodes.get(ref);
        if (!o) return null;
        const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
        const r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((1 - c.y) / 2) * r.height };
      };
      // 화면의 한 점을 눌렀을 때 선택될 부품 (가려진 부품은 앞의 부품이 잡힘)
      el.__hitAt = (x, y) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
        for (const hit of ray.intersectObjects(group.children, true)) {
          let o = hit.object;
          while (o && !nodes.has(o.name)) o = o.parent;
          if (o) return o.name;
        }
        return null;
      };
      el.__pixel = (x, y) => {
        renderer.render(scene, camera);
        const r = renderer.domElement.getBoundingClientRect();
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        const dpr = renderer.getPixelRatio();
        gl.readPixels(Math.round((x - r.left) * dpr), Math.round((r.bottom - y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return [...px.slice(0, 3)];
      };
    };

    if (url) {
      new GLTFLoader().load(
        url,
        (gltf) => {
          if (!alive) return;
          group.add(gltf.scene);
          // 최상위 노드(기판 하나)의 자식 = 부품. 이름이 부품 번호 ('__' 로 시작하면 기판 · 기타)
          const root = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene;
          for (const o of root.children) if (o.name && !o.name.startsWith('__')) nodes.set(o.name, o);
          gltf.scene.traverse((o) => {
            if (o.isMesh) o.material.side = THREE.DoubleSide;
          });
          for (const o of nodes.values()) remember(o);
          fit();
          expose();
          setState({ loading: false, error: null });
          api.current.ready = true;
          api.current.repaint?.();
        },
        undefined,
        () => alive && setState({ loading: false, error: '3D 모델을 불러오지 못했습니다' }),
      );
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach((m) => m.dispose());
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
  }, [url]);

  // 선택·상태 색 반영 (장면은 그대로 두고 색만 바꿈)
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.onPick = onPick;
    a.repaint = () => a.paint(selectedRef, statusOf ? (ref) => STATUS_COLOR[statusOf(ref)] : null);
    if (a.ready) a.repaint();
  }, [selectedRef, statusOf, onPick]);

  return (
    <figure className="model-viewer" aria-label={ariaLabel}>
      <div ref={host} className="mv-stage" style={{ height }} data-loading={state.loading ? '' : undefined} />
      {state.loading && <div className="mv-msg">3D 모델 불러오는 중…</div>}
      {state.error && <div className="mv-msg warn-text">{state.error}</div>}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
