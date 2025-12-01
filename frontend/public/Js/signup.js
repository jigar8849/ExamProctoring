const cameraIcon = document.querySelector(".camera-icon"); 
const cameraDiv = document.querySelector(".camera-div");
const retakeButton = document.querySelector(".retake");
let videoStream = null;
let videoElement = null;
let canvasElement = null;
let isCameraOn = false;
let capturedImage = null;

retakeButton.style.display = "none";

cameraIcon.addEventListener("click", () => {
  isCameraOn ? capturePhoto() : startCamera();
});

retakeButton.addEventListener("click", startCamera);

function startCamera() {
  if (isCameraOn) return; 

  if (capturedImage) {
    capturedImage.remove();
    capturedImage = null;
  }

  videoElement = document.createElement("video");
  Object.assign(videoElement, {
    autoplay: true,
    playsInline: true,
    style: "width:100%; height:100%;"
  });

  cameraDiv.innerHTML = "";  
  cameraDiv.append(videoElement, cameraIcon); 
  retakeButton.style.display = "none"; 

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoStream = stream;
      videoElement.srcObject = videoStream;
      isCameraOn = true;
    })
    .catch(error => console.error("Error accessing camera:", error));
}

function capturePhoto() {
  if (!videoElement) return;
  
  canvasElement = document.createElement("canvas");
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  canvasElement.getContext("2d").drawImage(videoElement, 0, 0);
  
  const imageDataURL = canvasElement.toDataURL("image/png");
  stopCamera();
  
  capturedImage = new Image();
  capturedImage.src = imageDataURL;
  capturedImage.style.cssText = "width:100%; height:100%;";
  cameraDiv.innerHTML = "";
  cameraDiv.appendChild(capturedImage);
  retakeButton.style.display = "block";
  
  const hiddenPhotoInput = document.getElementById("capturedPhoto");
  if (hiddenPhotoInput) {
    hiddenPhotoInput.value = imageDataURL;
  }
}
  
function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  isCameraOn = false;
  cameraDiv.innerHTML = "";  
}

function sendImageToServer(imageDataURL) {
  const blob = dataURLToBlob(imageDataURL);

  const formData = new FormData();
  formData.append("photo", blob, "photo.png");

  fetch("/signup", {
    method: "POST",
    body: formData,
    headers: {
    },
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log("Photo uploaded successfully!");
      } else {
        console.error("Failed to upload photo:", data.error);
      }
    })
    .catch(error => {
      console.error("Error uploading photo:", error);
    });
}

function dataURLToBlob(dataURL) {
  const byteString = atob(dataURL.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([arrayBuffer], { type: "image/png" });
}

document.getElementById("accessType").addEventListener("change", function () {
  const examinerPhotoDiv = document.getElementById("examiner-photo");
  const examineePhotoDiv = document.getElementById("examinee-photo");
  const examinerFieldsDiv = document.getElementById("examinerFields");
  const parentFieldsDiv = document.getElementById("parentFields");
  const labelElement = examinerFieldsDiv ? examinerFieldsDiv.querySelector("label") : null;

  if (examinerPhotoDiv) examinerPhotoDiv.style.display = "none";
  if (examineePhotoDiv) examineePhotoDiv.style.display = "none";
  if (examinerFieldsDiv) examinerFieldsDiv.style.display = "none";
  if (parentFieldsDiv) parentFieldsDiv.style.display = "none";
  stopCamera();

  if (this.value === "examiner") {
    if (examinerFieldsDiv) {
      examinerFieldsDiv.style.display = "block";
      if (labelElement) labelElement.textContent = "Employee Id";
    }
    if (examinerPhotoDiv) examinerPhotoDiv.style.display = "block";
  } else if (this.value === "examinee") {
    if (examinerFieldsDiv) {
      examinerFieldsDiv.style.display = "block";
      if (labelElement) labelElement.textContent = "Roll No.";
    }
    if (examineePhotoDiv) examineePhotoDiv.style.display = "block";
    startCamera(); 
  } else if (this.value === "parent") {
    if (parentFieldsDiv) {
      parentFieldsDiv.style.display = "block";
    }
    stopCamera();
  }
});
