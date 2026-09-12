// ============================================================
// PLAYLIST
// ============================================================


// ============================================================
// ELEMENTOS Y ESTADO
// ============================================================

const playlist = document.querySelector('#playlist');

const audioElement = new Audio();

let currentSong = null;


// ============================================================
// ÍNDICE DE CANCIONES
// ============================================================

const songsById = new Map(songs.map(song => [String(song.id), song]));


// ============================================================
// ÍNDICE DE ELEMENTOS DOM
// ============================================================

const songElementsById = new Map();


// ============================================================
// FORMATEAR DURACIÓN
// ============================================================

function formatDuration(totalSeconds) {
    const total = Math.floor(Number(totalSeconds));

    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}


// ============================================================
// ACTUALIZAR REPRESENTACIÓN VISUAL
// ============================================================

function updatePlaylistUI(previousSong, selectedSong) {
    if (previousSong) {
        const previousElement = songElementsById.get(String(previousSong.id));

        previousElement?.classList.remove('active');
    }

    if (selectedSong) {
        const selectedElement = songElementsById.get(String(selectedSong.id));

        selectedElement?.classList.add('active');
    }
}


// ============================================================
// CAMBIAR CANCIÓN ACTUAL
// ============================================================

function setCurrentSong(song) {
    const previousSong = currentSong;

    currentSong = song;

    updatePlaylistUI(previousSong, currentSong);
}


// ============================================================
// REPRODUCIR CANCIÓN ACTUAL
// ============================================================

async function playCurrentSong() {
    try {
        await audioElement.play();
    } catch (error) {
        console.error('No se pudo reproducir la canción:', error);
    }
}


// ============================================================
// ASEGURAR QUE LA CANCIÓN SEA VISIBLE
// ============================================================

function ensureSongVisible(song) {

    const songElement = songElementsById.get(String(song.id));

    if (!songElement) {
        return;
    }

    const playlistRect = playlist.getBoundingClientRect();
    const songRect = songElement.getBoundingClientRect();

    const isVisible = songRect.top >= playlistRect.top && songRect.bottom <= playlistRect.bottom;

    if (isVisible) {
        return;
    }

    songElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}


// ============================================================
// RENDERIZAR PLAYLIST
// ============================================================

function renderPlaylist() {
    playlist.replaceChildren();
    songElementsById.clear();

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < songs.length; index++) {

        const song = songs[index];

        const songElement = document.createElement('li');
        songElement.dataset.songId = String(song.id);

        const trackNumber = document.createElement('span');
        trackNumber.textContent = String(index + 1);

        const title = document.createElement('span');
        title.textContent = song.title;

        const artist = document.createElement('span');
        artist.textContent = song.artist;

        const duration = document.createElement('span');
        duration.textContent = formatDuration(song.duration);

        // Agregamos al list item, los span creados anteriormente
        songElement.append(
            trackNumber,
            title,
            artist,
            duration
        );

        fragment.appendChild(songElement);

        songElementsById.set(String(song.id), songElement);
    }

    playlist.appendChild(fragment);

    updatePlaylistUI(null, currentSong);
}


// ============================================================
// DELEGACIÓN DE EVENTOS
// ============================================================

playlist.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) {
        return;
    }

    const songElement = event.target.closest('li');

    if (!songElement) {
        return;
    }

    if (!playlist.contains(songElement)) {
        return;
    }

    const songId = songElement.dataset.songId;

    if (!songId) {
        return;
    }

    const song = songsById.get(songId);

    if (!song) {
        return;
    }

    const isCurrentSong = currentSong?.id === song.id;


    // ========================================================
    // MISMA CANCIÓN
    // ========================================================

    if (isCurrentSong) {
        if (audioElement.paused) {
            await playCurrentSong();
        } else {
            audioElement.pause();
        }

        return;
    }


    // ========================================================
    // NUEVA CANCIÓN
    // ========================================================

    setCurrentSong(song);

    ensureSongVisible(song);

    audioElement.src = song.src;

    await playCurrentSong();
});


// ============================================================
// INICIALIZACIÓN
// ============================================================

renderPlaylist();

