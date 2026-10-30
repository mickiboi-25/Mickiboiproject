# Tutorial Open Camera di Tab Baru Google Apps Script

## Workflow Sistem

```text
Pengguna klik tombol Buka Kamera
                ↓
Halaman utama menjalankan window.open()
                ↓
Tab atau popup kamera terbuka
                ↓
HTML kamera dimasukkan menggunakan document.write()
                ↓
Tab baru menjalankan getUserMedia()
                ↓
Pengguna menekan tombol Ambil Foto
                ↓
Frame video disalin ke elemen canvas
                ↓
Canvas diubah menjadi gambar Base64
                ↓
Foto dikirim ke halaman utama melalui postMessage()
                ↓
Halaman utama menampilkan preview
                ↓
Foto dapat disimpan ke Google Drive
```

Sediakan dua file dalam project Google Apps Script:

```text
Code.gs
Index.html
```

---

# 1. Script `Code.gs`

```javascript
/**
 * Folder Google Drive tempat menyimpan foto.
 *
 * Kosongkan jika foto ingin disimpan
 * ke root Google Drive.
 */
const PHOTO_FOLDER_ID = '';


/**
 * Menampilkan halaman utama aplikasi.
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Kamera Tab Baru')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}


/**
 * Menyimpan foto Base64 ke Google Drive.
 *
 * @param {string} dataUrl Data gambar dalam format Data URL.
 * @param {string} requestedFileName Nama file yang diminta.
 * @return {Object} Informasi file hasil penyimpanan.
 */
function savePhotoToDrive(dataUrl, requestedFileName) {
  try {
    if (
      typeof dataUrl !== 'string' ||
      !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(dataUrl)
    ) {
      throw new Error('Format gambar tidak valid.');
    }

    const parts = dataUrl.split(',');

    if (parts.length !== 2) {
      throw new Error('Data gambar tidak lengkap.');
    }

    const mimeMatch = parts[0].match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64$/
    );

    if (!mimeMatch) {
      throw new Error('MIME type gambar tidak valid.');
    }

    const mimeType = mimeMatch[1];
    const base64Data = parts[1];

    const extensionMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };

    const extension =
      extensionMap[mimeType] || 'jpg';

    const safeFileName = createSafeFileName(
      requestedFileName,
      extension
    );

    const imageBytes =
      Utilities.base64Decode(base64Data);

    const imageBlob =
      Utilities.newBlob(
        imageBytes,
        mimeType,
        safeFileName
      );

    const folder = PHOTO_FOLDER_ID
      ? DriveApp.getFolderById(PHOTO_FOLDER_ID)
      : DriveApp.getRootFolder();

    const file = folder.createFile(imageBlob);

    return {
      success: true,
      message: 'Foto berhasil disimpan.',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl()
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}


/**
 * Membersihkan nama file.
 */
function createSafeFileName(fileName, extension) {
  const fallbackName =
    'foto-' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    );

  let safeName =
    String(fileName || fallbackName)
      .replace(/[^\w\-.\s]/g, '')
      .trim()
      .replace(/\s+/g, '-');

  if (!safeName) {
    safeName = fallbackName;
  }

  const extensionPattern =
    new RegExp('\\.' + extension + '$', 'i');

  if (!extensionPattern.test(safeName)) {
    safeName += '.' + extension;
  }

  return safeName;
}
```

---

# 2. Script `Index.html`

```html
<!DOCTYPE html>
<html lang="id">

<head>
  <base target="_top">

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>Kamera Tab Baru</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 24px;
      background: #f1f5f9;
      color: #0f172a;
      font-family: Arial, sans-serif;
    }

    .container {
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
    }

    .card {
      padding: 24px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08);
    }

    h1 {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .description {
      margin-top: 0;
      margin-bottom: 24px;
      color: #64748b;
      line-height: 1.6;
    }

    button {
      padding: 13px 18px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .primary-button {
      width: 100%;
      background: #4f46e5;
      color: white;
    }

    .success-button {
      width: 100%;
      margin-top: 12px;
      background: #059669;
      color: white;
    }

    .preview-wrapper {
      display: none;
      margin-top: 22px;
    }

    .preview-wrapper.active {
      display: block;
    }

    .preview-wrapper img {
      display: block;
      width: 100%;
      max-height: 480px;
      border-radius: 16px;
      object-fit: contain;
      background: #0f172a;
    }

    .status {
      display: none;
      margin-top: 16px;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
    }

    .status.show {
      display: block;
    }

    .status.info {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .status.success {
      background: #ecfdf5;
      color: #047857;
    }

    .status.error {
      background: #fef2f2;
      color: #b91c1c;
    }

    .file-link {
      display: none;
      margin-top: 12px;
      text-align: center;
    }

    .file-link.active {
      display: block;
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="card">

      <h1>Open Camera di Tab Baru</h1>

      <p class="description">
        Tekan tombol berikut untuk membuka kamera pada tab atau
        popup browser baru. Setelah foto diambil, hasilnya akan
        dikirim kembali ke halaman ini.
      </p>

      <button
        type="button"
        class="primary-button"
        onclick="openCameraPopup()"
      >
        📷 Buka Kamera
      </button>

      <div
        id="photoPreviewWrapper"
        class="preview-wrapper"
      >
        <h3>Hasil Foto</h3>

        <img
          id="photoPreview"
          alt="Preview foto"
        >

        <button
          type="button"
          id="savePhotoButton"
          class="success-button"
          onclick="savePhoto()"
        >
          Simpan Foto ke Google Drive
        </button>

        <a
          id="savedFileLink"
          class="file-link"
          target="_blank"
          rel="noopener"
        >
          Buka file di Google Drive
        </a>
      </div>

      <div
        id="mainStatus"
        class="status"
      ></div>

    </div>

  </div>


  <script>
    const CAMERA_STORAGE_KEY =
      'APP_CAMERA_PHOTO_RESULT_V1';

    const MAIN_PAGE_ORIGIN =
      window.location.origin;

    const SAFE_TARGET_ORIGIN =
      MAIN_PAGE_ORIGIN === 'null'
        ? '*'
        : MAIN_PAGE_ORIGIN;

    let cameraPopup = null;
    let cameraPollingInterval = null;
    let latestPhotoData = null;

    const processedPhotoIds = new Set();


    /**
     * Membuka popup atau tab kamera.
     *
     * window.open() harus dijalankan langsung
     * dari event klik pengguna agar tidak
     * diblokir browser.
     */
    function openCameraPopup() {
      const width =
        Math.min(480, screen.availWidth - 30);

      const height =
        Math.min(760, screen.availHeight - 40);

      const left =
        Math.max(
          0,
          Math.round(
            (screen.availWidth - width) / 2
          )
        );

      const top =
        Math.max(
          0,
          Math.round(
            (screen.availHeight - height) / 2
          )
        );

      cameraPopup = window.open(
        '',
        'photo_camera_popup',
        [
          'width=' + width,
          'height=' + height,
          'left=' + left,
          'top=' + top,
          'resizable=yes',
          'scrollbars=yes'
        ].join(',')
      );

      if (!cameraPopup) {
        showStatus(
          'Popup diblokir. Izinkan popup pada browser, kemudian coba lagi.',
          'error'
        );

        return;
      }

      const cameraHTML =
        createCameraPopupHTML();

      try {
        cameraPopup.document.open();
        cameraPopup.document.write(cameraHTML);
        cameraPopup.document.close();

      } catch (error) {
        /*
         * Fallback jika document.write()
         * tidak dapat digunakan.
         */
        const cameraBlob =
          new Blob(
            [cameraHTML],
            { type: 'text/html' }
          );

        cameraPopup.location.href =
          URL.createObjectURL(cameraBlob);
      }

      startCameraPolling();

      showStatus(
        'Tab kamera sudah dibuka. Berikan izin kamera pada browser.',
        'info'
      );
    }


    /**
     * Membuat seluruh halaman kamera.
     */
    function createCameraPopupHTML() {
      const targetOrigin =
        JSON.stringify(SAFE_TARGET_ORIGIN);

      const storageKey =
        JSON.stringify(CAMERA_STORAGE_KEY);

      return `
<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>Ambil Foto</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 18px;
      background: #020617;
      color: white;
      font-family: Arial, sans-serif;
    }

    .camera-container {
      width: 100%;
      max-width: 520px;
      margin: 0 auto;
    }

    h2 {
      margin: 4px 0 6px;
      text-align: center;
    }

    .subtitle {
      margin: 0 0 16px;
      color: #94a3b8;
      text-align: center;
      font-size: 13px;
    }

    .camera-frame {
      position: relative;
      overflow: hidden;
      width: 100%;
      min-height: 300px;
      background: black;
      border: 1px solid #334155;
      border-radius: 20px;
    }

    video,
    #photoResult {
      display: block;
      width: 100%;
      min-height: 300px;
      max-height: 65vh;
      background: black;
      object-fit: contain;
    }

    #photoResult {
      display: none;
    }

    canvas {
      display: none;
    }

    .status {
      min-height: 22px;
      margin: 14px 0;
      color: #cbd5e1;
      text-align: center;
      font-size: 13px;
    }

    .status.success {
      color: #4ade80;
      font-weight: bold;
    }

    .status.error {
      color: #f87171;
      font-weight: bold;
    }

    .button-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    button {
      min-height: 46px;
      padding: 11px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
    }

    .capture-button {
      grid-column: 1 / -1;
      background: #4f46e5;
      color: white;
    }

    .use-button {
      grid-column: 1 / -1;
      display: none;
      background: #059669;
      color: white;
    }

    .retake-button {
      display: none;
      background: #f59e0b;
      color: #111827;
    }

    .switch-button {
      background: #334155;
      color: white;
    }

    .close-button {
      background: #7f1d1d;
      color: white;
    }
  </style>
</head>

<body>

  <div class="camera-container">

    <h2>📷 Kamera Foto</h2>

    <p class="subtitle">
      Ambil foto kemudian kirim hasilnya ke aplikasi utama
    </p>

    <div class="camera-frame">

      <video
        id="cameraVideo"
        autoplay
        playsinline
        muted
      ></video>

      <img
        id="photoResult"
        alt="Hasil foto"
      >

      <canvas id="photoCanvas"></canvas>

    </div>

    <div
      id="cameraStatus"
      class="status"
    >
      Memulai kamera...
    </div>

    <div class="button-grid">

      <button
        type="button"
        id="captureButton"
        class="capture-button"
        onclick="takePhoto()"
      >
        📸 Ambil Foto
      </button>

      <button
        type="button"
        id="retakeButton"
        class="retake-button"
        onclick="retakePhoto()"
      >
        ↩ Foto Ulang
      </button>

      <button
        type="button"
        id="useButton"
        class="use-button"
        onclick="sendPhotoToMainPage()"
      >
        ✓ Gunakan Foto
      </button>

      <button
        type="button"
        class="switch-button"
        onclick="switchCamera()"
      >
        🔄 Ganti Kamera
      </button>

      <button
        type="button"
        class="close-button"
        onclick="closeCameraWindow()"
      >
        ✕ Tutup
      </button>

    </div>

  </div>


  <script>
    var TARGET_ORIGIN = ${targetOrigin};
    var STORAGE_KEY = ${storageKey};

    var cameraStream = null;
    var facingMode = 'environment';
    var currentPhotoData = '';
    var currentPhotoId = '';

    var video =
      document.getElementById('cameraVideo');

    var canvas =
      document.getElementById('photoCanvas');

    var photoResult =
      document.getElementById('photoResult');

    var cameraStatus =
      document.getElementById('cameraStatus');

    var captureButton =
      document.getElementById('captureButton');

    var retakeButton =
      document.getElementById('retakeButton');

    var useButton =
      document.getElementById('useButton');


    /**
     * Memulai kamera.
     */
    async function startCamera() {
      try {
        stopCameraTracks();

        resetCameraDisplay();

        setCameraStatus(
          'Meminta izin kamera...',
          ''
        );

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            'Browser tidak mendukung akses kamera.'
          );
        }

        cameraStream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: {
                ideal: facingMode
              },

              width: {
                ideal: 1920
              },

              height: {
                ideal: 1080
              }
            },

            audio: false
          });

        video.srcObject = cameraStream;

        await video.play();

        setCameraStatus(
          'Kamera aktif. Tekan tombol Ambil Foto.',
          ''
        );

      } catch (error) {
        setCameraStatus(
          'Kamera gagal: ' +
          error.name +
          ' — ' +
          error.message,
          'error'
        );
      }
    }


    /**
     * Mengambil satu frame dari video kamera.
     */
    function takePhoto() {
      if (
        !video.videoWidth ||
        !video.videoHeight
      ) {
        setCameraStatus(
          'Video kamera belum siap.',
          'error'
        );

        return;
      }

      /*
       * Batasi ukuran gambar agar payload
       * tidak terlalu besar.
       */
      var maximumWidth = 1280;

      var scale =
        Math.min(
          1,
          maximumWidth / video.videoWidth
        );

      canvas.width =
        Math.round(
          video.videoWidth * scale
        );

      canvas.height =
        Math.round(
          video.videoHeight * scale
        );

      var context =
        canvas.getContext('2d');

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      /*
       * Mengubah canvas menjadi JPEG Base64.
       * Angka 0.82 adalah kualitas gambar.
       */
      currentPhotoData =
        canvas.toDataURL(
          'image/jpeg',
          0.82
        );

      currentPhotoId =
        'photo-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 10);

      photoResult.src =
        currentPhotoData;

      video.style.display =
        'none';

      photoResult.style.display =
        'block';

      captureButton.style.display =
        'none';

      retakeButton.style.display =
        'block';

      useButton.style.display =
        'block';

      setCameraStatus(
        'Foto berhasil diambil. Periksa hasilnya.',
        'success'
      );
    }


    /**
     * Mengulang pengambilan foto.
     */
    function retakePhoto() {
      currentPhotoData = '';
      currentPhotoId = '';

      resetCameraDisplay();

      setCameraStatus(
        'Silakan ambil foto kembali.',
        ''
      );
    }


    /**
     * Mengirim foto ke halaman utama.
     */
    function sendPhotoToMainPage() {
      if (!currentPhotoData) {
        setCameraStatus(
          'Belum ada foto yang dipilih.',
          'error'
        );

        return;
      }

      var payload = {
        type: 'CAMERA_PHOTO_RESULT',
        photoId: currentPhotoId,
        imageBase64: currentPhotoData,
        fileName:
          'foto-' +
          new Date()
            .toISOString()
            .replace(/[:.]/g, '-') +
          '.jpg',
        timestamp: Date.now()
      };

      var messageSent = false;

      /*
       * Jalur utama:
       * mengirim melalui postMessage().
       */
      try {
        if (
          window.opener &&
          !window.opener.closed
        ) {
          window.opener.postMessage(
            payload,
            TARGET_ORIGIN
          );

          messageSent = true;
        }
      } catch (error) {
        console.error(
          'postMessage gagal:',
          error
        );
      }

      /*
       * Jalur cadangan:
       * menyimpan sementara ke localStorage.
       */
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.error(
          'localStorage gagal:',
          error
        );
      }

      if (messageSent) {
        setCameraStatus(
          'Foto berhasil dikirim ke aplikasi utama.',
          'success'
        );
      } else {
        setCameraStatus(
          'Foto disimpan melalui jalur cadangan.',
          'success'
        );
      }
    }


    /**
     * Mengganti kamera depan dan belakang.
     */
    function switchCamera() {
      facingMode =
        facingMode === 'environment'
          ? 'user'
          : 'environment';

      currentPhotoData = '';
      currentPhotoId = '';

      startCamera();
    }


    /**
     * Mengatur kembali tampilan kamera.
     */
    function resetCameraDisplay() {
      video.style.display =
        'block';

      photoResult.style.display =
        'none';

      photoResult.src =
        '';

      captureButton.style.display =
        'block';

      retakeButton.style.display =
        'none';

      useButton.style.display =
        'none';
    }


    /**
     * Menghentikan semua track kamera.
     */
    function stopCameraTracks() {
      if (cameraStream) {
        cameraStream
          .getTracks()
          .forEach(function (track) {
            track.stop();
          });

        cameraStream = null;
      }
    }


    /**
     * Menutup tab kamera.
     */
    function closeCameraWindow() {
      stopCameraTracks();
      window.close();
    }


    /**
     * Menampilkan status.
     */
    function setCameraStatus(message, type) {
      cameraStatus.textContent =
        message;

      cameraStatus.className =
        'status' +
        (type ? ' ' + type : '');
    }


    /**
     * Menerima feedback dari halaman utama.
     */
    window.addEventListener(
      'message',
      function (event) {
        if (
          TARGET_ORIGIN !== '*' &&
          event.origin !== TARGET_ORIGIN
        ) {
          return;
        }

        var data = event.data;

        if (!data) {
          return;
        }

        if (
          data.type ===
          'CAMERA_PHOTO_SAVED'
        ) {
          setCameraStatus(
            'Foto tersimpan: ' +
            data.fileName,
            'success'
          );
        }

        if (
          data.type ===
          'CAMERA_PHOTO_ERROR'
        ) {
          setCameraStatus(
            data.message ||
            'Foto gagal disimpan.',
            'error'
          );
        }
      }
    );


    window.addEventListener(
      'beforeunload',
      stopCameraTracks
    );

    startCamera();
  <\/script>

</body>
</html>
      `;
    }


    /**
     * Listener utama hasil kamera.
     */
    window.addEventListener(
      'message',
      function (event) {
        /*
         * Validasi asal pesan.
         */
        if (
          MAIN_PAGE_ORIGIN !== 'null' &&
          event.origin !== MAIN_PAGE_ORIGIN
        ) {
          return;
        }

        /*
         * Validasi bahwa pesan berasal
         * dari popup kamera.
         */
        if (
          cameraPopup &&
          event.source !== cameraPopup
        ) {
          return;
        }

        const data = event.data;

        if (
          !data ||
          data.type !==
            'CAMERA_PHOTO_RESULT'
        ) {
          return;
        }

        receivePhotoResult(data);
      }
    );


    /**
     * Menerima dan menampilkan foto.
     */
    function receivePhotoResult(data) {
      if (
        !data.photoId ||
        processedPhotoIds.has(data.photoId)
      ) {
        return;
      }

      /*
       * Menolak pesan yang terlalu lama.
       */
      if (
        data.timestamp &&
        Date.now() - data.timestamp >
          30000
      ) {
        return;
      }

      if (
        typeof data.imageBase64 !== 'string' ||
        !data.imageBase64.startsWith(
          'data:image/'
        )
      ) {
        showStatus(
          'Data foto tidak valid.',
          'error'
        );

        return;
      }

      processedPhotoIds.add(
        data.photoId
      );

      /*
       * Hapus ID dari cache setelah
       * satu menit.
       */
      setTimeout(function () {
        processedPhotoIds.delete(
          data.photoId
        );
      }, 60000);

      latestPhotoData = {
        photoId: data.photoId,
        imageBase64:
          data.imageBase64,
        fileName:
          data.fileName ||
          'foto-kamera.jpg'
      };

      const preview =
        document.getElementById(
          'photoPreview'
        );

      preview.src =
        latestPhotoData.imageBase64;

      document
        .getElementById(
          'photoPreviewWrapper'
        )
        .classList.add('active');

      document
        .getElementById(
          'savedFileLink'
        )
        .classList.remove('active');

      showStatus(
        'Foto berhasil diterima dari tab kamera.',
        'success'
      );
    }


    /**
     * Polling localStorage sebagai fallback.
     */
    function startCameraPolling() {
      stopCameraPolling();

      try {
        localStorage.removeItem(
          CAMERA_STORAGE_KEY
        );
      } catch (error) {
        console.error(error);
      }

      cameraPollingInterval =
        setInterval(function () {

          /*
           * Berhenti polling jika popup
           * sudah ditutup.
           */
          if (
            cameraPopup &&
            cameraPopup.closed
          ) {
            cameraPopup = null;
            stopCameraPolling();

            return;
          }

          try {
            const rawData =
              localStorage.getItem(
                CAMERA_STORAGE_KEY
              );

            if (!rawData) {
              return;
            }

            localStorage.removeItem(
              CAMERA_STORAGE_KEY
            );

            const data =
              JSON.parse(rawData);

            receivePhotoResult(data);

          } catch (error) {
            console.error(
              'Polling kamera gagal:',
              error
            );
          }

        }, 400);
    }


    /**
     * Menghentikan polling.
     */
    function stopCameraPolling() {
      if (cameraPollingInterval) {
        clearInterval(
          cameraPollingInterval
        );

        cameraPollingInterval = null;
      }
    }


    /**
     * Menyimpan foto ke Google Drive.
     */
    function savePhoto() {
      if (!latestPhotoData) {
        showStatus(
          'Belum ada foto yang akan disimpan.',
          'error'
        );

        return;
      }

      const saveButton =
        document.getElementById(
          'savePhotoButton'
        );

      saveButton.disabled = true;
      saveButton.textContent =
        'Menyimpan foto...';

      showStatus(
        'Mengunggah foto ke Google Drive...',
        'info'
      );

      google.script.run
        .withSuccessHandler(
          function (result) {
            saveButton.disabled = false;
            saveButton.textContent =
              'Simpan Foto ke Google Drive';

            if (
              !result ||
              !result.success
            ) {
              const errorMessage =
                result && result.message
                  ? result.message
                  : 'Foto gagal disimpan.';

              showStatus(
                errorMessage,
                'error'
              );

              sendFeedbackToCamera({
                type:
                  'CAMERA_PHOTO_ERROR',
                message:
                  errorMessage
              });

              return;
            }

            showStatus(
              result.message,
              'success'
            );

            const fileLink =
              document.getElementById(
                'savedFileLink'
              );

            fileLink.href =
              result.fileUrl;

            fileLink.textContent =
              'Buka ' +
              result.fileName +
              ' di Google Drive';

            fileLink.classList.add(
              'active'
            );

            sendFeedbackToCamera({
              type:
                'CAMERA_PHOTO_SAVED',
              fileName:
                result.fileName
            });
          }
        )
        .withFailureHandler(
          function (error) {
            saveButton.disabled = false;
            saveButton.textContent =
              'Simpan Foto ke Google Drive';

            const errorMessage =
              error &&
              error.message
                ? error.message
                : String(error);

            showStatus(
              'Terjadi kesalahan: ' +
              errorMessage,
              'error'
            );

            sendFeedbackToCamera({
              type:
                'CAMERA_PHOTO_ERROR',
              message:
                errorMessage
            });
          }
        )
        .savePhotoToDrive(
          latestPhotoData.imageBase64,
          latestPhotoData.fileName
        );
    }


    /**
     * Mengirim feedback ke tab kamera.
     */
    function sendFeedbackToCamera(payload) {
      if (
        !cameraPopup ||
        cameraPopup.closed
      ) {
        return;
      }

      try {
        cameraPopup.postMessage(
          payload,
          SAFE_TARGET_ORIGIN
        );
      } catch (error) {
        console.error(
          'Feedback kamera gagal:',
          error
        );
      }
    }


    /**
     * Menampilkan notifikasi utama.
     */
    function showStatus(message, type) {
      const statusElement =
        document.getElementById(
          'mainStatus'
        );

      statusElement.textContent =
        message;

      statusElement.className =
        'status show ' +
        (type || 'info');
    }
  </script>

</body>
</html>
```

---

# 3. Cara Menggunakannya

## Langkah 1 — Buat project Apps Script

Buka Google Apps Script dan buat dua file:

```text
Code.gs
Index.html
```

Salin masing-masing script sesuai nama filenya.

## Langkah 2 — Tentukan folder penyimpanan

Buka folder Google Drive yang akan digunakan.

Contoh URL folder:

```text
https://drive.google.com/drive/folders/1ABCDEF123456789
```

Ambil bagian:

```text
1ABCDEF123456789
```

Masukkan ke:

```javascript
const PHOTO_FOLDER_ID =
  '1ABCDEF123456789';
```

Apabila dikosongkan:

```javascript
const PHOTO_FOLDER_ID = '';
```

foto akan disimpan ke root Google Drive.

## Langkah 3 — Deploy sebagai Web App

Pada Apps Script:

```text
Deploy
→ New deployment
→ Web app
```

Atur:

```text
Execute as:
Me

Who has access:
Sesuaikan dengan kebutuhan aplikasi
```

Kemudian buka URL deployment.

## Langkah 4 — Jalankan kamera

```text
Klik Buka Kamera
        ↓
Izinkan popup jika diminta
        ↓
Izinkan akses kamera
        ↓
Tekan Ambil Foto
        ↓
Periksa hasil foto
        ↓
Tekan Gunakan Foto
        ↓
Kembali ke halaman utama
        ↓
Tekan Simpan Foto ke Google Drive
```

---

# 4. Function Utama yang Perlu Dipahami

## Membuka tab kamera

```javascript
cameraPopup = window.open(
  '',
  'photo_camera_popup',
  'width=480,height=760'
);
```

## Memasukkan halaman kamera

```javascript
cameraPopup.document.open();
cameraPopup.document.write(cameraHTML);
cameraPopup.document.close();
```

## Mengaktifkan kamera

```javascript
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: {
      ideal: 'environment'
    }
  },
  audio: false
});
```

## Mengambil gambar dari video

```javascript
context.drawImage(
  video,
  0,
  0,
  canvas.width,
  canvas.height
);
```

## Mengubah hasil menjadi gambar

```javascript
const imageBase64 =
  canvas.toDataURL(
    'image/jpeg',
    0.82
  );
```

## Mengirim gambar ke halaman utama

```javascript
window.opener.postMessage({
  type: 'CAMERA_PHOTO_RESULT',
  imageBase64: imageBase64
}, targetOrigin);
```

## Menerima gambar di halaman utama

```javascript
window.addEventListener(
  'message',
  function (event) {
    if (
      event.data.type ===
      'CAMERA_PHOTO_RESULT'
    ) {
      receivePhotoResult(
        event.data
      );
    }
  }
);
```

---

# Kesimpulan

Kamera tidak dijalankan langsung di halaman utama Apps Script.

Halaman utama hanya bertugas:

```text
Membuka tab kamera
Menerima hasil foto
Menampilkan preview
Mengirim foto ke server
```

Sedangkan tab kamera bertugas:

```text
Meminta izin kamera
Menampilkan video
Mengambil foto
Mengubah foto menjadi Base64
Mengirim hasil ke halaman utama
```

Komponen inti sistemnya adalah:

```text
window.open()
        ↓
document.write()
        ↓
getUserMedia()
        ↓
canvas.drawImage()
        ↓
canvas.toDataURL()
        ↓
window.opener.postMessage()
        ↓
google.script.run
        ↓
Google Drive
```
