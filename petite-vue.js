import {createApp, reactive} from 'https://unpkg.com/petite-vue?module';
// import {createApp, reactive} from 'https://unpkg.com/petite-vue/dist/petite-vue.es.js';
import {createFFmpeg} from 'https://esm.sh/@ffmpeg/ffmpeg@0.11.6';
import settings from './settings.json' with {type: 'json'};

for (const value of Object.values(settings)) value.value = value.default;

/* const store = reactive({
	settings,
	show: null,
	colour: 'chilli',
	looper: true,
	comments: false,
	faderSeparation: 100,
	linkPitch: false,
}); */

const slider = (name) => ({
	$template: '#slider',
	name,
	min: settings[name].values[0] || 0,
	max: settings[name].values[1] || 100,
	step: settings[name].values[2] || 1,
	label: settings[name].label,
	tooltip: settings[name].tooltip,
	prefix: settings[name].prefix || '',
	suffix: settings[name].suffix || '',
	invert: settings[name].invert || false,
});

const select = (name) => ({
	$template: '#select',
	name,
	values: settings[name].values,
	label: settings[name].label,
	tooltip: settings[name].tooltip,
});

const boolean = (name) => ({
	$template: '#switch',
	name,
	label: settings[name].label,
	tooltip: settings[name].tooltip,
});

const dialog_header = (title) => ({
	$template: '#dialog_header',
	title,
});

createApp({
	slider,
	select,
	boolean,
	dialog_header,
	preferences: {
		colour: 'chilli',
		looper: true,
		comments: false,
		faderSeparation: 100,
		audio_dialog: false,
		config_dialog: false,
	},
	// store,
	settings,
	show: null,
	colour: 'chilli',
	looper: true,
	comments: false,
	faderSeparation: 100,
	linkPitch: false,
	prefix: '[wowmachine]\n',
	colours: ['chilli', 'midnight', 'gold', 'silver'],
	themes: ['red', 'slate', 'amber', 'grey'],
	beats: ['amen', 'apache', 'big', 'day', 'drummer', 'impeach', 'levee', 'mule', 'papa', 'synthetic'],
	samples: ['bruise', 'classics', 'dig', 'fill', 'fresh', 'funky', 'goes', 'hit', 'hold', 'jockey', 'journey', 'one', 'pump', 'this', 'time', 'uh', 'yeah'],
	effects: {
		delay: false,
		reverb: false,
	},
	audio: new Audio(),
	dialogs: {
		config: false,
		audio: true,
	},
	toggle(name) {
		this.show = this.show === name ? null : name;
	},
	nextColour() {
		this.colour = this.colours[this.colours.indexOf(this.colour) + 1] || this.colours[0];
	},
	savePreferences() {
		// Save preferences to local storage
		localStorage.setItem('preferences', JSON.stringify(this.preferences));
	},
	loadPreferences() {
		// Load preferences from local storage
		const preferences = localStorage.getItem('preferences');
		if (preferences) this.preferences = JSON.parse(preferences);
	},
	loadSettings() {
		// Load settings from URL
		
	},
	saveSettings() {
		// Save settings to the URL
	},
	updateTheme() {
		const link = document.querySelector('link[href^="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico"]');
		link.href = `https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.${this.themes[this.colours.indexOf(this.colour)]}.min.css`;
	},
	playWAV(path) {
		// If the audio is already playing, stop it
		if (!this.audio.paused) {
			this.audio.pause();
			return;
		}
		this.audio.src = path;
		this.audio.play();
	},
	play(type, name) {
		if (!type) type = 'sample';
		if (!name) name = this[type + 's'][Math.floor(Math.random() * this[type + 's'].length)];
		this.playWAV(`/audio/${type}s/${name}.wav`);
	},
	title(word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	},
	adjustFader(side) {
		const settings = this.settings;
		if (settings.fader_left.value === 'none' || settings.fader_right.value === 'none') return;
		if (side === 'left') {
			if (settings.left_cut_value.value > settings.right_cut_value.values[1] - this.faderSeparation) {
				settings.left_cut_value.value = settings.right_cut_value.values[1] - this.faderSeparation;
			}
			// When left slider moves, ensure right slider is at least buffer distance away
			if (settings.left_cut_value.value + this.faderSeparation > settings.right_cut_value.value) {
				settings.right_cut_value.value = settings.left_cut_value.value + this.faderSeparation;
			}
		} else {
			if (settings.right_cut_value.value < settings.left_cut_value.values[0] + this.faderSeparation) {
				settings.right_cut_value.value = settings.left_cut_value.values[0] + this.faderSeparation;
			}
			// When right slider moves, ensure left slider is at least buffer distance away
			if (settings.right_cut_value.value - this.faderSeparation < settings.left_cut_value.value) {
				settings.left_cut_value.value = settings.right_cut_value.value - this.faderSeparation;
			}
		}
	},
	updatePitch(side) {
		if (this.linkPitch) {
			if (side === 'min') {
				this.settings.pitch_range_max.value = this.settings.pitch_range_min.value;
			} else {
				this.settings.pitch_range_min.value = this.settings.pitch_range_max.value;
			}
		}
	},
	updateEffects() {
		if (this.effects.delay) {
			if (this.effects.reverb) this.settings.effect_mode.value = 'both';
			else this.settings.effect_mode.value = 'delay';
		} else if (this.effects.reverb) {
			this.settings.effect_mode.value = 'reverb';
		}
	},
	sectionSettings(section) {
		return Object.entries(this.settings).filter(([key, value]) => value.section === section).map(([key, {value}]) => `${key} = ${value}`).join('\n');
	},
	get config() {
		if (this.comments) return this.prefix + '\n#In this file, do not delete any #.\n\n' + Object.entries(this.settings).map(([key, value]) => `# ${value.comment}\n${key} = ${value.value}`).join('\n\n');
		return this.prefix + Object.entries(this.settings).map(([key, {value}]) => `${key} = ${value}`).join('\n');
	},
	reset() {
		for (const key in this.settings) {
			this.settings[key].value = this.settings[key].default;
		}
	},
	updateURL() {
		const url = new URL(window.location.href);
		url.searchParams.set('colour', this.colour);
		url.searchParams.set('looper', this.looper);
		url.searchParams.set('comments', this.comments);
		window.history.replaceState({}, '', url.toString());
	},
	upload() {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.txt';
		fileInput.onchange = (e) => {
			const file = e.target.files[0];
			const reader = new FileReader();
			reader.onload = (e) => {
				const config = e.target.result;
				const lines = config.split('\n');
				lines.forEach(line => {
					const [key, value] = line.split('=');
					if (key && value) {
						this.settings[key].value = value;
					}
				});
			}
			reader.readAsText(file);
		};
		fileInput.click();
	},
	async download(data, type, extension, description, dialog = False) {
		const blob = new Blob([data], {type});
		if (dialog) {
			const handle = await showSaveFilePicker({
				excludeAcceptAllOption: true,
				startIn: 'downloads',
				suggestedName: output,
				types: [{
					description: description,
					accept: {
						type: [extension]
					}
				}]
			});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
		} else {
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = output;
			a.click();
			URL.revokeObjectURL(url);
		}
	},
	downloadConfig() {
		this.download(this.config, 'text/plain', '.txt', 'Config file', this.dialogs.config);
	},
	async audioToWAV(e) {
		const file = e.target.files[0];
		if (!file) return;
		const ffmpeg = createFFmpeg({
			mainName: 'main',
			corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
			// log: true,
		});
		await ffmpeg.load();
		const arrayBuffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		ffmpeg.FS('writeFile', file.name, uint8Array);
		const output = file.name.replace(/\.[^.]+$/, '.wav');
		await ffmpeg.run('-i', file.name, '-ar', '48000', '-ac', '2', '-f', 'wav', output);
		const data = ffmpeg.FS('readFile', output);
		this.download(data, 'audio/wav', '.wav', 'Audio file', this.dialogs.audio);
	},
	async convertAudio() {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.wav,.mp3,.ogg,.m4a,.aac,.flac,.wma,.webm,.m4b,.m4p,.m4r,.m4v,.m4b,.m4p,.m4r,.m4v';
		fileInput.onchange = async (e) => {
			await this.audioToWAV(e);
		};
		fileInput.click();
	},
}).mount();
