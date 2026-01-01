import { useEffect, useRef, useState, useCallback } from 'react';

interface DoomProps {
  onClose: () => void;
}

// Map: 0 = empty, 1-4 = different wall types
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,2,2,0,0,0,3,3,3,0,0,0,1],
  [1,0,0,2,0,0,0,0,0,0,0,3,0,0,0,1],
  [1,0,0,2,0,0,0,0,0,0,0,3,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,4,0,0,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,4,0,0,0,1],
  [1,0,0,4,4,4,0,0,0,4,4,4,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

interface Enemy {
  x: number;
  y: number;
  health: number;
  type: 'imp' | 'demon';
  active: boolean;
}

const WALL_COLORS: Record<number, string> = {
  1: '#8B0000',
  2: '#4A4A4A',
  3: '#2F4F4F',
  4: '#8B4513',
};

const Doom: React.FC<DoomProps> = ({ onClose: _onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'dead'>('menu');
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(50);
  const [kills, setKills] = useState(0);
  const [isShooting, setIsShooting] = useState(false);

  const playerRef = useRef({
    x: 8,
    y: 8,
    angle: 0,
    fov: Math.PI / 3,
  });

  const enemiesRef = useRef<Enemy[]>([
    { x: 4, y: 4, health: 100, type: 'imp', active: true },
    { x: 12, y: 4, health: 100, type: 'demon', active: true },
    { x: 4, y: 12, health: 100, type: 'imp', active: true },
    { x: 12, y: 12, health: 100, type: 'demon', active: true },
  ]);

  const keysRef = useRef<Set<string>>(new Set());

  const castRay = useCallback((angle: number, maxDist: number = 20) => {
    const player = playerRef.current;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    for (let d = 0; d < maxDist; d += 0.02) {
      const x = player.x + cos * d;
      const y = player.y + sin * d;
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      
      if (mapX < 0 || mapX >= MAP[0].length || mapY < 0 || mapY >= MAP.length) {
        return { dist: d, wall: 1, side: 0 };
      }
      
      if (MAP[mapY][mapX] > 0) {
        const side = Math.abs(x - mapX - 0.5) > Math.abs(y - mapY - 0.5) ? 0 : 1;
        return { dist: d, wall: MAP[mapY][mapX], side };
      }
    }
    return { dist: maxDist, wall: 0, side: 0 };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const player = playerRef.current;

    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height / 2);
    skyGradient.addColorStop(0, '#1a0a0a');
    skyGradient.addColorStop(1, '#3d0000');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height / 2);

    // Floor
    const floorGradient = ctx.createLinearGradient(0, height / 2, 0, height);
    floorGradient.addColorStop(0, '#2a2a2a');
    floorGradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, height / 2, width, height / 2);

    // Walls (raycasting)
    const numRays = width;
    for (let i = 0; i < numRays; i++) {
      const rayAngle = player.angle - player.fov / 2 + (i / numRays) * player.fov;
      const { dist, wall, side } = castRay(rayAngle);
      
      // Fix fisheye
      const correctedDist = dist * Math.cos(rayAngle - player.angle);
      const wallHeight = Math.min(height * 2, height / correctedDist);
      
      const baseColor = WALL_COLORS[wall] || '#666';
      const brightness = side === 1 ? 0.7 : 1;
      const shade = Math.max(0.2, 1 - correctedDist / 15);
      
      ctx.fillStyle = adjustBrightness(baseColor, brightness * shade);
      ctx.fillRect(i, (height - wallHeight) / 2, 1, wallHeight);
    }

    // Render enemies
    const enemies = enemiesRef.current.filter(e => e.active);
    enemies.sort((a, b) => {
      const distA = Math.hypot(a.x - player.x, a.y - player.y);
      const distB = Math.hypot(b.x - player.x, b.y - player.y);
      return distB - distA;
    });

    for (const enemy of enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      
      let relAngle = angle - player.angle;
      while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
      while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
      
      if (Math.abs(relAngle) < player.fov / 2) {
        const screenX = width / 2 + (relAngle / player.fov) * width;
        const size = Math.min(height, height / dist) * 0.8;
        
        // Check if wall blocks enemy
        const wallDist = castRay(angle).dist;
        if (wallDist > dist) {
          const shade = Math.max(0.3, 1 - dist / 10);
          ctx.fillStyle = enemy.type === 'imp' 
            ? adjustBrightness('#ff4444', shade)
            : adjustBrightness('#884444', shade);
          
          // Draw enemy sprite (simple demon shape)
          ctx.beginPath();
          ctx.arc(screenX, height / 2, size / 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Eyes
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.arc(screenX - size / 8, height / 2 - size / 8, size / 15, 0, Math.PI * 2);
          ctx.arc(screenX + size / 8, height / 2 - size / 8, size / 15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Weapon
    ctx.fillStyle = '#666';
    ctx.fillRect(width / 2 - 20, height - 120, 40, 100);
    ctx.fillStyle = '#444';
    ctx.fillRect(width / 2 - 15, height - 130, 30, 40);
    ctx.fillStyle = '#333';
    ctx.fillRect(width / 2 - 5, height - 140, 10, 20);

    // Muzzle flash when shooting
    if (isShooting) {
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(width / 2, height - 150, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(width / 2, height - 150, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD
    ctx.fillStyle = '#333';
    ctx.fillRect(0, height - 50, width, 50);
    
    // Health
    ctx.fillStyle = health > 30 ? '#00ff00' : '#ff0000';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`HEALTH: ${health}%`, 20, height - 15);
    
    // Ammo
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`AMMO: ${ammo}`, 200, height - 15);
    
    // Kills
    ctx.fillStyle = '#ff4444';
    ctx.fillText(`KILLS: ${kills}`, 350, height - 15);

    // Crosshair
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 10, height / 2);
    ctx.lineTo(width / 2 + 10, height / 2);
    ctx.moveTo(width / 2, height / 2 - 10);
    ctx.lineTo(width / 2, height / 2 + 10);
    ctx.stroke();
  }, [castRay, health, ammo, kills, isShooting]);

  const shoot = useCallback(() => {
    if (ammo <= 0) return;
    
    setAmmo(a => a - 1);
    setIsShooting(true);
    setTimeout(() => setIsShooting(false), 100);

    const player = playerRef.current;
    const enemies = enemiesRef.current;
    
    // Check for hit
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      
      let relAngle = angle - player.angle;
      while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
      while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
      
      // Check if enemy is in crosshair
      if (Math.abs(relAngle) < 0.15 && dist < 10) {
        const wallDist = castRay(angle).dist;
        if (wallDist > dist) {
          enemy.health -= 35;
          if (enemy.health <= 0) {
            enemy.active = false;
            setKills(k => k + 1);
          }
          break;
        }
      }
    }
  }, [ammo, castRay]);

  const update = useCallback(() => {
    if (gameState !== 'playing') return;

    const player = playerRef.current;
    const speed = 0.08;
    const rotSpeed = 0.05;

    // Movement
    if (keysRef.current.has('w') || keysRef.current.has('arrowup')) {
      const newX = player.x + Math.cos(player.angle) * speed;
      const newY = player.y + Math.sin(player.angle) * speed;
      if (MAP[Math.floor(player.y)][Math.floor(newX)] === 0) player.x = newX;
      if (MAP[Math.floor(newY)][Math.floor(player.x)] === 0) player.y = newY;
    }
    if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) {
      const newX = player.x - Math.cos(player.angle) * speed;
      const newY = player.y - Math.sin(player.angle) * speed;
      if (MAP[Math.floor(player.y)][Math.floor(newX)] === 0) player.x = newX;
      if (MAP[Math.floor(newY)][Math.floor(player.x)] === 0) player.y = newY;
    }
    if (keysRef.current.has('a')) {
      const newX = player.x + Math.cos(player.angle - Math.PI / 2) * speed;
      const newY = player.y + Math.sin(player.angle - Math.PI / 2) * speed;
      if (MAP[Math.floor(player.y)][Math.floor(newX)] === 0) player.x = newX;
      if (MAP[Math.floor(newY)][Math.floor(player.x)] === 0) player.y = newY;
    }
    if (keysRef.current.has('d')) {
      const newX = player.x + Math.cos(player.angle + Math.PI / 2) * speed;
      const newY = player.y + Math.sin(player.angle + Math.PI / 2) * speed;
      if (MAP[Math.floor(player.y)][Math.floor(newX)] === 0) player.x = newX;
      if (MAP[Math.floor(newY)][Math.floor(player.x)] === 0) player.y = newY;
    }
    
    // Rotation
    if (keysRef.current.has('arrowleft') || keysRef.current.has('q')) {
      player.angle -= rotSpeed;
    }
    if (keysRef.current.has('arrowright') || keysRef.current.has('e')) {
      player.angle += rotSpeed;
    }

    // Enemy AI - move towards player and attack
    for (const enemy of enemiesRef.current) {
      if (!enemy.active) continue;
      
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < 0.8) {
        // Attack player
        setHealth(h => {
          const newHealth = h - 1;
          if (newHealth <= 0) setGameState('dead');
          return Math.max(0, newHealth);
        });
      } else if (dist < 8) {
        // Move towards player
        const moveSpeed = 0.02;
        const newX = enemy.x + (dx / dist) * moveSpeed;
        const newY = enemy.y + (dy / dist) * moveSpeed;
        if (MAP[Math.floor(newY)][Math.floor(newX)] === 0) {
          enemy.x = newX;
          enemy.y = newY;
        }
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === ' ') {
        e.preventDefault();
        shoot();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = setInterval(() => {
      update();
      render();
    }, 1000 / 60);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(gameLoop);
    };
  }, [gameState, update, render, shoot]);

  const startGame = () => {
    playerRef.current = { x: 8, y: 8, angle: 0, fov: Math.PI / 3 };
    enemiesRef.current = [
      { x: 4, y: 4, health: 100, type: 'imp', active: true },
      { x: 12, y: 4, health: 100, type: 'demon', active: true },
      { x: 4, y: 12, health: 100, type: 'imp', active: true },
      { x: 12, y: 12, health: 100, type: 'demon', active: true },
    ];
    setHealth(100);
    setAmmo(50);
    setKills(0);
    setGameState('playing');
  };

  if (gameState === 'menu') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black text-red-500 font-mono">
        <div className="text-6xl mb-4 animate-pulse">👹</div>
        <h1 className="text-5xl font-bold mb-2 tracking-widest" style={{ textShadow: '0 0 20px #ff0000' }}>
          DOOM
        </h1>
        <p className="text-xl mb-8 text-red-400">RIP AND TEAR</p>
        <button
          onClick={startGame}
          className="px-8 py-4 bg-red-900 hover:bg-red-700 text-white text-xl font-bold rounded border-2 border-red-500 transition-all"
        >
          START GAME
        </button>
        <div className="mt-8 text-sm text-red-400/60 text-center">
          <p>WASD - Move | Q/E or Arrows - Turn</p>
          <p>SPACE - Shoot</p>
        </div>
      </div>
    );
  }

  if (gameState === 'dead') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black text-red-500 font-mono">
        <div className="text-6xl mb-4">💀</div>
        <h1 className="text-4xl font-bold mb-4">YOU DIED</h1>
        <p className="text-xl mb-2">Kills: {kills}</p>
        <button
          onClick={startGame}
          className="mt-4 px-8 py-4 bg-red-900 hover:bg-red-700 text-white text-xl font-bold rounded border-2 border-red-500"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-black flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full object-contain"
      />
    </div>
  );
};

function adjustBrightness(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}

export default Doom;
