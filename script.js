"use strict";

const doc = document;

// Objeto audio
const audio = new Audio();

// Estado del reproductor
let playerState = {
    originalPlaylist: [],
    playbackQueue: [],
    tracksMap: new Map(),
    trackIndexMap: new Map(),
    currentIndex: 0, // Podemos setear a null, si es que no queremos cargar nada por defecto, o -1 nada cargado aún
    isShuffle: false,
    isPlaying: false,
    repeatMode: "none" // "none" | "all" | "one"
}

const repeatConfig = {
    none: {
        next: "all",
        title: "Repetir playlist",
        active: false
    },
    all: {
        next: "one",
        title: "Repetir canción indefinidamente",
        active: true
    },
    one: {
        next: "none",
        title: "Desactivar la repetición indefinida",
        active: true
    }
}

// Variable para control de list item seleccionado actualmente en la playlist del DOM

let loadToken = 0;
let isSeeking = false;
let rafId = null;
let lastTime = 0;
let currentListItem = null;

// URL para petición de los datos de la playlist "salsa" al backend
const BASE_URL = "https://neobte.github.io/musica/playlists/salsa/";

const PREVIOUS_TRACK_THRESHOLD = 3;

const DEFAULT_AUDIO_VOLUME = .16; // 33%

let currentAudioVolume = DEFAULT_AUDIO_VOLUME;

const DOCUMENT_TITLE = "Neobte - Express Audio";

/*** Referencias Cacheadas ***/
const documentTitle = doc.getElementById("document-title");
documentTitle.textContent = DOCUMENT_TITLE;
// Detalles de Título y Artista, componente superior
const playerTrackTitle = doc.getElementById("player-track-title");
const playerTrackArtist = doc.getElementById("player-track-artist");

// Detalles de número de track de total de tracks
const playerCurrentTrack = doc.getElementById("player-current-track");
const playerTotalTracks = doc.getElementById("player-total-tracks");

// Cacheamos la playlist para agregar tracks
const playlist = doc.getElementById("playlist");

// Detalles del tiempo de reproducción
const currentTime = doc.getElementById("current-time");
const currentTimeSlider = doc.getElementById("current-time-slider");
currentTimeSlider.value = 0;
const durationTime = doc.getElementById("duration-time");

// Detalles de los componentes de volumen
const volumeBtn = doc.getElementById("volume-btn");
const volumeIcon = doc.getElementById("volume-icon");
const volumeSlashIcon = doc.getElementById("volume-slash-icon");
const volumeSlider = doc.getElementById("volume-slider");
const volumeValue = doc.getElementById("volume-value");

volumeSlider.value = DEFAULT_AUDIO_VOLUME * 100; // El valor por defecto es "50"
volumeValue.textContent = volumeSlider.value;
audio.volume = volumeSlider.value / 100;

// Controles del reproductor
const shuffleBtn = doc.getElementById("shuffle-btn");
const shuffleIconCircle = shuffleBtn.querySelector("circle");
const backwardStepBtn = doc.getElementById("backward-step-btn");
const playPauseBtn = doc.getElementById("play-pause-btn");
const playIcon = doc.getElementById("play-icon");
const pauseIcon = doc.getElementById("pause-icon");
const forwardStepBtn = doc.getElementById("forward-step-btn");
const repeatBtn = doc.getElementById("repeat-btn");
const repeatIcon = doc.getElementById("repeat-icon");
const repeatIndicator = doc.getElementById("repeat-indicator");
const repeat1Icon = doc.getElementById("repeat-1-icon");

const playingIcon = doc.createElement('img');
playingIcon.src = 'images/bars.svg';
playingIcon.width = 14;
playingIcon.height = 14;
playingIcon.alt = 'Playing';
playingIcon.classList.add('playing-icon');

doc.addEventListener("DOMContentLoaded", () => {
    init();
});

const init = () => {

    const request_url = BASE_URL + "playlist.json"; // Aquí no hace falta encodeURIComponent()

    // Petición de los datos al servidor
    sendFetchHttpRequest(request_url, loadPlaylist);
}

const loadPlaylist = response => {
    // Respuesta del backend
    // playerState.originalPlaylist = response.tracks.items.slice(0, 5);
    playerState.originalPlaylist = response.tracks.items;
    playerState.playbackQueue = [...playerState.originalPlaylist];

    // Creamos un Mapper para ubicar los tracks más rapidamente por su ID
    playerState.tracksMap = new Map(playerState.originalPlaylist.map(track => [track.id, track]));

    // Creamos un Mapper para ubicar el índice del track más rapidamente por su ID
    playerState.trackIndexMap = new Map(playerState.originalPlaylist.map((track, index) => [track.id, index]));
    // console.log(playerState.trackIndexMap);

    // Obtenemos un currentIndex distinto, cada vez que cargamos la página. No queremos que siempre inicie en 0
    playerState.currentIndex = getRandomInt(0, playerState.playbackQueue.length - 1);
    // playerState.currentIndex = 0;

    // Obtenemos el track en la posición de playerState.currentIndex por defecto
    const track = getCurrentTrack();

    // Cargamos el track en el reproductor, no lo hacemos sonar
    loadTrack(track);

    // Renderizamos en la UI la playlist de canciones
    renderTracks();

    // Actualizamos la UI, con el nombre del título y el artista
    updateCurrentTrackUI(track);

    // Actualizamos la UI, X número de canción de un total de Y canciones
    playerCurrentTrack.textContent = playerState.currentIndex + 1;

    // Actulizamos la UI, número total de canciones
    playerTotalTracks.textContent = playerState.playbackQueue.length;
}

// Solo se renderiza una sola vez!!!
const renderTracks = () => {

    // Limpiamos todo lo que tiene el elemento playlist anteriormente
    playlist.innerHTML = '';

    // Creamos un fragmento para no esta haciendo appendchild en cada iteración del bucle
    const fragment = doc.createDocumentFragment();

    // Recorremos el array de tracks
    playerState.playbackQueue.forEach((track, index) => {
        // Creamos un list item por cada track
        const li = doc.createElement("li");

        // Creamos un dataset con el ID de cada track
        li.dataset.trackId = track.id;

        // Agregamos la clase "playlist-track" a cada list item
        li.classList.add("playlist-track");

        // Agregamos todos los elementos hijos del list item
        li.innerHTML = `
                    <div class="playlist-track__number">
                        <span class="track-number">${index + 1}</span>
                    </div>
                    <div class="playlist-track__info">
                        <h3 class="playlist-track__title">${track.title}</h3>
                        <p class="playlist-track__artist">${track.artist}</p>
                    </div>
                    <div class="playlist-track__duration">
                        <span>${formatTime(track.duration)}</span>
                    </div>
                `;
        // Por cada iteración agregamos un list item al fragmento
        fragment.appendChild(li);
    });

    // Aquí agregamos todos los list item contenidos en el fragmento al DOM, por lo tanto ahora ya existen
    playlist.appendChild(fragment);

    // Obtenemos el list item de la playlist
    const nextListItem = playlist.children[playerState.currentIndex];

    // Agregamos la clase "is-selected"
    nextListItem.classList.add("is-selected");

    // Asignamos una copia a la variabloe currentListItem, por lo tanto en el momento que hagamos 
    // click en forward o backward, la variable currentListItem contendra una referencia del list item inicial
    currentListItem = nextListItem;

    scrollIntoView(nextListItem);
}

// Delegación de eventos para seleccionar un track de la playlist, cuando el usuario hace click en un track
playlist.addEventListener("click", e => {
    const li = e.target.closest(".playlist-track");

    if (!li) return;

    if (li === currentListItem) {
        // Ya sea por pause o play. Toggle pause/play opcional
        if (playerState.isPlaying) {
            pauseAudio();
            li.classList.remove("is-playing");
            removeIcon(li);
        } else {
            playAudio();
            li.classList.add("is-playing");
            attachIcon(li);
        }
        return;
    }

    // si ya había uno activo, lo desactivamos
    if (currentListItem && currentListItem !== li) {
        currentListItem.classList.remove("is-selected");
        currentListItem.classList.remove("is-playing");
        removeIcon(currentListItem);
    }

    // Asignamos la referencia a la variable currentListItem cuyo valor original es null al principio del todo
    currentListItem = li;

    // Actualizamos la UI
    li.classList.add("is-selected");

    // Obtenemos el ID del track
    const trackId = Number(li.dataset.trackId);

    // Obtenemos el track buscando POR SU ID en el tracksMap
    const track = playerState.tracksMap.get(trackId);

    playerState.currentIndex = playerState.playbackQueue.findIndex(track => track.id === trackId);

    // Cargamos el audio
    loadTrack(track);

    // Reproducimos el audio
    playAudio();
    li.classList.add("is-playing");
    attachIcon(li);

    // Actualizar UI
    updateCurrentTrackUI(track);

    // Actualizamos la UI, X número de canción de un total de Y canciones
    updateTrackPositionUI(track);
});

// Eventos de controles del reproductor
shuffleBtn.addEventListener("click", handleShuffle);
backwardStepBtn.addEventListener("click", handleBackward);
playPauseBtn.addEventListener("click", handlePlayPause);
forwardStepBtn.addEventListener("click", handleForward);
repeatBtn.addEventListener("click", handleRepeat);

function handleShuffle() {
    playerState.isShuffle = !playerState.isShuffle;

    if (playerState.isShuffle) {
        enableShuffle();
    } else {
        disableShuffle();
    }

    updateShuffleButtonUI();
}

function handleBackward() {

    const shouldRestartTrack = audio.currentTime > PREVIOUS_TRACK_THRESHOLD;

    if (shouldRestartTrack) {
        audio.currentTime = 0;
        return;
    }

    // 1. Actualizar playerState.currentIndex
    playerState.currentIndex = prevIndex();

    loadCurrentTrack();

    if (playerState.isPlaying) {
        playAudio();

        // Agregamos la clase is-playing, la clase is-selected fue agregada en el proceso de carga del track
        currentListItem.classList.add("is-playing");
        attachIcon(currentListItem);
    }
}

function handlePlayPause() {

    if (!audio.src) return;

    // El estado original al inicio de la aplicación es false
    if (playerState.isPlaying) {
        pauseAudio();

        // Removemos la clase is-playing, si se pulsa el botón pause
        currentListItem.classList.remove("is-playing");

        // Removemos el icon del ecualizador
        removeIcon(currentListItem);
    } else {
        playAudio();

        // Agregamos la clase is-playing, si se pulsa el botón play
        currentListItem.classList.add("is-playing");

        // Agregamos el icono del ecualizador
        attachIcon(currentListItem);
    }

    updatePlayPauseUI();
}

function handleForward() {
    // 1. Actualizar playerState.currentIndex
    playerState.currentIndex = nextIndex();

    loadCurrentTrack();

    if (playerState.isPlaying) {
        playAudio();

        // Agregamos la clase is-playing, la clase is-selected fue agregada en el proceso de carga del track
        currentListItem.classList.add("is-playing");
        attachIcon(currentListItem);
    }
}

function handleRepeat() {
    // playerState.repeatMode = "none",  default value
    playerState.repeatMode = repeatConfig[playerState.repeatMode].next; // Aquí playerState.repeatMode empieza a cambiar de estado
    updateRepeatUI();
}

audio.addEventListener("play", () => {
    playerState.isPlaying = true;
    updatePlayPauseUI();

    // if (currentListItem) {
    //     currentListItem.classList.add('playing');
    // }
});
audio.addEventListener("pause", () => {
    playerState.isPlaying = false;
    updatePlayPauseUI();

    // if (currentListItem) {
    //     currentListItem.classList.remove('playing');
    // }
});

audio.addEventListener("loadedmetadata", handleLoadedmetadata);
audio.addEventListener("timeupdate", handleTimeupdate);
audio.addEventListener("waiting", () => {/* showLoadingUI(true); */ });
audio.addEventListener("canplay", () => {/*showLoadingUI(false); */ });
audio.addEventListener("ended", handleEnded);

function handleLoadedmetadata() {
    if (audio.dataset.token != loadToken) return;

    const duration = audio.duration;

    if (!Number.isFinite(duration)) return;

    currentTimeSlider.max = duration;

    durationTime.textContent = formatTime(duration);
}

function renderProgress() {
    rafId = null;

    const time = lastTime;

    currentTime.textContent = formatTime(time);
    currentTimeSlider.value = time;
}

function handleTimeupdate() {
    if (isSeeking) return;

    lastTime = audio.currentTime;

    if (!rafId) {
        rafId = requestAnimationFrame(renderProgress);
    }

    // if (isSeeking) return;

    // const t = audio.currentTime;

    // // Error detectado en el formateo de tiempo, por ejemplo: -5:NaN
    // if (!Number.isFinite(t)) return;

    // currentTimeSlider.value = t;

    // currentTime.textContent = formatTime(t);

    // countdown.textContent = `-${formatTime(audio.duration - t)}`;
}

function handleEnded() {

    // Repeat one -> misma canción
    if (playerState.repeatMode === "one") {
        audio.currentTime = 0; // Aquí si tiene sentido, por que queremos reproducir la canción ya cargada otra vez!!!
        playAudio();
        // Aquí no agregamos las clases is-selected y is-playing, porque ya las contiene el elemento
        return;
    }

    const isLastTrack = playerState.currentIndex === playerState.playbackQueue.length - 1;
    // repeat none + última canción → reset sin reproducir
    if (isLastTrack && playerState.repeatMode === "none") {
        playerState.currentIndex = 0;
        const track = getCurrentTrack();
        setAudioTrack(track);
        syncPlayerUI(track);
        return;
    }

    // repeat all o avance normal
    playerState.currentIndex = nextIndex();
    const track = getCurrentTrack();
    setAudioTrack(track);
    syncPlayerUI(track);
    playAudio();
    currentListItem.classList.add("is-playing");
    attachIcon(currentListItem);

}

const scrollIntoView = listItem => {
    listItem.scrollIntoView({ behavior: "smooth", block: "center" });
}

volumeSlider.addEventListener("input", handleVolumeSlider);
volumeBtn.addEventListener("click", handleVolumeBtn);
currentTimeSlider.addEventListener("input", handleCurrentTimeSlider);
currentTimeSlider.addEventListener("change", () => {
    audio.currentTime = currentTimeSlider.value;
    isSeeking = false;
});

function handleVolumeSlider() {
    if (volumeSlider.value === "0") {
        audio.volume = 0;
        currentAudioVolume = 0.5;

        // UI
        volumeBtn.title = "Activar sonido";
        volumeIcon.classList.add("d-none");
        volumeSlashIcon.classList.remove("d-none");

    } else {
        audio.volume = volumeSlider.value / 100; // 0.x
        currentAudioVolume = audio.volume;

        // UI
        volumeBtn.title = "Silenciar";
        volumeIcon.classList.remove("d-none");
        volumeSlashIcon.classList.add("d-none");
    }
    // UI
    volumeValue.textContent = volumeSlider.value;
}

function handleVolumeBtn() {
    if (volumeSlider.value > "0") {
        audio.volume = 0;
        volumeSlider.value = 0;

        // UI
        volumeBtn.title = "Activar sonido";
        volumeIcon.classList.add("d-none");
        volumeSlashIcon.classList.remove("d-none");
    } else {
        audio.volume = currentAudioVolume; // Values are  between 0.1 and 1, where 1 = 100 %
        volumeSlider.value = audio.volume * 100; // Values are between 0 and 100

        // UI
        volumeBtn.title = "Silenciar";
        volumeIcon.classList.remove("d-none");
        volumeSlashIcon.classList.add("d-none");
    }
    // UI
    volumeValue.textContent = volumeSlider.value;
}

function handleCurrentTimeSlider() {
    if (currentTimeSlider.disabled) return;
    isSeeking = true;
    currentTime.textContent = formatTime(currentTimeSlider.value);
}

function enableShuffle() {

    // Obtenemos la canción actualmente en reproducción
    const currentTrack = getCurrentTrack();

    // Obtenemos la longitud del arreglo de canciones
    const len = playerState.playbackQueue.length;

    // Construimos un array con un elemento menos, ej. si hay 5 canciones, entonces new Array tendra lugar para 4 canciones
    let rest = new Array(len - 1);

    let k = 0;
    for (let i = 0; i < len; i++) {
        // Llenamos el array, sin la canción actualmente en reproducción
        if (i === playerState.currentIndex) continue;
        rest[k++] = playerState.playbackQueue[i];
    }

    // Mezclamos el array
    rest = shuffleArray(rest);

    // Construimos la nueva cola
    playerState.playbackQueue = [currentTrack, ...rest];

    // Seteamos con 0, ya que la canción actualmente en reproducción esta en la posición 0
    playerState.currentIndex = 0;
}

function disableShuffle() {
    // Track actualmente en reproducción
    const currentTrack = getCurrentTrack();

    // Devolvemos el orden original al array "playbackQueue"
    playerState.playbackQueue = [...playerState.originalPlaylist];

    // Este es un Map creado con los índices originales
    const originalIndex = playerState.trackIndexMap.get(currentTrack.id);

    playerState.currentIndex = originalIndex;
}

function nextIndex() {
    return (playerState.currentIndex + 1) % playerState.playbackQueue.length;
}

function prevIndex() {
    return (playerState.currentIndex - 1 + playerState.playbackQueue.length) % playerState.playbackQueue.length;
}

function loadCurrentTrack() {
    const track = getCurrentTrack();

    if (!track) return;

    loadTrack(track);

    syncPlayerUI(track);
}

function loadTrack(track) {
    pauseAudio();
    audio.currentTime = 0;
    setAudioTrack(track);
}

function getCurrentTrack() {
    return playerState.playbackQueue[playerState.currentIndex];
}

function setAudioTrack(track) {
    const token = ++loadToken;

    audio.src = BASE_URL + encodeURIComponent(track.name);
    // audio.load();
    currentTimeSlider.value = 0;
    currentTimeSlider.max = 0;
    currentTime.textContent = "0:00";
    durationTime.textContent = "0:00";
    audio.dataset.token = token;
}

async function playAudio() {
    try {
        await audio.play();
    } catch (err) {
        console.error("Error al reproducir audio:", err);
    }
}

function pauseAudio() {
    // console.log(`Status: ${audio.paused}`);
    if (audio.paused) return;
    audio.pause();
}

function setPlayingTrack(trackElement) {

    // si ya había uno activo, lo desactivamos
    if (currentListItem && currentListItem !== trackElement) {
        currentListItem.classList.remove('is-playing');
        removeIcon(currentListItem);
    }

    // activar nuevo
    currentListItem = trackElement;
    currentListItem.classList.add('is-playing');

    attachIcon(currentListItem);
}

function attachIcon(trackElement) {
    const container = trackElement.querySelector('.playlist-track__number');

    // mover icono (no clonar)
    container.appendChild(playingIcon);
}

function removeIcon(trackElement) {
    const icon = trackElement.querySelector('.playing-icon');
    if (icon) icon.remove();
}

// Funciones de UI
function updateRepeatUI() {
    // El primer clic en el button repeatBtn, origina que playerState.repeatMode = all
    // El segundo clic en el button repeatBtn, origina que playerState.repeatMode = one
    // El tercer clic en el button repeatBtn, origina que playerState.repeatMode = none
    const mode = playerState.repeatMode;

    repeatBtn.classList.remove("active");
    // repeatIcon.classList.remove("d-none");
    // repeat1Icon.classList.add("d-none");
    // repeatIndicator.classList.add("d-none");

    if (mode === "none") {
        repeatBtn.title = repeatConfig[mode].title;
        repeat1Icon.classList.add("d-none"); // Ocultamos el icono de repeat-1-icon
        repeatIcon.classList.remove("d-none"); // Mostramos el icono de repeat icon
        return;
    }

    if (mode === "all") {
        repeatIndicator.classList.remove("d-none"); // Mostramos el circulo dentro del icono svg
        repeatBtn.title = repeatConfig[mode].title;
        repeatBtn.classList.add("active");
        return;
    }

    if (mode === "one") {
        repeat1Icon.classList.remove("d-none"); // Mostramos el icono repeat-1-icon
        repeatBtn.title = repeatConfig[mode].title;
        repeatBtn.classList.add("active");
        repeatIndicator.classList.add("d-none"); // Ocultamos el circulo dentro del icono svg
        repeatIcon.classList.add("d-none"); // Ocultamos el icono de repeat icon
        return;
    }
}

function updatePlayPauseUI() {
    const isPlaying = playerState.isPlaying;

    playIcon.classList.toggle("d-none", isPlaying);
    pauseIcon.classList.toggle("d-none", !isPlaying);
    playPauseBtn.title = isPlaying ? "Pausar" : "Reproducir";

}

function syncPlayerUI(track) {
    if (!track) return;
    updateCurrentTrackUI(track);
    updateTrackPositionUI(track);
    updatePlaylistSelectionUI(track);
}

function updatePlaylistSelectionUI(track) {

    if (currentListItem) {
        currentListItem.classList.remove("is-selected");
        currentListItem.classList.remove("is-playing");
        removeIcon(currentListItem);
    }

    const nextListItem = doc.querySelector(`li[data-track-id="${track.id}"]`);

    if (!nextListItem) return;

    // Agregamos la clase is-selected, la clase is playing sera agregada cuando se llame a la función playAudio()
    nextListItem.classList.add("is-selected");

    // Volvemos a asignar la referencia a la variable currentListItem
    currentListItem = nextListItem;

    scrollIntoView(nextListItem);
}

function updateCurrentTrackUI(track) {
    documentTitle.textContent = `${track.title} - ${track.artist}`;
    playerTrackTitle.textContent = track.title;
    playerTrackArtist.textContent = track.artist;
}

function updateTrackPositionUI(track) {
    // const currentTrack = track;
    // const originalIndex = playerState.originalPlaylist.findIndex(track => track.id === currentTrack.id);

    // Este es un Map creado con los índices originales
    const originalIndex = playerState.trackIndexMap.get(track.id);

    playerCurrentTrack.textContent = originalIndex + 1;
    // playerCurrentTrack.textContent = playerState.originalPlaylist.findIndex(t => t.id === trackId) + 1;
}

function updateShuffleButtonUI() {
    shuffleBtn.classList.toggle("active", playerState.isShuffle);
    shuffleBtn.title = playerState.isShuffle
        ? "Desactivar reproducción aleatoria"
        : "Activar reproducción aleatoria";

    shuffleIconCircle.classList.toggle("d-none");
}

// Request to server
const sendFetchHttpRequest = async (url, callback, method = "GET", data = {}) => {
    method = method.toUpperCase();

    const options = {
        method,
        headers: {}
    }

    if (method === 'GET') {
        const queryString = new URLSearchParams(data).toString();
        url += queryString ? `?${queryString}` : '';
    }

    if (method === 'POST') {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        // options.headers['Accept'] = "application/json, text/javascript, */*; q=0.01";
        // options.headers['Accept-Language'] = "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7";
        // options.headers['Sec-Fetch-Mode'] = "cors";
        // options.headers['Sec-Fetch-Site'] = "same-origin";
        options.body = new URLSearchParams(data).toString();
        // options.mode = "cors";
        // options.referrer = "https://www.correoargentino.com.ar/";
        // options.body = "action=localidades&localidad=none&calle=&altura=&provincia=B"
    }

    try {
        const response = await fetch(url + (/\?/.test(url) ? "&" : "?") + new Date().getTime(), options);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const contentType = response.headers.get("content-type");
        // console.log(contentType); // application/json; charset=utf-8
        if (contentType &&
            contentType.toLowerCase().indexOf("application/json") >= 0) {
            // Content-Type: text/html; charset=UTF-8
            callback(await response.json()); // Esto asignaría la referencia a la variable "songs"
            // callback(await response.text()); // Para parsear el string con JSON.parse y asignar a la variable
        }
    } catch (error) {
        console.log(error.message);
    }
}

// Format time in hh:mm:ss or mm:ss
const formatTime = (seconds, format = 0) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    // Int mod Int = Int
    const h = Math.floor(seconds / 3600); // hours calculation
    const min = Math.floor(seconds / 60) % 60; // min calculation
    const s = Math.floor(seconds) % 60; // Whole seconds

    if (format === 0) {
        return h > 0
            ? `${/*h < 10 ? "0" + h : */h}:${min < 10 ? "0" + min : min}:${s < 10 ? "0" + s : s}`
            : `${/*min < 10 ? "0" + min : */min}:${s < 10 ? "0" + s : s}`;
    }

    return h > 0
        ? // Show hours min seconds format => 10 h 8 min 47 s
        `${h} h ${min} min ${s} s`
        : // Show min seconds format => 8 min 47 s
        `${min} min ${s} s`;
}

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// https://introcs.cs.princeton.edu/java/14array/Deck.java.html
const shuffleArray = arr => {
    const n = arr.length;
    for (let i = 0; i < n; i++) {
        const r = i + Math.floor(Math.random() * (n - i));
        [arr[i], arr[r]] = [arr[r], arr[i]];
    }
    return arr;
}

const parseName = name => {
    const dot = name.lastIndexOf(".");
    const sep = name.indexOf(" - ");
    return {
        artist: name.slice(0, sep),
        title: name.slice(sep + 3, dot)
    }
}

