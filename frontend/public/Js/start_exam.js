document.addEventListener("DOMContentLoaded", () => {
  let currentQuestionIndex = 0;
  let answers = new Array(questions.length).fill(null);
  let examCompleted = false;
  let blurTimeout;
  const maxTabSwitchesAllowed = 1;
  let tabSwitchCount = 0;

  let videoRecorder, audioRecorder;
  let videoChunks = [];
  let audioChunks = [];

  async function startRecording() {
    const videoElement = document.getElementById("webcam");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        // Set up video preview
        videoElement.srcObject = stream;

        videoRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        videoRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) videoChunks.push(event.data);
        };
        videoRecorder.start(1000);

        console.log("Recording started: video only.");
    } catch (error) {
        console.error("Error accessing webcam:", error);
        alert("Please allow webcam access to use this feature.");
    }
}

async function stopRecordingAndSave() {
    return new Promise((resolve, reject) => {
        let videoBlob = null;

        function checkCompletion() {
            if (videoRecorder && videoBlob) {
                resolve({ video: videoBlob });
            }
        }

        if (videoRecorder && videoRecorder.state !== "inactive") {
            videoRecorder.stop();
            videoRecorder.onstop = () => {
                videoBlob = new Blob(videoChunks, { type: "video/webm" });
                saveFile(videoBlob, `exam_video_${Date.now()}.webm`);
                console.log("✅ Video recording saved.");
                checkCompletion();
            };
        } else {
            reject(new Error("❌ No active video recording to save."));
        }
    });
}

function saveFile(blob, fileName) {
    const fileURL = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = fileURL;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(fileURL);
}

async function uploadRecordedFiles(recordedFiles) {
    if (!recordedFiles || !recordedFiles.video) {
        console.warn("⚠️ No recorded files provided.");
        return null;
    }

    const CLOUD_NAME = "dwhovyplx"; 
    const uploadPreset = "media_upload"; 
    const folder = "ExamGuard/Media"; 

    const uploadToCloudinary = async (file, resourceType) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", folder);
        formData.append("resource_type", resourceType);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (data.secure_url) {
                console.log(`✅ Uploaded successfully: ${data.secure_url}`);
                return data.secure_url;
            } else {
                console.error("❌ Cloudinary upload failed:", data);
                return null;
            }
        } catch (error) {
            console.error("❌ Error uploading file to Cloudinary:", error);
            return null;
        }
    };

    // Upload video
    const videoUrl = await uploadToCloudinary(recordedFiles.video, "video");

    return { videoUrl };
}

async function submitExam() {
    if (examCompleted) return;

    alert("Your exam is being submitted.");

    let recordedFiles;
    let videoUrl = null;

    try {
        // Stop recording and save the video
        recordedFiles = await stopRecordingAndSave();
        console.log("✅ Video recording successfully saved:", recordedFiles);
    } catch (error) {
        console.warn("⚠️ Recording couldn't be saved, proceeding with submission:", error);
        alert("Failed to save recording. Submitting the exam without recording.");
    }

    if (!recordedFiles || !recordedFiles.video) {
        console.warn("⚠️ No recorded video found. Skipping upload.");
    } else {
        try {
            const uploadedFiles = await uploadRecordedFiles(recordedFiles);
            videoUrl = uploadedFiles.videoUrl;
            console.log("✅ Uploaded recording URL:", videoUrl);
        } catch (uploadError) {
            console.error("❌ Error uploading recording:", uploadError);
        }
    }

    try {
        // Submit the exam via API
        const response = await fetch(`/examinee/exams/${examId}/complete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ answers, videoUrl }), 
        });

        if (response.ok) {
            alert("✅ Your exam has been submitted successfully.");
            disableExamInteractions();
            examCompleted = true;
            window.location.href = `/examinee/exams/${examId}/complete`;
        } else {
            const errorText = await response.text();
            console.error("❌ Failed to submit the exam:", errorText);
            alert("Failed to submit the exam. Please try again.");
        }
    } catch (error) {
        console.error("❌ Error submitting the exam:", error);
        alert("An error occurred while submitting the exam. Please try again.");
    }
}


  function disableExamInteractions() {
    const optionsContainer = document.getElementById("options-container");
    const nextButton = document.getElementById("next-button");
    const submitButton = document.getElementById("submit-button");

    optionsContainer.innerHTML =
      "<p>The exam has been submitted. No further actions are allowed.</p>";
    nextButton.disabled = true;
    submitButton.disabled = true;

    document.querySelectorAll(".option").forEach((option) => {
      option.classList.add("disabled");
      option.style.pointerEvents = "none";
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      tabSwitchCount++;
      if (tabSwitchCount > maxTabSwitchesAllowed) {
        submitExam();
      } else {
        alert(`You have switched tabs ${tabSwitchCount} time(s).`);
      }
    }
  });

  window.addEventListener("blur", () => {
    if (!examCompleted) {
      blurTimeout = setTimeout(() => {
        alert(
          "You have switched to another window. The exam will be submitted automatically."
        );
        submitExam();
      }, 2000); 
    }
  });

  window.addEventListener("focus", () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
    }
  });

  function enableBeforeUnloadWarning() {
    window.addEventListener("beforeunload", (event) => {
      if (!examCompleted) {
        event.preventDefault();
        event.returnValue = "Are you sure you want to leave the exam?";
        return "Are you sure you want to leave the exam?";
      }
    });
  }

  function loadQuestion(index) {
    const question = questions[index];
    document.getElementById("question-number").textContent = `Question ${
      index + 1
    } of ${questions.length}`;
    document.getElementById("question-text").textContent = `${index + 1}. ${
      question.text
    }`;
    const optionsContainer = document.getElementById("options-container");
    optionsContainer.innerHTML = "";

    question.options.forEach((option) => {
      const optionElement = document.createElement("div");
      optionElement.classList.add("option");
      optionElement.textContent = option;
      optionElement.onclick = () => selectOption(optionElement, option);
      optionsContainer.appendChild(optionElement);
    });

    updateQuestionBoxStates();

    if (index === questions.length - 1) {
      document.getElementById("next-button").style.display = "none";
      document.getElementById("submit-button").style.display = "inline-block";
    } else {
      document.getElementById("next-button").style.display = "inline-block";
      document.getElementById("submit-button").style.display = "inline-block";
    }
  }

  function selectOption(optionElement, selectedOption) {
    document
      .querySelectorAll(".option")
      .forEach((option) => option.classList.remove("selected"));
    optionElement.classList.add("selected");
    answers[currentQuestionIndex] = selectedOption;

    const currentBox = document.querySelector(
      `.question-box[data-index="${currentQuestionIndex}"]`
    );
    if (currentBox) {
      currentBox.classList.remove("not-marked", "current");
      currentBox.classList.add("attempted"); // Change color to green
    }
  }

  function updateQuestionBoxStates() {
    document.querySelectorAll(".question-box").forEach((box, index) => {
      box.classList.remove("current", "attempted", "not-marked");

      if (index === currentQuestionIndex) {
        box.classList.add("current"); 
      } else if (answers[index] !== null) {
        box.classList.add("attempted"); 
      } else {
        box.classList.add("not-marked"); 
      }
    });
  }

  document
    .getElementById("submit-button")
    .addEventListener("click", async () => {
      submitExam();
    });

  enableBeforeUnloadWarning();
  startRecording();
  loadQuestion(currentQuestionIndex);



  const questionGrid = document.getElementById("questionGrid");
  const totalQuestions = questions.length;
  for (let i = 0; i < totalQuestions; i++) {
    const questionBox = document.createElement("div");
    questionBox.classList.add("question-box", "not-marked");
    questionBox.textContent = i + 1;
    questionBox.dataset.index = i;
    questionGrid.appendChild(questionBox);
  }

  // Add button event listeners
  document.getElementById("next-button").addEventListener("click", () => {
    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
      loadQuestion(currentQuestionIndex);
    }
  });

  document.getElementById("previous-button").addEventListener("click", () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      loadQuestion(currentQuestionIndex);
    }
  });

  function startTimer(durationInMinutes) {
    let timeRemainingElement = document.getElementById("time-remaining");

    let durationInSeconds = durationInMinutes * 60;

    function updateTimer() {
      let minutes = Math.floor(durationInSeconds / 60);
      let seconds = durationInSeconds % 60;

      timeRemainingElement.innerHTML = ` ${minutes}:${
        seconds < 10 ? "0" : ""
      }${seconds} <br>Time Left`;

      if (durationInSeconds > 0) {
        durationInSeconds--;
        setTimeout(updateTimer, 1000); // Update every second
      } else {
        timeRemainingElement.textContent = "Time's up!";
      }
    }

    updateTimer();
  }

  startTimer(examDuration);

  function updateDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString("en-GB"); 
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    document.getElementById("dateTime").innerHTML = `${date} <br> ${time}`;
  }

  setInterval(updateDateTime, 1000); 
  updateDateTime();

  document
    .getElementById("dark-mode-toggle")
    .addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");

      // Save preference in localStorage
      if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("theme", "dark");
      } else {
        localStorage.setItem("theme", "light");
      }
    });

  window.onload = function () {
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark-mode");
    }
  };
  const minRem = 12;
  const maxRem = 22; 
  const defaultRem = 16; 
  let currentRem = defaultRem;

  // Function to update the root font size
  function updateRootFontSize(size) {
    document.documentElement.style.fontSize = size + "px";
    localStorage.setItem("rootFontSize", size);
  }

  // Increase Font Size
  document
    .getElementById("increase-font")
    .addEventListener("click", function () {
      if (currentRem < maxRem) {
        currentRem += 2;
        updateRootFontSize(currentRem);
      }
    });

  // Decrease Font Size
  document
    .getElementById("decrease-font")
    .addEventListener("click", function () {
      if (currentRem > minRem) {
        currentRem -= 2;
        updateRootFontSize(currentRem);
      }
    });

  // Reset Font Size
  document.getElementById("reset-font").addEventListener("click", function () {
    currentRem = defaultRem;
    updateRootFontSize(currentRem);
  });

  // Load saved font size on page load
  window.onload = function () {
    const savedFontSize = localStorage.getItem("rootFontSize");
    if (savedFontSize) {
      currentRem = parseInt(savedFontSize);
      updateRootFontSize(currentRem);
    }
  };


  document.getElementById("toggle-video").addEventListener("click", function () {
    const video = document.getElementById("camera-preview");
    const icon = this.querySelector("i");

    if (video.style.display === "none") {
        // Show video
        video.style.display = "block";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        // Hide video
        video.style.display = "none";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "F12" ||
    (event.ctrlKey && event.shiftKey && (event.key === "I" || event.key === "J")) ||
    (event.ctrlKey && event.key === "U") 
  ) {
    event.preventDefault();
  }
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener("cut", (event) => event.preventDefault());
document.addEventListener("copy", (event) => event.preventDefault());
document.addEventListener("paste", (event) => event.preventDefault());

});
