// Spotify Authorization URL and Client ID
const AUTHORIZE = "https://accounts.spotify.com/authorize";
const client_id = "58d0be857362474fa5793508c9c326fa"; // Replace with your Client ID
const redirect_uri = "http://localhost:5501"; // Replace with your redirect URI
let accessToken = null; // Placeholder for the access token
let playbackPosition = 0; // Holds the current playback position in milliseconds

const scopes = [
    "user-read-private",
    "user-read-email",
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state"
].join(" "); // Permissions you are requesting

const playlistId = "7G8k1zSqwsVzm12gxmXC14"; // Replace with your Playlist ID

const socket = io(); // Initialize the Socket.IO client

// Listen for sensor data from the server
socket.on('update-playback', (sensorData) => {
    console.log('Received sensor data:', sensorData);

    // Control Spotify playback based on the sensor state
    if (sensorData === "ON") {
        playPlaylist(); // Play Spotify playlist
    } else if (sensorData === "OFF") {
        pausePlaylist(); // Pause Spotify playlist
    }
});

// Function to authenticate with Spotify
function authenticateSpotify() {
    const authUrl = `${AUTHORIZE}?client_id=${encodeURIComponent(client_id)}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}&show_dialog=true`;
    window.location.href = authUrl; // Redirect to Spotify’s authorization page
}

// Function to handle access token from the URL hash
function handleToken() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    accessToken = params.get("access_token");

    if (accessToken) {
        console.log("Access Token:", accessToken);
        alert("Spotify authenticated successfully!");
    } else {
        console.error("Failed to get access token.");
    }
}

// Updated Function to fetch playlist details
async function fetchPlaylist() {
    const endpoint = `https://api.spotify.com/v1/playlists/${playlistId}`;
    const response = await fetch(endpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (response.ok) {
        const playlist = await response.json();
        console.log("Playlist Details:", playlist);

        // Extract the image URL
        const imageUrl = playlist.images?.[0]?.url || ''; // Safely access the first image URL
        console.log("Image URL:", imageUrl); // Debug the image URL
        displayPlaylistDetails(playlist, imageUrl);
    } else {
        console.error("Error fetching playlist:", response.status, await response.text());
    }
}


function displayPlaylistDetails(playlist, imageUrl) {
    const container = document.getElementById("playlistDetails");
    container.innerHTML = `
        <div class="playlist-container">
            ${imageUrl ? `<img src="${imageUrl}" alt="${playlist.name} Cover" class="playlist-image">` : ''}
            <div class="playlist-text">
                <h2>${playlist.name}</h2>
                <p>${playlist.description || "No description available."}</p>
                <ul>
                    ${playlist.tracks.items.map(track => `
                        <li>${track.track.name} by ${track.track.artists.map(a => a.name).join(", ")}</li>
                    `).join("")}
                </ul>
            </div>
        </div>
    `;
}


// Function to display playlist details
function displayPlaylistDetails(playlist, imageUrl) {
    const container = document.getElementById("playlistDetails");
    container.innerHTML = `
        <div class="playlist-container">
            ${imageUrl ? `<img src="${imageUrl}" alt="${playlist.name} Cover" class="playlist-image">` : '<p>No cover image available</p>'}
            <div class="playlist-text">
                <h2>${playlist.name}</h2>
                <p>${playlist.description || "No description available."}</p>
                <ul>
                    ${playlist.tracks.items.map(track => `
                        <li>${track.track.name} by ${track.track.artists.map(a => a.name).join(", ")}</li>
                    `).join("")}
                </ul>
            </div>
        </div>
    `;
}

// Function to play the playlist from the last paused position
async function playPlaylist() {
    const endpoint = "https://api.spotify.com/v1/me/player/play";
    const deviceId = await getActiveDevices();

    if (!deviceId) return;

    const requestBody = {
        context_uri: `spotify:playlist:${playlistId}`,
        position_ms: playbackPosition // Resume from the last paused position
    };

    const response = await fetch(`${endpoint}?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
    });

    if (response.ok) {
        console.log("Playback resumed successfully from position:", playbackPosition);
    } else {
        console.error("Error resuming playback:", response.status, await response.text());
    }
}

// Function to pause the playlist and save the playback position
async function pausePlaylist() {
    const endpoint = "https://api.spotify.com/v1/me/player";

    // Get the current playback state to fetch the position
    const response = await fetch(endpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (response.ok) {
        const data = await response.json();
        playbackPosition = data.progress_ms || 0; // Save the current position
        console.log("Current Playback Position:", playbackPosition);

        // Send pause request
        const pauseEndpoint = `${endpoint}/pause`;
        const pauseResponse = await fetch(pauseEndpoint, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (pauseResponse.ok) {
            console.log("Playback paused successfully!");
        } else {
            console.error("Error pausing playback:", pauseResponse.status, await pauseResponse.text());
        }
    } else {
        console.error("Error fetching playback state:", response.status, await response.text());
    }
}

// Function to get active devices
async function getActiveDevices() {
    const endpoint = "https://api.spotify.com/v1/me/player/devices";
    const response = await fetch(endpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (response.ok) {
        const data = await response.json();
        console.log("Active Devices:", data.devices);

        if (data.devices.length > 0) {
            return data.devices[0].id; // Return the first active device
        } else {
            alert("No active devices found. Open Spotify on a device.");
            return null;
        }
    } else {
        console.error("Error fetching devices:", response.status, await response.text());
        return null;
    }
}

// Run token handler on page load
window.onload = handleToken;

