/**
* SCRIPT OPEN CAMERA DI TAB / POPUP BARU
*
* Pasang function ini pada JavaScript halaman utama.
* Jalankan melalui tombol:
*
* <button onclick="openCameraInNewTab()">Buka Kamera</button>
*/

let cameraPopupWindow = null;

function openCameraInNewTab() {
const popupWidth = Math.min(480, screen.availWidth - 30);
const popupHeight = Math.min(760, screen.availHeight - 40);

const popupLeft = Math.max(
0,
Math.round((screen.availWidth - popupWidth) / 2)
);

const popupTop = Math.max(
0,
Math.round((screen.availHeight - popupHeight) / 2)
);

/*
* window.open() harus dipanggil langsung dari klik pengguna
* agar tidak diblokir browser.
*/
cameraPopupWindow = window.open(
'',
'camera_popup_window',
[
`width=${popupWidth}`,
`height=${popupHeight}`,
`left=${popupLeft}`,
`top=${popupTop}`,
'resizable=yes',
'scrollbars=yes'
].join(',')
);

if (!cameraPopupWindow) {
alert(
'Popup kamera diblokir browser. Izinkan popup, lalu coba kembali.'
);

return;
}

const cameraPageHTML = `
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Kamera</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            padding: 18px;
            background: #020617;
            color: #ffffff;
            font-family: Arial, sans-serif;
        }

        .camera-container {
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
        }

        h2 {
            margin: 5px 0 6px;
            text-align: center;
        }

        .description {
            margin: 0 0 16px;
            color: #94a3b8;
            font-size: 13px;
            text-align: center;
        }

        .camera-frame {
            position: relative;
            overflow: hidden;
            width: 100%;
            min-height: 320px;
            background: #000000;
            border: 1px solid #334155;
            border-radius: 20px;
        }

        video {
            display: block;
            width: 100%;
            min-height: 320px;
            max-height: 70vh;
            background: #000000;
            object-fit: cover;
        }

        .camera-status {
            min-height: 22px;
            margin: 14px 0;
            color: #cbd5e1;
            font-size: 13px;
            text-align: center;
        }

        .camera-status.error {
            color: #f87171;
            font-weight: bold;
        }

        .camera-status.success {
            color: #4ade80;
            font-weight: bold;
        }

        .button-wrapper {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        button {
            min-height: 46px;
            padding: 12px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: 13px;
            font-weight: bold;
        }

        .switch-camera-button {
            background: #4f46e5;
            color: #ffffff;
        }

        .close-camera-button {
            background: #991b1b;
            color: #ffffff;
        }
    </style>
</head>

<body>

    <div class="camera-container">

        <h2>📷 Kamera Live</h2>

        <p class="description">
            Kamera dijalankan melalui tab atau popup browser baru.
        </p>

        <div class="camera-frame">
            <video id="cameraVideo" autoplay playsinline muted></video>
        </div>

        <div id="cameraStatus" class="camera-status">
            Memulai kamera...
        </div>

        <div class="button-wrapper">

            <button type="button" class="switch-camera-button" onclick="switchCamera()">
                🔄 Ganti Kamera
            </button>

            <button type="button" class="close-camera-button" onclick="closeCamera()">
                ✕ Tutup Kamera
            </button>

        </div>

    </div>

    <script>
        let cameraStream = null;
        let activeFacingMode = 'environment';

        const cameraVideo =
            document.getElementById('cameraVideo');

        const cameraStatus =
            document.getElementById('cameraStatus');


        async function startCamera() {
            try {
                stopCameraStream();

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
                                ideal: activeFacingMode
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

                cameraVideo.srcObject =
                    cameraStream;

                await cameraVideo.play();

                setCameraStatus(
                    activeFacingMode === 'environment'
                        ? 'Kamera belakang aktif.'
                        : 'Kamera depan aktif.',
                    'success'
                );

            } catch (error) {
                console.error(
                    'Gagal membuka kamera:',
                    error
                );

                let errorMessage =
                    error.message ||
                    'Kamera tidak dapat dijalankan.';

                if (error.name === 'NotAllowedError') {
                    errorMessage =
                        'Izin kamera ditolak. Izinkan akses kamera melalui pengaturan browser.';
                }

                if (error.name === 'NotFoundError') {
                    errorMessage =
                        'Perangkat kamera tidak ditemukan.';
                }

                if (error.name === 'NotReadableError') {
                    errorMessage =
                        'Kamera sedang digunakan aplikasi lain atau tidak dapat dibaca.';
                }

                if (error.name === 'OverconstrainedError') {
                    errorMessage =
                        'Konfigurasi kamera tidak didukung oleh perangkat.';
                }

                setCameraStatus(
                    errorMessage,
                    'error'
                );
            }
        }


        async function switchCamera() {
            activeFacingMode =
                activeFacingMode === 'environment'
                    ? 'user'
                    : 'environment';

            await startCamera();
        }


        function stopCameraStream() {
            if (!cameraStream) {
                return;
            }

            cameraStream
                .getTracks()
                .forEach(function (track) {
                    track.stop();
                });

            cameraStream = null;
            cameraVideo.srcObject = null;
        }


        function closeCamera() {
            stopCameraStream();
            window.close();
        }


        function setCameraStatus(message, type) {
            cameraStatus.textContent = message;

            cameraStatus.className =
                'camera-status' +
                (type ? ' ' + type : '');
        }


        window.addEventListener(
            'beforeunload',
            stopCameraStream
        );

        startCamera();
  <\/script>

</body >

</html >
            `;

  try {
    cameraPopupWindow.document.open();
    cameraPopupWindow.document.write(cameraPageHTML);
    cameraPopupWindow.document.close();

    cameraPopupWindow.focus();

  } catch (error) {
    console.error(
      'Gagal menulis halaman kamera:',
      error
    );

    /*
     * Fallback menggunakan Blob URL.
     */
    const cameraPageBlob = new Blob(
      [cameraPageHTML],
      {
        type: 'text/html'
      }
    );

    cameraPopupWindow.location.href =
      URL.createObjectURL(cameraPageBlob);
  }
}


/**
 * Menutup kamera dari halaman utama.
 */
function closeCameraPopup() {
  if (
    cameraPopupWindow &&
    !cameraPopupWindow.closed
  ) {
    cameraPopupWindow.close();
  }

  cameraPopupWindow = null;
}