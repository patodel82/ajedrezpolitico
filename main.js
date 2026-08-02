import * as THREE from 'three';
import { Chess } from 'chess.js';
import { AIPlayer } from './ai.js';
import './style.css';

// Setup Chess Logic
let game = null;
try {
  game = new Chess();
} catch (e) {
  // Fallback if import is resolved as default export
  import('chess.js').then((module) => {
    const ChessConstructor = module.Chess || module.default || module;
    game = new ChessConstructor();
  });
}
let ai = null;
let playMode = 'ai'; // 'ai' or 'local'
let playerFaction = 'w'; // 'w' = Libertarios, 'b' = Peronistas
let selectedSquare = null;
let validMoves = [];

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen');
const startBtn = document.getElementById('start-btn');
const playModeSelect = document.getElementById('play-mode');
const turnIndicator = document.getElementById('turn-indicator');
const resetBtn = document.getElementById('reset-btn');
const refereeClock = document.getElementById('referee-clock');
const bribeModal = document.getElementById('bribe-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const copyAliasBtn = document.getElementById('copy-alias-btn');
const payMockBtn = document.getElementById('pay-mock-btn');
const notification = document.getElementById('game-notification');
const notificationMessage = document.getElementById('notification-message');
const shareActionContainer = document.getElementById('share-action-container');
const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
const capturedLibertarios = document.getElementById('captured-by-libertarios');
const capturedPeronistas = document.getElementById('captured-by-peronistas');
const clockTimer = document.getElementById('clock-timer');

// 3D Scene Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8fafc); // Fondo Claro (Slate 50)

// Camera
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 10, 8);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75); // Aumentada intensidad ambiental
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.45); // Aumentada luz direccional principal
dirLight.position.set(5, 12, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 25;
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;
scene.add(dirLight);

// Luz de apoyo (Fill light) para iluminar las caras de las piezas en sombras
const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-6, 8, -6);
scene.add(fillLight);

// Point Light for dramatic effect
const pointLight = new THREE.PointLight(0x0088ff, 1.5, 15);
pointLight.position.set(0, 4, 0);
scene.add(pointLight);

// Board Dimensions
const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const BOARD_OFFSET = (BOARD_SIZE * SQUARE_SIZE) / 2 - SQUARE_SIZE / 2;

// Materials
const boardMaterials = {
  light: new THREE.MeshStandardMaterial({ color: 0xe5c298, roughness: 0.5, metalness: 0.1 }), // Madera Clara (Pino)
  dark: new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6, metalness: 0.05 }), // Madera Oscura (Caoba)
  selected: new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.1, emissive: 0x332200 }),
  validMove: new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.1, emissive: 0x003311 }),
  kingInCheck: new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.1, emissive: 0x440000 })
};

const pieceMaterials = {
  w: new THREE.MeshStandardMaterial({ color: 0xcd9a62, roughness: 0.8, metalness: 0.05 }), // Madera Natural Clara (Tallada) - Libertarios
  b: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.02 }), // Madera Pintada de Negro - Peronistas
  wood: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85, metalness: 0.05 }), // Madera del Grillete
  metal: new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4 }), // Metal Mate (Sierra)
  gold: new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.15, emissive: 0x332200 }) // Oro brillante para el grillete peronista
};

// Map chess coordinate e.g. 'e4' to 3D position
function squareToCoords(square) {
  const file = square.charCodeAt(0) - 97; // 'a' -> 0
  const rank = parseInt(square[1]) - 1;   // '1' -> 0
  const x = file * SQUARE_SIZE - BOARD_OFFSET;
  const z = (7 - rank) * SQUARE_SIZE - BOARD_OFFSET;
  return { x, z };
}

// 3D Objects mapping
let boardSquares = {}; // e.g. 'e4' -> Mesh
let pieceMeshes = {};  // Unique ID -> Group/Mesh

// Create 3D Board
function createBoard() {
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const squareName = String.fromCharCode(97 + file) + (rank + 1);
      const isLight = (rank + file) % 2 !== 0;
      
      const geometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.2, SQUARE_SIZE);
      const material = isLight ? boardMaterials.light : boardMaterials.dark;
      const mesh = new THREE.Mesh(geometry, material);
      
      const x = file * SQUARE_SIZE - BOARD_OFFSET;
      const z = (7 - rank) * SQUARE_SIZE - BOARD_OFFSET;
      mesh.position.set(x, -0.1, z);
      mesh.receiveShadow = true;
      mesh.userData = { square: squareName, defaultMaterial: material };
      
      scene.add(mesh);
      boardSquares[squareName] = mesh;
    }
  }

  // Board frame
  const frameGeo = new THREE.BoxGeometry(8.4, 0.15, 8.4);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.7, metalness: 0.1 }); // Borde de Madera Oscura Pulida
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, -0.12, 0);
  scene.add(frame);
}

// Procedural Piece Models
function createPieceMesh(type, color) {
  const group = new THREE.Group();
  const mat = pieceMaterials[color];

  // Common Base for all pieces - Faceted base (8 segments) for hand-carved look
  const baseGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 8);
  const base = new THREE.Mesh(baseGeo, mat);
  base.position.y = 0.075;
  base.castShadow = true;
  group.add(base);

  switch (type) {
    case 'p': // Pawn
      // Base stem (8 segments)
      const stemGeo = new THREE.CylinderGeometry(0.12, 0.2, 0.4, 8);
      const stem = new THREE.Mesh(stemGeo, mat);
      stem.position.y = 0.35;
      stem.castShadow = true;
      group.add(stem);

      // Head
      if (color === 'w') {
        // Libertario Pawn: Lion silhouette (Faceted Torus and Sphere)
        const headGeo = new THREE.TorusGeometry(0.18, 0.06, 6, 8);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.y = 0.65;
        head.rotation.x = Math.PI / 2;
        head.castShadow = true;
        group.add(head);

        const coreGeo = new THREE.SphereGeometry(0.12, 8, 6);
        const core = new THREE.Mesh(coreGeo, mat);
        core.position.y = 0.65;
        group.add(core);
      } else {
        // Peronista Pawn: Hand with victory sign (Faceted sphere)
        const sphereGeo = new THREE.SphereGeometry(0.16, 8, 6);
        const sphere = new THREE.Mesh(sphereGeo, mat);
        sphere.position.y = 0.6;
        sphere.castShadow = true;
        group.add(sphere);

        // Two fingers (V sign) (6 segments)
        const fingerGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6);
        
        const f1 = new THREE.Mesh(fingerGeo, mat);
        f1.position.set(-0.06, 0.8, 0);
        f1.rotation.z = 0.2;
        group.add(f1);

        const f2 = new THREE.Mesh(fingerGeo, mat);
        f2.position.set(0.06, 0.8, 0);
        f2.rotation.z = -0.2;
        group.add(f2);
      }
      break;

    case 'r': // Rook
      const wallGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.7, 8);
      const wall = new THREE.Mesh(wallGeo, mat);
      wall.position.y = 0.5;
      wall.castShadow = true;
      group.add(wall);

      const topGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.15, 6);
      const top = new THREE.Mesh(topGeo, mat);
      top.position.y = 0.85;
      top.castShadow = true;
      group.add(top);
      break;

    case 'n': // Knight
      // Horse shape (Naturally boxy and blocky, perfect for carved look)
      const bodyGeo = new THREE.BoxGeometry(0.2, 0.5, 0.4);
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = 0.45;
      body.castShadow = true;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.2, 0.25, 0.35);
      const head = new THREE.Mesh(headGeo, mat);
      head.position.set(0, 0.75, 0.1);
      head.rotation.x = 0.3;
      head.castShadow = true;
      group.add(head);
      break;

    case 'b': // Bishop
      const bStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.7, 8), mat);
      bStem.position.y = 0.5;
      bStem.castShadow = true;
      group.add(bStem);

      const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat);
      bHead.position.y = 0.95;
      bHead.scale.y = 1.4;
      bHead.castShadow = true;
      group.add(bHead);

      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), mat);
      cross.position.y = 1.2;
      group.add(cross);
      break;

    case 'q': // Queen
      const qStem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.8, 8), mat);
      qStem.position.y = 0.55;
      qStem.castShadow = true;
      group.add(qStem);

      const qHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
      qHead.position.y = 1.05;
      qHead.castShadow = true;
      group.add(qHead);

      // Crown points
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 8), mat);
      crown.position.y = 1.1;
      crown.rotation.x = Math.PI / 2;
      group.add(crown);

      // PERONISTA QUEEN SPECIFIC: GRILLETE DE ORO CON BOLA DE PRESA
      if (color === 'b') {
        const shackleGroup = new THREE.Group();
        const shackleBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.55), pieceMaterials.gold);
        shackleBox.position.y = 0.4;
        shackleGroup.add(shackleBox);
        
        const hole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8), pieceMaterials.gold);
        hole1.position.set(-0.14, 0.4, 0);
        const hole2 = hole1.clone();
        hole2.position.x = 0.14;
        shackleGroup.add(hole1, hole2);

        // Gold Chain hanging down (Low-poly)
        const chainGeo = new THREE.TorusGeometry(0.12, 0.03, 6, 8);
        const chain = new THREE.Mesh(chainGeo, pieceMaterials.gold);
        chain.position.set(0, 0.2, 0.15);
        chain.rotation.y = Math.PI / 4;
        shackleGroup.add(chain);

        // Gold prisoner ball (Faceted sphere)
        const ballGeo = new THREE.SphereGeometry(0.2, 8, 6);
        const ball = new THREE.Mesh(ballGeo, pieceMaterials.gold);
        ball.position.set(0.2, 0.1, 0.35);
        shackleGroup.add(ball);

        group.add(shackleGroup);
      }
      break;

    case 'k': // King
      const kStem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.7, 8), mat);
      kStem.position.y = 0.35;
      kStem.castShadow = true;
      group.add(kStem);

      // LIBERTARIO KING: LEÓN TALLADO EN MADERA CON BRAZOS, MOTOSIERRA Y CRUZ REY (Faceted)
      if (color === 'w') {
        // Hombros / Pecho curvo (Faceted cylinder)
        const chestGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.3, 8);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.y = 0.75;
        group.add(chest);

        // Cabeza León
        const lionHeadGeo = new THREE.SphereGeometry(0.2, 32, 32);
        const lionHead = new THREE.Mesh(lionHeadGeo, mat);
        lionHead.position.y = 1.1;
        group.add(lionHead);

        // Hocico de León sobresaliendo hacia el frente
        const snoutGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 16);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 1.05, 0.18);
        snout.rotation.x = Math.PI / 2;
        group.add(snout);

        // Orellas de León
        const earGeo = new THREE.SphereGeometry(0.06, 16, 16);
        const earLeft = new THREE.Mesh(earGeo, mat);
        earLeft.position.set(-0.16, 1.25, 0.05);
        const earRight = earLeft.clone();
        earRight.position.x = 0.16;
        group.add(earLeft, earRight);

        // Melena frondosa que rodea la cabeza (Toro + Cono de melena)
        const maneGeo = new THREE.TorusGeometry(0.22, 0.12, 16, 32);
        const mane = new THREE.Mesh(maneGeo, mat);
        mane.position.set(0, 1.1, -0.02);
        group.add(mane);

        const maneBackGeo = new THREE.ConeGeometry(0.32, 0.5, 32);
        const maneBack = new THREE.Mesh(maneBackGeo, mat);
        maneBack.position.set(0, 0.95, -0.1);
        maneBack.rotation.x = -0.2;
        group.add(maneBack);

        // Cruz de Rey Plana en la cima de la cabeza (como el remate tradicional de la foto)
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), mat);
        crossH.position.y = 1.48;
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), mat);
        crossV.position.y = 1.48;
        group.add(crossH, crossV);

        // --- BRAZOS Y MANOS ARTICULADOS DE MADERA ---
        // Brazo Izquierdo (Apuntando al frente, brazo cruzado sobre el pecho como en la imagen)
        const armLeftGroup = new THREE.Group();
        armLeftGroup.position.set(-0.2, 0.7, 0);
        
        const upperArmLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 16), mat);
        upperArmLeft.position.set(-0.05, -0.05, 0.1);
        upperArmLeft.rotation.x = Math.PI / 3;
        upperArmLeft.rotation.z = 0.2;
        armLeftGroup.add(upperArmLeft);

        const handLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), mat);
        handLeft.position.set(-0.05, -0.1, 0.22);
        armLeftGroup.add(handLeft);
        group.add(armLeftGroup);

        // Brazo Derecho (Sosteniendo activamente la motosierra hacia adelante)
        const armRightGroup = new THREE.Group();
        armRightGroup.position.set(0.2, 0.7, 0);

        const upperArmRight = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), mat);
        upperArmRight.position.set(0.1, 0, 0.15);
        upperArmRight.rotation.x = Math.PI / 4;
        upperArmRight.rotation.y = -Math.PI / 6;
        armRightGroup.add(upperArmRight);

        group.add(armRightGroup);

        // Motosierra sostenida por el brazo derecho hacia adelante
        const chainsawGroup = new THREE.Group();
        chainsawGroup.position.set(0.4, 0.7, 0.25);
        chainsawGroup.rotation.x = 0.2;
        chainsawGroup.rotation.y = -0.5;
        chainsawGroup.rotation.z = -0.1;

        // Motor (Rojo)
        const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: 0xcc3333 }));
        chainsawGroup.add(motorBox);

        // Espada/Hoja larga hacia el frente
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.5), pieceMaterials.metal);
        bar.position.set(0, 0, 0.3);
        chainsawGroup.add(bar);

        // Manillar negro de la motosierra
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 12, 24), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
        handle.position.set(-0.06, 0.06, 0);
        handle.rotation.x = Math.PI / 2;
        chainsawGroup.add(handle);

        group.add(chainsawGroup);
      } else {
        // Rey Peronista
        const kHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 32), mat);
        kHead.position.y = 1.15;
        kHead.castShadow = true;
        group.add(kHead);

        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), mat);
        crossH.position.y = 1.45;
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mat);
        crossV.position.y = 1.45;
        group.add(crossH, crossV);
      }
      break;
  }

  // Optimize shadow casting for group children
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

// Display Captured Pieces
function updateCapturedUI() {
  capturedLibertarios.innerHTML = '';
  capturedPeronistas.innerHTML = '';

  const initialCounts = {
    p: 8, n: 2, b: 2, r: 2, q: 1, k: 1
  };

  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
  };

  // Count remaining pieces on board
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        currentCounts[piece.color][piece.type]++;
      }
    }
  }

  const pieceEmojis = {
    w: { p: '🦁', n: '🐴', b: '⛪', r: '🏰', q: '👑', k: '🪚' },
    b: { p: '✌️', n: '🐴', b: '⛪', r: '🏰', q: '⛓️', k: '👑' }
  };

  // Add captured white pieces to Peronista captured panel
  for (const [type, count] of Object.entries(initialCounts)) {
    const diff = count - currentCounts.w[type];
    for (let i = 0; i < diff; i++) {
      const el = document.createElement('div');
      el.className = 'captured-piece-icon';
      el.textContent = pieceEmojis.w[type];
      capturedPeronistas.appendChild(el);
    }
  }

  // Add captured black pieces to Libertario captured panel
  for (const [type, count] of Object.entries(initialCounts)) {
    const diff = count - currentCounts.b[type];
    for (let i = 0; i < diff; i++) {
      const el = document.createElement('div');
      el.className = 'captured-piece-icon';
      el.textContent = pieceEmojis.b[type];
      capturedLibertarios.appendChild(el);
    }
  }
}

// Clear scene and draw pieces based on game state
function syncPieces3D() {
  // Remove existing piece meshes
  for (const key of Object.keys(pieceMeshes)) {
    scene.remove(pieceMeshes[key]);
  }
  pieceMeshes = {};

  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const squareName = String.fromCharCode(97 + c) + (8 - r);
        const { x, z } = squareToCoords(squareName);
        
        const mesh = createPieceMesh(piece.type, piece.color);
        mesh.position.set(x, 0, z);
        mesh.userData = { square: squareName, type: piece.type, color: piece.color };
        scene.add(mesh);
        
        const pieceId = `${piece.color}-${piece.type}-${squareName}`;
        pieceMeshes[pieceId] = mesh;
      }
    }
  }
}

// Reset Highlight of board squares
function resetBoardHighlight() {
  for (const square of Object.values(boardSquares)) {
    square.material = square.userData.defaultMaterial;
  }
}

// Show notification
function showNotification(text, duration = 3000, showShare = false) {
  notificationMessage.textContent = text;
  notification.classList.remove('hidden');
  
  if (showShare) {
    shareActionContainer.classList.remove('hidden');
  } else {
    shareActionContainer.classList.add('hidden');
  }

  // Only auto-hide if it is not a final game over notification
  if (!showShare) {
    setTimeout(() => {
      notification.classList.add('hidden');
    }, duration);
  }
}

// Handle Win / Loss / Draw
function checkGameOver() {
  if (game.isGameOver()) {
    let msg = "Fin de la Partida! ";
    let peronistasWon = false;
    let isCheckmate = false;

    if (game.isCheckmate()) {
      isCheckmate = true;
      const winner = game.turn() === 'w' ? 'Peronistas' : 'Libertarios';
      msg += `¡Victoria para los ${winner}!`;
      if (winner === 'Peronistas') {
        peronistasWon = true;
      }
    } else if (game.isDraw()) {
      msg += "Empate.";
    } else if (game.isStalemate()) {
      msg += "Ahogado.";
    }
    
    // Only show WhatsApp sharing button if the game ended in checkmate
    showNotification(msg, 10000, isCheckmate);

    if (peronistasWon) {
      setTimeout(() => {
        showNotification("⚠️ ¡Este juego se autodestruirá en 1 minuto!", 60000, false);
        
        // Autodestruction trigger after 60 seconds
        setTimeout(() => {
          document.body.innerHTML = `
            <div style="
              height: 100vh; 
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              align-items: center; 
              background: #000; 
              color: red; 
              font-family: monospace; 
              font-size: 2rem;
              text-align: center;
              padding: 20px;
            ">
              <h1>💥 JUEGO AUTODESTRUIDO 💥</h1>
              <p style="font-size: 1.2rem; color: #666; margin-top: 20px;">Vuelva a cargar la página para reconstruir la república.</p>
            </div>
          `;
        }, 60000);
      }, 2000);
    }
  }
}

// WhatsApp Share Event Handler
whatsappShareBtn.addEventListener('click', () => {
  // Absolute path to the generated image inside local static files folder
  const currentUrl = window.location.href;
  const imageLocation = `${window.location.origin}/leon_motosierra.jpg`;
  
  // Custom message to share
  const message = `¡He terminado una partida en Ajedrez Político 3D! 🇦🇷\n\n🦁 Viva la libertad carajo!!! 🪚\n\nImagen del León con Motosierra: ${imageLocation}\nJuega gratis aquí: ${currentUrl}`;
  
  const encodedText = encodeURIComponent(message);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(whatsappUrl, '_blank');
});

// Execution of turn
function executeMove(from, to) {
  try {
    const move = game.move({ from, to, promotion: 'q' });
    if (move) {
      syncPieces3D();
      resetBoardHighlight();
      updateCapturedUI();
      
      selectedSquare = null;
      validMoves = [];

      // Update turn title
      const isLibertario = game.turn() === 'w';
      turnIndicator.innerHTML = `Turno: <span class="turn-faction ${isLibertario ? 'libertarios-text' : 'peronistas-text'}">${isLibertario ? 'Libertarios' : 'Peronistas'}</span>`;

      if (game.inCheck()) {
        showNotification("¡Jaque!");
      }

      checkGameOver();

      // Trigger AI if it's the AI's turn
      if (!game.isGameOver() && playMode === 'ai' && game.turn() !== playerFaction) {
        setTimeout(playAIMove, 400);
      }
    }
  } catch (err) {
    console.error("Invalid move: ", err);
  }
}

// IA plays
function playAIMove() {
  if (game.isGameOver()) return;
  const bestMove = ai.getBestMove(game);
  if (bestMove) {
    executeMove(bestMove.from, bestMove.to);
  }
}

// Select cell and process chess moves via click
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  // Prevent raycast triggering if clicking buttons or welcome overlay
  if (event.target.closest('#welcome-screen') || event.target.closest('#referee-clock') || event.target.closest('#bribe-modal') || event.target.closest('header') || event.target.closest('.side-panel')) {
    return;
  }

  // Calculate mouse position in normalized device coordinates (-1 to +1)
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    // Find the topmost intersected block which has square information
    let targetMesh = null;
    let parent = intersects[0].object;
    while (parent) {
      if (parent.userData && parent.userData.square) {
        targetMesh = parent;
        break;
      }
      parent = parent.parent;
    }

    if (targetMesh) {
      const square = targetMesh.userData.square;
      
      // If AI's turn, lock interaction
      if (playMode === 'ai' && game.turn() !== playerFaction) return;

      if (selectedSquare === square) {
        // Deselect
        selectedSquare = null;
        validMoves = [];
        resetBoardHighlight();
      } else if (validMoves.includes(square)) {
        // Complete the move
        executeMove(selectedSquare, square);
      } else {
        // Check if selected square has a piece of current color
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          selectedSquare = square;
          resetBoardHighlight();

          // Highlight selected
          boardSquares[square].material = boardMaterials.selected;

          // Get legal moves
          const moves = game.moves({ square: square, verbose: true });
          validMoves = moves.map(m => m.to);

          // Highlight valid moves
          for (const targetSq of validMoves) {
            boardSquares[targetSq].material = boardMaterials.validMove;
          }
        } else {
          // Deselect
          selectedSquare = null;
          validMoves = [];
          resetBoardHighlight();
        }
      }
    }
  }
});

// Orbit effect (Automatic gentle camera rotation or user drag based rotation)
let targetRotation = 0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

window.addEventListener('mousedown', (e) => {
  if (e.target.closest('#canvas-container')) {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.clientX - previousMousePosition.x;
    targetRotation += deltaX * 0.005;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// Touch controls for rotation
window.addEventListener('touchstart', (e) => {
  if (e.target.closest('#canvas-container') && e.touches.length === 1) {
    isDragging = true;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
});

window.addEventListener('touchmove', (e) => {
  if (isDragging && e.touches.length === 1) {
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    targetRotation += deltaX * 0.005;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
});

window.addEventListener('touchend', () => {
  isDragging = false;
});

// Render Loop
function animate() {
  requestAnimationFrame(animate);

  // Apply smooth camera rotation
  const radius = 9.5;
  camera.position.x = radius * Math.sin(targetRotation);
  camera.position.z = radius * Math.cos(targetRotation);
  camera.lookAt(0, 0, 0);

  // Gentle wave or float animation for pieces
  const time = Date.now() * 0.002;
  for (const mesh of Object.values(pieceMeshes)) {
    // Add micro-bobbing to the King/Queen
    if (mesh.userData.type === 'k' || mesh.userData.type === 'q') {
      mesh.position.y = Math.sin(time + mesh.position.x * 2) * 0.03;
    }
  }

  renderer.render(scene, camera);
}

// Window resizing
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// Confetti/Papelitos Logic
let confettiInterval = null;
const confettiColors = {
  w: ['#ffcc00', '#ffe680', '#e5a93b', '#fff'], // Amarillo / Blanco (Libertario)
  b: ['#0088cc', '#00a2ff', '#86d6ff', '#e0f2fe']  // Azul / Celeste (Peronista)
};

function startConfetti(faction) {
  stopConfetti();
  
  const colors = confettiColors[faction];
  confettiInterval = setInterval(() => {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    
    // Random placement and color
    particle.style.left = Math.random() * 100 + 'vw';
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Vary size, animation duration and delays slightly
    const scale = 0.5 + Math.random() * 0.8;
    particle.style.width = (10 * scale) + 'px';
    particle.style.height = (15 * scale) + 'px';
    
    const duration = 2.5 + Math.random() * 2.5;
    particle.style.animationDuration = duration + 's';
    particle.style.transform = `rotate(${Math.random() * 360}deg)`;
    
    document.body.appendChild(particle);

    // Remove particle when animation ends
    setTimeout(() => {
      particle.remove();
    }, duration * 1000);
  }, 60);
}

function stopConfetti() {
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }
  // Clear any active particles on the screen
  document.querySelectorAll('.confetti-particle').forEach(p => p.remove());
}

// DOM elements for faction cards selection
const factionCards = document.querySelectorAll('.faction-card');

// Set default faction selection value
let selectedFactionVal = 'w';

// Faction card click listeners
factionCards.forEach(card => {
  card.addEventListener('click', () => {
    // Remove selected state from all cards
    factionCards.forEach(c => c.classList.remove('selected'));
    
    // Add selected state to clicked card
    card.classList.add('selected');
    
    // Update local variable
    selectedFactionVal = card.getAttribute('data-faction');
    
    // Trigger confetti corresponding to the new selection
    startConfetti(selectedFactionVal);
  });
});

// Trigger initial confetti based on default selected faction (Libertarios 'w')
startConfetti(selectedFactionVal);

// Game flow initialization
startBtn.addEventListener('click', async () => {
  playMode = playModeSelect.value;
  playerFaction = selectedFactionVal;

  stopConfetti(); // Papelitos desaparecen al empezar el juego

  ai = new AIPlayer(playerFaction === 'w' ? 'b' : 'w', 1300);
  
  welcomeScreen.classList.add('hidden');
  
  if (!game) {
    const module = await import('chess.js');
    const ChessConstructor = module.Chess || module.default || module;
    game = new ChessConstructor();
  }
  
  game.reset();
  createBoard();
  syncPieces3D();
  updateCapturedUI();

  // Set initial camera perspective based on team
  if (playerFaction === 'b') {
    targetRotation = Math.PI; // Look from black's side
  } else {
    targetRotation = 0;
  }

  // If player chose black, AI starts first
  if (playMode === 'ai' && playerFaction === 'b') {
    setTimeout(playAIMove, 600);
  }

  // Launch render loop
  animate();
});

// Reset Button
resetBtn.addEventListener('click', () => {
  welcomeScreen.classList.remove('hidden');
});

// Juez / Clock and popup interaction
let fakeTimerVal = 0;
setInterval(() => {
  if (!welcomeScreen.classList.contains('hidden') || game.isGameOver()) return;
  fakeTimerVal++;
  const mins = Math.floor(fakeTimerVal / 60);
  const secs = fakeTimerVal % 60;
  clockTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}, 1000);

refereeClock.addEventListener('click', () => {
  bribeModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  bribeModal.classList.add('hidden');
});

copyAliasBtn.addEventListener('click', () => {
  navigator.clipboard.writeText('patodel82.mp').then(() => {
    alert("¡Alias copiado al portapapeles!");
  });
});

payMockBtn.addEventListener('click', () => {
  alert("Simulando transferencia... ¡El juez electoral ha recibido la coima con éxito!");
  bribeModal.classList.add('hidden');
  showNotification("El Juez fallará a tu favor en la próxima apelación.");
});
