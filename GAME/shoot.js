// ==========================================
// [파트 A] DOM 선택 및 게임 환경 설정 변수
// ==========================================
const container = document.getElementById('game-container');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const ammoDisplay = document.getElementById('ammo-display');
const gameOverScreen = document.getElementById('game-over');
const finalScoreDisplay = document.getElementById('final-score');
const rankingList = document.getElementById('ranking-list');

const CONTAINER_WIDTH = 400;
const CONTAINER_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_SPEED = 6;

const MAX_AMMO = 5;
let currentAmmo = MAX_AMMO;
let isReloading = false;
const RELOAD_TIME = 1200; 

// [실시간 난이도 및 보스 레이드 플래그 변수]
let gameStartTime = 0;       
let currentDifficultyLevel = 1; 
let baseEnemySpawnTime = 900; 
let speedMultiplier = 1.0;    
let isBossSpawned = false;     // 보스 등장 유무 판정 플래그
let bossObject = null;         // 보스 데이터 인스턴스

let playerX = 180; 
let score = 0;
let isGameOver = false;
let keys = {}; 

let bullets = [];       
let enemies = [];       
let enemyBullets = [];  

let gameLoopId;
let enemySpawnId;
let enemyShootId;       

// ==========================================
// [파트 A] 입력 및 사격 제어 로직
// ==========================================
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); 
        if (!isGameOver) fireBullet();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function fireBullet() {
    if (isReloading) return; 

    if (currentAmmo > 0) {
        currentAmmo--;
        updateAmmoUI();

        const bullet = document.createElement('div');
        bullet.classList.add('bullet');
        const bulletX = playerX + (PLAYER_WIDTH / 2) - 2;
        const bulletY = 540; 
        
        bullet.style.left = bulletX + 'px';
        bullet.style.top = bulletY + 'px';
        container.appendChild(bullet);

        bullets.push({ element: bullet, x: bulletX, y: bulletY });

        if (currentAmmo === 0) {
            startReload();
        }
    }
}

function startReload() {
    isReloading = true;
    ammoDisplay.textContent = "RELOAD...";
    ammoDisplay.classList.add('reloading');

    setTimeout(() => {
        if (isGameOver) return;
        currentAmmo = MAX_AMMO;
        isReloading = false;
        ammoDisplay.classList.remove('reloading');
        updateAmmoUI();
    }, RELOAD_TIME);
}

function updateAmmoUI() {
    if (!isReloading) {
        ammoDisplay.textContent = `${currentAmmo} / ${MAX_AMMO}`;
    }
}

// ==========================================
// [파트 B] 오브젝트 스폰 및 패턴 제어 로직
// ==========================================

function checkDifficulty() {
    if (isGameOver || isBossSpawned) return;

    // 💡 핵심 수정: 점수가 500점 이상이 되면 즉시 보스 소환 루틴 발동
    if (score >= 500) {
        spawnBoss();
        return;
    }

    const elapsedTime = (Date.now() - gameStartTime) / 1000;
    let newLevel = Math.floor(elapsedTime / 25) + 1; // 25초마다 난이도 상승
    if (newLevel > 4) newLevel = 4;

    if (newLevel !== currentDifficultyLevel) {
        currentDifficultyLevel = newLevel;
        if (currentDifficultyLevel === 2) { baseEnemySpawnTime = 700; speedMultiplier = 1.15; }
        else if (currentDifficultyLevel === 3) { baseEnemySpawnTime = 550; speedMultiplier = 1.3; }
        else if (currentDifficultyLevel === 4) { baseEnemySpawnTime = 450; speedMultiplier = 1.5; }

        clearInterval(enemySpawnId);
        enemySpawnId = setInterval(spawnEnemy, baseEnemySpawnTime);
    }
}

// 6가지 적 유형 스폰 분기 처리 시스템
function spawnEnemy() {
    if (isGameOver || isBossSpawned) return;
    
    checkDifficulty();
    if (isBossSpawned) return; // 보스가 나왔다면 일반 적 생성을 완전히 차단

    const enemy = document.createElement('div');
    const rand = Math.random();
    
    let type = 'normal';
    let width = 35, height = 35, hp = 1, speedY = (Math.random() * 2 + 2) * speedMultiplier;
    let speedX = 0; // 지그재그 전용

    if (currentDifficultyLevel >= 3 && rand < 0.15) {
        type = 'tanker'; 
        enemy.classList.add('enemy-tanker');
        width = 70; height = 70; hp = 4; speedY = 1.0;
    } else if (currentDifficultyLevel >= 2 && rand >= 0.15 && rand < 0.35) {
        type = 'zigzag'; 
        enemy.classList.add('enemy-zigzag');
        width = 30; height = 30; speedY = 3.5;
        speedX = Math.random() < 0.5 ? -3 : 3; 
    } else if (rand >= 0.35 && rand < 0.55) {
        type = 'cluster'; 
        enemy.classList.add('enemy-cluster');
        width = 36; height = 36; speedY = 2.2 * speedMultiplier;
    } else if (rand >= 0.55 && rand < 0.75) {
        type = 'shooter'; 
        enemy.classList.add('enemy-shooter');
        speedY = 1.5 * speedMultiplier;
    } else {
        type = 'normal'; 
        enemy.classList.add('enemy');
    }
    
    const enemyX = Math.floor(Math.random() * (CONTAINER_WIDTH - width));
    enemy.style.left = enemyX + 'px';
    enemy.style.top = '0px';
    container.appendChild(enemy);

    enemies.push({ element: enemy, x: enemyX, y: 0, width, height, type, speedY, speedX, hp });
}

// ④ 최종 보스(Boss) 기체 소환 엔진
function spawnBoss() {
    if (isBossSpawned) return;
    isBossSpawned = true;
    
    clearInterval(enemySpawnId); // 일반 적 스폰 타이머 완전 중지

    const bossEl = document.createElement('div');
    bossEl.classList.add('enemy-boss');
    
    // 💡 안전장치 추가: CSS에 .enemy-boss 설정이 누락되어도 강제로 보이도록 인라인 스타일 부여
    bossEl.style.position = 'absolute';
    bossEl.style.width = '160px';
    bossEl.style.height = '60px';
    bossEl.style.backgroundColor = '#ff3333'; // 눈에 띄는 빨간색 보스 상자 기본값
    bossEl.style.borderRadius = '10px';
    bossEl.style.boxShadow = '0 0 15px #ff0000';
    bossEl.style.left = '120px'; 
    bossEl.style.top = '-70px'; 
    
    container.appendChild(bossEl);

    bossObject = {
        element: bossEl,
        x: 120,
        y: -70,
        width: 160,
        height: 60,
        type: 'boss',
        hp: 35,             // 보스 체력 35발
        maxHp: 35,
        speedX: 2,          // 좌우 이동 속도
        moveTimer: 0
    };
    enemies.push(bossObject);
}

// 사격 패턴 실행
function enemyShoot() {
    if (isGameOver) return;

    enemies.forEach(e => {
        if (e.type === 'shooter' && e.y < CONTAINER_HEIGHT - 120) {
            createEnemyBullet(e.x + e.width/2 - 3, e.y + e.height, 0, 5 * speedMultiplier);
        } 
        else if (e.type === 'boss' && e.y >= 50) {
            // 보스 탄막 패턴
            createEnemyBullet(e.x + 20, e.y + e.height, -1.5, 4); 
            createEnemyBullet(e.x + e.width/2 - 3, e.y + e.height, 0, 4.5); 
            createEnemyBullet(e.x + e.width - 20, e.y + e.height, 1.5, 4); 
        }
    });
}

function createEnemyBullet(x, y, speedX, speedY) {
    const eb = document.createElement('div');
    eb.classList.add('enemy-bullet');
    eb.style.left = x + 'px';
    eb.style.top = y + 'px';
    container.appendChild(eb);
    enemyBullets.push({ element: eb, x, y, width: 6, height: 12, speedX, speedY });
}

// ==========================================
// [파트 B] 물리 연산 및 메인 게임 루프 엔진
// ==========================================
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function update() {
    if (isGameOver) return;

    // 1. 플레이어 이동
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        playerX -= PLAYER_SPEED; if (playerX < 0) playerX = 0;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        playerX += PLAYER_SPEED; if (playerX > CONTAINER_WIDTH - PLAYER_WIDTH) playerX = CONTAINER_WIDTH - PLAYER_WIDTH;
    }
    player.style.left = playerX + 'px';

    // 2. 아군 미사일 이동
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.y -= 8; b.element.style.top = b.y + 'px';
        if (b.y < 0) { b.element.remove(); bullets.splice(i, 1); }
    }

    // 3. 적군 미사일 이동
    const playerRect = { x: playerX, y: 540, width: PLAYER_WIDTH, height: 40 };
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];
        eb.x += eb.speedX || 0;
        eb.y += eb.speedY;
        eb.element.style.left = eb.x + 'px';
        eb.element.style.top = eb.y + 'px';

        if (checkCollision(playerRect, eb)) { endGame(false); return; } 
        if (eb.y > CONTAINER_HEIGHT || eb.x < 0 || eb.x > CONTAINER_WIDTH) {
            eb.element.remove(); enemyBullets.splice(i, 1);
        }
    }

    // 4. 적 개체 패턴 연산
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        if (e.type === 'zigzag') {
            e.x += e.speedX;
            if (e.x <= 0 || e.x >= CONTAINER_WIDTH - e.width) { e.speedX = -e.speedX; }
            e.element.style.left = e.x + 'px';
        } 
        else if (e.type === 'boss') {
            if (e.y < 60) { e.y += 1; } // 60px 좌표까지 서서히 내려옴
            else {
                e.x += e.speedX;
                if (e.x <= 10 || e.x >= CONTAINER_WIDTH - e.width - 10) { e.speedX = -e.speedX; }
                e.element.style.left = e.x + 'px';
            }
        }
        
        if (e.type !== 'boss' || e.y < 60) {
            e.y += e.speedY;
            e.element.style.top = e.y + 'px';
        }

        const enemyRect = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (checkCollision(playerRect, enemyRect)) { endGame(false); return; }

        // 미사일 충돌 연산
        for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            const bulletRect = { x: b.x, y: b.y, width: 4, height: 15 };

            if (checkCollision(bulletRect, enemyRect)) {
                b.element.remove();
                bullets.splice(j, 1);
                
                e.hp--; 

                if (e.hp > 0) continue; 

                // 완전히 파괴되었을 때
                e.element.remove();
                enemies.splice(i, 1);

                if (e.type === 'cluster') {
                    createSplitEnemy(e.x, e.y, -1.5, 3.5);
                    createSplitEnemy(e.x + 15, e.y, 1.5, 3.5);
                    score += 15;
                } else if (e.type === 'boss') {
                    score += 500;
                    endGame(true); 
                    return;
                } else {
                    score += (e.type === 'tanker') ? 40 : ((e.type === 'shooter') ? 20 : 10);
                }
                
                scoreDisplay.textContent = score;

                // 💡 점수 획득 시 실시간 난이도 및 보스 등장 검사 강제 트리거!
                checkDifficulty(); 
                
                break;
            }
        }

        if (e.y > CONTAINER_HEIGHT && e.type !== 'boss') {
            e.element.remove(); enemies.splice(i, 1);
        }
    }

    gameLoopId = requestAnimationFrame(update);
}

function createSplitEnemy(x, y, speedX, speedY) {
    const sub = document.createElement('div');
    sub.classList.add('enemy'); 
    sub.style.width = '20px';
    sub.style.height = '20px';
    sub.style.left = x + 'px';
    sub.style.top = y + 'px';
    container.appendChild(sub);

    enemies.push({ element: sub, x, y, width: 20, height: 20, type: 'zigzag', speedY, speedX, hp: 1 });
}

// ==========================================
// [파트 B] 게임엔딩 및 리셋 시스템
// ==========================================
function updateRanking(finalScore) {
    let rankings = JSON.parse(localStorage.getItem('shooting_rankings')) || [];
    const dateStr = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const newRecord = { score: finalScore, date: dateStr, id: Date.now() };
    
    rankings.push(newRecord);
    rankings.sort((a, b) => b.score - a.score);
    rankings = rankings.slice(0, 5);            
    localStorage.setItem('shooting_rankings', JSON.stringify(rankings));
    
    rankingList.innerHTML = '';
    rankings.forEach((rank, index) => {
        const item = document.createElement('div');
        item.classList.add('ranking-item');
        if (rank.id === newRecord.id) item.classList.add('current'); 
        item.innerHTML = `<span>${index + 1}위. ${rank.score}점</span> <span>${rank.date}</span>`;
        rankingList.appendChild(item);
    });
}

function endGame(isClear = false) {
    isGameOver = true;
    cancelAnimationFrame(gameLoopId);
    clearInterval(enemySpawnId);
    clearInterval(enemyShootId);
    
    if (isClear) {
        gameOverScreen.classList.add('clear');
        gameOverScreen.querySelector('h2').textContent = "🏆 MISSION CLEAR 🏆";
    } else {
        gameOverScreen.classList.remove('clear');
        gameOverScreen.querySelector('h2').textContent = "GAME OVER";
    }

    finalScoreDisplay.textContent = `최종 점수: ${score} 점`;
    updateRanking(score); 
    gameOverScreen.style.display = 'flex';
}

function resetGame() {
    bullets.forEach(b => b.element.remove());
    enemies.forEach(e => e.element.remove());
    enemyBullets.forEach(eb => eb.element.remove());
    bullets = []; enemies = []; enemyBullets = [];
    
    currentAmmo = MAX_AMMO;
    isReloading = false;
    ammoDisplay.classList.remove('reloading');
    updateAmmoUI();

    gameStartTime = Date.now();
    currentDifficultyLevel = 1;
    baseEnemySpawnTime = 900;
    speedMultiplier = 1.0;
    isBossSpawned = false;
    bossObject = null;

    score = 0; playerX = 180; isGameOver = false;
    scoreDisplay.textContent = score; 
    gameOverScreen.style.display = 'none';
    player.style.left = playerX + 'px';

    cancelAnimationFrame(gameLoopId);
    clearInterval(enemySpawnId);
    clearInterval(enemyShootId);

    gameLoopId = requestAnimationFrame(update);
    enemySpawnId = setInterval(spawnEnemy, baseEnemySpawnTime);     
    enemyShootId = setInterval(enemyShoot, 1400); 
}

resetGame();