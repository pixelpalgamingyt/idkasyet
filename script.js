// --- DOM Elements ---
const startScreen = document.getElementById('startScreen');
const menuScreen = document.getElementById('menuScreen');
const gameWrapper = document.getElementById('gameWrapper');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const expDisplay = document.getElementById('exp');
const hpDisplay = document.getElementById('hp');
const levelDisplay = document.getElementById('level');
const cooldownDisplay = document.getElementById('cooldownTimer');
const cardContainer = document.getElementById('cardContainer');
const gameOverScreen = document.getElementById('gameOverScreen');
const controlsInfo = document.getElementById('controlsInfo');
const abilityControlsDiv = document.getElementById('abilityControls');

// --- Audio Elements ---
const expSound = document.getElementById('expSound');
const powerUpSound = document.getElementById('powerUpSound');
const shootSound = document.getElementById('shootSound');
const backgroundMusic = document.getElementById('backgroundMusic');
const gameOverMusic = document.getElementById('gameOverMusic');

// --- Game State ---
let keys = {};
let bullets = [];
let zombies = [];
let abilities = [];
let abilityCooldown = {}; // Store cooldown status for each ability
let cooldownEndTime = {}; // Store cooldown end time for each ability
let isGameOver = false;
let isGamePaused = false;
let lastShootAngle = { x: 0, y: -1 }; // Default angle (up)
let animationFrameId; // For requestAnimationFrame
let player = {
    x: 400,
    y: 300,
    size: 20,
    speed: 3,
    hp: 100,
    exp: 0,
    level: 1
};
let boss = null;

// --- Config ---
const abilityKeys = ['q', 'e', 'r']; // Key bindings for abilities

// --- Event Listeners ---
canvas.addEventListener('click', shootBullet);
canvas.addEventListener('mousemove', e => {
    if (!isGamePaused && !isGameOver) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        const dist = Math.hypot(dx, dy);
        lastShootAngle = { x: dx / dist, y: dy / dist };
    }
});

window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    keys[key] = true;

    if (key === 'escape') {
        if (isGamePaused) {
            resumeGame();
        } else if (!isGameOver) {
            pauseGame();
        }
    }

    const abilityIndex = abilityKeys.indexOf(key);
    if (abilityIndex !== -1) {
        activateAbility(abilityIndex);
    }
});

window.addEventListener('keyup', e => {
    delete keys[e.key.toLowerCase()];
});


// --- Game State Functions ---
function startGame() {
    startScreen.style.display = 'none';
    gameWrapper.style.display = 'flex';
    resetGame();
    backgroundMusic.currentTime = 0;
    backgroundMusic.play();
    
    // Start the game loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
    isGamePaused = true;
    backgroundMusic.pause();
    menuScreen.style.display = 'block';
    // The game loop will stop itself because isGamePaused is true
}

function resumeGame() {
    isGamePaused = false;
    backgroundMusic.play();
    menuScreen.style.display = 'none';
    
    // Restart the game loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

function goToMainMenu() {
    isGamePaused = true; // Stop the loop
    isGameOver = true;   // Stop the loop

    gameWrapper.style.display = 'none';
    gameOverScreen.style.display = 'none';
    menuScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    gameOverMusic.pause();
    gameOverMusic.currentTime = 0;
}

function restartGame() {
    gameOverScreen.style.display = 'none';
    menuScreen.style.display = 'none';
    resetGame();
    
    gameOverMusic.pause();
    gameOverMusic.currentTime = 0;
    backgroundMusic.currentTime = 0;
    backgroundMusic.play();
    
    // Restart the game loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

function resetGame() {
    isGameOver = false;
    isGamePaused = false;
    
    player.hp = 100;
    player.exp = 0;
    player.level = 1;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    
    zombies = [];
    bullets = [];
    abilities = [];
    abilityCooldown = {};
    cooldownEndTime = {};
    boss = null;
    
    cardContainer.innerHTML = '';
    gameOverScreen.style.display = 'none';
    
    updateUI();
}

function showControls() {
    menuScreen.querySelector('h2').textContent = 'Controls';
    document.querySelectorAll('#menuScreen > button').forEach(button => button.style.display = 'none');
    controlsInfo.style.display = 'block';
    abilityControlsDiv.innerHTML = '';
    abilities.forEach((ability, index) => {
        const p = document.createElement('p');
        p.textContent = `${ability.name}: ${abilityKeys[index] || 'Not Bound'}`;
        abilityControlsDiv.appendChild(p);
    });
}

function hideControls() {
    menuScreen.querySelector('h2').textContent = 'Menu';
    document.querySelectorAll('#menuScreen > button').forEach(button => button.style.display = 'block');
    controlsInfo.style.display = 'none';
}


// --- Game Logic Functions ---
function spawnZombie() {
    // Only spawn if not paused/over and below zombie limit
    if (zombies.length >= 10 + player.level || isGamePaused || isGameOver) return; 
    
    // Randomly spawn from one of the 4 edges
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -20; y = Math.random() * canvas.height; } // Left
    else if (side === 1) { x = canvas.width + 20; y = Math.random() * canvas.height; } // Right
    else if (side === 2) { x = Math.random() * canvas.width; y = -20; } // Top
    else { x = Math.random() * canvas.width; y = canvas.height + 20; } // Bottom

    // Randomly select a zombie type
    const zombieType = Math.random();
    let type = 'normal';
    let size = 20;
    let speed = 0.5 + (player.level / 10);
    let hp = 2 + Math.floor(player.level / 5);
    let color = 'red';

    if (zombieType < 0.2 && player.level > 2) { // 20% chance
        type = 'ice';
        size = 25;
        speed = 0.3 + (player.level / 15); // Slower
        hp = 3 + Math.floor(player.level / 7);
        color = 'cyan';
    } else if (zombieType < 0.4 && player.level > 3) { // 20% chance (cumulative 40%)
        type = 'explosive';
        size = 30;
        speed = 0.7 + (player.level / 8); // Faster
        hp = 1 + Math.floor(player.level / 3); // Less HP
        color = 'orange';
    } else if (zombieType < 0.6 && player.level > 4) { // 20% chance (cumulative 60%)
        type = 'tank';
        size = 35;
        speed = 0.4 + (player.level / 12);
        hp = 5 + Math.floor(player.level / 4);
        color = 'gray'
    }

    zombies.push({
        x: x, y: y, size: size, speed: speed, hp: hp,
        type: type, color: color, exploded: false
    });
}

function spawnBoss() {
    if (!boss && player.level % 10 === 0 && player.level > 0) {
        boss = { 
            x: canvas.width / 2, 
            y: -50, 
            size: 50, 
            speed: 1, 
            hp: 50 + (player.level * 5),
            maxHp: 50 + (player.level * 5)
        };
    }
}

function shootBullet() {
    if (!isGamePaused && !isGameOver) {
        bullets.push({
            x: player.x,
            y: player.y,
            size: 5,
            speed: 10,
            dx: lastShootAngle.x,
            dy: lastShootAngle.y
        });
        shootSound.currentTime = 0;
        shootSound.play();
    }
}

function grantAbility(abilityName, description, action) {
    const newAbility = { name: abilityName, description: description, action: action };
    abilities.push(newAbility);
    abilityCooldown[abilityName] = false;
    cooldownEndTime[abilityName] = 0;

    const card = document.createElement('div');
    card.className = 'card';
    card.title = description; // Add tooltip
    card.innerText = abilityName;
    card.addEventListener('click', () => {
        const index = abilities.findIndex(a => a.name === abilityName);
        activateAbility(index);
    });
    cardContainer.appendChild(card);
}

function handleAbilities() {
    // Grant abilities based on EXP or Level
    // Note: This runs every frame, so check `abilities.length` to prevent duplicates
    if (player.exp >= 10 && abilities.length === 0) {
        grantAbility('Fireblast', 'Damages all zombies on screen', () => {
            zombies.forEach(z => z.hp -= 10);
            powerUpSound.play();
        });
    } else if (player.exp >= 20 && abilities.length === 1) {
        grantAbility('Speed Boost', 'Move faster for 5 seconds', () => {
            player.speed += 2;
            powerUpSound.play();
            setTimeout(() => { player.speed -= 2; }, 5000);
        });
    } else if (player.exp >= 30 && abilities.length === 2) {
        grantAbility('Heal', 'Restore 25 HP', () => {
            player.hp = Math.min(100, player.hp + 25);
            powerUpSound.play();
        });
    }
}

function activateAbility(abilityIndex) {
    if (!abilities[abilityIndex] || isGamePaused || isGameOver) return;
    
    const ability = abilities[abilityIndex];
    if (!abilityCooldown[ability.name]) {
        abilityCooldown[ability.name] = true;
        cooldownEndTime[ability.name] = Date.now() + 10000; // 10-second cooldown
        ability.action();
        updateCooldownUI();
        
        setTimeout(() => {
            abilityCooldown[ability.name] = false;
            updateCooldownUI();
        }, 10000);
    } else {
        console.log(`${ability.name} is on cooldown.`);
    }
}

function updateUI() {
    hpDisplay.textContent = player.hp;
    expDisplay.textContent = player.exp;
    player.level = Math.floor(player.exp / 10) + 1;
    levelDisplay.textContent = player.level;
}

function updateCooldownUI() {
    cooldownDisplay.innerHTML = ''; // Clear previous timers
    abilities.forEach(ability => {
        if (abilityCooldown[ability.name]) {
            const timeLeft = Math.ceil((cooldownEndTime[ability.name] - Date.now()) / 1000);
            if (timeLeft > 0) {
                const timerSpan = document.createElement('span');
                timerSpan.style.margin = "0 10px";
                timerSpan.textContent = `${ability.name}: ${timeLeft}s`;
                cooldownDisplay.appendChild(timerSpan);
            }
        }
    });
}

// --- Main Loop Functions ---
function update() {
    if (keys['w'] || keys['arrowup']) player.y -= player.speed;
    if (keys['s'] || keys['arrowdown']) player.y += player.speed;
    if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
    if (keys['d'] || keys['arrowright']) player.x += player.speed;

    // Clamp player to canvas bounds
    player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));

    // Update Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.dx * b.speed;
        b.y += b.dy * b.speed;
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }

    // Update Zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        const dx = player.x - z.x;
        const dy = player.y - z.y;
        const dist = Math.hypot(dx, dy);
        z.x += (dx / dist) * z.speed;
        z.y += (dy / dist) * z.speed;

        // Bullet-Zombie Collision
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (Math.hypot(z.x - b.x, z.y - b.y) < (z.size / 2) + (b.size / 2)) {
                z.hp -= 5; // Bullet damage
                bullets.splice(j, 1);
            }
        }

        // Player-Zombie Collision
        if (Math.hypot(z.x - player.x, z.y - player.y) < (z.size / 2) + (player.size / 2)) {
            player.hp -= (z.type === 'ice') ? 2 : 1; 
            z.hp = 0; // Zombie dies on impact
        }

        // Check for dead zombies
        if (z.hp <= 0) {
            if (z.type === 'explosive' && !z.exploded) {
                z.exploded = true; 
                const explosionRadius = 60;
                const explosionDamage = 15;
                
                // Damage other zombies
                zombies.forEach((otherZombie, k) => {
                    if (i !== k && Math.hypot(z.x - otherZombie.x, z.y - otherZombie.y) < explosionRadius) {
                        otherZombie.hp -= explosionDamage;
                    }
                });
                // Damage player
                if (Math.hypot(z.x - player.x, z.y - player.y) < explosionRadius) {
                    player.hp -= explosionDamage;
                }
            }
            zombies.splice(i, 1);
            player.exp += 1;
            expSound.currentTime = 0;
            expSound.play();
        }
    }

    // --- Boss Logic ---
    spawnBoss(); // Check if a boss should spawn
    if (boss) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy);
        boss.x += (dx / dist) * boss.speed;
        boss.y += (dy / dist) * boss.speed;

        // Player-Boss Collision
        if (Math.hypot(boss.x - player.x, boss.y - player.y) < (boss.size / 2) + (player.size / 2)) {
            player.hp -= 5;
        }

        // Bullet-Boss Collision
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (Math.hypot(boss.x - b.x, boss.y - b.y) < (boss.size / 2) + (b.size / 2)) {
                boss.hp -= 5; 
                bullets.splice(j, 1);
            }
        }
        
        // Boss Defeat
        if (boss.hp <= 0) {
            boss = null;
            player.exp += 50; // Big EXP reward
            expSound.play();
        }
    }

    // --- UI & State Updates ---
    updateUI();
    handleAbilities();

    // --- Game Over Check ---
    if (player.hp <= 0) {
        player.hp = 0; // Don't show negative HP
        isGameOver = true;
        gameOverScreen.style.display = 'block';
        backgroundMusic.pause();
        gameOverMusic.currentTime = 0;
        gameOverMusic.play();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Player
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw Bullets
    ctx.fillStyle = 'yellow';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Zombies
    zombies.forEach(z => {
        ctx.fillStyle = z.color;
        ctx.fillRect(z.x - z.size / 2, z.y - z.size / 2, z.size, z.size);
        if (z.type === 'explosive') {
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(z.x, z.y, z.size / 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw Boss
    if (boss) {
        // Boss body
        ctx.fillStyle = 'purple';
        ctx.fillRect(boss.x - boss.size / 2, boss.y - boss.size / 2, boss.size, boss.size);
        
        // Boss HP bar
        const hpBarWidth = boss.size * 1.5;
        ctx.fillStyle = 'red';
        ctx.fillRect(boss.x - hpBarWidth / 2, boss.y - boss.size / 2 - 15, hpBarWidth, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(boss.x - hpBarWidth / 2, boss.y - boss.size / 2 - 15, hpBarWidth * (boss.hp / boss.maxHp), 10);
    }
}

// --- Main Game Loop ---
function gameLoop() {
    // Stop loop if paused or game is over
    if (isGamePaused || isGameOver) {
        return;
    }

    // Run game logic
    update();
    draw();
    updateCooldownUI(); // Update cooldown timers every frame
    
    // Randomly try to spawn a zombie
    if (Math.random() < 0.02) { // Adjust spawn rate
        spawnZombie();
    }

    // Request the next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}