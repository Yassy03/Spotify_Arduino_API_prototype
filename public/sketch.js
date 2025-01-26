let port; // Variable to store the serial port
let reader; // Reader object to read data
let connectBtn; // Button to connect to the Arduino
let state = "IDLE"; // Default state when no data is received
let previousState = "IDLE"; // Track the previous state to avoid redundant calls

function setup() {
    const canvas = createCanvas(400, 400);

    // Center the canvas on the screen
    canvas.style('display', 'block');
    canvas.style('margin', 'auto');
    canvas.parent('canvasWrapper'); 

    // Create a "Connect to Arduino" button
    connectBtn = createButton('Connect to Arduino');
    connectBtn.mousePressed(connectToArduino); // Attach the event handler
    connectBtn.class('connect-btn'); // Apply the CSS class for styling
}

function draw() {
    clear();

    // Adjust the circle's position
    const ellipseY = height / 2 - 50; 

    // Display the current sensor state on the canvas
    textSize(16);
    fill('black'); // White text
    textAlign(CENTER, TOP); // Align text to the center horizontally and top vertically
    text(`Sensor State: ${state}`, width / 2, ellipseY - 60);

    // Visual feedback based on state
    if (state === "ON") {
        fill(0, 255, 0); // Green for ON
    } else if (state === "OFF") {
        fill(255, 0, 0); // Red for OFF
    } else {
        fill(200); // Gray for IDLE
    }
    ellipse(width / 2, height / 2, 100, 100);

    // Trigger actions based on state
    handleStateChange();
}

async function connectToArduino() {
    try {
        // Request the user to select a serial port
        port = await navigator.serial.requestPort();

        // Open the port with the correct baud rate (match Arduino code)
        await port.open({ baudRate: 9600 });

        // Create a text decoder and set up the readable stream
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        // Start reading data from the Arduino
        readSerialData();
    } catch (error) {
        console.error("Error connecting to Arduino:", error);
    }
}

async function readSerialData() {
    while (true) {
        try {
            const { value, done } = await reader.read();
            if (done) {
                // Reader has been closed, exit the loop
                console.log("Serial port closed.");
                break;
            }
            if (value) {
                processSerialData(value.trim());
            }
        } catch (error) {
            console.error("Error reading from serial port:", error);
            break;
        }
    }
}

function processSerialData(data) {
    console.log(`Received from Arduino: ${data}`);

    // Update the state based on the received data
    if (data.includes("Winner")) {
        if (data.includes("ON")) {
            state = "ON";
        } else if (data.includes("OFF")) {
            state = "OFF";
        }
    }
}

function handleStateChange() {
    // Check if the state has changed
    if (state !== previousState) {
        previousState = state; // Update the previous state

        // Trigger appropriate actions
        if (state === "ON") {
            console.log("Playing playlist...");
            playPlaylist(); // Call the play function from app.js
        } else if (state === "OFF") {
            console.log("Pausing playlist...");
            pausePlaylist(); // Call the pause function from app.js
        }
    }
}





