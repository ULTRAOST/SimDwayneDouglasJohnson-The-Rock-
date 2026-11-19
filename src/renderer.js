/**
 * 3D-отрисовка. Весь код, который зависит от Three.js, находится только здесь.
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js";
import { RowType, DeathCause } from "./config.js";

const CAR_COLORS = [0xd63031, 0x0984e3, 0xfdcb6e, 0x00b894, 0x6c5ce7, 0xe17055];

/**
 * Отрисовщик 3D-сцены. Единственное место, где используется Three.js.
 * Получает данные рядов от игры и строит/обновляет по ним меши.
 */
export class ThreeSceneRenderer {
  /** @param {HTMLCanvasElement} canvasElement Canvas для WebGL. */
  constructor(canvasElement) {
    /** WebGL-рендерер. */
    this.webglRenderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
    this.webglRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.webglRenderer.shadowMap.enabled = true;

    /** Сцена. */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3f5);
    this.scene.fog = new THREE.Fog(0xbfe3f5, 18, 40);

    /** Камера. */
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    /** Сглаженная позиция, за которой следует камера (x, z). */
    this.cameraFollowX = 0;
    this.cameraFollowZ = 0;

    this.setupLights();
    /** @type {Map<number, {group:THREE.Group, carMeshes:THREE.Group[]}>} Меши рядов по номеру. */
    this.rowViews = new Map();
    /** Меш камня. */
    this.rockMesh = this.createRockMesh();
    this.scene.add(this.rockMesh);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /** Создаёт ambient-свет и «солнце» с тенями. */
  setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    /** Направленный свет (солнце). */
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sunLight.position.set(6, 12, 6);
    this.sunLight.castShadow = true;
    const shadowCam = this.sunLight.shadow.camera;
    shadowCam.left = -14; shadowCam.right = 14; shadowCam.top = 14; shadowCam.bottom = -14;
    this.scene.add(this.sunLight, this.sunLight.target);
  }

  /** @returns {THREE.Mesh} Новый меш камня. */
  createRockMesh() {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4, 0),
      new THREE.MeshLambertMaterial({ color: 0x8a8d91 })
    );
    mesh.castShadow = true;
    mesh.position.set(0, 0.4, 0);
    return mesh;
  }

  /** @param {number} color @returns {THREE.MeshLambertMaterial} Матовый материал. */
  createMaterial(color) { return new THREE.MeshLambertMaterial({ color }); }

  /** Подгоняет размер рендера и камеры под окно. */
  resize() {
    this.webglRenderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Строит 3D-модель машины.
   * @param {CarData} carData Данные машины.
   * @param {number} direction +1 вправо, -1 влево.
   * @returns {THREE.Group}
   */
  createCarMesh(carData, direction) {
    const group = new THREE.Group();
    const length = carData.length;
    const body = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, 0.7), this.createMaterial(CAR_COLORS[carData.colorIndex]));
    body.position.y = 0.35;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(length * 0.5, 0.3, 0.6), this.createMaterial(0xdfe6e9));
    cabin.position.y = 0.7;
    const wheelGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.8);
    const wheelMaterial = this.createMaterial(0x222222);
    [-0.3, 0.3].forEach(offset => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(offset * length * 1.2, 0.15, 0);
      group.add(wheel);
    });
    group.add(body, cabin);
    group.traverse(o => o.castShadow = true);
    group.rotation.y = direction > 0 ? 0 : Math.PI;
    return group;
  }

  /** Строит дерево (ствол + крона). @param {number} x Координата X. @returns {THREE.Group} */
  createTreeMesh(x) {
    const crownHeight = 0.5 + Math.random() * 0.6;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), this.createMaterial(0x7a5230));
    trunk.position.y = 0.2;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.4, crownHeight + 0.5, 6), this.createMaterial(0x2e8b3d));
    crown.position.y = 0.4 + (crownHeight + 0.5) / 2;
    tree.add(trunk, crown);
    tree.position.x = x;
    tree.traverse(o => o.castShadow = true);
    return tree;
  }

  /** Строит бревно (цилиндр вдоль оси X). @param {{length:number}} logData @returns {THREE.Mesh} */
  createLogMesh(logData) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, logData.length, 10), this.createMaterial(0x8b5a2b));
    mesh.rotation.z = Math.PI / 2;
    mesh.position.y = 0;
    mesh.castShadow = true;
    return mesh;
  }

  /**
   * Строит крокодила (тело, голова, хвост, глаза).
   * @param {{length:number}} crocData @param {number} direction +1 вправо, -1 влево. @returns {THREE.Group}
   */
  createCrocodileMesh(crocData, direction) {
    const group = new THREE.Group();
    const green = this.createMaterial(0x2e7d32);
    const body = new THREE.Mesh(new THREE.BoxGeometry(crocData.length, 0.22, 0.55), green);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.35), this.createMaterial(0x3b9440));
    head.position.x = crocData.length / 2 + 0.2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.25), green);
    tail.position.x = -crocData.length / 2 - 0.2;
    group.add(body, head, tail);
    [-0.12, 0.12].forEach(z => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.createMaterial(0xffe600));
      eye.position.set(crocData.length / 2 + 0.05, 0.16, z);
      group.add(eye);
    });
    group.position.y = 0.2;
    group.traverse(o => o.castShadow = true);
    group.rotation.y = direction > 0 ? 0 : Math.PI;
    return group;
  }

  /**
   * Создаёт графику для нового ряда (пол, разметка, деревья или машины).
   * @param {RowData} row
   */
  addRow(row) {
    const group = new THREE.Group();
    group.position.z = -row.index;
    const isRoad = row.type === RowType.ROAD;
    const isRiver = row.type === RowType.RIVER;
    const floorColor = isRoad ? 0x3d4450 : isRiver ? 0x2f7fd1 : (row.index % 2 ? 0x6fcf5a : 0x62c24e);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 1), this.createMaterial(floorColor));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    group.add(floor);

    const view = { group, carMeshes: [], logMeshes: [], crocodileMeshes: [] };
    if (isRoad) {
      for (let x = -30; x < 30; x += 2) { // пунктир разметки
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.06), this.createMaterial(0xdddddd));
        dash.position.set(x, 0.005, 0);
        group.add(dash);
      }
    } else if (isRiver) {
      row.logs.forEach(log => { const m = this.createLogMesh(log); group.add(m); view.logMeshes.push(m); });
      row.crocodiles.forEach(c => { const m = this.createCrocodileMesh(c, row.carDirection); group.add(m); view.crocodileMeshes.push(m); });
    } else {
      row.treeXs.forEach(x => group.add(this.createTreeMesh(x)));
    }
    this.scene.add(group);
    this.rowViews.set(row.index, view);
    if (isRoad) this.rebuildCars(row);
  }

  /** Пересоздаёт меши машин ряда (после смены их количества). @param {RowData} row */
  rebuildCars(row) {
    const view = this.rowViews.get(row.index);
    if (!view) return;
    view.carMeshes.forEach(mesh => view.group.remove(mesh));
    view.carMeshes = row.cars.map(car => {
      const mesh = this.createCarMesh(car, row.carDirection);
      view.group.add(mesh);
      return mesh;
    });
  }

  /** Удаляет графику ряда. @param {number} rowIndex */
  removeRow(rowIndex) {
    const view = this.rowViews.get(rowIndex);
    if (!view) return;
    this.scene.remove(view.group);
    this.rowViews.delete(rowIndex);
  }

  /** Удаляет графику всех рядов и возвращает камень в исходный вид. */
  clearScene() {
    this.rowViews.forEach(view => this.scene.remove(view.group));
    this.rowViews.clear();
    this.rockMesh.scale.set(1, 1, 1);
    this.rockMesh.position.set(0, 0.4, 0);
  }

  /** Переносит позиции машин, брёвен и крокодилов из данных игры в меши. @param {Map<number,RowData>} rows */
  syncMovingObjects(rows) {
    rows.forEach(row => {
      const view = this.rowViews.get(row.index);
      if (!view) return;
      row.cars.forEach((car, i) => { if (view.carMeshes[i]) view.carMeshes[i].position.x = car.x; });
      row.logs.forEach((log, i) => { if (view.logMeshes[i]) view.logMeshes[i].position.x = log.x; });
      row.crocodiles.forEach((croc, i) => { if (view.crocodileMeshes[i]) view.crocodileMeshes[i].position.x = croc.x; });
    });
  }

  /**
   * Ставит камень в позицию.
   * @param {number} x Координата X. @param {number} lift Высота прыжка. @param {number} row Дробный номер ряда.
   */
  placeRock(x, lift, row) { this.rockMesh.position.set(x, 0.4 + lift, -row); }

  /** Вращает камень во время прыжка. @param {number} deltaX @param {number} deltaRow @param {number} dt */
  spinRock(deltaX, deltaRow, dt) {
    this.rockMesh.rotation.x -= deltaRow * dt * 20;
    this.rockMesh.rotation.z -= deltaX * dt * 20;
  }

  /** Показывает раздавленный камень (сплюснутый). */
  showRockCrushed() { this.rockMesh.scale.y = 0.2; this.rockMesh.position.y = 0.1; }

  /**
   * Показывает погибший камень в зависимости от причины.
   * @param {string} cause Причина смерти (DeathCause).
   */
  showRockDead(cause) {
    if (cause === DeathCause.WATER) this.rockMesh.position.y = -0.25;          // утонул
    else if (cause === DeathCause.CROCODILE) { this.rockMesh.scale.set(0.6, 0.6, 0.6); this.rockMesh.position.y = 0.3; } // укушен
    else this.showRockCrushed();                                               // раздавлен
  }

  /** Плавно двигает камеру за камнем и подстраивает свет. @param {number} dt */
  updateCamera(dt) {
    const smoothing = Math.min(dt * 4, 1);
    this.cameraFollowX += (this.rockMesh.position.x - this.cameraFollowX) * smoothing;
    this.cameraFollowZ += (this.rockMesh.position.z - this.cameraFollowZ) * smoothing;
    this.camera.position.set(this.cameraFollowX * 0.5 + 4, 8, this.cameraFollowZ + 6);
    this.camera.lookAt(this.cameraFollowX * 0.5, 0, this.cameraFollowZ - 1.5);
    this.sunLight.position.set(this.cameraFollowX + 6, 12, this.cameraFollowZ + 6);
    this.sunLight.target.position.set(this.cameraFollowX, 0, this.cameraFollowZ);
  }

  /** Рисует кадр. */
  render() { this.webglRenderer.render(this.scene, this.camera); }
}
