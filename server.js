
//server.js 

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" directory
app.use(express.static('public'));

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A client connected.');

    // Listen for sensor data from the client
    socket.on('sensor-data', (data) => {
        console.log('Received sensor data:', data);

        // Broadcast sensor data to all connected clients
        io.emit('update-playback', data);
    });

    socket.on('disconnect', () => {
        console.log('A client disconnected.');
    });
});

// Start the server
const PORT = 5501;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
