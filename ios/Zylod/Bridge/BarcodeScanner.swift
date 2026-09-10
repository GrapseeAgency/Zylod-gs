import UIKit
import VisionKit
import AVFoundation

// §7.1 barcode scanning — VisionKit DataScannerViewController (iOS 16+),
// camera-permission aware, one-shot: first recognized code (any symbology the
// web supports) fires the callback and dismisses. Devices where DataScanner
// is unsupported (no A12 Bionic) degrade to a graceful callback(false, msg)
// — matching the Android host's "graceful error, never a crash" rule.

@available(iOS 16.0, *)
final class BarcodeScannerViewController: UIViewController, DataScannerViewControllerDelegate {

    private let onResult: (Bool, String?) -> Void
    private var settled = false

    init(onResult: @escaping (Bool, String?) -> Void) {
        self.onResult = onResult
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        // Camera permission is required before DataScanner can start.
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            installScanner()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    granted ? self?.installScanner() : self?.finish(false, "Camera permission denied")
                }
            }
        default:
            finish(false, "Camera permission denied")
        }
    }

    private func installScanner() {
        guard DataScannerViewController.isSupported else {
            finish(false, "Barcode scanning is not supported on this device")
            return
        }
        guard DataScannerViewController.isAvailable else {
            finish(false, "The camera is not available right now")
            return
        }
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode()],
            qualityMode: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: true,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        scanner.delegate = self
        addChild(scanner)
        scanner.view.frame = view.bounds
        scanner.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(scanner.view)
        scanner.didMove(toParent: self)
        try? scanner.startScanning()
    }

    func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        guard let item = addedItems.first else { return }
        if case let .barcode(barcode) = item, let payload = barcode.payloadStringValue {
            finish(true, payload)
        }
    }

    private func finish(_ success: Bool, _ code: String?) {
        guard !settled else { return }
        settled = true
        onResult(success, code)
        dismiss(animated: true)
    }

    // UI chrome

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if closeButton.superview == nil { layoutChrome() }
    }

    private let closeButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Cancel", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        return button
    }()

    private let hintLabel: UILabel = {
        let label = UILabel()
        label.text = "Point the camera at a barcode or QR code"
        label.textColor = .white
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textAlignment = .center
        label.numberOfLines = 0
        return label
    }()

    private func layoutChrome() {
        closeButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(closeButton)
        view.addSubview(hintLabel)
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            hintLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            hintLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 48),
            hintLabel.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -8),
        ])
    }

    @objc private func cancelTapped() {
        finish(false, nil)
    }
}
