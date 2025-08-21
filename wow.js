import {createApp} from 'https://unpkg.com/petite-vue?module'; // , reactive
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
	cuts: ['ah', 'fresh', 'beep', 'funky', 'hit', 'yeah'],
	beats: ['amen', 'apache', 'big', 'day', 'drummer', 'impeach', 'levee', 'mule', 'papa', 'synthetic'],
	samples: ['bruise', 'classics', 'dig', 'fill', 'fresh', 'funky', 'goes', 'hit', 'hold', 'jockey', 'journey', 'one', 'pump', 'this', 'time', 'uh', 'yeah'],
	effects: {
		delay: settings.effect_mode.value === 'delay' || settings.effect_mode.value === 'both',
		reverb: settings.effect_mode.value === 'reverb' || settings.effect_mode.value === 'both',
	},
	audio: new Audio(),
	audioContext: new window.AudioContext(),
	currentSource: null,
	// Keep references to live effect nodes for realtime updates
	liveNodes: {
		delay: null,
		feedback: null,
		delayWet: null,
		reverbConvolver: null,
		reverbLowpass: null,
		reverbWet: null,
		masterGain: null,
	},
	buffer: null,
	gain: 1,
	dialogs: {
		config: false,
		audio: true,
	},
	toggle(name) {
		this.show = this.show === name ? null : name;
	},
	// Generate a simple stereo impulse response for the ConvolverNode
	createReverbImpulse(durationSeconds, decay, reverse = false) {
		const sr = this.audioContext.sampleRate;
		const length = Math.max(1, Math.floor(sr * durationSeconds));
		const impulse = this.audioContext.createBuffer(2, length, sr);
		for (let channel = 0; channel < 2; channel++) {
			const data = impulse.getChannelData(channel);
			for (let i = 0; i < length; i++) {
				const n = reverse ? length - i : i;
				// Exponential decay shaped by "decay" parameter
				data[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
			}
		}
		return impulse;
	},
	computeDelayParams() {
		const delayTime = this.settings.delay_length.value;
		const wet = Math.min(0.9, Math.max(0.0, this.settings.delay_strength.value / 10));
		const feedback = Math.max(0, Math.min(0.85, wet * 0.6));
		return {delayTime, wet, feedback};
	},
	computeReverbParams() {
		const room = this.settings.reverb_roomsize.value; // 1..10
		const duration = 0.5 + (room / 10) * 4.5; // 0.5s .. 5.0s
		const damping = this.settings.reverb_damping.value; // 1..10
		const decay = 0.5 + (damping / 10) * 3.0; // shape exponential decay
		const wet = Math.min(0.9, Math.max(0.0, this.settings.reverb_strength.value / 10));
		const lpHz = this.settings.reverb_tone_low_pass_hz.value;
		return {duration, decay, wet, lpHz};
	},
	updateEffectsGraph() {
		if (!this.currentSource || !this.liveNodes.masterGain) return;
		// Delay
		if (this.effects.delay) {
			if (!this.liveNodes.delay) {
				const delayNode = this.audioContext.createDelay(5.0);
				const feedback = this.audioContext.createGain();
				const delayWet = this.audioContext.createGain();
				// source -> delay -> feedback loop -> wet -> master
				this.currentSource.connect(delayNode);
				delayNode.connect(feedback);
				feedback.connect(delayNode);
				delayNode.connect(delayWet);
				delayWet.connect(this.liveNodes.masterGain);
				this.liveNodes.delay = delayNode;
				this.liveNodes.feedback = feedback;
				this.liveNodes.delayWet = delayWet;
			}
			const {delayTime, wet, feedback} = this.computeDelayParams();
			this.liveNodes.delay.delayTime.value = delayTime;
			this.liveNodes.feedback.gain.value = feedback;
			this.liveNodes.delayWet.gain.value = wet;
		} else {
			if (this.liveNodes.delayWet) this.liveNodes.delayWet.gain.value = 0;
		}
		// Reverb
		if (this.effects.reverb) {
			if (!this.liveNodes.reverbConvolver) {
				const convolver = this.audioContext.createConvolver();
				convolver.normalize = true;
				const lowpass = this.audioContext.createBiquadFilter();
				lowpass.type = 'lowpass';
				const reverbWet = this.audioContext.createGain();
				// source -> convolver -> lowpass -> wet -> master
				this.currentSource.connect(convolver);
				convolver.connect(lowpass);
				lowpass.connect(reverbWet);
				reverbWet.connect(this.liveNodes.masterGain);
				this.liveNodes.reverbConvolver = convolver;
				this.liveNodes.reverbLowpass = lowpass;
				this.liveNodes.reverbWet = reverbWet;
			}
			const {duration, decay, wet, lpHz} = this.computeReverbParams();
			// Rebuild impulse when parameters change
			this.liveNodes.reverbConvolver.buffer = this.createReverbImpulse(duration, decay, false);
			this.liveNodes.reverbLowpass.frequency.value = lpHz;
			this.liveNodes.reverbWet.gain.value = wet;
		} else {
			if (this.liveNodes.reverbWet) this.liveNodes.reverbWet.gain.value = 0;
		}
	},
	async playCutWithEffects(name = 'fresh') {
		try {
			await this.audioContext.resume();
		} catch (e) {}
		// Stop any current preview
		if (this.currentSource) {
			try { this.currentSource.stop(); } catch (e) {}
			try { this.currentSource.disconnect(); } catch (e) {}
			this.currentSource = null;
		}
		// Fetch and decode the selected cut
		const url = `/audio/cuts/${name}.wav`;
		const arrayBuffer = await fetch(url).then(r => r.arrayBuffer());
		const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
		// Build graph
		const source = this.audioContext.createBufferSource();
		source.buffer = buffer;
		this.currentSource = source;
		const masterGain = this.audioContext.createGain();
		masterGain.gain.value = 1.0;
		masterGain.connect(this.audioContext.destination);
		this.liveNodes.masterGain = masterGain;
		// Dry path
		const dryGain = this.audioContext.createGain();
		dryGain.gain.value = 1.0;
		source.connect(dryGain);
		dryGain.connect(masterGain);
		// Reset effect node references for this new source and configure based on current settings
		this.liveNodes.delay = null;
		this.liveNodes.feedback = null;
		this.liveNodes.delayWet = null;
		this.liveNodes.reverbConvolver = null;
		this.liveNodes.reverbLowpass = null;
		this.liveNodes.reverbWet = null;
		this.updateEffectsGraph();
		// Start playback
		source.start();
		source.onended = () => {
			try { source.disconnect(); } catch (e) {}
			if (this.currentSource === source) this.currentSource = null;
		};
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
	async playWAV(path) {
		// If the audio is already playing, stop it
		console.log(path);
		// Use the audioContext to play the audio
		const audioBuffer = await fetch(path).then(response => response.arrayBuffer());
		this.audioContext.decodeAudioData(audioBuffer).then(buffer => {
			const audioBufferSource = this.audioContext.createBufferSource();
			audioBufferSource.buffer = buffer;
			audioBufferSource.connect(this.audioContext.destination);
			audioBufferSource.start();
			audioBufferSource.stop();
		});

		// if (!this.audio.paused) {
		// 	this.audio.pause();
		// 	this.audio.currentTime = 0;
		// 	return;
		// }
		// this.audio.src = path;
		// this.audio.play();
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
	settingChanged(name) {
		// Live updates for preview nodes if active
		if (!this.currentSource) return; // only when preview is playing
		this.updateEffectsGraph();
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
	onMounted() {
		this.loadPreferences();
	},
}).mount();
