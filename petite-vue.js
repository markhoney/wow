import {createApp, reactive} from 'https://unpkg.com/petite-vue?module';
// import {createApp, reactive} from 'https://unpkg.com/petite-vue/dist/petite-vue.es.js';
// import {FFmpeg} from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg/dist/esm/index.js';
// import {FFmpeg} from 'https://unpkg.com/@ffmpeg/ffmpeg/dist/esm/index.js';
// import {FFmpeg} from 'https://esm.sh/@ffmpeg/ffmpeg';
import {createFFmpeg} from 'https://esm.sh/@ffmpeg/ffmpeg@0.11.6';
// import {toBlobURL} from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util/dist/esm/index.js';
import settings from './settings.json' with {type: 'json'};

for (const value of Object.values(settings)) value.value = value.default;

const store = reactive({
	settings,
	show: null,
	colour: 'chilli',
	looper: true,
	minimal: true,
	faderSeparation: 100,
	linkPitch: false,
});

function slider(name) {
	return {
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
	};
}

function select(name) {
	return {
		$template: '#select',
		name,
		values: settings[name].values,
		label: settings[name].label,
		tooltip: settings[name].tooltip,
	};
}

function boolean(name) {
	return {
		$template: '#switch',
		name,
		label: settings[name].label,
		tooltip: settings[name].tooltip,
	};
}

function dialog_header(title) {
	return {
		$template: '#dialog_header',
		title,
	};
}

createApp({
	store,
	slider,
	select,
	boolean,
	dialog_header,
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
	toggle(name) {
		this.store.show = this.store.show === name ? null : name;
	},
	nextColour() {
		this.store.colour = this.colours[this.colours.indexOf(this.store.colour) + 1] || this.colours[0];
	},
	updateTheme() {
		const link = document.querySelector('link[href^="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico"]');
		link.href = `https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.${this.themes[this.colours.indexOf(this.store.colour)]}.min.css`;
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
		const settings = this.store.settings;
		if (settings.fader_left.value === 'none' || settings.fader_right.value === 'none') return;
		if (side === 'left') {
			if (settings.left_cut_value.value > settings.right_cut_value.values[1] - this.store.faderSeparation) {
				settings.left_cut_value.value = settings.right_cut_value.values[1] - this.store.faderSeparation;
			}
			// When left slider moves, ensure right slider is at least buffer distance away
			if (settings.left_cut_value.value + this.store.faderSeparation > settings.right_cut_value.value) {
				settings.right_cut_value.value = settings.left_cut_value.value + this.store.faderSeparation;
			}
		} else {
			if (settings.right_cut_value.value < settings.left_cut_value.values[0] + this.store.faderSeparation) {
				settings.right_cut_value.value = settings.left_cut_value.values[0] + this.store.faderSeparation;
			}
			// When right slider moves, ensure left slider is at least buffer distance away
			if (settings.right_cut_value.value - this.store.faderSeparation < settings.left_cut_value.value) {
				settings.left_cut_value.value = settings.right_cut_value.value - this.store.faderSeparation;
			}
		}
	},
	updatePitch(side) {
		if (this.store.linkPitch) {
			if (side === 'min') {
				this.store.settings.pitch_range_max.value = this.store.settings.pitch_range_min.value;
			} else {
				this.store.settings.pitch_range_min.value = this.store.settings.pitch_range_max.value;
			}
		}
	},
	updateEffects() {
		if (this.effects.delay) {
			if (this.effects.reverb) this.store.settings.effect_mode.value = 'both';
			else this.store.settings.effect_mode.value = 'delay';
		} else if (this.effects.reverb) {
			this.store.settings.effect_mode.value = 'reverb';
		}
	},
	sectionSettings(section) {
		return Object.entries(this.store.settings).filter(([key, value]) => value.section === section).map(([key, {value}]) => `${key} = ${value}`).join('\n');
	},
	get config() {
		if (this.store.minimal) return this.prefix + Object.entries(this.store.settings).map(([key, {value}]) => `${key} = ${value}`).join('\n');
		return this.prefix + '\n#In this file, do not delete any #.\n\n' + Object.entries(this.store.settings).map(([key, value]) => `# ${value.comment}\n${key} = ${value.value}`).join('\n\n');
	},
	reset() {
		for (const key in this.store.settings) {
			this.store.settings[key].value = this.store.settings[key].default;
		}
	},
	updateURL() {
		const url = new URL(window.location.href);
		url.searchParams.set('colour', this.store.colour);
		url.searchParams.set('looper', this.store.looper);
		url.searchParams.set('minimal', this.store.minimal);
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
						this.store.settings[key].value = value;
					}
				});
			}
			reader.readAsText(file);
		};
		fileInput.click();
	},
	download() {
		const blob = new Blob([this.config()], {type: 'text/plain'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'wow_settings.txt';
		a.click();
		URL.revokeObjectURL(url);
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
		const blob = new Blob([data], {type: 'audio/wav'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = output;
		a.click();
		URL.revokeObjectURL(url);
		/* const handle = await showSaveFilePicker({
			excludeAcceptAllOption: true,
			startIn: 'downloads',
			suggestedName: output,
			types: [{
				description: 'Audio file',
				accept: {
					'audio/wav': ['.wav']
				}
			}]
		});
		const writable = await handle.createWritable();
		await writable.write(blob);
		await writable.close(); */
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
