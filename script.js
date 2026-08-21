"use strict";

const d = document;

/**
 * Referencias cacheadas
 */

// Información acerca del track
const trackArtist = d.getElementById("track-artist");
const trackTitle = d.getElementById("track-title");

// Información acerca del tiempo del track
const trackCurrentTime = d.getElementById("track-current-time");
const currentTimeSlider = d.getElementById("current-time-slider");
const trackDuration = d.getElementById("track-duration");

// Controles
const shuffleBtn = d.getElementById("shuffle-btn");
const shuffleIconCircle = shuffleBtn.querySelector("circle");

const backwardBtn = d.getElementById("backward-btn");

const playPauseBtn = d.getElementById("play-pause-btn");
const playIcon = d.getElementById("play-icon");
const pauseIcon = d.getElementById("pause-icon");

const forwardBtn = d.getElementById("forward-btn");

const repeatBtn = d.getElementById("repeat-btn");
const repeatIcon = d.getElementById("repeat-icon");
const repeatIndicator = d.getElementById("repeat-indicator");
const repeat1Icon = d.getElementById("repeat-1-icon");

// Información de X número de track de Y número total de tracks
const trackCurrentIndex = d.getElementById("track-current-index");
const tracksTotal = d.getElementById("tracks-total");

// Información acerca del volumen
const volumeBtn = d.getElementById("volume-btn");
const volumeIcon = d.getElementById("volume-icon");
const volumeSlashIcon = d.getElementById("volume-slash-icon");

const volumeSlider = d.getElementById("volume-slider");
const volumeValue = d.getElementById("volume-value");

// Playlist de tracks
const playlist = d.getElementById("playlist");

const playingIcon = d.createElement('img');
playingIcon.src = 'images/bars.svg';
playingIcon.alt = 'Playing';
playingIcon.classList.add('playing-icon');

const playlistOptions = d.getElementById("playlist-options");

// Objeto audio
const audioElement = new Audio();

// Umbral de tiempo para repetir un track cuando se hace clic en el botón backward
const PREVIOUS_TRACK_THRESHOLD = 3;

// Volumen por defecto
const DEFAULT_VOLUME = 33;

// Volumen por defecto a restaurar cuando el slider sea 0
const RESTORE_DEFAULT_VOLUME = 50;

// REQUEST URI
const BASE_URL = "https://neobte.github.io/audio-repo/playlists/";

const PLAYER_STATE = {
    IDLE: "idle",
    READY: "ready",
    PLAYING: "playing",
    PAUSED: "paused"
};

// Player state
const playerState = {
    selectedTrackIndex: 32,
    isPlaying: false,
    isShuffle: false,
    tracksMap: new Map(),
    trackIndexMap: new Map(),
    originalPlaylist: [],
    playbackQueue: [],
    previousVolume: DEFAULT_VOLUME,
    mutedFromSlider: false,
    repeatMode: "none", // "none" | "all" | "one"
    status: PLAYER_STATE.IDLE,
}

// Modos de repetición
const repeatModes = {
    none: {
        next: "all",
        title: "Repetir playlist"
    },
    all: {
        next: "one",
        title: "Repetir canción indefinidamente"
    },
    one: {
        next: "none",
        title: "Desactivar la repetición indefinida"
    }
}

let currentListItem = null;
let playlistName = null;
let currentPlaylist = null;

// Evento que carga el contenido de la página
d.addEventListener("DOMContentLoaded", () => {

    init();

});


// Función que inicia toda la aplicación
function init() {

    // Actualiza valores iniciales de volumen al inicio de la app
    initializeVolume();

    playerState.status = PLAYER_STATE.IDLE;

    syncPlayerUI();

    // Delegación de eventos en la lista de playlists para seleccionar una playlist
    bindPlaylistOptionsEvents();

    // Delegación de eventos en la playlist para seleccionar un track
    bindPlaylistEvents();
}

function syncPlayerUI() {

    const player = d.querySelector(".player");

    const isReady = playerState.status !== PLAYER_STATE.IDLE;

    player.classList.toggle("is-idle", !isReady);
    player.classList.toggle("is-ready", isReady);

    d.querySelectorAll(".controls .btn").forEach(btn => {
        btn.disabled = !isReady;
    });

    currentTimeSlider.disabled = !isReady;

}

function bindPlaylistOptionsEvents() {

    playlistOptions.addEventListener("click", (e) => {

        const li = e.target.closest("li");

        if (!li) return;

        if (li === currentPlaylist) {
            return;
        }

        if (currentPlaylist && currentPlaylist !== li) {
            currentPlaylist.classList.remove("active");
        }

        // Asignamos la referencia a la variable currentPlaylist
        currentPlaylist = li;

        li.classList.add("active");

        playlistName = li.dataset.playlist;

        const request_url = BASE_URL + playlistName + "/playlist.json";

        // Petición de los datos al servidor
        sendFetchHttpRequest(request_url, handleLoadPlaylist);

    });
}

function handleLoadPlaylist(response) {

    setPlaylistState(response);

    updatePlayPauseBtnUI();

    // Actualiza valores iniciales de tiempo al inicio de la app
    updateCurrentTimeValues();

    // Renderizamos la playlist
    renderPlaylist();

    // Despues de renderizar la playlist verificamos el shuffle
    if (playerState.isShuffle) {
        enableShuffle();
    }

    // Mostramos en consola la duración de la playlist
    getPlaylistDuration();

    // Obtenemos el track y lo cargamos
    loadSelectedTrack();
}

function setPlaylistState(response) {

    // playerState.originalPlaylist = response.tracks.items.slice(0, 5);
    playerState.originalPlaylist = response.tracks;

    // Creamos un Mapper para ubicar los tracks más rapidamente por su ID
    playerState.tracksMap = new Map(playerState.originalPlaylist.map(track => [track.id, track]));

    // Creamos un Mapper para ubicar el índice del track más rapidamente por su ID
    playerState.trackIndexMap = new Map(playerState.originalPlaylist.map((track, index) => [track.id, index]));

    playerState.playbackQueue = [...playerState.originalPlaylist];

    // Obtenemos un selectedTrackIndex distinto, cada vez que cargamos la página. No queremos que siempre inicie en 0
    playerState.selectedTrackIndex = getRandomInt(0, playerState.playbackQueue.length - 1);

    playerState.status = PLAYER_STATE.READY;

    playerState.isPlaying = false;

    syncPlayerUI();

}

/**
 * Eventos de controles
 */

// Evento click del botón play/pause
playPauseBtn.addEventListener("click", () => {

    if (!playerState.isPlaying) {
        playTrack();
    } else {
        pauseTrack();
    }
});

// Evento click del botón shuffle
shuffleBtn.addEventListener("click", () => {

    if (!Array.isArray(playerState.playbackQueue) || !playerState.playbackQueue.length) {
        return;
    }

    playerState.isShuffle = !playerState.isShuffle;

    if (playerState.isShuffle) {
        enableShuffle();
    } else {
        disableShuffle();
    }

    updateShuffleButtonUI();

    syncPlayerUI();
});

// Evento click del botón backward
backwardBtn.addEventListener("click", () => {

    const shouldRestartTrack = audioElement.currentTime > PREVIOUS_TRACK_THRESHOLD;

    if (shouldRestartTrack) {
        audioElement.currentTime = 0;
        return;
    }

    // Seteamos el índice del track anterior
    setPreviousTrackIndex();

    handleTrackChange();
});

// Evento click del botón forward
forwardBtn.addEventListener("click", () => {

    // Seteamos el índice del siguiente track
    setNextTrackIndex();

    handleTrackChange();
});

// Evento click del botón repetir
repeatBtn.addEventListener("click", () => {

    // Seteamos el modo de repetición
    playerState.repeatMode = repeatModes[playerState.repeatMode].next;

    updateRepeatButtonUI();
});

/**
 * Eventos del objeto audio
 */

audioElement.addEventListener("ended", handleTrackEnded);

// Evento play. playback state
audioElement.addEventListener("play", () => {

    playerState.isPlaying = true;

    updatePlayPauseBtnUI();

    currentListItem.classList.add("is-playing");
    attachIcon(currentListItem);
});

// Evento pause
audioElement.addEventListener("pause", () => {

    playerState.isPlaying = false;

    updatePlayPauseBtnUI();

    currentListItem.classList.remove("is-playing");
    removeIcon(currentListItem);
});

// Evento loadedmetadata
audioElement.addEventListener("loadedmetadata", () => {

    if (!Number.isFinite(audioElement.duration)) return;

    currentTimeSlider.max = audioElement.duration;

    // UI
    trackDuration.textContent = formatTime(audioElement.duration);
});

// Evento timeupdate
audioElement.addEventListener("timeupdate", () => {

    if (!Number.isFinite(audioElement.currentTime)) return;

    currentTimeSlider.value = audioElement.currentTime;

    // UI
    trackCurrentTime.textContent = formatTime(audioElement.currentTime);
});

// Evento input del Slider de tiempo
currentTimeSlider.addEventListener("input", () => {

    audioElement.currentTime = Number(currentTimeSlider.value);
});

// Evento input del Slider de volumen
volumeSlider.addEventListener("input", () => {

    const volume = Number(volumeSlider.value);

    setVolume(volume);

    playerState.mutedFromSlider = volume === 0;
});

//  Evento click del botón de volumen
volumeBtn.addEventListener("click", () => {

    const currentVolume = Number(volumeSlider.value);

    if (currentVolume > 0) {

        setVolume(0);

    } else {

        const volumeToRestore = playerState.mutedFromSlider ? RESTORE_DEFAULT_VOLUME : playerState.previousVolume;

        setVolume(volumeToRestore);
    }
});

/**
 * 
 * UI
 */
function updateSelectedTrackUI(track) {

    if (currentListItem) {
        currentListItem.classList.remove("is-selected", "is-playing");
    }

    // Obtenemos el list item de la playlist
    const selectedListItem = d.querySelector(`li[data-track-id="${track.id}"]`);

    // Agregamos la clase "is-selected"
    selectedListItem.classList.add("is-selected");

    currentListItem = selectedListItem;

    scrollIntoView(selectedListItem);
}

// UI, botón volumen
function updateVolumeButtonUI(volume) {

    const isMuted = volume === 0;

    const text = isMuted
        ? "Activar sonido"
        : "Silenciar";

    volumeBtn.title = text;

    volumeIcon.classList.toggle("d-none", isMuted);
    volumeSlashIcon.classList.toggle("d-none", !isMuted);
}

// UI, Track info
function updateTrackInfoUI(track) {

    trackTitle.textContent = track.title;

    trackArtist.textContent = track.artist;
}

// UI, X número de track de Y número total de tracks
function updateTrackCounterUI(track) {

    const originalIndex = playerState.trackIndexMap.get(track.id);

    trackCurrentIndex.textContent = playerState.originalPlaylist.length > 0 ? originalIndex + 1 : 0;

    // La longitud siempre será la misma
    tracksTotal.textContent = playerState.originalPlaylist.length;
}

// UI, de valores de tiempo
function updateCurrentTimeValues() {

    trackCurrentTime.textContent = "0:00"; // Cambia su valor en el evento timeupdate del objeto audio

    currentTimeSlider.value = "0"; // Cambia su valor en el evento timeupdate del objeto audio

    currentTimeSlider.max = "0"; // Cambia su valor en el evento loadedmetadata del objeto audio

    trackDuration.textContent = "0:00"; // Cambia su valor en el evento loadedmetadata del objeto audio
}

// UI, de título de la página que mostrará el título y artista del track
function updateDocumentTitle(track) {

    if (!track) {
        document.title = "Express Audio";
        return;
    }

    document.title = `${track.title} - ${track.artist}`;
}

// UI, de botón aleatorio
function updateShuffleButtonUI() {

    shuffleBtn.classList.toggle("active", playerState.isShuffle);

    shuffleBtn.title = playerState.isShuffle
        ? "Desactivar reproducción aleatoria"
        : "Activar reproducción aleatoria";

    shuffleIconCircle.classList.toggle("d-none");
}

// UI, de botón play/pause
function updatePlayPauseBtnUI() {

    const isPlaying = playerState.isPlaying;

    playIcon.classList.toggle("d-none", isPlaying);

    pauseIcon.classList.toggle("d-none", !isPlaying);

    playPauseBtn.classList.toggle("is-playing", isPlaying);

    playPauseBtn.title = isPlaying ? "Pausar" : "Reproducir";

    playPauseBtn.setAttribute("aria-label", playPauseBtn.title);
}

//  UI, de botón repeat
function updateRepeatButtonUI() {

    const repeatMode = playerState.repeatMode;

    repeatBtn.classList.remove(`active`);

    repeatBtn.title = repeatModes[repeatMode].title;

    switch (repeatMode) {

        case "none":
            repeat1Icon.classList.add("d-none"); // Ocultamos el icono de repeat-1-icon
            repeatIcon.classList.remove("d-none"); // Mostramos el icono de repeat icon
            break;

        case "all":
            repeatIndicator.classList.remove("d-none"); // Mostramos el circulo dentro del icono svg
            repeatBtn.classList.add("active");
            break;

        case "one":
            repeat1Icon.classList.remove("d-none"); // Mostramos el icono repeat-1-icon
            repeatBtn.classList.add("active");
            repeatIndicator.classList.add("d-none"); // Ocultamos el circulo dentro del icono svg
            repeatIcon.classList.add("d-none"); // Ocultamos el icono de repeat icon
            break;
    }
}

/**
 * Funciones
 */
function renderPlaylist() {

    // Limpiamos todo lo que tiene el elemento playlist anteriormente
    playlist.innerHTML = '';

    // Creamos un fragmento para no esta haciendo appendchild en cada iteración del bucle
    const fragment = d.createDocumentFragment();

    const len = playerState.playbackQueue.length;

    for (let i = 0; i < len; i++) {

        // Obtenemos el track
        const track = playerState.playbackQueue[i];

        // Creamos un list item por cada track
        const li = d.createElement("li");

        // Creamos un dataset con el ID de cada track
        li.dataset.trackId = track.id;

        // Agregamos la clase "playlist-track" a cada list item
        li.classList.add("playlist-track");

        // Agregamos todos los elementos hijos del list item
        li.innerHTML = `
                    <div class="playlist-track__number">
                        <span class="track-number">${i + 1}</span>
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
    }

    // Aquí agregamos todos los list item contenidos en el fragmento al DOM, por lo tanto ahora ya existen
    playlist.appendChild(fragment);
}

// Delegación de eventos, cuando se hace click en una canción
function bindPlaylistEvents() {

    playlist.addEventListener("click", (e) => {
        const li = e.target.closest(".playlist-track");

        if (!li) return;

        if (li === currentListItem) {

            if (playerState.isPlaying) {
                pauseTrack();
            } else {
                playTrack();
            }

            return;
        }

        // si ya había uno activo, lo desactivamos
        if (currentListItem && currentListItem !== li) {
            currentListItem.classList.remove("is-selected", "is-playing");
            removeIcon(currentListItem);
        }

        // Asignamos la referencia a la variable currentListItem
        currentListItem = li;

        // Obtenemos el ID del track seleccionado
        const trackId = Number(li.dataset.trackId);

        // Obtenemos el track buscando POR SU ID en el tracksMap
        const track = playerState.tracksMap.get(trackId);

        // Cargamos el audio
        loadTrack(track);

        // Actualizamos la UI
        li.classList.add("is-selected");

        // Reproducimos el audio
        playTrack();

        // Buscamos el índice del track
        playerState.selectedTrackIndex = playerState.playbackQueue.findIndex(track => track.id === trackId);
    });
}

// Función para setear el volumen
function setVolume(volume) {

    audioElement.volume = volume / 100;
    // console.log(`Audio element: ${audioElement.volume}`);

    volumeSlider.value = volume;
    // console.log(`Volume slider: ${volumeSlider.value}`);
    volumeValue.textContent = volume;

    if (volume > 0) {
        playerState.previousVolume = volume;
    }

    updateVolumeButtonUI(volume);
}

// Función para inicializar el volumen
function initializeVolume() {

    setVolume(DEFAULT_VOLUME)
}

// Función que habilita el modo aleatorio
function enableShuffle() {

    // Obtenemos el track actualmente en reproducción
    const currentTrack = getSelectedTrack();

    // Obtenemos la longitud del arreglo de tracks
    const len = playerState.playbackQueue.length;

    // Construimos un array con un elemento menos, ej. si hay 5 tracks, entonces new Array tendra lugar para 4 tracks
    let rest = new Array(len - 1);

    let k = 0;

    for (let i = 0; i < len; i++) {
        // Llenamos el array, sin el track actualmente en reproducción
        if (i === playerState.selectedTrackIndex) continue;
        rest[k++] = playerState.playbackQueue[i];
    }

    // Mezclamos el array
    rest = shuffleArray(rest);

    // Construimos la nueva cola
    playerState.playbackQueue = [currentTrack, ...rest];

    // Seteamos con 0, ya que el track actualmente en reproducción esta en la posición 0
    playerState.selectedTrackIndex = 0;
}

// Función que deshabilita el modo aleatorio
function disableShuffle() {
    // Track actualmente en reproducción
    const currentTrack = getSelectedTrack();

    // Devolvemos el orden original al array "playbackQueue"
    playerState.playbackQueue = [...playerState.originalPlaylist];

    // Este es un Map creado con los índices originales
    const originalIndex = playerState.trackIndexMap.get(currentTrack.id);

    playerState.selectedTrackIndex = originalIndex;
}

// Función para cargar un track
function loadTrack(track) {

    // Esta función debe verificar que todo este bien antes de llamar a las otras funciones
    if (!track) return;

    pauseTrack();

    audioElement.currentTime = 0;

    // Construimos el audio source
    const src = `${BASE_URL}${playlistName}/${track.name}`;

    // Llamamos a la función que se encarga de setear el source
    setAudioSource(src);

    // UI, actualizamos título y artista
    updateTrackInfoUI(track);

    // UI, Actualizamos valores de tiempo
    updateCurrentTimeValues();

    // UI, actualizamos el contador X número de track de Y número de tracks
    updateTrackCounterUI(track);

    // UI, actualizamos el título del documento con información del track
    updateDocumentTitle(track);

    // UI, actualizamos en la playlist el track que ha sido seleccionado
    updateSelectedTrackUI(track);
}

// Función para manejar en termino de una canción en el evento ended del objeto audio
function handleTrackEnded() {

    switch (playerState.repeatMode) {

        case "one":
            audioElement.currentTime = 0;
            // Reproducimos el track
            playTrack();
            break;

        case "all":
            // Incrementamos el índice del siguiente track
            setNextTrackIndex();

            playSelectedTrack();
            break;

        case "none":
            handleEndedWithoutRepeat();
            break;
    }
}

function handleEndedWithoutRepeat() {

    const isLastTrack = playerState.selectedTrackIndex === playerState.playbackQueue.length - 1;

    if (isLastTrack) {
        resetToFirstTrack();
        return;
    }

    setNextTrackIndex();
    playSelectedTrack();
}

// Función que adjunta el icono de las barras a la canción en reproducción
function attachIcon(listItem) {

    const container = listItem.querySelector('.playlist-track__number');

    // mover icono (no clonar)
    container.appendChild(playingIcon);
}

// Función que remueve el icoo de las barras a la canción en reproducción
function removeIcon(listItem) {

    const playingIcon = listItem.querySelector('.playing-icon');

    if (playingIcon) playingIcon.remove();
}

// Resetea al primer track
function resetToFirstTrack() {

    playerState.selectedTrackIndex = 0;

    loadSelectedTrack();

    playerState.isPlaying = false;
}

// Selecciona y reproduce la canción seleccionada
function playSelectedTrack() {

    loadSelectedTrack();

    playTrack();
}

// Función para el manejo del cambio de canción
function handleTrackChange() {

    loadSelectedTrack();

    if (playerState.isPlaying) {
        playTrack();
    }
}

// Reproducimos el track
function playTrack() {
    // No podemos reproducir, si no se ha seteado la fuente de audio
    if (!audioElement.src) return;

    playAudio();
}

// Pausamos el track
function pauseTrack() {
    // Si el audio ya se encuentra pausado no hacemos nada
    if (audioElement.paused) return;

    pauseAudio();
}

// Reproducimos el audio
async function playAudio() {

    if (playerState.status === PLAYER_STATE.IDLE) return;

    try {
        const track = playerState.playbackQueue[playerState.selectedTrackIndex];
        if (!track) return;

        await audioElement.play();
        playerState.status = PLAYER_STATE.PLAYING;
        syncPlayerUI();

    } catch (error) {

        console.error(`Error en el intento de iniciar la reproducción:`, error.message);
    }
}

// Pausamos el audio
function pauseAudio() {

    if (playerState.status !== PLAYER_STATE.PLAYING) return;

    audioElement.pause();

    playerState.status = PLAYER_STATE.PAUSED;

    syncPlayerUI();
}

// Seteamos el audio source
function setAudioSource(src) {

    audioElement.src = src;
}

// Obtenemos el track seleccionado
function getSelectedTrack() {

    return playerState.playbackQueue[playerState.selectedTrackIndex];
}

function setNextTrackIndex() {

    playerState.selectedTrackIndex = (playerState.selectedTrackIndex + 1) % playerState.playbackQueue.length;
}

function setPreviousTrackIndex() {

    playerState.selectedTrackIndex = (playerState.selectedTrackIndex - 1 + playerState.playbackQueue.length) % playerState.playbackQueue.length;
}

function loadSelectedTrack() {

    const track = getSelectedTrack();

    loadTrack(track);
}

// Util functions

const scrollIntoView = element => {

    element.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        options.body = new URLSearchParams(data).toString();
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

function getPlaylistDuration() {

    const infoPlaylist = getInfoPlaylist(playerState.playbackQueue);
    console.log(`Tiempo de duración de la playlist: ${formatTime(infoPlaylist.totalDuration, 1)}`);
    console.log("Número de canciones: " + infoPlaylist.tracks);
    console.log("Tamaños de la playlist: " + JSON.stringify(getSizeInUnits(infoPlaylist.totalSize), null, 2));
}

function getInfoPlaylist(tracks) {
    let totalDuration = 0;
    let totalSize = 0;
    const len = tracks.length;
    for (let i = 0; i < len; i++) {
        totalDuration += tracks[i].duration;
        totalSize += tracks[i].size;
    }

    return { totalDuration, totalSize, tracks: len };
}

function getSizeInUnits(bytes) {
    /**
     * https://www.bipm.org/en/measurement-units/si-prefixes
     * 
     * 10^0  = 1 B
     * 10^3  = 1_000 B
     * 10^6  = 1_000_000 B
     * 10^9  = 1_000_000_000 B
     * 10^12 = 1_000_000_000_000 B
     * ...
     * 10^30 = ... B
     * 
     * 10³=1000 => base = 10; exponente = 3; potencia 1000
     * log 10 (1000) = 3
     */

    // const units = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB", "RB", "QB"];
    const units = ["B", "kB", "MB", "GB", "TB"];

    const result = {};

    const exponent = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
    console.log("Unidad apropiada para mostrar resultado: " + units[exponent]);

    let value = bytes;

    for (let i = 0; i < units.length; i++) {

        // result[units[i]] = bytes / (10 ** (3 * i));
        result[units[i]] = value;
        value /= 1000;
    }

    return result;
}
