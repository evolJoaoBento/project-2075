import { App, PluginSettingTab, Setting } from 'obsidian';
import D20DicePlugin from './main';

export interface DiceSettings {
    // Camera window border
    showWindowBorder: boolean;
    windowBorderColor: string;
    windowBorderOpacity: number;
    windowBorderWidth: number;

    // Surface background
    showSurface: boolean;
    surfaceColor: string;
    surfaceOpacity: number;
    surfaceBorderColor: string;
    surfaceBorderOpacity: number;
    surfaceBorderWidth: number;

    // Dice configuration
    diceType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
    diceSize: number;
    diceColor: string;
    diceTextureMode: 'solid' | 'custom';
    customDiceTexture: string; // Base64 encoded image data
}

export const DEFAULT_SETTINGS: DiceSettings = {
    // Camera window border defaults
    showWindowBorder: false,
    windowBorderColor: '#ffffff',
    windowBorderOpacity: 0.3,
    windowBorderWidth: 2,

    // Surface background defaults
    showSurface: false,
    surfaceColor: '#8B4513',
    surfaceOpacity: 0.1,
    surfaceBorderColor: '#654321',
    surfaceBorderOpacity: 0.3,
    surfaceBorderWidth: 2,

    // Dice defaults
    diceType: 'd20',
    diceSize: 0.8,
    diceColor: '#ff4444',
    diceTextureMode: 'solid',
    customDiceTexture: ''
};

export class DiceSettingTab extends PluginSettingTab {
    plugin: D20DicePlugin;

    constructor(app: App, plugin: D20DicePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'D20 Dice Roller Settings' });

        // Camera Window Border Section
        containerEl.createEl('h3', { text: 'Camera Window Border' });

        new Setting(containerEl)
            .setName('Show window border')
            .setDesc('Display a border around the 3D view window')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showWindowBorder)
                .onChange(async (value) => {
                    this.plugin.settings.showWindowBorder = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Border color')
            .setDesc('Color of the window border')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.windowBorderColor)
                .onChange(async (value) => {
                    this.plugin.settings.windowBorderColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Border opacity')
            .setDesc('Transparency of the window border (0 = invisible, 1 = opaque)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.windowBorderOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.windowBorderOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Border width')
            .setDesc('Width of the window border in pixels')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.windowBorderWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.windowBorderWidth = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        // Surface Background Section
        containerEl.createEl('h3', { text: 'Dice Tray Surface' });

        new Setting(containerEl)
            .setName('Show dice tray')
            .setDesc('Display a visible surface for the dice to roll on')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showSurface)
                .onChange(async (value) => {
                    this.plugin.settings.showSurface = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Surface color')
            .setDesc('Color of the dice tray surface')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.surfaceColor)
                .onChange(async (value) => {
                    this.plugin.settings.surfaceColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Surface opacity')
            .setDesc('Transparency of the surface (0 = invisible, 1 = opaque)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.surfaceOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.surfaceOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Surface border color')
            .setDesc('Color of the surface border')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.surfaceBorderColor)
                .onChange(async (value) => {
                    this.plugin.settings.surfaceBorderColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Surface border opacity')
            .setDesc('Transparency of the surface border')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.surfaceBorderOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.surfaceBorderOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Surface border width')
            .setDesc('Width of the surface border')
            .addSlider(slider => slider
                .setLimits(0, 5, 0.5)
                .setValue(this.plugin.settings.surfaceBorderWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.surfaceBorderWidth = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        // Dice Configuration Section
        containerEl.createEl('h3', { text: 'Dice Configuration' });

        new Setting(containerEl)
            .setName('Dice type')
            .setDesc('Type of dice to display')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'd4': 'D4 (4 sides)',
                    'd6': 'D6 (6 sides)',
                    'd8': 'D8 (8 sides)',
                    'd10': 'D10 (10 sides)',
                    'd12': 'D12 (12 sides)',
                    'd20': 'D20 (20 sides)',
                    'd100': 'D100 (100 sides)'
                })
                .setValue(this.plugin.settings.diceType)
                .onChange(async (value: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100') => {
                    this.plugin.settings.diceType = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Dice size')
            .setDesc('Size of the dice (0.5 = small, 1.5 = large)')
            .addSlider(slider => slider
                .setLimits(0.3, 2.0, 0.1)
                .setValue(this.plugin.settings.diceSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.diceSize = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Dice color')
            .setDesc('Color of the dice')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.diceColor)
                .onChange(async (value) => {
                    this.plugin.settings.diceColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                }));

        new Setting(containerEl)
            .setName('Dice texture mode')
            .setDesc('Choose how the dice faces should appear')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'solid': 'Solid color only',
                    'custom': 'Custom image texture'
                })
                .setValue(this.plugin.settings.diceTextureMode)
                .onChange(async (value: 'solid' | 'custom') => {
                    this.plugin.settings.diceTextureMode = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshDiceView();
                    this.display(); // Refresh the settings display
                }));

        // Only show custom texture upload when custom mode is selected
        if (this.plugin.settings.diceTextureMode === 'custom') {
            new Setting(containerEl)
                .setName('Custom dice texture')
                .setDesc('Upload a custom image to tile on all dice faces. Your image will repeat on each triangular face of the D20.')
                .addButton(button => button
                    .setButtonText('Upload Image')
                    .onClick(() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.addEventListener('change', async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                                // Check file size (limit to 5MB to prevent memory issues)
                                if (file.size > 5 * 1024 * 1024) {
                                    alert('Image file too large. Please use an image smaller than 5MB.');
                                    return;
                                }

                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                    const base64 = event.target?.result as string;
                                    this.plugin.settings.customDiceTexture = base64;
                                    await this.plugin.saveSettings();
                                    this.plugin.refreshDiceView();
                                };
                                reader.readAsDataURL(file);
                            }
                        });
                        input.click();
                    }))
                .addButton(button => button
                    .setButtonText('Clear')
                    .onClick(async () => {
                        this.plugin.settings.customDiceTexture = '';
                        await this.plugin.saveSettings();
                        this.plugin.refreshDiceView();
                    }));
        }
    }
}