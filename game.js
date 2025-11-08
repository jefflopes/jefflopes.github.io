const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;

// Sound effects using Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine', volume = 0.3) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.value = volume;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.stop(audioContext.currentTime + duration);
}

function playJumpSound() {
    playSound(400, 0.1, 'square', 0.1);
    setTimeout(() => playSound(600, 0.1, 'square', 0.1), 50);
}

function playEnemyDefeatSound() {
    playSound(800, 0.1, 'square', 0.2);
    setTimeout(() => playSound(1200, 0.15, 'square', 0.2), 50);
}

function playDeathSound() {
    playSound(400, 0.2, 'sawtooth', 0.2);
    setTimeout(() => playSound(300, 0.2, 'sawtooth', 0.2), 100);
    setTimeout(() => playSound(200, 0.3, 'sawtooth', 0.2), 200);
}

function playPowerUpSound() {
    playSound(600, 0.1, 'sine', 0.2);
    setTimeout(() => playSound(800, 0.1, 'sine', 0.2), 50);
    setTimeout(() => playSound(1000, 0.15, 'sine', 0.2), 100);
}

function playEarthquakeSound() {
    playSound(200, 0.3, 'sawtooth', 0.3);
    setTimeout(() => playSound(150, 0.4, 'sawtooth', 0.3), 100);
    setTimeout(() => playSound(100, 0.5, 'sawtooth', 0.3), 300);
}

function playTsunamiSound() {
    playSound(400, 0.2, 'triangle', 0.2);
    setTimeout(() => playSound(300, 0.3, 'triangle', 0.2), 100);
    setTimeout(() => playSound(500, 0.4, 'triangle', 0.2), 200);
    setTimeout(() => playSound(200, 0.5, 'triangle', 0.2), 400);
}

let flyingSoundInterval = null;
function startFlyingSound() {
    if (flyingSoundInterval) return;
    flyingSoundInterval = setInterval(() => {
        playSound(800, 0.1, 'sine', 0.05);
        setTimeout(() => playSound(1000, 0.1, 'sine', 0.05), 50);
    }, 200);
}

function stopFlyingSound() {
    if (flyingSoundInterval) {
        clearInterval(flyingSoundInterval);
        flyingSoundInterval = null;
    }
}

let score = 0;
let lives = 3;
let gameRunning = true;
let camera = { x: 0, y: 0 };
let screenShake = 0;
let tsunamiWaves = [];
let flyMode = false;
let currentLevel = 1;
let levelComplete = false;
let flagTouched = false;

class Raccoon {
    constructor() {
        this.x = 100;
        this.y = 200;
        this.width = 40;
        this.height = 40;
        this.velocityX = 0;
        this.velocityY = 0;
        this.onGround = false;
        this.powerUp = null;
        this.powerUpTimer = 0;
    }

    update() {
        if (keys.ArrowLeft) {
            this.velocityX = -MOVE_SPEED;
        } else if (keys.ArrowRight) {
            this.velocityX = MOVE_SPEED;
        } else {
            this.velocityX *= 0.8;
        }

        if (flyMode && this.powerUp && this.powerUp.type === 'fly') {
            if (keys.ArrowUp) {
                this.velocityY = -5;
            } else if (keys.ArrowDown) {
                this.velocityY = 5;
            } else {
                this.velocityY *= 0.9;
            }
        } else {
            if (keys[' '] && this.onGround) {
                this.velocityY = JUMP_FORCE;
                this.onGround = false;
                playJumpSound();
            }
            this.velocityY += GRAVITY;
        }
        
        this.x += this.velocityX;
        this.y += this.velocityY;

        if (this.x < 0) this.x = 0;
        if (this.x > level.width - this.width) this.x = level.width - this.width;

        this.onGround = false;
        for (let platform of level.platforms) {
            if (this.checkCollision(platform)) {
                if (this.velocityY > 0 && this.y < platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
            }
        }

        if (this.y > canvas.height) {
            this.respawn();
        }

        if (this.powerUpTimer > 0) {
            this.powerUpTimer--;
            if (this.powerUpTimer === 0) {
                this.powerUp = null;
                flyMode = false;
                stopFlyingSound();
            }
        }

        camera.x = Math.max(0, Math.min(this.x - canvas.width / 2, level.width - canvas.width));
    }

    checkCollision(obj) {
        return this.x < obj.x + obj.width &&
               this.x + this.width > obj.x &&
               this.y < obj.y + obj.height &&
               this.y + this.height > obj.y;
    }

    respawn() {
        lives--;
        playDeathSound();
        if (lives <= 0) {
            gameRunning = false;
        } else {
            this.x = 100;
            this.y = 200;
            this.velocityX = 0;
            this.velocityY = 0;
            this.powerUp = null;
            this.powerUpTimer = 0;
        }
        updateUI();
    }

    draw() {
        ctx.save();
        const x = this.x - camera.x;
        const y = this.y;
        
        // Helper function to draw fluffy fur edges
        function drawFluffyEdge(centerX, centerY, radiusX, radiusY, startAngle, endAngle, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            for (let angle = startAngle; angle < endAngle; angle += 0.15) {
                const baseX = centerX + Math.cos(angle) * radiusX;
                const baseY = centerY + Math.sin(angle) * radiusY;
                const length = 1.5 + (Math.sin(angle * 10) + 1) * 0.75; // Consistent pattern based on angle
                const endX = baseX + Math.cos(angle) * length;
                const endY = baseY + Math.sin(angle) * length;
                
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
        
        // Helper function to add fur texture dots
        function addFurTexture(centerX, centerY, radiusX, radiusY, density, color, seed = 0) {
            for (let i = 0; i < density; i++) {
                const angle = ((i + seed) * 2.4) % (Math.PI * 2);
                const r = ((i * 0.618 + seed) % 1) * 0.8;
                const dotX = centerX + Math.cos(angle) * radiusX * r;
                const dotY = centerY + Math.sin(angle) * radiusY * r;
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(dotX, dotY, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Fuzzy tail (gray with light gray stripes)
        for (let i = 0; i < 5; i++) {
            const tailColor = i % 2 === 0 ? '#696969' : '#C0C0C0';
            ctx.fillStyle = tailColor;
            ctx.beginPath();
            ctx.ellipse(x - 5 - i * 7, y + 20 - i * 2, 12 - i * 1.5, 14 - i * 1.5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            
            // Add fluffy edge to tail
            drawFluffyEdge(x - 5 - i * 7, y + 20 - i * 2, 12 - i * 1.5, 14 - i * 1.5, 0, Math.PI * 2, tailColor);
        }
        
        // Fuzzy round body (gray)
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 26, 22, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Add fluffy body edge
        drawFluffyEdge(x + 20, y + 26, 22, 18, 0, Math.PI * 2, '#707070');
        
        // Body fur texture
        addFurTexture(x + 20, y + 26, 20, 16, 40, '#707070', 1);
        addFurTexture(x + 20, y + 26, 20, 16, 20, '#909090', 100);
        
        // Lighter belly
        ctx.fillStyle = '#A9A9A9';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 30, 14, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Belly fur texture
        addFurTexture(x + 20, y + 30, 12, 9, 20, '#BEBEBE', 200);
        
        // Round fuzzy head
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 8, 16, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Add fluffy head edge
        drawFluffyEdge(x + 20, y + 8, 16, 14, 0, Math.PI * 2, '#707070');
        
        // Head fur texture
        addFurTexture(x + 20, y + 8, 14, 12, 30, '#707070', 300);
        addFurTexture(x + 20, y + 8, 14, 12, 15, '#909090', 400);
        
        // Round fluffy ears
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.arc(x + 8, y - 2, 6, 0, Math.PI * 2);
        ctx.arc(x + 32, y - 2, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Ear fluff
        drawFluffyEdge(x + 8, y - 2, 6, 6, 0, Math.PI * 2, '#606060');
        drawFluffyEdge(x + 32, y - 2, 6, 6, 0, Math.PI * 2, '#606060');
        
        // Inner ears
        ctx.fillStyle = '#D3D3D3';
        ctx.beginPath();
        ctx.arc(x + 8, y - 1, 3, 0, Math.PI * 2);
        ctx.arc(x + 32, y - 1, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Cream colored face area
        ctx.fillStyle = '#F5DEB3';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 10, 11, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye patches (dark gray)
        ctx.fillStyle = '#2F2F2F';
        ctx.beginPath();
        ctx.ellipse(x + 12, y + 7, 7, 5, -0.2, 0, Math.PI * 2);
        ctx.ellipse(x + 28, y + 7, 7, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + 13, y + 7, 2, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 7, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye highlights
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(x + 14, y + 6, 0.8, 0, Math.PI * 2);
        ctx.arc(x + 28, y + 6, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Black nose
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 13, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Fuzzy muzzle
        ctx.fillStyle = '#F5DEB3';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 15, 4, 3, 0, 0, Math.PI);
        ctx.fill();
        
        // Arms (gray and fuzzy)
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.ellipse(x + 7, y + 22, 6, 11, -0.4, 0, Math.PI * 2);
        ctx.ellipse(x + 33, y + 22, 6, 11, 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Arm fluff
        drawFluffyEdge(x + 7, y + 22, 6, 11, -Math.PI * 0.5, Math.PI * 1.5, '#707070');
        drawFluffyEdge(x + 33, y + 22, 6, 11, -Math.PI * 0.5, Math.PI * 1.5, '#707070');
        addFurTexture(x + 7, y + 22, 5, 9, 10, '#707070', 500);
        addFurTexture(x + 33, y + 22, 5, 9, 10, '#707070', 600);
        
        // Paws (lighter gray)
        ctx.fillStyle = '#A9A9A9';
        ctx.beginPath();
        ctx.arc(x + 5, y + 30, 5, 0, Math.PI * 2);
        ctx.arc(x + 35, y + 30, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Cookie in hand
        ctx.fillStyle = '#D4A574';
        ctx.beginPath();
        ctx.arc(x + 37, y + 28, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Cookie bite mark
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.arc(x + 41, y + 26, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Chocolate chips
        ctx.fillStyle = '#3C2414';
        ctx.beginPath();
        ctx.arc(x + 34, y + 27, 1.5, 0, Math.PI * 2);
        ctx.arc(x + 38, y + 30, 1.5, 0, Math.PI * 2);
        ctx.arc(x + 36, y + 24, 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Fuzzy feet
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.ellipse(x + 12, y + 40, 6, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 28, y + 40, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Foot fluff
        drawFluffyEdge(x + 12, y + 40, 6, 5, 0, Math.PI * 2, '#606060');
        drawFluffyEdge(x + 28, y + 40, 6, 5, 0, Math.PI * 2, '#606060');
        addFurTexture(x + 12, y + 40, 5, 4, 8, '#606060', 700);
        addFurTexture(x + 28, y + 40, 5, 4, 8, '#606060', 800);
        
        // Foot pads
        ctx.fillStyle = '#404040';
        ctx.beginPath();
        ctx.ellipse(x + 12, y + 41, 3, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 28, y + 41, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (this.powerUp) {
            ctx.strokeStyle = this.powerUp.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - camera.x - 5, this.y - 5, this.width + 10, this.height + 10);
        }
        
        ctx.restore();
    }

    usePowerUp() {
        if (!this.powerUp) return;

        switch (this.powerUp.type) {
            case 'earthquake':
                screenShake = 30;
                playEarthquakeSound();
                for (let enemy of enemies) {
                    if (Math.abs(enemy.x - this.x) < 300) {
                        enemy.defeated = true;
                        enemy.shakeDefeat = true;
                        score += 100;
                    }
                }
                break;
            case 'fly':
                // Fly is now auto-activated, but can still manually trigger
                if (!flyMode) {
                    flyMode = true;
                    this.velocityY = -5;
                    startFlyingSound();
                }
                break;
            case 'tsunami':
                playTsunamiSound();
                tsunamiWaves.push({
                    x: this.x + this.width,
                    y: this.y,
                    width: 20,
                    height: 60,
                    speed: 8,
                    lifetime: 60
                });
                break;
        }
        updateUI();
    }
}

class Skunk {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 35;
        this.velocityX = -1;
        this.defeated = false;
        this.shakeDefeat = false;
        this.tsunamiDefeat = false;
        this.defeatAnimation = 0;
    }

    update() {
        if (this.defeated) return;
        
        this.x += this.velocityX;
        
        for (let platform of level.platforms) {
            if (this.x <= platform.x || this.x + this.width >= platform.x + platform.width) {
                if (Math.abs(this.y + this.height - platform.y) < 5) {
                    this.velocityX *= -1;
                    break;
                }
            }
        }
    }

    draw() {
        if (this.defeated && this.defeatAnimation > 30) return;
        
        ctx.save();
        
        let drawY = this.y;
        let drawX = this.x - camera.x;
        
        if (this.shakeDefeat && this.defeatAnimation < 30) {
            drawY += Math.sin(this.defeatAnimation * 0.5) * 10;
            this.defeatAnimation++;
        } else if (this.tsunamiDefeat && this.defeatAnimation < 30) {
            drawX += this.defeatAnimation * 5;
            drawY -= this.defeatAnimation * 2;
            ctx.globalAlpha = 1 - (this.defeatAnimation / 30);
            this.defeatAnimation++;
        }
        
        // Helper function to draw fluffy fur edges for skunk
        function drawFluffyEdge(centerX, centerY, radiusX, radiusY, startAngle, endAngle, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            for (let angle = startAngle; angle < endAngle; angle += 0.15) {
                const baseX = centerX + Math.cos(angle) * radiusX;
                const baseY = centerY + Math.sin(angle) * radiusY;
                const length = 1.5 + (Math.sin(angle * 10) + 1) * 0.75;
                const endX = baseX + Math.cos(angle) * length;
                const endY = baseY + Math.sin(angle) * length;
                
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
        
        // Helper function to add fur texture dots for skunk
        function addFurTexture(centerX, centerY, radiusX, radiusY, density, color, seed = 0) {
            for (let i = 0; i < density; i++) {
                const angle = ((i + seed) * 2.4) % (Math.PI * 2);
                const r = ((i * 0.618 + seed) % 1) * 0.8;
                const dotX = centerX + Math.cos(angle) * radiusX * r;
                const dotY = centerY + Math.sin(angle) * radiusY * r;
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(dotX, dotY, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Fluffy tail (behind body)
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(drawX - 5, drawY + 15, 15, 20, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Add fluffy tail edge
        drawFluffyEdge(drawX - 5, drawY + 15, 15, 20, 0, Math.PI * 2, '#0A0A0A');
        
        // Tail texture
        addFurTexture(drawX - 5, drawY + 15, 13, 18, 25, '#0A0A0A', 1000);
        
        // Tail stripe
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(drawX - 8, drawY + 5, 8, 25);
        
        // White stripe texture
        addFurTexture(drawX - 4, drawY + 17, 3, 10, 15, '#F0F0F0', 2000);
        
        // Round chubby body
        ctx.fillStyle = '#2A2A2A';
        ctx.beginPath();
        ctx.ellipse(drawX + 17, drawY + 22, 17, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Add fluffy body edge
        drawFluffyEdge(drawX + 17, drawY + 22, 17, 14, 0, Math.PI * 2, '#1A1A1A');
        
        // Body fur texture
        addFurTexture(drawX + 17, drawY + 22, 15, 12, 35, '#1A1A1A', 3000);
        addFurTexture(drawX + 17, drawY + 22, 15, 12, 20, '#3A3A3A', 4000);
        
        // White stripe on body
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(drawX + 14, drawY + 12, 6, 18);
        
        // White stripe texture
        addFurTexture(drawX + 17, drawY + 21, 2, 7, 12, '#F0F0F0', 5000);
        
        // Round head
        ctx.fillStyle = '#2A2A2A';
        ctx.beginPath();
        ctx.ellipse(drawX + 17, drawY + 8, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Add fluffy head edge
        drawFluffyEdge(drawX + 17, drawY + 8, 12, 10, 0, Math.PI * 2, '#1A1A1A');
        
        // Head fur texture
        addFurTexture(drawX + 17, drawY + 8, 10, 8, 25, '#1A1A1A', 6000);
        addFurTexture(drawX + 17, drawY + 8, 10, 8, 15, '#3A3A3A', 7000);
        
        // Cute round ears
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(drawX + 8, drawY, 4, 5, -0.3, 0, Math.PI * 2);
        ctx.ellipse(drawX + 26, drawY, 4, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Ear fluff
        drawFluffyEdge(drawX + 8, drawY, 4, 5, 0, Math.PI * 2, '#0A0A0A');
        drawFluffyEdge(drawX + 26, drawY, 4, 5, 0, Math.PI * 2, '#0A0A0A');
        
        // Inner ears
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.ellipse(drawX + 8, drawY + 1, 2, 3, -0.3, 0, Math.PI * 2);
        ctx.ellipse(drawX + 26, drawY + 1, 2, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // White snout area
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(drawX + 17, drawY + 10, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Big sparkly eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(drawX + 11, drawY + 6, 3, 0, Math.PI * 2);
        ctx.arc(drawX + 23, drawY + 6, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(drawX + 11.5, drawY + 6, 1.5, 0, Math.PI * 2);
        ctx.arc(drawX + 22.5, drawY + 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye sparkles
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(drawX + 12, drawY + 5, 0.8, 0, Math.PI * 2);
        ctx.arc(drawX + 23, drawY + 5, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Pink heart nose
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.moveTo(drawX + 17, drawY + 11);
        ctx.bezierCurveTo(drawX + 17, drawY + 9, drawX + 15, drawY + 9, drawX + 15, drawY + 10);
        ctx.bezierCurveTo(drawX + 15, drawY + 11, drawX + 17, drawY + 13, drawX + 17, drawY + 13);
        ctx.bezierCurveTo(drawX + 17, drawY + 13, drawX + 19, drawY + 11, drawX + 19, drawY + 10);
        ctx.bezierCurveTo(drawX + 19, drawY + 9, drawX + 17, drawY + 9, drawX + 17, drawY + 11);
        ctx.fill();
        
        // Little smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(drawX + 14, drawY + 12, 3, 0, Math.PI * 0.5);
        ctx.arc(drawX + 20, drawY + 12, 3, Math.PI * 0.5, Math.PI);
        ctx.stroke();
        
        // Tiny arms holding flower
        ctx.fillStyle = '#2A2A2A';
        ctx.beginPath();
        ctx.ellipse(drawX + 6, drawY + 18, 4, 7, -0.5, 0, Math.PI * 2);
        ctx.ellipse(drawX + 28, drawY + 18, 4, 7, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Arm fluff
        drawFluffyEdge(drawX + 6, drawY + 18, 4, 7, 0, Math.PI * 2, '#1A1A1A');
        drawFluffyEdge(drawX + 28, drawY + 18, 4, 7, 0, Math.PI * 2, '#1A1A1A');
        addFurTexture(drawX + 6, drawY + 18, 3, 6, 8, '#1A1A1A', 8000);
        addFurTexture(drawX + 28, drawY + 18, 3, 6, 8, '#1A1A1A', 9000);
        
        // Flower in hand
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.arc(drawX + 30 + Math.cos(angle) * 3, drawY + 20 + Math.sin(angle) * 3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.arc(drawX + 30, drawY + 20, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Stubby legs
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(drawX + 10, drawY + 32, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(drawX + 24, drawY + 32, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Leg fluff
        drawFluffyEdge(drawX + 10, drawY + 32, 4, 3, 0, Math.PI * 2, '#0A0A0A');
        drawFluffyEdge(drawX + 24, drawY + 32, 4, 3, 0, Math.PI * 2, '#0A0A0A');
        addFurTexture(drawX + 10, drawY + 32, 3, 2, 6, '#0A0A0A', 10000);
        addFurTexture(drawX + 24, drawY + 32, 3, 2, 6, '#0A0A0A', 11000);
        
        // Rosy cheeks
        ctx.fillStyle = 'rgba(255, 182, 193, 0.6)';
        ctx.beginPath();
        ctx.arc(drawX + 5, drawY + 10, 3, 0, Math.PI * 2);
        ctx.arc(drawX + 29, drawY + 10, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

class Flag {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseY = y + 140; // Flag starts at bottom
        this.width = 60;
        this.height = 160;
        this.touched = false;
        this.waveOffset = 0;
        this.riseAnimation = 0;
        this.flagPosition = this.baseY; // Current flag position
    }

    draw() {
        const x = this.x - camera.x;
        const poleY = this.y;
        
        // Flag pole (full height)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + 25, poleY, 6, 160);
        
        // Flag base
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.ellipse(x + 28, poleY + 160, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Flag pole top
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x + 28, poleY, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Only draw flag if it's being raised or fully raised
        if (this.touched) {
            if (this.riseAnimation < 60) {
                this.riseAnimation += 2;
                this.flagPosition = this.baseY - (this.riseAnimation / 60) * 130; // Rise 130 pixels
            }
            
            const flagY = this.flagPosition;
            
            // Flag fabric with wave effect (horizontal)
            this.waveOffset += 0.1;
            ctx.fillStyle = '#87CEEB';
            
            // Draw horizontal flag with wave effect
            ctx.beginPath();
            ctx.moveTo(x + 31, flagY);
            
            // Top edge of flag with wave
            for (let i = 0; i <= 80; i += 3) {
                const waveX = x + 31 + i;
                const waveY = flagY + Math.sin(this.waveOffset + i * 0.1) * 2;
                if (i === 0) {
                    ctx.moveTo(waveX, waveY);
                } else {
                    ctx.lineTo(waveX, waveY);
                }
            }
            
            // Right edge
            ctx.lineTo(x + 111, flagY + 30);
            
            // Bottom edge with wave
            for (let i = 80; i >= 0; i -= 3) {
                const waveX = x + 31 + i;
                const waveY = flagY + 30 + Math.sin(this.waveOffset + i * 0.1 + Math.PI) * 2;
                ctx.lineTo(waveX, waveY);
            }
            
            // Left edge
            ctx.lineTo(x + 31, flagY);
            ctx.closePath();
            ctx.fill();
            
            // Flag text "EVIE"
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('EVIE', x + 71, flagY + 20);
            ctx.textAlign = 'left'; // Reset alignment
        }
    }

    checkCollision(raccoon) {
        // Collision detection for the flag pole area
        return raccoon.x < this.x + this.width &&
               raccoon.x + raccoon.width > this.x &&
               raccoon.y < this.y + this.height &&
               raccoon.y + raccoon.height > this.y;
    }
}

class PowerUp {
    constructor(x, y, type, color) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.type = type;
        this.color = color;
        this.collected = false;
    }

    draw() {
        if (this.collected) return;
        
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.fillText(this.type[0].toUpperCase(), this.x - camera.x + 8, this.y + 22);
        
        ctx.restore();
    }
}

const levels = {
    1: { // Grassy Level
        name: "Meadow Adventure",
        width: 2400,
        theme: "grass",
        platforms: [
            { x: 0, y: 350, width: 300, height: 50, type: "grass" },
            { x: 350, y: 300, width: 200, height: 50, type: "grass" },
            { x: 600, y: 250, width: 150, height: 50, type: "grass" },
            { x: 800, y: 350, width: 400, height: 50, type: "grass" },
            { x: 1250, y: 280, width: 150, height: 50, type: "grass" },
            { x: 1450, y: 220, width: 200, height: 50, type: "grass" },
            { x: 1700, y: 320, width: 300, height: 50, type: "grass" },
            { x: 2050, y: 350, width: 350, height: 50, type: "grass" },
        ],
        enemies: [
            { x: 400, y: 265 },
            { x: 900, y: 315 },
            { x: 1300, y: 245 },
            { x: 1500, y: 185 },
            { x: 1800, y: 285 },
        ],
        powerUps: [
            { x: 650, y: 220, type: 'earthquake', color: '#00FF00' },
            { x: 1100, y: 320, type: 'fly', color: '#FF69B4' },
            { x: 1550, y: 190, type: 'tsunami', color: '#0000FF' },
        ]
    },
    2: { // Snowy Level
        name: "Winter Wonderland",
        width: 2600,
        theme: "snow",
        platforms: [
            { x: 0, y: 350, width: 250, height: 50, type: "snow" },
            { x: 300, y: 280, width: 180, height: 50, type: "snow" },
            { x: 550, y: 220, width: 160, height: 50, type: "snow" },
            { x: 780, y: 300, width: 200, height: 50, type: "snow" },
            { x: 1050, y: 240, width: 150, height: 50, type: "snow" },
            { x: 1280, y: 180, width: 180, height: 50, type: "snow" },
            { x: 1540, y: 260, width: 200, height: 50, type: "snow" },
            { x: 1820, y: 320, width: 250, height: 50, type: "snow" },
            { x: 2150, y: 280, width: 200, height: 50, type: "snow" },
            { x: 2400, y: 350, width: 200, height: 50, type: "snow" },
        ],
        enemies: [
            { x: 350, y: 245 },
            { x: 600, y: 185 },
            { x: 1100, y: 205 },
            { x: 1350, y: 145 },
            { x: 1600, y: 225 },
            { x: 1900, y: 285 },
        ],
        powerUps: [
            { x: 450, y: 250, type: 'fly', color: '#FF69B4' },
            { x: 950, y: 270, type: 'earthquake', color: '#00FF00' },
            { x: 1400, y: 150, type: 'tsunami', color: '#0000FF' },
            { x: 2000, y: 250, type: 'fly', color: '#FF69B4' },
        ]
    },
    3: { // Icy Level
        name: "Frozen Peaks",
        width: 2800,
        theme: "ice",
        platforms: [
            { x: 0, y: 350, width: 200, height: 50, type: "ice" },
            { x: 280, y: 290, width: 150, height: 50, type: "ice" },
            { x: 510, y: 230, width: 120, height: 50, type: "ice" },
            { x: 710, y: 170, width: 140, height: 50, type: "ice" },
            { x: 930, y: 250, width: 160, height: 50, type: "ice" },
            { x: 1170, y: 190, width: 130, height: 50, type: "ice" },
            { x: 1380, y: 130, width: 150, height: 50, type: "ice" },
            { x: 1610, y: 210, width: 140, height: 50, type: "ice" },
            { x: 1830, y: 280, width: 180, height: 50, type: "ice" },
            { x: 2090, y: 220, width: 160, height: 50, type: "ice" },
            { x: 2330, y: 160, width: 150, height: 50, type: "ice" },
            { x: 2560, y: 320, width: 240, height: 50, type: "ice" },
        ],
        enemies: [
            { x: 320, y: 255 },
            { x: 560, y: 195 },
            { x: 760, y: 135 },
            { x: 1000, y: 215 },
            { x: 1220, y: 155 },
            { x: 1450, y: 95 },
            { x: 1700, y: 175 },
            { x: 1950, y: 245 },
            { x: 2200, y: 185 },
        ],
        powerUps: [
            { x: 380, y: 260, type: 'earthquake', color: '#00FF00' },
            { x: 800, y: 140, type: 'fly', color: '#FF69B4' },
            { x: 1250, y: 160, type: 'tsunami', color: '#0000FF' },
            { x: 1680, y: 180, type: 'fly', color: '#FF69B4' },
            { x: 2150, y: 190, type: 'earthquake', color: '#00FF00' },
        ]
    }
};

let level = levels[currentLevel];

const raccoon = new Raccoon();
let enemies = [];
let powerUps = [];
let levelFlag = null;

function initializeLevel() {
    level = levels[currentLevel];
    
    // Clear existing enemies and powerups
    enemies = [];
    powerUps = [];
    tsunamiWaves = [];
    
    // Create enemies for current level
    level.enemies.forEach(enemy => {
        enemies.push(new Skunk(enemy.x, enemy.y));
    });
    
    // Create powerups for current level
    level.powerUps.forEach(powerup => {
        powerUps.push(new PowerUp(powerup.x, powerup.y, powerup.type, powerup.color));
    });
    
    // Create flag at end of level
    levelFlag = new Flag(level.width - 150, 230);
    
    // Reset raccoon position
    raccoon.x = 100;
    raccoon.y = 200;
    raccoon.velocityX = 0;
    raccoon.velocityY = 0;
    raccoon.powerUp = null;
    raccoon.powerUpTimer = 0;
    flyMode = false;
    stopFlyingSound();
    camera.x = 0;
    levelComplete = false;
    flagTouched = false;
}

const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'e' && raccoon.powerUp) {
        raccoon.usePowerUp();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function drawBackground() {
    switch(level.theme) {
        case 'grass':
            // Sky gradient
            const grassGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grassGradient.addColorStop(0, '#87CEEB');
            grassGradient.addColorStop(0.7, '#98FB98');
            grassGradient.addColorStop(1, '#90EE90');
            ctx.fillStyle = grassGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Clouds
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let i = 0; i < 5; i++) {
                const cloudX = (i * 200 + 50 - camera.x * 0.3) % (canvas.width + 100);
                ctx.beginPath();
                ctx.arc(cloudX, 50 + i * 10, 20, 0, Math.PI * 2);
                ctx.arc(cloudX + 25, 50 + i * 10, 30, 0, Math.PI * 2);
                ctx.arc(cloudX + 50, 50 + i * 10, 20, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Flowers
            for (let i = 0; i < level.width; i += 150) {
                const flowerX = i - camera.x;
                if (flowerX > -50 && flowerX < canvas.width + 50) {
                    ctx.fillStyle = '#FFB6C1';
                    ctx.beginPath();
                    ctx.arc(flowerX, 370, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#FFD700';
                    ctx.beginPath();
                    ctx.arc(flowerX, 370, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            break;
            
        case 'snow':
            // Winter sky
            const snowGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            snowGradient.addColorStop(0, '#B0E0E6');
            snowGradient.addColorStop(0.7, '#F0F8FF');
            snowGradient.addColorStop(1, '#FFFFFF');
            ctx.fillStyle = snowGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Snow clouds
            ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
            for (let i = 0; i < 4; i++) {
                const cloudX = (i * 250 + 80 - camera.x * 0.2) % (canvas.width + 120);
                ctx.beginPath();
                ctx.arc(cloudX, 40 + i * 15, 25, 0, Math.PI * 2);
                ctx.arc(cloudX + 30, 40 + i * 15, 35, 0, Math.PI * 2);
                ctx.arc(cloudX + 60, 40 + i * 15, 25, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Snowflakes
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let i = 0; i < 50; i++) {
                const snowX = (i * 47 + 23 - camera.x * 0.1) % (canvas.width + 50);
                const snowY = (Date.now() * 0.01 + i * 137) % (canvas.height + 20);
                ctx.beginPath();
                ctx.arc(snowX, snowY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Snow drifts
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            for (let i = 0; i < level.width; i += 200) {
                const driftX = i - camera.x;
                if (driftX > -100 && driftX < canvas.width + 100) {
                    ctx.beginPath();
                    ctx.ellipse(driftX + 50, 380, 60, 15, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            break;
            
        case 'ice':
            // Aurora sky
            const iceGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            iceGradient.addColorStop(0, '#191970');
            iceGradient.addColorStop(0.3, '#483D8B');
            iceGradient.addColorStop(0.7, '#B0C4DE');
            iceGradient.addColorStop(1, '#E6F3FF');
            ctx.fillStyle = iceGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Aurora borealis effect
            ctx.save();
            ctx.globalAlpha = 0.3;
            const auroraOffset = Math.sin(Date.now() * 0.001) * 50;
            const auroraGradient = ctx.createLinearGradient(0, 0, 0, 150);
            auroraGradient.addColorStop(0, '#00FF7F');
            auroraGradient.addColorStop(0.5, '#00BFFF');
            auroraGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = auroraGradient;
            ctx.fillRect(auroraOffset - camera.x * 0.05, 0, canvas.width, 150);
            ctx.restore();
            
            // Ice crystals
            ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
            for (let i = 0; i < 30; i++) {
                const crystalX = (i * 73 + 36 - camera.x * 0.15) % (canvas.width + 70);
                const crystalY = 50 + (i * 29) % 200;
                ctx.save();
                ctx.translate(crystalX, crystalY);
                ctx.rotate(Date.now() * 0.0001 * i);
                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const angle = (j / 6) * Math.PI * 2;
                    const x = Math.cos(angle) * 3;
                    const y = Math.sin(angle) * 3;
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            break;
    }
}

function drawPlatform(platform) {
    switch(platform.type) {
        case 'grass':
            // Grass platform
            ctx.fillStyle = '#228B22';
            ctx.fillRect(platform.x - camera.x, platform.y, platform.width, platform.height);
            // Grass texture on top
            ctx.fillStyle = '#32CD32';
            for (let i = 0; i < platform.width; i += 5) {
                const grassHeight = 3 + Math.sin(i * 0.1) * 2;
                ctx.fillRect(platform.x - camera.x + i, platform.y - grassHeight, 2, grassHeight);
            }
            break;
            
        case 'snow':
            // Snow platform
            ctx.fillStyle = '#A9A9A9';
            ctx.fillRect(platform.x - camera.x, platform.y, platform.width, platform.height);
            // Snow on top
            ctx.fillStyle = '#FFFAFA';
            ctx.fillRect(platform.x - camera.x, platform.y - 8, platform.width, 8);
            // Snow bumps
            for (let i = 0; i < platform.width; i += 15) {
                ctx.beginPath();
                ctx.arc(platform.x - camera.x + i + 7, platform.y - 4, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
            
        case 'ice':
            // Ice platform
            ctx.fillStyle = '#4682B4';
            ctx.fillRect(platform.x - camera.x, platform.y, platform.width, platform.height);
            // Ice surface
            const iceGradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + 10);
            iceGradient.addColorStop(0, 'rgba(173, 216, 230, 0.9)');
            iceGradient.addColorStop(1, 'rgba(173, 216, 230, 0.3)');
            ctx.fillStyle = iceGradient;
            ctx.fillRect(platform.x - camera.x, platform.y, platform.width, 10);
            // Ice shine
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(platform.x - camera.x + 10, platform.y + 3);
            ctx.lineTo(platform.x - camera.x + platform.width - 10, platform.y + 3);
            ctx.stroke();
            break;
    }
}

function updateUI() {
    document.getElementById('level').textContent = currentLevel;
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    
    const powerupDiv = document.getElementById('powerup');
    if (raccoon.powerUp) {
        let instructions;
        if (raccoon.powerUp.type === 'fly') {
            instructions = `Power: Flying (Use Arrow Keys)`;
        } else {
            instructions = `Power: ${raccoon.powerUp.type} (Press E)`;
        }
        powerupDiv.textContent = instructions;
        powerupDiv.style.color = raccoon.powerUp.color;
    } else {
        powerupDiv.textContent = '';
    }
}

function gameLoop() {
    if (!gameRunning) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '48px Arial';
        ctx.fillText('Game Over!', canvas.width/2 - 120, canvas.height/2);
        ctx.font = '24px Arial';
        ctx.fillText('Refresh to play again', canvas.width/2 - 100, canvas.height/2 + 40);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    ctx.save();
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
        screenShake *= 0.9;
        if (screenShake < 1) screenShake = 0;
    }
    
    // Draw platforms with theme-specific styling
    for (let platform of level.platforms) {
        drawPlatform(platform);
    }

    raccoon.update();
    raccoon.draw();

    for (let i = tsunamiWaves.length - 1; i >= 0; i--) {
        const wave = tsunamiWaves[i];
        wave.x += wave.speed;
        wave.lifetime--;
        
        if (wave.lifetime <= 0) {
            tsunamiWaves.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.fillStyle = 'rgba(0, 100, 255, 0.6)';
        ctx.fillRect(wave.x - camera.x, wave.y - wave.height/2, wave.width, wave.height);
        
        for (let j = 0; j < 3; j++) {
            const offsetX = j * 10 - 10;
            const offsetY = Math.sin((wave.lifetime + j * 10) * 0.3) * 5;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(wave.x - camera.x + offsetX, wave.y - wave.height/2 + offsetY, 5, 5);
        }
        ctx.restore();
        
        for (let enemy of enemies) {
            if (!enemy.defeated && wave.x > enemy.x && wave.x < enemy.x + enemy.width) {
                enemy.defeated = true;
                enemy.tsunamiDefeat = true;
                score += 100;
                playEnemyDefeatSound();
                updateUI();
            }
        }
    }

    for (let enemy of enemies) {
        if (!enemy.defeated || enemy.defeatAnimation < 30) {
            enemy.update();
            enemy.draw();
            
            if (!enemy.defeated && raccoon.checkCollision(enemy)) {
                if (raccoon.velocityY > 0 && raccoon.y < enemy.y) {
                    enemy.defeated = true;
                    enemy.defeatAnimation = 31;
                    raccoon.velocityY = JUMP_FORCE / 2;
                    score += 50;
                    playEnemyDefeatSound();
                    updateUI();
                } else {
                    raccoon.respawn();
                }
            }
        }
    }

    for (let powerUp of powerUps) {
        if (!powerUp.collected) {
            powerUp.draw();
            
            if (raccoon.checkCollision(powerUp)) {
                powerUp.collected = true;
                raccoon.powerUp = powerUp;
                raccoon.powerUpTimer = 600;
                playPowerUpSound();
                
                // Auto-activate fly power-up
                if (powerUp.type === 'fly') {
                    flyMode = true;
                    raccoon.velocityY = -5;
                    startFlyingSound();
                }
                
                updateUI();
            }
        }
    }

    // Draw and check flag collision
    if (levelFlag) {
        levelFlag.draw();
        
        if (!flagTouched && levelFlag.checkCollision(raccoon)) {
            flagTouched = true;
            levelFlag.touched = true;
            
            // Wait for flag to finish raising before showing completion screen
            setTimeout(() => {
                levelComplete = true;
                
                if (currentLevel < 3) {
                    // Progress to next level after screen is shown
                    setTimeout(() => {
                        currentLevel++;
                        initializeLevel();
                        gameRunning = true;
                    }, 2000);
                } else {
                    // Game complete after screen is shown
                    setTimeout(() => {
                        gameRunning = false;
                    }, 2000);
                }
            }, 1500); // Wait for flag animation to complete
        }
    }

    ctx.restore();

    // Show level complete screen when flag is touched
    if (levelComplete) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '48px Arial';
        
        if (currentLevel < 3) {
            ctx.fillText('Level Complete!', canvas.width/2 - 150, canvas.height/2 - 20);
            ctx.font = '24px Arial';
            ctx.fillText(`Score: ${score}`, canvas.width/2 - 50, canvas.height/2 + 20);
            ctx.fillText('Next level loading...', canvas.width/2 - 80, canvas.height/2 + 50);
        } else {
            ctx.fillText('Game Complete!', canvas.width/2 - 140, canvas.height/2 - 20);
            ctx.font = '24px Arial';
            ctx.fillText(`Final Score: ${score}`, canvas.width/2 - 70, canvas.height/2 + 20);
            ctx.fillText('Congratulations!', canvas.width/2 - 80, canvas.height/2 + 50);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Initialize the first level
initializeLevel();
updateUI();
gameLoop();