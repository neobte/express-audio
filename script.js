'use strict';

const REPO_OWNER = "neobte";
const REPO_NAME = "express-audio";

async function loadPlaylists() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/music`;

    const res = await fetch(url);
    const data = await res.json();

    return data
        .filter(item => item.type === "dir")
        .map(dir => ({
            name: dir.name,
            path: dir.path
        }));
}

async function loadTracks(folderPath) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${folderPath}`;

    const res = await fetch(url);
    const data = await res.json();

    return data
        .filter(file => file.type === "file")
        .filter(file => file.name.match(/\.(mp3|m4a)$/i))
        .map((file, index) => {
            const clean = file.name.replace(/\.(mp3|m4a)$/i, "");
            const parts = clean.split(" - ");

            return {
                id: index,
                artist: parts[0] || "Unknown",
                title: parts[1] || clean,
                url: file.download_url
            };
        });
}

loadPlaylists().then(console.log);

// loadTracks("music/rock").then(console.log);
