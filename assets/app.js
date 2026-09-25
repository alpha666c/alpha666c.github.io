import * as THREE from "three";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const simplexNoise = (
  /* glsl */
  `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`
);
const STEPS = [2, 1.5, 1, 0.75, 0.5];
const SAMPLE_MS = 1500;
const SLOW_FPS = 40;
function createAdaptiveQuality(renderer, onChange) {
  let step = STEPS.findIndex((s) => s <= Math.min(window.devicePixelRatio, 2));
  if (step < 0) step = STEPS.length - 1;
  renderer.setPixelRatio(STEPS[step]);
  let frames = 0;
  let windowStart = performance.now();
  let lastFrame = windowStart;
  return function tick() {
    const now = performance.now();
    if (now - lastFrame > 500) {
      frames = 0;
      windowStart = now;
    }
    lastFrame = now;
    frames++;
    const elapsed = now - windowStart;
    if (elapsed < SAMPLE_MS) return;
    const fps = frames * 1e3 / elapsed;
    frames = 0;
    windowStart = now;
    if (fps < SLOW_FPS && step < STEPS.length - 1) {
      step++;
      renderer.setPixelRatio(STEPS[step]);
      onChange();
    }
  };
}
const blobVertex = (
  /* glsl */
  `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uPulse;
varying vec3 vNormal;
varying vec3 vView;
varying float vDisp;
${simplexNoise}

float disp(vec3 p){
  vec3 q = normalize(p);
  float d = snoise(q * uFreq + uTime * 0.22) * uAmp;
  d += snoise(q * uFreq * 2.3 - uTime * 0.37) * uAmp * 0.35;
  d += uPulse * 0.28 * sin(q.y * 12.0 - uTime * 7.0);
  return d;
}

void main(){
  vec3 n = normalize(position);
  vec3 t = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(n, t);
  float e = 0.012;
  vec3 p0 = position + n * disp(position);
  vec3 s1 = position + t * e;
  vec3 s2 = position + b * e;
  vec3 p1 = s1 + normalize(s1) * disp(s1);
  vec3 p2 = s2 + normalize(s2) * disp(s2);
  vec3 dn = normalize(cross(p1 - p0, p2 - p0));
  vNormal = normalize(normalMatrix * dn);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vView = normalize(-mv.xyz);
  vDisp = disp(position);
  gl_Position = projectionMatrix * mv;
}
`
);
const blobFragment = (
  /* glsl */
  `
uniform float uTime;
uniform float uHue;
varying vec3 vNormal;
varying vec3 vView;
varying float vDisp;

vec3 palette(float t){
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main(){
  vec3 n = normalize(vNormal);
  float fres = pow(1.0 - max(dot(n, vView), 0.0), 2.4);
  vec3 L = normalize(vec3(0.6, 0.8, 0.7));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vView), 0.0), 48.0);
  vec3 irid = palette(vDisp * 1.4 + fres * 0.55 + uTime * 0.04 + uHue);
  vec3 deep = vec3(0.03, 0.02, 0.09);
  vec3 col = mix(deep, irid, 0.18 + diff * 0.45);
  col += irid * fres * 0.9;
  col += vec3(spec) * 0.7;
  gl_FragColor = vec4(col, 1.0);
}
`
);
const starVertex = (
  /* glsl */
  `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSeed;
varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 40.0);
  vAlpha = tw;
  gl_PointSize = (2.2 + aSeed * 3.0) * uPixelRatio * (10.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`
);
const starFragment = (
  /* glsl */
  `
uniform vec3 uColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  gl_FragColor = vec4(uColor, a * 0.85);
}
`
);
function createHero(canvas, reducedMotion2) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);
  const blobUniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.32 },
    uFreq: { value: 1.35 },
    uPulse: { value: 0 },
    uHue: { value: 0 }
  };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.35, 48),
    new THREE.ShaderMaterial({ uniforms: blobUniforms, vertexShader: blobVertex, fragmentShader: blobFragment })
  );
  const rig = new THREE.Group();
  rig.add(blob);
  scene.add(rig);
  const STAR_COUNT = 3500;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starSeeds = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 3.5 + Math.random() * 14;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi) - 4;
    starSeeds[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute("aSeed", new THREE.BufferAttribute(starSeeds, 1));
  const starUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uColor: { value: new THREE.Color("#b9b4ff") }
  };
  const stars = new THREE.Points(
    starGeo,
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(stars);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#7cf7d4", transparent: true, opacity: 0.35, wireframe: true });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, 4e-3, 8, 180), ringMaterial);
  ring.rotation.x = Math.PI * 0.42;
  rig.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 3e-3, 8, 180), ringMaterial.clone());
  ring2.material.color.set("#b58cff");
  ring2.rotation.set(Math.PI * 0.6, 0.3, 0);
  rig.add(ring2);
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let scroll = 0;
  let targetAmp = blobUniforms.uAmp.value;
  let pulse = 0;
  window.addEventListener("pointermove", (e) => {
    pointer.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });
  const onScroll = () => {
    scroll = window.scrollY / window.innerHeight;
    canvas.style.opacity = String(Math.max(0, Math.min(1, 1 - (scroll - 0.35) / 0.55)));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("pointerdown", (e) => {
    const ndc = new THREE.Vector2(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(blob).length > 0) triggerPulse();
  });
  function triggerPulse() {
    pulse = 1;
  }
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const narrow = w < 820;
    rig.position.x = narrow ? 0 : 1.55;
    rig.position.y = narrow ? 0.9 : 0;
    rig.scale.setScalar(narrow ? 0.72 : 1);
  }
  window.addEventListener("resize", resize);
  const adaptQuality = createAdaptiveQuality(renderer, () => {
    starUniforms.uPixelRatio.value = renderer.getPixelRatio();
    resize();
  });
  resize();
  const clock = new THREE.Clock();
  const speed = reducedMotion2 ? 0.25 : 1;
  const baseX = () => window.innerWidth < 820 ? 0 : 1.55;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (scroll > 0.95) {
      requestAnimationFrame(frame);
      return;
    }
    const t = clock.elapsedTime * speed;
    pointerSmooth.lerp(pointer, 0.06);
    blobUniforms.uTime.value = t;
    starUniforms.uTime.value = t;
    blobUniforms.uAmp.value += (targetAmp + pulse * 0.25 - blobUniforms.uAmp.value) * 0.08;
    pulse = Math.max(0, pulse - dt * 0.9);
    blobUniforms.uPulse.value = pulse;
    const s = Math.min(scroll, 3);
    rig.rotation.y = t * 0.15 + pointerSmooth.x * 0.5 + s * 1.2;
    rig.rotation.x = -pointerSmooth.y * 0.35 + s * 0.3;
    rig.position.x = baseX() - s * 0.9;
    rig.position.z = -s * 1.4;
    ring.rotation.z = t * 0.2;
    ring2.rotation.z = -t * 0.14;
    stars.rotation.y = t * 0.012 + pointerSmooth.x * 0.08;
    stars.rotation.x = pointerSmooth.y * 0.05;
    camera.position.y = -s * 0.6;
    renderer.render(scene, camera);
    adaptQuality();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    setTurbulence(v) {
      targetAmp = v;
    },
    setFrequency(v) {
      blobUniforms.uFreq.value = v;
    },
    setHue(v) {
      blobUniforms.uHue.value = v;
    },
    pulse: triggerPulse
  };
}
const PALETTES = [
  ["#1b1440", "#7a5cff", "#7cf7d4"],
  ["#240b1e", "#ff4f8b", "#ffd36e"],
  ["#07202a", "#1fb6ff", "#e6ff6e"],
  ["#161616", "#8a8a8a", "#ffffff"]
];
const N = 24;
const CELL = 0.5;
function createGrid(canvas, onDrop) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 13.5, 13.5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight("#b8b0ff", "#0a0714", 0.9));
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.position.set(6, 12, 4);
  scene.add(sun);
  const cursorLight = new THREE.PointLight("#7cf7d4", 30, 7, 1.6);
  cursorLight.position.set(0, 2.2, 0);
  scene.add(cursorLight);
  const geometry = new THREE.BoxGeometry(CELL * 0.86, 1, CELL * 0.86);
  geometry.translate(0, 0.5, 0);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.25 });
  const mesh = new THREE.InstancedMesh(geometry, material, N * N);
  scene.add(mesh);
  const cells = [];
  const half = (N - 1) * CELL / 2;
  for (let ix = 0; ix < N; ix++) {
    for (let iz = 0; iz < N; iz++) {
      cells.push({ x: ix * CELL - half, z: iz * CELL - half });
    }
  }
  let palette = PALETTES[0].map((c) => new THREE.Color(c));
  let mode = "ripple";
  const drops = [];
  let dropTotal = 0;
  let lastRain = 0;
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const hover = new THREE.Vector3();
  const hoverTarget = new THREE.Vector3();
  let hoverStrength = 0;
  let hovering = false;
  function projectPointer(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, hit) !== null && Math.abs(hit.x) < half + 1 && Math.abs(hit.z) < half + 1;
  }
  canvas.addEventListener("pointermove", (e) => {
    hovering = projectPointer(e);
    if (hovering) hoverTarget.copy(hit);
  });
  canvas.addEventListener("pointerleave", () => {
    hovering = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (!projectPointer(e)) return;
    addDrop(hit.x, hit.z, 2.4);
  });
  const clock = new THREE.Clock();
  function addDrop(x, z, strength) {
    drops.push({ x, z, t0: clock.elapsedTime, strength });
    if (drops.length > 24) drops.shift();
    dropTotal++;
    onDrop(dropTotal);
  }
  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = w / h < 1 ? 21 : 16;
    camera.position.set(0, dist * 0.72, dist * 0.7);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  const adaptQuality = createAdaptiveQuality(renderer, resize);
  let visible = false;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }, { threshold: 0.05 }).observe(canvas);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  function heightAt(x, z, t) {
    let h = 0.18 + 0.1 * Math.sin(x * 0.7 + t * 1.1) * Math.cos(z * 0.6 + t * 0.8);
    if (hoverStrength > 1e-3) {
      const dx = x - hover.x;
      const dz = z - hover.z;
      const d2 = dx * dx + dz * dz;
      if (mode === "magnet") {
        h += hoverStrength * 3.4 * Math.exp(-d2 / 1.1);
      } else {
        const d = Math.sqrt(d2);
        h += hoverStrength * 1.4 * Math.exp(-d2 / 4) * (0.55 + 0.45 * Math.sin(d * 3 - t * 7));
      }
    }
    for (const drop of drops) {
      const age = t - drop.t0;
      const dx = x - drop.x;
      const dz = z - drop.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const r = age * 5.5;
      h += drop.strength * Math.exp(-(d - r) * (d - r) * 2.2) * Math.exp(-age * 1.1);
    }
    return Math.max(0.06, h);
  }
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    hover.lerp(hoverTarget, 0.18);
    hoverStrength += ((hovering ? 1 : 0) - hoverStrength) * 0.08;
    cursorLight.position.set(hover.x, 2.4, hover.z);
    cursorLight.intensity = 8 + hoverStrength * 30;
    cursorLight.color.copy(palette[2]);
    while (drops.length && t - drops[0].t0 > 3.5) drops.shift();
    if (mode === "rain" && t - lastRain > 0.22) {
      lastRain = t;
      addDrop((Math.random() * 2 - 1) * half, (Math.random() * 2 - 1) * half, 0.9 + Math.random() * 1.4);
    }
    for (let i = 0; i < cells.length; i++) {
      const { x, z } = cells[i];
      const h = heightAt(x, z, t);
      dummy.position.set(x, 0, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const k = Math.min(h / 2.6, 1);
      if (k < 0.5) color.lerpColors(palette[0], palette[1], k * 2);
      else color.lerpColors(palette[1], palette[2], (k - 0.5) * 2);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.rotation.y = Math.sin(t * 0.12) * 0.12;
    renderer.render(scene, camera);
    adaptQuality();
  }
  resize();
  requestAnimationFrame(frame);
  return {
    setMode(next) {
      mode = next;
    },
    setPalette(index) {
      palette = PALETTES[index].map((c) => new THREE.Color(c));
    }
  };
}
function createTagSphere(root, tags, onFocus) {
  const nodes = tags.map((tag) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "tag";
    el.textContent = tag.label;
    root.appendChild(el);
    return el;
  });
  const points = tags.map((_, i) => {
    const y = 1 - i / (tags.length - 1) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
  });
  let rotX = 0.3;
  let rotY = 0;
  let velX = 0;
  let velY = 35e-4;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let focused = -1;
  root.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    root.setPointerCapture(e.pointerId);
    root.classList.add("grabbing");
  });
  root.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    velY = (e.clientX - lastX) * 45e-4;
    velX = -(e.clientY - lastY) * 45e-4;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const release = () => {
    dragging = false;
    root.classList.remove("grabbing");
  };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  nodes.forEach((el, i) => {
    el.addEventListener("pointerenter", () => {
      focused = i;
      onFocus(tags[i]);
    });
    el.addEventListener("pointerleave", () => {
      if (focused === i) {
        focused = -1;
        onFocus(null);
      }
    });
    el.addEventListener("focus", () => onFocus(tags[i]));
  });
  function frame() {
    requestAnimationFrame(frame);
    if (!dragging) {
      velX *= 0.95;
      velY += (35e-4 - velY) * 0.02;
    }
    const damp = focused >= 0 ? 0.15 : 1;
    rotX += velX * damp;
    rotY += velY * damp;
    const radius = Math.min(root.clientWidth, root.clientHeight) * 0.4;
    const cx = Math.cos(rotX);
    const sx = Math.sin(rotX);
    const cy = Math.cos(rotY);
    const sy = Math.sin(rotY);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x1 = p.x * cy + p.z * sy;
      const z1 = -p.x * sy + p.z * cy;
      const y2 = p.y * cx - z1 * sx;
      const z2 = p.y * sx + z1 * cx;
      const depth = (z2 + 1) / 2;
      const scale = 0.55 + depth * 0.75;
      const el = nodes[i];
      el.style.transform = `translate(-50%, -50%) translate3d(${x1 * radius}px, ${y2 * radius}px, 0) scale(${scale})`;
      el.style.opacity = String(0.2 + depth * 0.8);
      el.style.zIndex = String(Math.round(depth * 100));
      el.classList.toggle("front", depth > 0.62);
    }
  }
  requestAnimationFrame(frame);
}
function initCursor() {
  if (window.matchMedia("(pointer: coarse)").matches) return;
  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  if (!dot || !ring) return;
  document.body.classList.add("has-cursor");
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let rx = x;
  let ry = y;
  window.addEventListener("pointermove", (e) => {
    x = e.clientX;
    y = e.clientY;
    const target = e.target;
    ring.classList.toggle("hot", !!(target == null ? void 0 : target.closest("a, button, input, canvas, .tag-sphere, .card")));
  });
  window.addEventListener("pointerdown", () => ring.classList.add("down"));
  window.addEventListener("pointerup", () => ring.classList.remove("down"));
  const tick = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(tick);
  };
  tick();
}
function initMagnetic() {
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.3}px, ${dy * 0.4}px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });
}
function initTilt() {
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--rx", `${(0.5 - py) * 16}deg`);
      card.style.setProperty("--ry", `${(px - 0.5) * 18}deg`);
      card.style.setProperty("--gx", `${px * 100}%`);
      card.style.setProperty("--gy", `${py * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}
function splitText(el) {
  let index = 0;
  const walk = (node) => {
    var _a;
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      (node.textContent ?? "").split(/(\s+)/).forEach((part) => {
        if (part === "") return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
          return;
        }
        const word = document.createElement("span");
        word.className = "word";
        for (const ch of part) {
          const span = document.createElement("span");
          span.className = "char";
          span.textContent = ch;
          span.style.setProperty("--i", String(index++));
          word.appendChild(span);
        }
        frag.appendChild(word);
      });
      (_a = node.parentNode) == null ? void 0 : _a.replaceChild(frag, node);
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(el.childNodes).forEach(walk);
  requestAnimationFrame(() => el.classList.add("in"));
}
function initReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.18 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}
function initCounters() {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      io.unobserve(el);
      const end = Number(el.dataset.count);
      const start = performance.now();
      const step = (now) => {
        const k = Math.min((now - start) / 1400, 1);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(end * eased).toLocaleString();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
}
function initTerminal(el, lines) {
  let started = false;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || started) return;
    started = true;
    io.disconnect();
    void typeLines();
  }, { threshold: 0.3 });
  io.observe(el);
  async function typeLines() {
    for (const line of lines) {
      const row = document.createElement("div");
      row.className = line.startsWith("$") ? "cmd" : line.startsWith("✓") ? "ok" : "out";
      el.appendChild(row);
      for (const ch of line) {
        row.textContent += ch;
        await sleep(line.startsWith("$") ? 22 : 6);
      }
      await sleep(line.startsWith("$") ? 260 : 90);
    }
    const caret = document.createElement("span");
    caret.className = "caret";
    el.appendChild(caret);
  }
}
function initFpsMeter(el) {
  let frames = 0;
  let last = performance.now();
  const tick = (now) => {
    frames++;
    if (now - last >= 500) {
      el.textContent = `${Math.round(frames * 1e3 / (now - last))} fps`;
      frames = 0;
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function initScrollProgress(el) {
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    el.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const TAGS = [
  { label: "TypeScript", note: "Strict types end to end. This whole site compiles with noUnusedLocals on." },
  { label: "Three.js", note: "Two WebGL scenes: a shader blob with starfield, and 576 instanced cubes." },
  { label: "GLSL", note: "Hand-written simplex displacement with normals rebuilt per vertex." },
  { label: "Bun", note: "Runtime for the Vertix HQ API and its auth smoke." },
  { label: "Hono", note: "The HQ API router: health, login, logout, operator status." },
  { label: "React", note: "The Operator UI in apps/hq. This page skips it on purpose." },
  { label: "Vite", note: "Bundles this showcase into static files you can drop on any host." },
  { label: "Git", note: "Branch, commit, push, open a PR. No force pushes to main." },
  { label: "GitHub", note: "Read issues, review PRs, check CI logs, search code." },
  { label: "Slack", note: "Read and post in the channels this workspace can see." },
  { label: "Vercel", note: "Deployments, logs, env vars, domains, once a team is connected." },
  { label: "Sub-agents", note: "Spawn explorers, browser testers, reviewers and CI watchers in parallel." },
  { label: "Browser QA", note: "Drive a real desktop browser, click through flows, record the screen." },
  { label: "Docker", note: "Compose, Caddy and a Dockerfile already stubbed in the repo." },
  { label: "Postgres", note: "Drizzle + Postgres is the planned data layer for HQ." },
  { label: "CSS 3D", note: "This sphere is plain DOM with 3D math. No WebGL here." },
  { label: "A11y", note: "Keyboard-focusable controls and prefers-reduced-motion support." },
  { label: "Security", note: "Fail-closed vault doctrine. Secrets never land in the tree or the logs." },
  { label: "Testing", note: "Smokes and bun test before any claim gets tagged VERIFIED." },
  { label: "Design", note: "Layout, type, motion and color. Everything here was designed in code." },
  { label: "Perf", note: "Offscreen scenes pause rendering. Pixel ratio capped at 2." },
  { label: "Docs", note: "DOCTRINE, ARCHITECTURE and AGENTS kept honest with evidence tags." }
];
const LOG = [
  "$ helix status",
  "repo       alpha666c/Vertix-suite-core",
  "branch     cursor/capability-showcase-60a6",
  "agents     4 visible on this repo",
  "slack      #general  #random",
  "$ helix build showcase --three --glsl --no-framework",
  "writing    noise.ts  hero.ts  grid.ts  sphere.ts  ui.ts",
  "compiling  tsc --noEmit",
  "✓ types clean",
  "$ vite build",
  "✓ static bundle ready in dist/",
  "$ helix qa --browser",
  "spawning   browser tester sub-agent",
  "✓ hero, reactables, sphere, log exercised on a real desktop",
  "fixing    headline word wrap, hero bleed-through, adaptive pixel ratio",
  "✓ re-tested, screenshots saved",
  "$ helix ship",
  "✓ committed, pushed, pull request opened"
];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hero = createHero(document.querySelector("#hero-canvas"), reducedMotion);
function bindRange(id, apply) {
  const input = document.querySelector(`#${id}`);
  const output = document.querySelector(`output[for="${id}"]`);
  const update = () => {
    const v = Number(input.value);
    apply(v);
    if (output) output.textContent = v.toFixed(2);
    input.style.setProperty("--fill", `${(v - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
  };
  input.addEventListener("input", update);
  update();
}
bindRange("turbulence", hero.setTurbulence);
bindRange("frequency", hero.setFrequency);
bindRange("hue", hero.setHue);
document.querySelector("#pulse").addEventListener("click", hero.pulse);
const dropCount = document.querySelector("#drop-count");
const grid = createGrid(document.querySelector("#grid-canvas"), (total) => {
  dropCount.textContent = String(total);
  dropCount.classList.remove("bump");
  void dropCount.offsetWidth;
  dropCount.classList.add("bump");
});
document.querySelectorAll("[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    grid.setMode(btn.dataset.mode);
  });
});
const swatches = document.querySelector("#swatches");
PALETTES.forEach((colors, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "swatch";
  btn.setAttribute("aria-label", `Palette ${i + 1}`);
  btn.setAttribute("aria-pressed", String(i === 0));
  btn.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]} 55%, ${colors[2]})`;
  btn.addEventListener("click", () => {
    swatches.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    grid.setPalette(i);
  });
  swatches.appendChild(btn);
});
const tagNote = document.querySelector("#tag-note");
const tagTitle = document.querySelector("#tag-title");
const defaultTitle = tagTitle.textContent;
const defaultNote = tagNote.textContent;
createTagSphere(document.querySelector("#tag-sphere"), TAGS, (tag) => {
  tagTitle.textContent = tag ? tag.label : defaultTitle;
  tagNote.textContent = tag ? tag.note : defaultNote;
});
initTerminal(document.querySelector("#terminal-body"), LOG);
splitText(document.querySelector(".split"));
initCursor();
initMagnetic();
initTilt();
initReveal();
initCounters();
initFpsMeter(document.querySelector("#fps"));
initScrollProgress(document.querySelector(".progress"));
