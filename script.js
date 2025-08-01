// --------------------------------------------------
// 1. 상수 선언
// --------------------------------------------------
const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Sleeping } = Matter;
const WIDTH = 570, HEIGHT = 700, WALL_THICKNESS = 20, GAME_OVER_LINE = 100;
const DROP_SOUND_URL = 'music/drop.mp3', MERGE_SOUND_URL = 'music/pop.mp3';
const FRUITS_DATA = [
    { level: 0, radius: 20, score: 1, imgSrc: 'img/00_cherry.png' }, { level: 1, radius: 25, score: 3, imgSrc: 'img/01_strawberry.png' }, { level: 2, radius: 35, score: 6, imgSrc: 'img/02_grape.png' }, { level: 3, radius: 40, score: 10, imgSrc: 'img/03_gyool.png' }, { level: 4, radius: 50, score: 15, imgSrc: 'img/04_orange.png' }, { level: 5, radius: 60, score: 21, imgSrc: 'img/05_apple.png' }, { level: 6, radius: 70, score: 28, imgSrc: 'img/06_pear.png' }, { level: 7, radius: 80, score: 36, imgSrc: 'img/07_peach.png' }, { level: 8, radius: 90, score: 45, imgSrc: 'img/08_pineapple.png' }, { level: 9, radius: 100, score: 55, imgSrc: 'img/09_melon.png' }, { level: 10, radius: 110, score: 66, imgSrc: 'img/10_watermelon.png' },
];

// --------------------------------------------------
// 2. 게임 클래스 정의
// --------------------------------------------------
class SuikaGame {
    constructor() {
        this.wrapper = document.getElementById('game-wrapper');
        this.container = document.getElementById('game-container');
        this.canvasContainer = document.getElementById('canvas-container');
        this.canvas = document.getElementById('game-canvas');
        this.scoreElement = document.getElementById('score');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.restartButton = document.getElementById('restart-button');
        this.bgm = document.getElementById('bgm');
        this.muteButton = document.getElementById('mute-button');
        
        this.engine = null; this.world = null; this.render = null; this.runner = null;
        this.score = 0; this.currentFruit = null; this.disableAction = false;
        this.gameOver = false; this.isMusicStarted = false; this.scale = 1;
        this.loadedImages = [];
    }

    init() {
        let loadedCount = 0;
        FRUITS_DATA.forEach((fruit, index) => {
            const img = new Image();
            img.src = fruit.imgSrc;
            img.onload = () => { loadedCount++; if (loadedCount === FRUITS_DATA.length) this._startGame(); };
            img.onerror = () => { console.error(`이미지 로딩 실패: ${fruit.imgSrc}`); loadedCount++; if (loadedCount === FRUITS_DATA.length) this._startGame(); };
            this.loadedImages[index] = img;
        });
    }
    
    _startGame() {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.render = Render.create({ canvas: this.canvas, engine: this.engine, options: { width: WIDTH, height: HEIGHT, wireframes: false, background: 'transparent' } });
        this.runner = Runner.create();
        
        const wallOptions = {
            isStatic: true,
            render: {
                fillStyle: '#a2b9d1'
            }
        };

        World.add(this.world, [
            Bodies.rectangle(WIDTH / 2, HEIGHT - (WALL_THICKNESS / 2), WIDTH, WALL_THICKNESS, wallOptions),
            Bodies.rectangle(WALL_THICKNESS / 2, HEIGHT / 2, WALL_THICKNESS, HEIGHT, wallOptions),
            Bodies.rectangle(WIDTH - (WALL_THICKNESS / 2), HEIGHT / 2, WALL_THICKNESS, HEIGHT, wallOptions),
        ]);

        Render.run(this.render);
        Runner.run(this.runner, this.engine);
        
        this._addEventListeners();
        this._addNewIndicatorFruit();
        this._resizeGame();
    }

    _restartGame() {
        Runner.stop(this.runner);
        Render.stop(this.render);
        World.clear(this.world);
        Engine.clear(this.engine);
        this.score = 0;
        this.gameOver = false;
        this.disableAction = false;
        this.currentFruit = null;
        this._updateScore();
        this.gameOverScreen.style.display = 'none';
        this._startGame();
    }

    _addEventListeners() {
        window.onresize = () => this._resizeGame();
        this.restartButton.onclick = () => this._restartGame();
        this.muteButton.onclick = () => {
            this.bgm.muted = !this.bgm.muted;
            this.muteButton.textContent = this.bgm.muted ? '🔇' : '🎵';
        };
        
        const handleMove = (event) => {
            if (!this.currentFruit || !this.currentFruit.isSleeping || this.gameOver) return;
            const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX;
            const canvasBounds = this.canvasContainer.getBoundingClientRect();
            const correctedX = (clientX - canvasBounds.left) / this.scale;
            
            const fruitData = FRUITS_DATA[this.currentFruit.level];
            const newX = Math.max(
                WALL_THICKNESS + fruitData.radius, 
                Math.min(correctedX, WIDTH - WALL_THICKNESS - fruitData.radius)
            );
            Body.setPosition(this.currentFruit, { x: newX, y: this.currentFruit.position.y });
        };
        
        this.canvasContainer.onclick = () => { if (!this.gameOver) this._dropCurrentFruit(); };
        this.canvasContainer.onmousemove = handleMove;
        this.canvasContainer.ontouchstart = (e) => e.preventDefault();
        this.canvasContainer.ontouchmove = (e) => { e.preventDefault(); handleMove(e); };

        Events.on(this.engine, 'collisionStart', (event) => this._handleCollision(event));
        Events.on(this.engine, 'beforeUpdate', () => this._checkGameOver());
        Events.on(this.render, 'afterRender', () => this._drawCustomElements());
    }
    
    _resizeGame() {
        const availableHeight = window.innerHeight * 0.95;
        const availableWidth = window.innerWidth * 0.95;
        const scale = Math.min(
            availableWidth / this.container.offsetWidth, 
            availableHeight / this.container.offsetHeight
        );
        this.scale = scale;
        this.wrapper.style.transform = `scale(${scale})`;
    }

    _handleCollision(event) {
        event.pairs.forEach((pair) => {
            const { bodyA, bodyB } = pair;
            if (bodyA.label === 'fruit' && bodyB.label === 'fruit' && bodyA.level === bodyB.level) {
                const currentLevel = bodyA.level;
                if (currentLevel >= FRUITS_DATA.length - 1 || !this.world.bodies.includes(bodyA) || !this.world.bodies.includes(bodyB)) return;
                
                this._playSoundEffect(MERGE_SOUND_URL);
                const midX = (bodyA.position.x + bodyB.position.x) / 2;
                const midY = (bodyA.position.y + bodyB.position.y) / 2;
                World.remove(this.world, [bodyA, bodyB]);
                
                this.score += FRUITS_DATA[currentLevel].score;
                this._updateScore();

                setTimeout(() => {
                    const newFruit = this._createFruitBody(midX, midY, currentLevel + 1, false);
                    World.add(this.world, newFruit);
                }, 50);
            }
        });
    }

    _checkGameOver() {
        if (this.gameOver) return;
        for (const body of Composite.allBodies(this.world)) {
            if (body.label === 'fruit' && body.position.y - body.circleRadius < GAME_OVER_LINE) {
                body.framesAboveLine = (body.framesAboveLine || 0) + 1;
                if (body.framesAboveLine > 60 * 1.5) { this._endGame(); return; }
            } else if (body.framesAboveLine) {
                body.framesAboveLine = 0;
            }
        }
    }

    _drawCustomElements() {
        const context = this.render.context;
        Composite.allBodies(this.world).forEach(body => {
            if (body.label.startsWith('fruit')) {
                const img = this.loadedImages[body.level];
                if (img && img.complete) {
                    const { x, y } = body.position;
                    const angle = body.angle;
                    const radius = body.circleRadius;
                    context.save();
                    context.translate(x, y);
                    context.rotate(angle);
                    context.drawImage(img, -radius, -radius, radius * 2, radius * 2);
                    context.restore();
                }
            }
        });
        context.beginPath();
        context.moveTo(WALL_THICKNESS, GAME_OVER_LINE);
        context.lineTo(WIDTH - WALL_THICKNESS, GAME_OVER_LINE);
        context.strokeStyle = 'rgba(165, 42, 42, 0.8)';
        context.lineWidth = 4;
        context.setLineDash([10, 10]);
        context.stroke();
        context.setLineDash([]);
    }

    _createFruitBody(x, y, level, isSleeping) {
        const fruitData = FRUITS_DATA[level];
        // ====== [핵심 수정] 과일의 기본 배경색을 다시 투명하게 만듭니다 ======
        return Bodies.circle(x, y, fruitData.radius, {
            isSleeping,
            label: isSleeping ? 'fruit_indicator' : 'fruit',
            level,
            restitution: 0.2,
            friction: 0.5,
            render: {
                visible: false // Matter.js의 기본 그리기를 끔
            }
        });
    }
    
    _addNewIndicatorFruit() {
        const level = Math.floor(Math.random() * 5);
        this.currentFruit = this._createFruitBody(WIDTH / 2, 50, level, true);
        World.add(this.world, this.currentFruit);
    }

    _dropCurrentFruit() {
        if (!this.currentFruit || this.disableAction) return;
        if (!this.isMusicStarted) {
            this.bgm.volume = 0.2;
            this.bgm.play().catch(e => console.error("BGM 재생 실패", e));
            this.isMusicStarted = true;
            this.muteButton.textContent = '🎵';
        }
        this._playSoundEffect(DROP_SOUND_URL);
        this.disableAction = true;
        Sleeping.set(this.currentFruit, false);
        this.currentFruit.label = 'fruit';
        this.currentFruit = null;
        setTimeout(() => {
            this._addNewIndicatorFruit();
            this.disableAction = false;
        }, 600);
    }
    
    _playSoundEffect(url) {
        const sound = new Audio(url);
        sound.volume = 0.4;
        sound.play().catch(e => console.error("효과음 재생 실패", e));
    }

    _updateScore() {
        this.scoreElement.innerText = `점수: ${this.score}`;
    }

    _endGame() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.gameOverScreen.style.display = 'flex';
        Runner.stop(this.runner);
    }
}

// --------------------------------------------------
// 3. 게임 인스턴스 생성 및 시작
// --------------------------------------------------
window.onload = () => {
    const game = new SuikaGame();
    game.init();
};