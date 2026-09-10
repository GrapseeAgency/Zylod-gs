import Foundation
import AVFoundation
import Speech

// §7.1 voice recognition — SFSpeechRecognizer over live AVAudioEngine input
// (the WKWebView exposes no Web Speech API). Handles both microphone and
// speech permissions; a denial or engine failure surfaces as
// callback(false, message) — never a crash (Android host parity).
// The session auto-stops after `timeoutSeconds` or when the user's utterance
// is finalized, whichever comes first.

final class VoiceRecognitionController: NSObject, SFSpeechRecognizerDelegate {

    static let shared = VoiceRecognitionController()
    private let timeoutSeconds: TimeInterval = 10

    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var completion: ((Bool, String?) -> Void)?
    private var settled = true
    private var timeoutWork: DispatchWorkItem?

    func run(completion: @escaping (Bool, String?) -> Void) {
        guard settled else {
            completion(false, "Voice recognition is already running")
            return
        }
        settled = false
        self.completion = completion

        // Permission 1: microphone
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] micGranted in
            guard let self else { return }
            guard micGranted else {
                self.finish(false, "Microphone permission denied")
                return
            }
            // Permission 2: speech recognition
            SFSpeechRecognizer.requestAuthorization { [weak self] status in
                guard let self else { return }
                guard status == .authorized else {
                    self.finish(false, "Speech recognition permission denied")
                    return
                }
                DispatchQueue.main.async { self.startEngine() }
            }
        }
    }

    private func startEngine() {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        guard let recognizer, recognizer.isAvailable else {
            finish(false, "Speech recognition is unavailable for en-US")
            return
        }
        recognizer.delegate = self

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let engine = AVAudioEngine()
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true

            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                self?.request?.append(buffer)
            }

            engine.prepare()
            try engine.start()

            self.engine = engine
            self.request = request
            self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                // SFTranscription.formattedString is non-optional — no optional binding.
                if let result, !result.bestTranscription.formattedString.isEmpty {
                    self.lastPartial = result.bestTranscription.formattedString
                }
                if let result, result.isFinal, !result.bestTranscription.formattedString.isEmpty {
                    self.finish(true, result.bestTranscription.formattedString)
                    return
                }
                if error != nil {
                    // Partial results may already have text — prefer them.
                    if let result, !result.bestTranscription.formattedString.isEmpty {
                        self.finish(true, result.bestTranscription.formattedString)
                    } else {
                        self.finish(false, "Voice recognition failed")
                    }
                }
            }

            // Hard timeout: stop after N seconds with whatever was heard.
            let work = DispatchWorkItem { [weak self] in
                self?.stopAndDeliverBestResult()
            }
            timeoutWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + timeoutSeconds, execute: work)
        } catch {
            finish(false, "Could not start the microphone: \(error.localizedDescription)")
        }
    }

    private var lastPartial: String?

    private func stopAndDeliverBestResult() {
        // Keep the engine's tap long enough to finalize, but cap delivery.
        if let task, !task.isFinishing {
            task.finish()
        }
        request?.endAudio()
        // Give the recognizer a short grace period to emit isFinal.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let self, !self.settled else { return }
            if let partial = self.lastPartial, !partial.isEmpty {
                self.finish(true, partial)
            } else {
                self.finish(false, "No speech detected")
            }
        }
    }

    private func finish(_ success: Bool, _ message: String?) {
        guard !settled else { return }
        settled = true
        timeoutWork?.cancel()
        timeoutWork = nil
        if let engine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        engine = nil
        request = nil
        task = nil
        completion?(success, message)
        completion = nil
    }
}
