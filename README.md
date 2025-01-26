# Arduino_SpotifyAPI_Prototype
 VSC code for serial monitor info to control spotify API player

Note: users will also need to npm start in the terminal and add install node_modules folder to the project. This project uses socket.io so ensure this has also been insalled in the terminal 

Run this code in Ardiuno with a Arduino Nano 33 BLE connected: 
Note - make sure all necessary libaries are installed 
``` 
#include <Arduino_LSM9DS1.h>
#include <TensorFlowLite.h>
#include <tensorflow/lite/micro/all_ops_resolver.h>
#include <tensorflow/lite/micro/micro_error_reporter.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/schema/schema_generated.h>
#include <tensorflow/lite/version.h>


//==============================================================================
// Your custom data / settings
// - Editing these is not recommended
//==============================================================================

// This is the model you trained in Tiny Motion Trainer, converted to 
// a C style byte array.
#include "model.h"

// Values from Tiny Motion Trainer
#define MOTION_THRESHOLD 0.095
#define CAPTURE_DELAY 2096 // This is now in milliseconds
#define NUM_SAMPLES 89

// Array to map gesture index to a name
const char *GESTURES[] = {
    "ON", "OFF"
};


//==============================================================================
// Capture variables
//==============================================================================

#define NUM_GESTURES (sizeof(GESTURES) / sizeof(GESTURES[0]))

bool isCapturing = false;

// Num samples read from the IMU sensors
// "Full" by default to start in idle
int numSamplesRead = 0;


//==============================================================================
// TensorFlow variables
//==============================================================================

// Global variables used for TensorFlow Lite (Micro)
tflite::MicroErrorReporter tflErrorReporter;

// Auto resolve all the TensorFlow Lite for MicroInterpreters ops, for reduced memory-footprint change this to only 
// include the op's you need.
tflite::AllOpsResolver tflOpsResolver;

// Setup model
const tflite::Model* tflModel = nullptr;
tflite::MicroInterpreter* tflInterpreter = nullptr;
TfLiteTensor* tflInputTensor = nullptr;
TfLiteTensor* tflOutputTensor = nullptr;

// Create a static memory buffer for TensorFlow Lite for MicroInterpreters, the size may need to
// be adjusted based on the model you are using
constexpr int tensorArenaSize = 8 * 1024;
byte tensorArena[tensorArenaSize];


//==============================================================================
// Setup / Loop
//==============================================================================

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
        
  Serial.begin(9600);

  // Wait for serial monitor to connect
  while (!Serial);

  // Initialize IMU sensors
  if (!IMU.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1);
  }

  // Print out the samples rates of the IMUs
  Serial.print("Accelerometer sample rate: ");
  Serial.print(IMU.accelerationSampleRate());
  Serial.println(" Hz");
  Serial.print("Gyroscope sample rate: ");
  Serial.print(IMU.gyroscopeSampleRate());
  Serial.println(" Hz");

  Serial.println();

  // Get the TFL representation of the model byte array
  tflModel = tflite::GetModel(model);
  if (tflModel->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("Model schema mismatch!");
    while (1);
  }

  // Create an interpreter to run the model
  tflInterpreter = new tflite::MicroInterpreter(tflModel, tflOpsResolver, tensorArena, tensorArenaSize, &tflErrorReporter);

  // Allocate memory for the model's input and output tensors
  tflInterpreter->AllocateTensors();

  // Get pointers for the model's input and output tensors
  tflInputTensor = tflInterpreter->input(0);
  tflOutputTensor = tflInterpreter->output(0);
}

void loop() {
  // Variables to hold IMU data
  float aX, aY, aZ, gX, gY, gZ;

  // Wait for motion above the threshold setting
  while (!isCapturing) {
    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable()) {
     
      IMU.readAcceleration(aX, aY, aZ);
      IMU.readGyroscope(gX, gY, gZ);

      // Sum absolute values
      float average = fabs(aX / 4.0) + fabs(aY / 4.0) + fabs(aZ / 4.0) + fabs(gX / 2000.0) + fabs(gY / 2000.0) + fabs(gZ / 2000.0);
      average /= 6.;

      // Above the threshold?
      if (average >= MOTION_THRESHOLD) {
        isCapturing = true;
        numSamplesRead = 0;
        break;
      }
    }
  }

  while (isCapturing) {

    // Check if both acceleration and gyroscope data is available
    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable()) {

      // read the acceleration and gyroscope data
      IMU.readAcceleration(aX, aY, aZ);
      IMU.readGyroscope(gX, gY, gZ);

      // Normalize the IMU data between -1 to 1 and store in the model's
      // input tensor. Accelerometer data ranges between -4 and 4,
      // gyroscope data ranges between -2000 and 2000
      tflInputTensor->data.f[numSamplesRead * 6 + 0] = aX / 4.0;
      tflInputTensor->data.f[numSamplesRead * 6 + 1] = aY / 4.0;
      tflInputTensor->data.f[numSamplesRead * 6 + 2] = aZ / 4.0;
      tflInputTensor->data.f[numSamplesRead * 6 + 3] = gX / 2000.0;
      tflInputTensor->data.f[numSamplesRead * 6 + 4] = gY / 2000.0;
      tflInputTensor->data.f[numSamplesRead * 6 + 5] = gZ / 2000.0;

      numSamplesRead++;

      // Do we have the samples we need?
      if (numSamplesRead == NUM_SAMPLES) {
        
        // Stop capturing
        isCapturing = false;
        
        // Run inference
        TfLiteStatus invokeStatus = tflInterpreter->Invoke();
        if (invokeStatus != kTfLiteOk) {
          Serial.println("Error: Invoke failed!");
          while (1);
          return;
        }

        // Loop through the output tensor values from the model
        int maxIndex = 0;
        float maxValue = 0;
        for (int i = 0; i < NUM_GESTURES; i++) {
          float _value = tflOutputTensor->data.f[i];
          if (_value > maxValue) {
            maxValue = _value;
            maxIndex = i;
          }
          Serial.print(GESTURES[i]);  // Print the gesture name
          Serial.print(": ");
          Serial.println(tflOutputTensor->data.f[i], 6);  // Print the value with precision
        }
        
        // Print the recognized gesture (ON or OFF)
        Serial.print("Winner: ");
        Serial.println(GESTURES[maxIndex]); // Sends "ON" or "OFF" with a newline character

        // Add delay to avoid rapid re-triggering
        delay(CAPTURE_DELAY);
      }
    }
  }
}











```
