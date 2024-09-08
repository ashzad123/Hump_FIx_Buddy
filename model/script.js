const videoElement = document.createElement('video');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');

const loaderElement = document.getElementById('loader');
const messageElement = document.createElement('div');
const restartButton = document.createElement('button');

messageElement.style.display = 'none';
messageElement.style.fontSize = '24px';
messageElement.style.color = '#fff';
messageElement.style.marginTop = '20px';

restartButton.textContent = 'Restart Poses';
restartButton.style.display = 'none';
restartButton.className = 'action-button';
restartButton.onclick = restartPoses;

document.body.appendChild(messageElement);
document.body.appendChild(restartButton);

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.3,
    minTrackingConfidence: 0.3
});

pose.onResults(onResults);

let poseStartTime = null;
let currentPoseIndex = 0;
const poseDuration = 15; // in seconds

const poseSequence = ['Y Pose', 'W Pose', 'T Pose', 'L Pose'];

const poseGuideImage = new Image();
poseGuideImage.src = 'images/Y_Pose.jpg'; // Default pose guide image

// Initially hide canvas
canvasElement.style.display = 'none';

// Start the camera
navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
        videoElement.srcObject = stream;
        videoElement.play();

        videoElement.onloadedmetadata = () => {
            loaderElement.style.display = 'none';
            canvasElement.style.display = 'block';

            const resizeCanvas = () => {
                const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                const maxCanvasWidth = windowWidth * 0.9;
                const maxCanvasHeight = windowHeight * 0.9;

                if (maxCanvasWidth / aspectRatio <= maxCanvasHeight) {
                    canvasElement.width = maxCanvasWidth;
                    canvasElement.height = maxCanvasWidth / aspectRatio;
                } else {
                    canvasElement.width = maxCanvasHeight * aspectRatio;
                    canvasElement.height = maxCanvasHeight;
                }
            };

            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            async function videoFrameProcessing() {
                await pose.send({ image: videoElement });
                requestAnimationFrame(videoFrameProcessing);
            }
            videoFrameProcessing();
        };
    }).catch((err) => {
        console.error("Error accessing the webcam: ", err);
        loaderElement.textContent = "Error accessing the camera.";
    });

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        classifyPose(results.poseLandmarks);
    }
    
    if (poseGuideImage.complete) {
        canvasCtx.globalAlpha = 0.1;
        canvasCtx.drawImage(poseGuideImage, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.globalAlpha = 1.0;
    }

    canvasCtx.restore();
}

function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = radians * (180.0 / Math.PI);
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}

function classifyPose(landmarks) {
    const leftElbowAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    const rightElbowAngle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
    const leftShoulderAngle = calculateAngle(landmarks[13], landmarks[11], landmarks[23]);
    const rightShoulderAngle = calculateAngle(landmarks[14], landmarks[12], landmarks[24]);

    let label = 'Unknown Pose';

    if ((leftElbowAngle > 120 && leftElbowAngle < 150) || (rightElbowAngle > 120 && rightElbowAngle < 150)) {
        if ((leftShoulderAngle > 115 && leftShoulderAngle < 150) || (rightShoulderAngle > 115 && rightShoulderAngle < 150)) {
            label = 'Y Pose';
        }
    }
    if ((leftElbowAngle > 50 && leftElbowAngle < 85) || (rightElbowAngle > 50 && rightElbowAngle < 85)) {
        if ((leftShoulderAngle > 55 && leftShoulderAngle < 100) || (rightShoulderAngle > 55 && rightShoulderAngle < 100)) {
            label = 'W Pose';
        }
    }
    if ((leftElbowAngle > 145 && leftElbowAngle < 200) || (rightElbowAngle > 145 && rightElbowAngle < 200)) {
        if ((leftShoulderAngle > 65 && leftShoulderAngle < 95) || (rightShoulderAngle > 65 && rightShoulderAngle < 95)) {
            label = 'T Pose';
        }
    }
    if ((leftElbowAngle > 90 && leftElbowAngle < 130) || (rightElbowAngle > 90 && rightElbowAngle < 130)) {
        if ((leftShoulderAngle > 15 && leftShoulderAngle < 45) || (rightShoulderAngle > 15 && rightShoulderAngle < 45)) {
            label = 'L Pose';
        }
    }

    const now = Date.now() / 1000;
    const expectedPose = poseSequence[currentPoseIndex];

    if (label !== 'Unknown Pose' && label === expectedPose) {
        if (!poseStartTime) {
            poseStartTime = now;
        }

        const elapsedTime = now - poseStartTime;
        const remainingTime = Math.max(0, poseDuration - elapsedTime);

        canvasCtx.font = "30px Arial";
        canvasCtx.fillStyle = "green";
        canvasCtx.fillText(`${label} - Time Left: ${Math.ceil(remainingTime)}s`, 10, 80);

        if (remainingTime === 0) {
            poseStartTime = null;
            currentPoseIndex = (currentPoseIndex + 1) % poseSequence.length;

            if (currentPoseIndex === 0) {
                showCongratulations();
            } else {
                const audio = new Audio('audio/pose_change.mp3');
                audio.play();
                updatePoseGuide();
            }
        }
    } else {
        poseStartTime = null;
    }

    canvasCtx.font = "30px Arial";
    canvasCtx.fillStyle = "green";
    canvasCtx.fillText(`Current Pose: ${expectedPose}`, 10, 40);
}

function updatePoseGuide() {
    const nextPose = poseSequence[currentPoseIndex];

    switch (nextPose) {
        case 'Y Pose':
            poseGuideImage.src = 'images/Y_Pose.jpg';
            break;
        case 'W Pose':
            poseGuideImage.src = 'images/W_Pose.jpg';
            break;
        case 'T Pose':
            poseGuideImage.src = 'images/T_pose.jpg';
            break;
        case 'L Pose':
            poseGuideImage.src = 'images/L-Pose.jpg';
            break;
    }
}

function showCongratulations() {
    canvasElement.style.display = 'none'; // Hide the canvas
    messageElement.textContent = "Congratulations! You've completed all poses!";
    messageElement.style.display = 'block';
    restartButton.style.display = 'inline-block';
}

function restartPoses() {
    currentPoseIndex = 0;
    updatePoseGuide();
    messageElement.style.display = 'none';
    restartButton.style.display = 'none';
    canvasElement.style.display = 'block'; // Show the canvas again
}