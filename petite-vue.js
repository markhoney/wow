// import {createApp, reactive} from 'https://unpkg.com/petite-vue?module';
import {createApp, reactive} from 'https://unpkg.com/petite-vue/dist/petite-vue.es.js';
import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg/dist/esm/index.js';
import { toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util/dist/esm/index.js';
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

function dialog(title) {
	return {
		$template: '#dialog',
		title,
	};
}

createApp({
	store,
	slider,
	select,
	boolean,
	dialog,
	prefix: '[wowmachine]\n',
	colours: ['chilli', 'midnight', 'gold', 'silver'],
	themes: ['red', 'slate', 'amber', 'grey'],
	toggle(name) {
		this.store.show = this.store.show === name ? null : name;
		console.log(this.store.show);
	},
	nextColour() {
		this.store.colour = this.colours[this.colours.indexOf(this.store.colour) + 1] || this.colours[0];
	},
	updateTheme() {
		const link = document.querySelector('link[href^="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico"]');
		link.href = `https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.${this.themes[this.colours.indexOf(this.store.colour)]}.min.css`;
	},
	playWAV() {
		const audio = new Audio('/audio/fresh.wav');
		audio.play();
	},
	/* get sections() {
		return [...new Set(Object.values(this.store.settings).map(value => value.section))];
	},
	get sectioned() {
		return this.sections.map(section => this.store.settings.filter(value => value.section === section));
	}, */
	title(word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	},
	adjustFader(side) {
		const settings = this.store.settings;
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
	async convertAudio() {
		// When an audio file is selected, convert it to a 48kHz stereo WAV file and bring up a download dialog for the user to save it with their chose filename.
		console.log('convertAudio');
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.wav,.mp3,.ogg,.m4a,.aac,.flac,.wma,.webm,.m4b,.m4p,.m4r,.m4v,.m4b,.m4p,.m4r,.m4v';
		console.log('fileInput', fileInput);
		fileInput.onchange = (e) => {
			console.log('onchange');
			const file = e.target.files[0];
			const reader = new FileReader();
			reader.onload = async (e) => {
				// const audioBuffer = e.target.result;
				const ffmpeg = new FFmpeg();
				ffmpeg.on('log', ({ message }) => {
					console.log(message);
				});
				// const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core/dist/esm';
				const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt/dist/esm';
				await ffmpeg.load({
					coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
					wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
					workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
				});
				// const { name } = files[0];
				const output = file.name.replace(/\.[^.]+$/, '.wav');
				await ffmpeg.writeFile(file.name, file);
				await ffmpeg.exec(['-i', file.name, '-ar', '48000', '-ac', '2', '-f', 'wav', output]);
				const blob = await ffmpeg.readFile(output);
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = output;
				a.click();
				URL.revokeObjectURL(url);
			};
			reader.readAsDataURL(file);
		};
		fileInput.click();
	},
}).mount(); // body // 'article#image'
