import { Plugin } from 'obsidian';
import { D20Dice } from './d20-dice';
import { DiceSettings, DEFAULT_SETTINGS, DiceSettingTab } from './settings';

export default class D20DicePlugin extends Plugin {
    settings: DiceSettings;
    private diceOverlay: HTMLElement | null = null;
    private dice: D20Dice | null = null;
    private isVisible = false;
    private controlsPanel: HTMLElement | null = null;
    private isDraggingControls = false;
    private controlsDragOffset = { x: 0, y: 0 };

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'toggle-dice-roller',
            name: 'Toggle D20 Dice Roller',
            callback: () => {
                this.toggleDiceOverlay();
            }
        });

        this.addRibbonIcon('dice', 'Toggle D20 Dice Roller', (evt: MouseEvent) => {
            this.toggleDiceOverlay();
        });

        this.addSettingTab(new DiceSettingTab(this.app, this));
    }

    async onunload() {
        this.hideDiceOverlay();
    }

    private toggleDiceOverlay() {
        if (this.isVisible) {
            this.hideDiceOverlay();
        } else {
            this.showDiceOverlay();
        }
    }

    private showDiceOverlay() {
        if (this.diceOverlay) return;

        // Create floating overlay that fills the window
        this.diceOverlay = document.body.createDiv('dice-floating-overlay');

        // Create dice container
        const diceContainer = this.diceOverlay.createDiv('dice-floating-container');

        // Create draggable controls panel
        this.controlsPanel = this.diceOverlay.createDiv('dice-controls-panel');

        // Add drag handle at the top
        const dragHandle = this.controlsPanel.createDiv('dice-controls-drag-handle');
        dragHandle.innerHTML = '⋮⋮⋮';

        // Roll button
        const rollButton = this.controlsPanel.createEl('button', {
            text: 'Roll D20',
            cls: 'mod-cta dice-roll-button'
        });

        // Result display
        const resultElement = this.controlsPanel.createDiv({ cls: 'dice-result-overlay' });

        // Current face display
        const faceDisplay = this.controlsPanel.createDiv({ cls: 'dice-face-display' });
        faceDisplay.textContent = 'Face: 1';
        faceDisplay.style.cssText = 'padding: 5px; text-align: center; font-weight: bold; background: var(--background-primary); border: 1px solid var(--background-modifier-border); margin: 2px 0;';

        // Rotation controls section
        const rotationSection = this.controlsPanel.createDiv();
        rotationSection.style.cssText = 'border-top: 1px solid var(--background-modifier-border); margin-top: 5px; padding-top: 5px;';

        const rotationTitle = rotationSection.createEl('div', { text: 'Rotation Controls' });
        rotationTitle.style.cssText = 'font-weight: bold; text-align: center; margin-bottom: 5px; font-size: 12px;';

        // X rotation slider
        const xLabel = rotationSection.createEl('label', { text: 'X:' });
        xLabel.style.cssText = 'font-size: 11px; display: block;';
        const xSlider = rotationSection.createEl('input', {
            type: 'range',
            attr: { min: '-3.14159', max: '3.14159', step: '0.1', value: '0' }
        }) as HTMLInputElement;
        xSlider.style.cssText = 'width: 100%; margin: 2px 0;';
        const xValue = rotationSection.createEl('span', { text: '0.0' });
        xValue.style.cssText = 'font-size: 10px; float: right;';

        // Y rotation slider
        const yLabel = rotationSection.createEl('label', { text: 'Y:' });
        yLabel.style.cssText = 'font-size: 11px; display: block; margin-top: 3px;';
        const ySlider = rotationSection.createEl('input', {
            type: 'range',
            attr: { min: '-3.14159', max: '3.14159', step: '0.1', value: '0' }
        }) as HTMLInputElement;
        ySlider.style.cssText = 'width: 100%; margin: 2px 0;';
        const yValue = rotationSection.createEl('span', { text: '0.0' });
        yValue.style.cssText = 'font-size: 10px; float: right;';

        // Z rotation slider
        const zLabel = rotationSection.createEl('label', { text: 'Z:' });
        zLabel.style.cssText = 'font-size: 11px; display: block; margin-top: 3px;';
        const zSlider = rotationSection.createEl('input', {
            type: 'range',
            attr: { min: '-3.14159', max: '3.14159', step: '0.1', value: '0' }
        }) as HTMLInputElement;
        zSlider.style.cssText = 'width: 100%; margin: 2px 0;';
        const zValue = rotationSection.createEl('span', { text: '0.0' });
        zValue.style.cssText = 'font-size: 10px; float: right;';

        // Euler display
        const eulerDisplay = rotationSection.createDiv();
        eulerDisplay.style.cssText = 'font-size: 10px; text-align: center; padding: 3px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); margin: 5px 0; font-family: monospace;';
        eulerDisplay.textContent = 'Euler(0.0, 0.0, 0.0)';

        // Add face selection buttons
        const faceButtonsDiv = rotationSection.createDiv();
        faceButtonsDiv.style.cssText = 'margin: 10px 0; text-align: center;';

        const faceButtonsTitle = faceButtonsDiv.createEl('div', { text: 'Set Current Rotation as Face:' });
        faceButtonsTitle.style.cssText = 'font-size: 11px; margin-bottom: 5px;';

        const buttonGrid = faceButtonsDiv.createDiv();
        buttonGrid.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px;';

        // Create buttons for faces 1-20
        for (let i = 1; i <= 20; i++) {
            const btn = buttonGrid.createEl('button', { text: i.toString() });
            btn.style.cssText = 'padding: 2px; font-size: 10px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary);';

            btn.addEventListener('click', () => {
                const x = parseFloat(xSlider.value);
                const y = parseFloat(ySlider.value);
                const z = parseFloat(zSlider.value);

                console.log(`Face ${i}: Euler(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);

                // Visual feedback
                btn.style.background = 'var(--interactive-accent)';
                btn.style.color = 'white';
                setTimeout(() => {
                    btn.style.background = 'var(--background-secondary)';
                    btn.style.color = '';
                }, 500);
            });
        }

        // Update rotation function
        const updateRotation = () => {
            const x = parseFloat(xSlider.value);
            const y = parseFloat(ySlider.value);
            const z = parseFloat(zSlider.value);

            // Update display values
            xValue.textContent = x.toFixed(1);
            yValue.textContent = y.toFixed(1);
            zValue.textContent = z.toFixed(1);
            eulerDisplay.textContent = `Euler(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;

            // Apply rotation to dice if it exists
            if (this.dice) {
                this.dice.setManualRotation(x, y, z);
                // For now, don't show face detection since it's wrong
                faceDisplay.textContent = 'Adjust rotation, then click face number';
            }
        };

        // Add event listeners
        xSlider.addEventListener('input', updateRotation);
        ySlider.addEventListener('input', updateRotation);
        zSlider.addEventListener('input', updateRotation);

        // Add export button for UV inspection
        const exportSection = rotationSection.createDiv();
        exportSection.style.cssText = 'border-top: 1px solid var(--background-modifier-border); margin-top: 10px; padding-top: 10px;';

        const exportBtn = exportSection.createEl('button', { text: 'Export D20 Model (.obj)' });
        exportBtn.style.cssText = 'width: 100%; padding: 8px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer;';

        exportBtn.addEventListener('click', () => {
            if (this.dice) {
                this.dice.exportModel();
                exportBtn.textContent = 'Exported! Check console/downloads';
                setTimeout(() => {
                    exportBtn.textContent = 'Export D20 Model (.obj)';
                }, 2000);
            }
        });

        // Close button
        const closeBtn = this.controlsPanel.createEl('button', {
            text: '×',
            cls: 'dice-floating-close-btn'
        });
        closeBtn.addEventListener('click', () => this.hideDiceOverlay());

        // Setup dragging for controls
        this.setupControlsDragging(dragHandle);

        // Position controls panel initially
        this.controlsPanel.style.left = '50px';
        this.controlsPanel.style.top = '100px';

        // Initialize dice with settings
        this.dice = new D20Dice(diceContainer, this.settings);

        // Set up callback for drag-based rolls
        this.dice.onRollComplete = (result: number) => {
            this.showResult(result, resultElement);
        };

        // Set up button roll
        rollButton.addEventListener('click', async () => {
            rollButton.disabled = true;
            rollButton.textContent = 'Rolling...';
            resultElement.textContent = '';
            resultElement.className = 'dice-result-overlay';

            try {
                const result = await this.dice!.roll();
                this.showResult(result, resultElement);
            } catch (error) {
                resultElement.textContent = 'Error rolling dice';
                resultElement.className = 'dice-result-overlay error';
            } finally {
                rollButton.disabled = false;
                rollButton.textContent = 'Roll D20';
            }
        });

        this.isVisible = true;

        // Handle window resize with debouncing
        let resizeTimeout: NodeJS.Timeout;
        const resizeHandler = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateOverlaySize();
            }, 100);
        };
        window.addEventListener('resize', resizeHandler);

        // Also listen for Obsidian layout changes
        this.app.workspace.on('layout-change', () => {
            setTimeout(() => this.updateOverlaySize(), 100);
        });

        // Initial sizing
        setTimeout(() => this.updateOverlaySize(), 50);
    }

    private setupControlsDragging(dragHandle: HTMLElement) {
        dragHandle.addEventListener('mousedown', (e) => {
            this.isDraggingControls = true;
            const rect = this.controlsPanel!.getBoundingClientRect();
            this.controlsDragOffset.x = e.clientX - rect.left;
            this.controlsDragOffset.y = e.clientY - rect.top;
            dragHandle.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingControls && this.controlsPanel) {
                const x = e.clientX - this.controlsDragOffset.x;
                const y = e.clientY - this.controlsDragOffset.y;

                // Keep panel within window bounds
                const maxX = window.innerWidth - this.controlsPanel.offsetWidth;
                const maxY = window.innerHeight - this.controlsPanel.offsetHeight;

                this.controlsPanel.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
                this.controlsPanel.style.top = `${Math.max(44, Math.min(y, maxY))}px`; // 44px for ribbon
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingControls) {
                this.isDraggingControls = false;
                if (dragHandle) {
                    dragHandle.style.cursor = 'grab';
                }
            }
        });
    }

    private showResult(result: number, resultElement: HTMLElement) {
        const copyableText = `1d20=${result}`;
        resultElement.textContent = copyableText;
        resultElement.className = 'dice-result-overlay show';
        resultElement.title = 'Click to copy result';
        resultElement.style.cursor = 'pointer';

        // Make result clickable to copy
        resultElement.onclick = () => {
            navigator.clipboard.writeText(copyableText).then(() => {
                const originalText = resultElement.textContent;
                resultElement.textContent = 'Copied!';
                setTimeout(() => {
                    resultElement.textContent = originalText;
                }, 1000);
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = copyableText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);

                const originalText = resultElement.textContent;
                resultElement.textContent = 'Copied!';
                setTimeout(() => {
                    resultElement.textContent = originalText;
                }, 1000);
            });
        };
    }

    private updateOverlaySize() {
        if (!this.diceOverlay || !this.dice) return;

        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        // Calculate available space (below ribbon)
        const ribbonHeight = 44; // Obsidian ribbon height

        const availableHeight = windowHeight - ribbonHeight;
        const availableWidth = windowWidth;

        // Update dice renderer size to fill the window
        this.dice.updateSize(availableWidth, availableHeight);

        // Update overlay to fill entire window except ribbon
        this.diceOverlay.style.width = `${availableWidth}px`;
        this.diceOverlay.style.height = `${availableHeight}px`;
        this.diceOverlay.style.left = '0';
        this.diceOverlay.style.top = `${ribbonHeight}px`;
    }

    private hideDiceOverlay() {
        if (this.diceOverlay) {
            if (this.dice) {
                this.dice.destroy();
                this.dice = null;
            }
            this.diceOverlay.remove();
            this.diceOverlay = null;
        }
        this.controlsPanel = null;
        this.isDraggingControls = false;
        this.isVisible = false;
        window.removeEventListener('resize', () => this.updateOverlaySize());
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    refreshDiceView() {
        if (this.dice) {
            this.dice.updateSettings(this.settings);
        }
    }
}