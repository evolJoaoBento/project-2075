import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DiceSettings } from './settings';

export class D20Dice {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private dice: THREE.Mesh;
    private diceBody: CANNON.Body;
    private world: CANNON.World;
    private isRolling = false;
    private container: HTMLElement;
    private animationId: number | null = null;
    private rollTimeout: NodeJS.Timeout | null = null;
    private isDragging = false;
    private dragStartPosition = { x: 0, y: 0 };
    private mouse = new THREE.Vector2();
    private raycaster = new THREE.Raycaster();
    private lastMousePosition = { x: 0, y: 0, time: 0 };
    private mouseVelocity = { x: 0, y: 0 };
    private diceGeometry: THREE.IcosahedronGeometry;
    private faceNumbers: number[] = [];
    private settings: DiceSettings;
    private trayMesh: THREE.Mesh | null = null;
    private windowBorder: HTMLElement | null = null;
    public onRollComplete: ((result: number) => void) | null = null;

    constructor(container: HTMLElement, settings: DiceSettings) {
        this.container = container;
        this.settings = settings;
        this.init();
    }

    private init() {
        try {
            // Initialize Three.js scene with transparent background
            this.scene = new THREE.Scene();
            // No background color - will be transparent

            // Setup orthographic camera - will be properly sized in updateSize
            const aspect = window.innerWidth / (window.innerHeight - 44);
            const frustumSize = 20;
            this.camera = new THREE.OrthographicCamera(
                -frustumSize * aspect / 2, frustumSize * aspect / 2,
                frustumSize / 2, -frustumSize / 2,
                0.1, 1000
            );
            this.camera.position.set(0, 20, 0);
            this.camera.lookAt(0, -2, 0);
            this.camera.up.set(0, 0, -1);

            // Setup renderer to fill container
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: false,
                powerPreference: "high-performance"
            });
            // Initial size - will be updated by updateSize call
            this.renderer.shadowMap.enabled = false; // No shadow maps

            // Add WebGL context loss/restore handlers
            const canvas = this.renderer.domElement;
            canvas.addEventListener('webglcontextlost', (event) => {
                console.warn('WebGL context lost, attempting to prevent default');
                event.preventDefault();
            });

            canvas.addEventListener('webglcontextrestored', () => {
                console.log('WebGL context restored, reinitializing scene');
                this.reinitializeAfterContextLoss();
            });

            this.container.appendChild(canvas);

            // Create window border if enabled
            this.createWindowBorder();

            // Set initial size to fill container
            this.setInitialSize();

            // Setup drag controls
            this.setupDragControls();

            // Initialize physics world
            this.initPhysics();

            // Create dice and tray
            this.createDiceTray();
            this.createDice();
            this.setupLighting();

            this.animate();
        } catch (error) {
            console.error('Failed to initialize D20 dice:', error);
            this.container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">3D rendering not available</div>';
        }
    }

    private initPhysics() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -15, 0); // Normal gravity
        this.world.broadphase = new CANNON.NaiveBroadphase();
    }

    private createDiceTray() {
        // Create visual tray based on settings
        if (this.settings.showSurface) {
            const trayGeometry = new THREE.BoxGeometry(21.6, 0.8, 16);
            const trayMaterial = new THREE.MeshPhongMaterial({
                color: this.settings.surfaceColor,
                transparent: this.settings.surfaceOpacity < 1,
                opacity: this.settings.surfaceOpacity
            });
            this.trayMesh = new THREE.Mesh(trayGeometry, trayMaterial);
            this.trayMesh.position.set(0, -2, 0);
            this.scene.add(this.trayMesh);

            // Add border if enabled (using tray's own border settings)
            if (this.settings.surfaceBorderWidth > 0 && this.settings.surfaceBorderOpacity > 0) {
                const borderGeometry = new THREE.EdgesGeometry(trayGeometry);
                const borderMaterial = new THREE.LineBasicMaterial({
                    color: this.settings.surfaceBorderColor,
                    transparent: this.settings.surfaceBorderOpacity < 1,
                    opacity: this.settings.surfaceBorderOpacity,
                    linewidth: this.settings.surfaceBorderWidth
                });
                const borderLines = new THREE.LineSegments(borderGeometry, borderMaterial);
                borderLines.position.copy(this.trayMesh.position);
                this.scene.add(borderLines);
            }
        }

        // Physics tray floor
        const floorMaterial = new CANNON.Material('floor');
        floorMaterial.restitution = 0.1;  // Less bouncy for better settling
        floorMaterial.friction = 1.0;      // Maximum friction to stop sliding

        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, material: floorMaterial });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        floorBody.position.set(0, -2.4, 0);
        this.world.addBody(floorBody);

        // Physics tray walls - 10% smaller horizontally
        const wallMaterial = new CANNON.Material('wall');
        wallMaterial.restitution = 0.1;  // Less bouncy walls too
        wallMaterial.friction = 0.9;  // High friction on walls

        // Left wall
        const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.2, 2, 8));
        const leftWall = new CANNON.Body({ mass: 0, material: wallMaterial });
        leftWall.addShape(leftWallShape);
        leftWall.position.set(-10.8, 0, 0);
        this.world.addBody(leftWall);

        // Right wall
        const rightWallShape = new CANNON.Box(new CANNON.Vec3(0.2, 2, 8));
        const rightWall = new CANNON.Body({ mass: 0, material: wallMaterial });
        rightWall.addShape(rightWallShape);
        rightWall.position.set(10.8, 0, 0);
        this.world.addBody(rightWall);

        // Front wall
        const frontWallShape = new CANNON.Box(new CANNON.Vec3(10.8, 2, 0.2));
        const frontWall = new CANNON.Body({ mass: 0, material: wallMaterial });
        frontWall.addShape(frontWallShape);
        frontWall.position.set(0, 0, 8);
        this.world.addBody(frontWall);

        // Back wall
        const backWallShape = new CANNON.Box(new CANNON.Vec3(10.8, 2, 0.2));
        const backWall = new CANNON.Body({ mass: 0, material: wallMaterial });
        backWall.addShape(backWallShape);
        backWall.position.set(0, 0, -8);
        this.world.addBody(backWall);
    }

    private createDice() {
        // Create geometry based on dice type
        this.diceGeometry = this.createDiceGeometry();

        // Create a basic fallback material first
        const fallbackMaterial = new THREE.MeshPhongMaterial({
            color: this.settings.diceColor,
            shininess: 100,
            specular: 0x222222
        });

        this.dice = new THREE.Mesh(this.diceGeometry, fallbackMaterial);

        // Ensure dice is visible by making it reasonably sized
        console.log(`Creating dice with size: ${this.settings.diceSize}, type: ${this.settings.diceType}`);
        this.dice.castShadow = false; // No shadows
        this.dice.receiveShadow = false; // No shadows
        this.dice.position.set(0, 2, 0);
        this.scene.add(this.dice);

        // Initialize face numbers for d20 (1-20 mapped to faces)
        this.initializeFaceNumbers();

        // Physics dice body
        const diceMaterial = new CANNON.Material('dice');
        diceMaterial.restitution = 0.2;  // Less bouncy dice
        diceMaterial.friction = 0.9;      // High friction for better settling

        const diceShape = new CANNON.Sphere(this.settings.diceSize);
        this.diceBody = new CANNON.Body({
            mass: 1,
            material: diceMaterial,
            linearDamping: 0.4,  // Higher damping for faster settling
            angularDamping: 0.5  // Even higher angular damping to stop rotation
        });
        this.diceBody.addShape(diceShape);
        this.diceBody.position.set(0, 2, 0);

        this.world.addBody(this.diceBody);

        this.addDiceTextures();
    }

    private createDiceGeometry(): THREE.BufferGeometry {
        switch (this.settings.diceType) {
            case 'd4':
                return new THREE.TetrahedronGeometry(this.settings.diceSize, 0);
            case 'd6':
                return new THREE.BoxGeometry(this.settings.diceSize * 2, this.settings.diceSize * 2, this.settings.diceSize * 2);
            case 'd8':
                return new THREE.OctahedronGeometry(this.settings.diceSize, 0);
            case 'd10':
            case 'd100':
                return new THREE.ConeGeometry(this.settings.diceSize, this.settings.diceSize * 2, 10, 1);
            case 'd12':
                return new THREE.DodecahedronGeometry(this.settings.diceSize, 0);
            case 'd20':
            default:
                const geometry = new THREE.IcosahedronGeometry(this.settings.diceSize, 0);
                this.applyCustomD20UVMapping(geometry);
                return geometry;
        }
    }

    private applyCustomD20UVMapping(geometry: THREE.BufferGeometry): void {
        // IcosahedronGeometry uses indexed geometry, so we need to convert it to non-indexed
        // to give each face its own unique UV coordinates

        // First, convert to non-indexed geometry so each face has its own vertices
        const nonIndexedGeometry = geometry.toNonIndexed();

        // Copy the non-indexed attributes back to the original geometry
        geometry.attributes = nonIndexedGeometry.attributes;
        geometry.index = null;

        console.log('Converted to non-indexed geometry:', {
            positionCount: geometry.attributes.position.count,
            uvCount: geometry.attributes.uv.count,
            facesCount: geometry.attributes.position.count / 3
        });

        const uvAttribute = geometry.attributes.uv;
        const uvArray = uvAttribute.array as Float32Array;

        // Define UV mapping based on icosahedral net layout
        // This matches the actual geometric structure of an icosahedron

        // Define UV layout in a simple 5x4 grid to prevent intersections
        // Each triangle gets its own cell with padding
        const cols = 5;
        const rows = 4;
        const cellWidth = 1.0 / cols;
        const cellHeight = 1.0 / rows;
        const padding = 0.02; // Small padding between triangles

        for (let faceIndex = 0; faceIndex < 20; faceIndex++) {
            // Calculate grid position
            const col = faceIndex % cols;
            const row = Math.floor(faceIndex / cols);

            // Calculate cell bounds with padding
            const cellLeft = col * cellWidth + padding;
            const cellRight = (col + 1) * cellWidth - padding;
            const cellTop = row * cellHeight + padding;
            const cellBottom = (row + 1) * cellHeight - padding;

            // Calculate cell center and size
            const cellCenterX = (cellLeft + cellRight) / 2;
            const cellCenterY = (cellTop + cellBottom) / 2;
            const cellW = cellRight - cellLeft;
            const cellH = cellBottom - cellTop;

            // Create equilateral triangle that fits within the cell
            const triangleHeight = Math.min(cellH, cellW * Math.sqrt(3) / 2);
            const triangleWidth = triangleHeight * 2 / Math.sqrt(3);

            // All triangles point up for consistency
            const v1 = {
                x: cellCenterX,
                y: cellTop
            };

            const v2 = {
                x: cellCenterX - triangleWidth / 2,
                y: cellTop + triangleHeight
            };

            const v3 = {
                x: cellCenterX + triangleWidth / 2,
                y: cellTop + triangleHeight
            };

            // Ensure triangles don't exceed cell boundaries
            const vertices = [v1, v2, v3];
            vertices.forEach(v => {
                v.x = Math.max(cellLeft, Math.min(cellRight, v.x));
                v.y = Math.max(cellTop, Math.min(cellBottom, v.y));
            });

            // Set UV coordinates for the three vertices of this face
            const vertexOffset = faceIndex * 3;

            // First vertex UVs
            uvArray[(vertexOffset * 2)] = v1.x;
            uvArray[(vertexOffset * 2) + 1] = 1.0 - v1.y;

            // Second vertex UVs
            uvArray[(vertexOffset * 2) + 2] = v2.x;
            uvArray[(vertexOffset * 2) + 3] = 1.0 - v2.y;

            // Third vertex UVs
            uvArray[(vertexOffset * 2) + 4] = v3.x;
            uvArray[(vertexOffset * 2) + 5] = 1.0 - v3.y;
        }

        // Mark UV attribute as needing update
        uvAttribute.needsUpdate = true;

        console.log('Applied custom UV mapping with equilateral triangles for D20');
    }

    private initializeFaceNumbers() {
        // Simple 1-to-1 mapping since we're using Euler-based detection now
        // This array is no longer used for detection, only kept for compatibility
        this.faceNumbers = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            11, 12, 13, 14, 15, 16, 17, 18, 19, 20
        ];
    }

    private addDiceTextures() {
        if (!this.dice) return;

        const faceCount = this.getFaceCount();

        switch (this.settings.diceTextureMode) {
            case 'solid':
                // Simple solid color material
                this.dice.material = new THREE.MeshPhongMaterial({
                    color: this.settings.diceColor,
                    shininess: 100,
                    specular: 0x222222
                });
                console.log('Applied solid color material to dice', this.settings.diceColor);
                break;

            case 'custom':
                // Custom texture if available
                if (this.settings.customDiceTexture) {
                    const customTexture = this.loadCustomTexture();
                    if (customTexture) {
                        // Use a single material for all faces to reduce memory usage
                        const customMaterial = new THREE.MeshPhongMaterial({
                            color: 0xffffff,
                            map: customTexture,
                            shininess: 100,
                            specular: 0x222222
                        });
                        this.dice.material = customMaterial;
                        console.log(`Applied custom texture material to dice`);
                        break;
                    }
                }
                // Fall back to solid if no custom texture
                this.dice.material = new THREE.MeshPhongMaterial({
                    color: this.settings.diceColor,
                    shininess: 100,
                    specular: 0x222222
                });
                console.log('Custom texture failed, using solid color');
                break;

            default:
                // Fall back to solid color
                this.dice.material = new THREE.MeshPhongMaterial({
                    color: this.settings.diceColor,
                    shininess: 100,
                    specular: 0x222222
                });
                console.log('Using default solid color material');
                break;
        }
    }

    // Method to generate UV mapping template (for development/reference)
    public generateUVTemplate(): string {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        canvas.width = 512;
        canvas.height = 512;

        // D20 face colors and corresponding numbers
        const faceData = [
            { color: '#FF0000', number: 1 },   // Red
            { color: '#00FF00', number: 2 },   // Green
            { color: '#0000FF', number: 3 },   // Blue
            { color: '#FFFF00', number: 4 },   // Yellow
            { color: '#FF00FF', number: 5 },   // Magenta
            { color: '#00FFFF', number: 6 },   // Cyan
            { color: '#FFA500', number: 7 },   // Orange
            { color: '#800080', number: 8 },   // Purple
            { color: '#FFC0CB', number: 9 },   // Pink
            { color: '#A52A2A', number: 10 },  // Brown
            { color: '#808080', number: 11 },  // Gray
            { color: '#000000', number: 12 },  // Black
            { color: '#FFFFFF', number: 13 },  // White
            { color: '#90EE90', number: 14 },  // Light Green
            { color: '#FFB6C1', number: 15 },  // Light Pink
            { color: '#87CEEB', number: 16 },  // Sky Blue
            { color: '#DDA0DD', number: 17 },  // Plum
            { color: '#F0E68C', number: 18 },  // Khaki
            { color: '#20B2AA', number: 19 },  // Light Sea Green
            { color: '#DC143C', number: 20 }   // Crimson
        ];

        // Create a 4x5 grid layout for 20 faces
        const gridCols = 4;
        const gridRows = 5;
        const cellWidth = 512 / gridCols;
        const cellHeight = 512 / gridRows;

        // Fill background
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, 512, 512);

        // Draw each face
        for (let i = 0; i < 20; i++) {
            const row = Math.floor(i / gridCols);
            const col = i % gridCols;

            const x = col * cellWidth;
            const y = row * cellHeight;

            // Fill the cell with the face color
            ctx.fillStyle = faceData[i].color;
            ctx.fillRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);

            // Add face number
            ctx.fillStyle = faceData[i].color === '#000000' || faceData[i].color === '#800080' ? '#FFFFFF' : '#000000';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(faceData[i].number.toString(), x + cellWidth/2, y + cellHeight/2);

            // Add small border
            ctx.strokeStyle = '#CCCCCC';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellWidth, cellHeight);
        }

        // Add title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('D20 UV Mapping Template', 10, 25);

        return canvas.toDataURL('image/png');
    }

    // Method to log the color mapping for reference
    public logColorMapping(): void {
        const colorMapping = [
            { face: 1, color: '#FF0000', name: 'Red' },
            { face: 2, color: '#00FF00', name: 'Green' },
            { face: 3, color: '#0000FF', name: 'Blue' },
            { face: 4, color: '#FFFF00', name: 'Yellow' },
            { face: 5, color: '#FF00FF', name: 'Magenta' },
            { face: 6, color: '#00FFFF', name: 'Cyan' },
            { face: 7, color: '#FFA500', name: 'Orange' },
            { face: 8, color: '#800080', name: 'Purple' },
            { face: 9, color: '#FFC0CB', name: 'Pink' },
            { face: 10, color: '#A52A2A', name: 'Brown' },
            { face: 11, color: '#808080', name: 'Gray' },
            { face: 12, color: '#000000', name: 'Black' },
            { face: 13, color: '#FFFFFF', name: 'White' },
            { face: 14, color: '#90EE90', name: 'Light Green' },
            { face: 15, color: '#FFB6C1', name: 'Light Pink' },
            { face: 16, color: '#87CEEB', name: 'Sky Blue' },
            { face: 17, color: '#DDA0DD', name: 'Plum' },
            { face: 18, color: '#F0E68C', name: 'Khaki' },
            { face: 19, color: '#20B2AA', name: 'Light Sea Green' },
            { face: 20, color: '#DC143C', name: 'Crimson' }
        ];

        console.log('🎲 D20 Face-to-Color Mapping:');
        console.table(colorMapping);
    }

    private getFaceCount(): number {
        switch (this.settings.diceType) {
            case 'd4': return 4;
            case 'd6': return 6;
            case 'd8': return 8;
            case 'd10': return 10;
            case 'd12': return 12;
            case 'd20': return 20;
            case 'd100': return 10; // Cone approximation
            default: return 20;
        }
    }

    private loadCustomTexture(): THREE.Texture | null {
        if (!this.settings.customDiceTexture) return null;

        try {
            // Create image element to load the texture
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const texture = new THREE.Texture();
            texture.image = img;
            texture.wrapS = THREE.ClampToEdgeWrapping; // Use clamp for clean edges
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false; // Disable mipmaps to reduce memory usage

            // Load the image
            img.onload = () => {
                texture.needsUpdate = true;
                console.log('Custom texture loaded successfully');
            };

            img.onerror = (error) => {
                console.error('Failed to load custom texture image:', error);
            };

            img.src = this.settings.customDiceTexture;

            return texture;
        } catch (error) {
            console.error('Failed to load custom dice texture:', error);
            return null;
        }
    }


    private setupLighting() {
        // Bright ambient light only - no shadows
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);

        // Simple directional light without shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 35, 0);
        directionalLight.target.position.set(0, -2, 0);
        directionalLight.castShadow = false; // No shadows
        this.scene.add(directionalLight);
        this.scene.add(directionalLight.target);
    }

    private setupDragControls() {
        const canvas = this.renderer.domElement;

        // Set up mouse move for hover detection (always active)
        canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
        canvas.addEventListener('mousedown', (event) => this.onMouseDown(event));
        canvas.addEventListener('mouseup', (event) => this.onMouseUp(event));

        canvas.addEventListener('touchstart', (event) => this.onTouchStart(event));
        canvas.addEventListener('touchmove', (event) => this.onTouchMove(event));
        canvas.addEventListener('touchend', (event) => this.onTouchEnd(event));

        // Start with click-through enabled
        canvas.classList.remove('dice-interactive');
    }

    private updateMousePosition(clientX: number, clientY: number) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    private onMouseDown(event: MouseEvent) {
        this.updateMousePosition(event.clientX, event.clientY);
        this.dragStartPosition = { x: event.clientX, y: event.clientY };

        // Only handle the click if we clicked on the dice
        const didClickDice = this.checkDiceClick(event);

        if (!didClickDice) {
            // If not clicking on dice, don't prevent the event
            // Let it pass through to Obsidian
            return;
        }
    }

    private onTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
            this.updateMousePosition(event.touches[0].clientX, event.touches[0].clientY);
            this.dragStartPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };

            // Create a mock mouse event for dice checking
            const mockEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: event.touches[0].clientX,
                clientY: event.touches[0].clientY
            });

            const diceClicked = this.checkDiceClick(mockEvent);

            if (!diceClicked) {
                // Allow touch to pass through if not touching dice
                return;
            } else {
                event.preventDefault();
            }
        }
    }

    private onMouseMove(event: MouseEvent) {
        // Check if hovering over dice for cursor update
        this.updateMousePosition(event.clientX, event.clientY);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.dice, true); // Include children for better detection

        const canvas = this.renderer.domElement;

        if (intersects.length > 0 && !this.isDragging) {
            // Enable pointer events when hovering over dice
            canvas.classList.add('dice-interactive');
            canvas.style.cursor = 'grab';
        } else if (!this.isDragging) {
            // Disable pointer events when not hovering over dice
            canvas.classList.remove('dice-interactive');
            canvas.style.cursor = 'default';
        }

        if (this.isDragging) {
            // Calculate mouse velocity for momentum
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastMousePosition.time;

            if (deltaTime > 0) {
                this.mouseVelocity.x = (event.clientX - this.lastMousePosition.x) / deltaTime;
                this.mouseVelocity.y = (event.clientY - this.lastMousePosition.y) / deltaTime;
            }

            this.lastMousePosition = { x: event.clientX, y: event.clientY, time: currentTime };

            this.updateDicePosition();
            this.renderer.domElement.style.cursor = 'grabbing';
        }
    }

    private onTouchMove(event: TouchEvent) {
        if (this.isDragging && event.touches.length === 1) {
            // Calculate touch velocity for momentum
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastMousePosition.time;

            if (deltaTime > 0) {
                this.mouseVelocity.x = (event.touches[0].clientX - this.lastMousePosition.x) / deltaTime;
                this.mouseVelocity.y = (event.touches[0].clientY - this.lastMousePosition.y) / deltaTime;
            }

            this.lastMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: currentTime };

            this.updateMousePosition(event.touches[0].clientX, event.touches[0].clientY);
            this.updateDicePosition();
            event.preventDefault();
        }
    }

    private onMouseUp(event: MouseEvent) {
        if (this.isDragging) {
            this.throwDice(event.clientX, event.clientY);
        }
    }

    private onTouchEnd(event: TouchEvent) {
        if (this.isDragging) {
            const touch = event.changedTouches[0];
            this.throwDice(touch.clientX, touch.clientY);
        }
    }

    private checkDiceClick(event: MouseEvent) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.dice, true); // Include children for better detection

        if (intersects.length > 0) {
            // Only prevent event propagation when actually clicking on dice
            event.stopPropagation();
            event.preventDefault();

            this.isDragging = true;
            this.renderer.domElement.style.cursor = 'grabbing';

            // Initialize velocity tracking
            this.lastMousePosition = { x: this.dragStartPosition.x, y: this.dragStartPosition.y, time: Date.now() };
            this.mouseVelocity = { x: 0, y: 0 };

            // Stop any current rolling
            if (this.rollTimeout) {
                clearTimeout(this.rollTimeout);
                this.rollTimeout = null;
            }
            this.isRolling = false;

            // Reset dice position for dragging
            this.diceBody.position.set(0, 2, 0);
            this.diceBody.velocity.set(0, 0, 0);
            this.diceBody.angularVelocity.set(0, 0, 0);

            return true; // Indicate that dice was clicked
        }

        return false; // Indicate that dice was not clicked
    }

    private updateDicePosition() {
        if (!this.isDragging) return;

        // For orthographic camera, convert mouse coordinates directly to world coordinates
        // Orthographic cameras don't have perspective, so the conversion is simpler
        const rect = this.renderer.domElement.getBoundingClientRect();

        // Get the camera's frustum size
        const frustumHeight = this.camera.top - this.camera.bottom;
        const frustumWidth = this.camera.right - this.camera.left;

        // Convert normalized mouse coordinates to world coordinates
        const worldX = (this.mouse.x * frustumWidth) / 2;
        const worldZ = -(this.mouse.y * frustumHeight) / 2; // Negative because Y is flipped

        // Set position at dice tray level (Y = 2)
        const worldPosition = new THREE.Vector3(worldX, 2, worldZ);

        // Constrain to smaller tray bounds
        worldPosition.x = Math.max(-9, Math.min(9, worldPosition.x));
        worldPosition.z = Math.max(-6, Math.min(6, worldPosition.z));

        this.diceBody.position.copy(worldPosition);

        // Add rolling animation while dragging
        this.dice.rotation.x += 0.1;
        this.dice.rotation.y += 0.1;
        this.dice.rotation.z += 0.05;
    }

    private throwDice(endX: number, endY: number) {
        this.isDragging = false;
        this.renderer.domElement.style.cursor = 'grab';

        this.isRolling = true;

        // Use mouse velocity for momentum-based throwing
        const velocityMultiplier = 50; // Adjust this to change sensitivity
        const throwForce = new CANNON.Vec3(
            this.mouseVelocity.x * velocityMultiplier,
            -Math.max(Math.abs(this.mouseVelocity.x + this.mouseVelocity.y) * velocityMultiplier * 0.5, 3),
            this.mouseVelocity.y * velocityMultiplier
        );

        // Cap maximum force to prevent dice from flying too far
        const maxForce = 25;
        const forceLength = throwForce.length();
        if (forceLength > maxForce) {
            throwForce.scale(maxForce / forceLength, throwForce);
        }

        this.diceBody.velocity.copy(throwForce);

        // Apply spin based on velocity direction and magnitude
        const spinIntensity = Math.min(Math.sqrt(this.mouseVelocity.x * this.mouseVelocity.x + this.mouseVelocity.y * this.mouseVelocity.y) * 100, 25);
        this.diceBody.angularVelocity.set(
            (Math.random() - 0.5) * spinIntensity + this.mouseVelocity.y * 10,
            (Math.random() - 0.5) * spinIntensity,
            (Math.random() - 0.5) * spinIntensity + this.mouseVelocity.x * 10
        );

        // Force stop after 3 seconds
        this.rollTimeout = setTimeout(() => {
            this.forceStop();
        }, 3000);
    }

    private forceStop() {
        if (this.rollTimeout) {
            clearTimeout(this.rollTimeout);
            this.rollTimeout = null;
        }

        console.log('Force stopping dice roll');
        this.isRolling = false;

        // Stop the dice movement
        this.diceBody.velocity.set(0, 0, 0);
        this.diceBody.angularVelocity.set(0, 0, 0);

        // Snap to nearest face for cleaner result
        this.snapToNearestFace();

        // Small delay to ensure physics settle, then trigger result animation
        setTimeout(() => {
            console.log('Triggering result calculation and animation');
            this.calculateResult();
        }, 100);
    }

    private animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Step physics simulation
        this.world.step(1/60);

        // Update dice visual position from physics body (unless showing result animation)
        if (!this.showingResult) {
            this.dice.position.copy(this.diceBody.position as any);
            this.dice.quaternion.copy(this.diceBody.quaternion as any);
        }

        // Check if dice has settled (early stop if settled before 3 seconds)
        if (this.isRolling && !this.isDragging) {
            const velocity = this.diceBody.velocity.length();
            const angularVelocity = this.diceBody.angularVelocity.length();

            if (velocity < 0.1 && angularVelocity < 0.1 && this.diceBody.position.y < 0) {
                setTimeout(() => {
                    if (this.isRolling && this.diceBody.velocity.length() < 0.1 && this.diceBody.angularVelocity.length() < 0.1) {
                        // Apply a final "snap" to the nearest face orientation
                        this.snapToNearestFace();
                        this.forceStop();
                    }
                }, 500);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    public roll(): Promise<number> {
        return new Promise((resolve) => {
            if (this.isRolling) return;

            // Reset result animation state and make physics body dynamic again
            this.showingResult = false;
            this.diceBody.type = CANNON.Body.DYNAMIC;

            this.isRolling = true;

            // Reset dice position and rotation in larger area
            this.diceBody.position.set(
                (Math.random() - 0.5) * 8,
                8,
                (Math.random() - 0.5) * 8
            );

            this.diceBody.quaternion.set(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize();

            // Apply random throw force for larger tray
            const throwForce = new CANNON.Vec3(
                (Math.random() - 0.5) * 16,
                -4,
                (Math.random() - 0.5) * 16
            );

            this.diceBody.velocity.copy(throwForce);

            // Apply random spin
            this.diceBody.angularVelocity.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );

            this.rollResolve = resolve;

            // Force stop after 3 seconds
            this.rollTimeout = setTimeout(() => {
                this.forceStop();
            }, 3000);
        });
    }

    private rollResolve: ((value: number) => void) | null = null;
    private resultAnimation: any = null;
    private showingResult = false;

    private calculateResult(): void {
        // Get the face that's pointing most upward
        const result = this.getTopFaceNumber();

        // Start result presentation animation
        this.showResultAnimation(result);

        // Call the result callback for UI updates
        if (this.onRollComplete) {
            this.onRollComplete(result);
        }

        // Also handle button-based rolls
        if (this.rollResolve) {
            this.rollResolve(result);
            this.rollResolve = null;
        }
    }

    private showResultAnimation(result: number): void {
        console.log(`Starting result animation for face ${result}`);

        // Set flag to disable physics updates during animation
        this.showingResult = true;

        // Stop dice physics completely
        this.diceBody.velocity.set(0, 0, 0);
        this.diceBody.angularVelocity.set(0, 0, 0);
        this.diceBody.type = CANNON.Body.KINEMATIC; // Make body kinematic so physics doesn't affect it

        // Store original position and rotation from dice mesh (not physics body)
        const originalPosition = this.dice.position.clone();
        const originalRotation = this.dice.rotation.clone();

        // Define target position (center of the area, elevated)
        const centerPosition = new THREE.Vector3(0, originalPosition.y + 3, 0);

        // Calculate target rotation to show the result face pointing upward
        const targetRotation = this.calculateRotationForTopFace(result);

        console.log('Current result face:', result);
        console.log('Moving to center and lifting for result display');
        console.log('Original position:', originalPosition);
        console.log('Target position:', centerPosition);
        console.log('Original rotation:', originalRotation);
        console.log('Target rotation:', targetRotation);

        // Animation parameters
        const animationDuration = 1500; // 1.5 seconds
        const liftHeight = 3; // How high to lift the dice
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);

            // Smooth easing function
            const easeInOutCubic = (t: number) => {
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            };

            const easedProgress = easeInOutCubic(progress);

            if (progress < 0.5) {
                // First half: lift up and move toward center, start rotating
                const liftProgress = easedProgress * 2; // 0 to 1 in first half

                // Interpolate position from original to center + lift
                this.dice.position.x = originalPosition.x + (centerPosition.x - originalPosition.x) * liftProgress;
                this.dice.position.y = originalPosition.y + liftHeight * liftProgress;
                this.dice.position.z = originalPosition.z + (centerPosition.z - originalPosition.z) * liftProgress;

                // Start gentle rotation towards target
                this.dice.rotation.x = originalRotation.x + (targetRotation.x - originalRotation.x) * liftProgress * 0.3;
                this.dice.rotation.y = originalRotation.y + (targetRotation.y - originalRotation.y) * liftProgress * 0.3;
                this.dice.rotation.z = originalRotation.z + (targetRotation.z - originalRotation.z) * liftProgress * 0.3;
            } else {
                // Second half: settle down slightly while staying centered, complete rotation
                const settleProgress = (easedProgress - 0.5) * 2; // 0 to 1 in second half

                // Stay at center position, just adjust height
                this.dice.position.x = centerPosition.x;
                this.dice.position.y = originalPosition.y + liftHeight * (1 - settleProgress * 0.4); // Keep well elevated
                this.dice.position.z = centerPosition.z;

                // Complete rotation to show result face upward
                this.dice.rotation.x = originalRotation.x + (targetRotation.x - originalRotation.x) * (0.3 + settleProgress * 0.7);
                this.dice.rotation.y = originalRotation.y + (targetRotation.y - originalRotation.y) * (0.3 + settleProgress * 0.7);
                this.dice.rotation.z = originalRotation.z + (targetRotation.z - originalRotation.z) * (0.3 + settleProgress * 0.7);
            }

            if (progress < 1) {
                this.resultAnimation = requestAnimationFrame(animate);
            } else {
                // Animation complete, reset physics body to allow rolling again
                this.showingResult = false;
                this.diceBody.type = CANNON.Body.DYNAMIC;

                // Set final position to center, elevated
                const finalY = originalPosition.y + liftHeight * 0.6; // Keep well elevated
                this.dice.position.set(centerPosition.x, finalY, centerPosition.z);

                // Update physics body position to match visual position
                this.diceBody.position.set(
                    this.dice.position.x,
                    this.dice.position.y,
                    this.dice.position.z
                );

                // Set the physics body rotation to match the visual rotation
                const quaternion = new THREE.Quaternion();
                quaternion.setFromEuler(this.dice.rotation);
                this.diceBody.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

                // Stop any residual velocities
                this.diceBody.velocity.set(0, 0, 0);
                this.diceBody.angularVelocity.set(0, 0, 0);

                this.resultAnimation = null;
                console.log('Result animation completed - dice centered and physics restored');
            }
        };

        // Cancel any existing result animation
        if (this.resultAnimation) {
            cancelAnimationFrame(this.resultAnimation);
        }

        animate();
    }

    private calculateRotationForTopFace(targetFaceNumber: number): THREE.Euler {
        // Use the accurate Euler rotations captured for each face
        const faceRotations: { [key: number]: THREE.Euler } = {
            1: new THREE.Euler(-1.7, -0.9, -2.5),
            2: new THREE.Euler(-0.0, -0.5, 2.0),
            3: new THREE.Euler(-0.0, 0.6, -1.9),
            4: new THREE.Euler(-0.5, -2.8, 0.6),
            5: new THREE.Euler(-2.4, -0.4, -1.9),
            6: new THREE.Euler(-1.7, 2.9, 0.6),
            7: new THREE.Euler(-1.2, 0.1, -1.5),
            8: new THREE.Euler(-0.7, 2.2, -2.5),
            9: new THREE.Euler(0.7, 0.6, -1.2),
            10: new THREE.Euler(-2.8, 0.1, 0.1),
            11: new THREE.Euler(2.5, 1.0, -2.5),
            12: new THREE.Euler(-1.7, -0.9, 0.6),
            13: new THREE.Euler(-2.6, -0.0, -3.1),
            14: new THREE.Euler(-2.8, -2.7, 0.0),
            15: new THREE.Euler(-1.2, -0.0, 1.6),
            16: new THREE.Euler(-0.6, -2.8, -2.5),
            17: new THREE.Euler(-2.3, -0.5, 1.3),
            18: new THREE.Euler(-0.0, 0.6, 1.2),
            19: new THREE.Euler(-0.0, -0.5, -1.2),
            20: new THREE.Euler(-2.4, 2.7, -1.2)
        };

        const targetRotation = faceRotations[targetFaceNumber];

        if (targetRotation) {
            console.log(`Using calibrated rotation for face ${targetFaceNumber}:`, targetRotation);
            return targetRotation;
        } else {
            console.warn(`No calibrated rotation found for face ${targetFaceNumber}, using default`);
            return new THREE.Euler(0, 0, 0);
        }
    }

    // Temporary methods for rotation calibration
    public setManualRotation(x: number, y: number, z: number): void {
        if (!this.dice) return;

        // Disable physics updates during manual rotation
        this.showingResult = true;
        this.diceBody.type = CANNON.Body.KINEMATIC;

        // Set the rotation directly
        this.dice.rotation.set(x, y, z);

        // Position dice at center and elevated for better visibility
        this.dice.position.set(0, 2, 0);
        this.diceBody.position.set(0, 2, 0);
    }

    public getCurrentTopFace(): number {
        if (!this.dice) return 1;
        return this.getTopFaceNumber();
    }

    public exportModel(): void {
        if (!this.diceGeometry) {
            console.error('No geometry available to export');
            return;
        }

        // Generate OBJ file content
        const objContent = this.generateOBJContent(this.diceGeometry);

        // Create download
        const blob = new Blob([objContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'd20-with-uv-mapping.obj';
        a.click();
        URL.revokeObjectURL(url);

        console.log('D20 model exported with custom UV mapping');
        console.log('You can now open this .obj file in Blender, MeshLab, or other 3D software to inspect the UV layout');
    }

    private generateOBJContent(geometry: THREE.BufferGeometry): string {
        const vertices = geometry.attributes.position.array;
        const uvs = geometry.attributes.uv.array;
        let obj = '# D20 Icosahedron with Custom UV Mapping\n';
        obj += '# Generated by Claude Code D20 Dice Plugin\n\n';

        // Write vertices
        for (let i = 0; i < vertices.length; i += 3) {
            obj += `v ${vertices[i]} ${vertices[i + 1]} ${vertices[i + 2]}\n`;
        }

        obj += '\n';

        // Write UV coordinates
        for (let i = 0; i < uvs.length; i += 2) {
            obj += `vt ${uvs[i]} ${uvs[i + 1]}\n`;
        }

        obj += '\n';

        // Write faces (groups of 3 vertices since we have 20 triangular faces)
        for (let i = 0; i < vertices.length / 3; i += 3) {
            const v1 = i + 1;
            const v2 = i + 2;
            const v3 = i + 3;
            obj += `f ${v1}/${v1} ${v2}/${v2} ${v3}/${v3}\n`;
        }

        return obj;
    }

    private calculateRotationToShowFace(faceNormal: THREE.Vector3): THREE.Euler {
        // We want this face normal to point upward (positive Y direction)
        const upVector = new THREE.Vector3(0, 1, 0);

        // Create a rotation that aligns the face normal with up vector
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(faceNormal, upVector);

        // Convert to Euler angles
        const euler = new THREE.Euler();
        euler.setFromQuaternion(quaternion);

        return euler;
    }

    private getTopFaceNumber(): number {
        try {
            // Use the calibrated Euler rotations to detect which face is up
            // by finding which calibrated rotation is closest to current rotation
            const currentRotation = this.dice.rotation;

            // These are the same calibrated rotations we use for animations
            const faceRotations: { [key: number]: THREE.Euler } = {
                1: new THREE.Euler(-1.7, -0.9, -2.5),
                2: new THREE.Euler(-0.0, -0.5, 2.0),
                3: new THREE.Euler(-0.0, 0.6, -1.9),
                4: new THREE.Euler(-0.5, -2.8, 0.6),
                5: new THREE.Euler(-2.4, -0.4, -1.9),
                6: new THREE.Euler(-1.7, 2.9, 0.6),
                7: new THREE.Euler(-1.2, 0.1, -1.5),
                8: new THREE.Euler(-0.7, 2.2, -2.5),
                9: new THREE.Euler(0.7, 0.6, -1.2),
                10: new THREE.Euler(-2.8, 0.1, 0.1),
                11: new THREE.Euler(2.5, 1.0, -2.5),
                12: new THREE.Euler(-1.7, -0.9, 0.6),
                13: new THREE.Euler(-2.6, -0.0, -3.1),
                14: new THREE.Euler(-2.8, -2.7, 0.0),
                15: new THREE.Euler(-1.2, -0.0, 1.6),
                16: new THREE.Euler(-0.6, -2.8, -2.5),
                17: new THREE.Euler(-2.3, -0.5, 1.3),
                18: new THREE.Euler(-0.0, 0.6, 1.2),
                19: new THREE.Euler(-0.0, -0.5, -1.2),
                20: new THREE.Euler(-2.4, 2.7, -1.2)
            };

            let closestFace = 1;
            let closestDistance = Infinity;

            // Find the closest rotation match
            for (const [faceNum, targetRotation] of Object.entries(faceRotations)) {
                const face = parseInt(faceNum);

                // Calculate angular distance with proper wrapping
                const dx = this.normalizeAngle(currentRotation.x - targetRotation.x);
                const dy = this.normalizeAngle(currentRotation.y - targetRotation.y);
                const dz = this.normalizeAngle(currentRotation.z - targetRotation.z);

                // Calculate total angular distance
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestFace = face;
                }
            }

            // Debug logging
            console.log(`Current rotation: Euler(${currentRotation.x.toFixed(2)}, ${currentRotation.y.toFixed(2)}, ${currentRotation.z.toFixed(2)})`);
            console.log(`Detected face: ${closestFace} (distance: ${closestDistance.toFixed(3)})`);

            return closestFace;
        } catch (error) {
            console.error('Error in getTopFaceNumber:', error);
            return Math.floor(Math.random() * 20) + 1;
        }
    }

    private normalizeAngle(angle: number): number {
        // Normalize angle to [-π, π]
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    private snapToNearestFace(): void {
        // Find which face we're closest to
        const nearestFace = this.getTopFaceNumber();

        // Get the target rotation for that face
        const faceRotations: { [key: number]: THREE.Euler } = {
            1: new THREE.Euler(-1.7, -0.9, -2.5),
            2: new THREE.Euler(-0.0, -0.5, 2.0),
            3: new THREE.Euler(-0.0, 0.6, -1.9),
            4: new THREE.Euler(-0.5, -2.8, 0.6),
            5: new THREE.Euler(-2.4, -0.4, -1.9),
            6: new THREE.Euler(-1.7, 2.9, 0.6),
            7: new THREE.Euler(-1.2, 0.1, -1.5),
            8: new THREE.Euler(-0.7, 2.2, -2.5),
            9: new THREE.Euler(0.7, 0.6, -1.2),
            10: new THREE.Euler(-2.8, 0.1, 0.1),
            11: new THREE.Euler(2.5, 1.0, -2.5),
            12: new THREE.Euler(-1.7, -0.9, 0.6),
            13: new THREE.Euler(-2.6, -0.0, -3.1),
            14: new THREE.Euler(-2.8, -2.7, 0.0),
            15: new THREE.Euler(-1.2, -0.0, 1.6),
            16: new THREE.Euler(-0.6, -2.8, -2.5),
            17: new THREE.Euler(-2.3, -0.5, 1.3),
            18: new THREE.Euler(-0.0, 0.6, 1.2),
            19: new THREE.Euler(-0.0, -0.5, -1.2),
            20: new THREE.Euler(-2.4, 2.7, -1.2)
        };

        const targetRotation = faceRotations[nearestFace];
        if (targetRotation) {
            // Smoothly interpolate toward the target rotation
            const currentRotation = this.dice.rotation;
            const snapStrength = 0.5; // Increased snap strength for more decisive settling

            this.dice.rotation.x = currentRotation.x + (targetRotation.x - currentRotation.x) * snapStrength;
            this.dice.rotation.y = currentRotation.y + (targetRotation.y - currentRotation.y) * snapStrength;
            this.dice.rotation.z = currentRotation.z + (targetRotation.z - currentRotation.z) * snapStrength;

            // Update physics body to match
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(this.dice.rotation);
            this.diceBody.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

            console.log(`Snapped dice toward face ${nearestFace}`);
        }
    }

    private setInitialSize() {
        // Get the full window size minus ribbon
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight - 44; // 44px for ribbon
        this.updateSize(containerWidth, containerHeight);
    }

    public updateSize(width: number, height: number) {
        // Force renderer to exactly match the provided dimensions
        this.renderer.setSize(width, height, true);

        // Update pixel ratio for crisp rendering
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Set canvas to fill container completely without any constraints
        const canvas = this.renderer.domElement;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';

        // Update orthographic camera frustum to match the exact window dimensions
        const aspect = width / height;
        const frustumSize = 20;
        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;

        // Update the camera projection matrix for orthographic camera
        this.camera.updateProjectionMatrix();
    }

    private reinitializeAfterContextLoss() {
        try {
            // Recreate the scene elements
            this.createDiceTray();
            this.createDice();
            this.setupLighting();
            console.log('Scene reinitialized after WebGL context restore');
        } catch (error) {
            console.error('Failed to reinitialize scene after context loss:', error);
        }
    }

    private createWindowBorder() {
        if (this.settings.showWindowBorder) {
            this.windowBorder = document.createElement('div');
            this.windowBorder.style.position = 'absolute';
            this.windowBorder.style.top = '0';
            this.windowBorder.style.left = '0';
            this.windowBorder.style.width = '100%';
            this.windowBorder.style.height = '100%';
            this.windowBorder.style.border = `${this.settings.windowBorderWidth}px solid ${this.settings.windowBorderColor}`;
            this.windowBorder.style.opacity = this.settings.windowBorderOpacity.toString();
            this.windowBorder.style.pointerEvents = 'none';
            this.windowBorder.style.boxSizing = 'border-box';
            this.container.appendChild(this.windowBorder);
        }
    }

    private removeWindowBorder() {
        if (this.windowBorder) {
            this.container.removeChild(this.windowBorder);
            this.windowBorder = null;
        }
    }

    public updateSettings(newSettings: DiceSettings) {
        this.settings = newSettings;

        // Update window border
        this.removeWindowBorder();
        this.createWindowBorder();

        // Update dice material color
        if (this.dice && this.dice.material) {
            (this.dice.material as THREE.MeshPhongMaterial).color.setStyle(this.settings.diceColor);
        }

        // Recreate dice with new size
        if (this.dice) {
            this.scene.remove(this.dice);
            this.world.removeBody(this.diceBody);
            this.createDice();
        }

        // Update tray
        if (this.trayMesh) {
            this.scene.remove(this.trayMesh);
            this.trayMesh = null;
        }
        this.createDiceTray();
    }

    public destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.rollTimeout) {
            clearTimeout(this.rollTimeout);
        }

        if (this.resultAnimation) {
            cancelAnimationFrame(this.resultAnimation);
        }

        // Clean up window border
        this.removeWindowBorder();

        // Remove event listeners
        if (this.renderer) {
            const canvas = this.renderer.domElement;
            canvas.removeEventListener('mousedown', (event) => this.onMouseDown(event));
            canvas.removeEventListener('mousemove', (event) => this.onMouseMove(event));
            canvas.removeEventListener('mouseup', (event) => this.onMouseUp(event));
            canvas.removeEventListener('touchstart', (event) => this.onTouchStart(event));
            canvas.removeEventListener('touchmove', (event) => this.onTouchMove(event));
            canvas.removeEventListener('touchend', (event) => this.onTouchEnd(event));

            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();

            const gl = this.renderer.getContext();
            if (gl && gl.getExtension('WEBGL_lose_context')) {
                gl.getExtension('WEBGL_lose_context')!.loseContext();
            }
        }

        if (this.scene) {
            this.scene.clear();
        }

        if (this.world) {
            this.world.bodies.forEach(body => {
                this.world.removeBody(body);
            });
        }
    }
}