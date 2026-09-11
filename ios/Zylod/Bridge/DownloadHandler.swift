import UIKit
import WebKit

// §7.1 download parity (Android DownloadBridge.kt).
//
// Two paths:
// 1. iOS 14.5+ (WKDownloadDelegate was introduced in 14.5, not 17): WKWebView
//    hands .download decisions to the delegate; the downloaded file lands in
//    Documents and a share sheet is offered.
// 2. Blob/data URLs (any iOS): `ZylodDownload.save(dataUrl, filename, mime)`
//    via the bridge — base64 decoded, written to Documents, share sheet
//    (the simple robust path mandated by the brief; blob FETCH happens in
//    the page, then the page hands us the data: URL — same as Android).

enum DownloadHandler {

    static var documentsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
    }

    /// Decodes a data: URL and writes it into Documents. Returns the file URL
    /// or nil (Android persistDataUrl parity).
    @discardableResult
    static func saveDataUrl(dataUrl: String, filename: String, mime: String, completion: ((URL?) -> Void)? = nil) -> URL? {
        guard dataUrl.hasPrefix("data:"), let comma = dataUrl.firstIndex(of: ",") else {
            completion?(nil)
            return nil
        }
        let base64 = String(dataUrl[dataUrl.index(after: comma)...])
        guard let bytes = Data(base64Encoded: base64) else {
            completion?(nil)
            return nil
        }
        let sanitized = sanitize(filename)
        let finalName = sanitized.isEmpty ? "zylod_download" : sanitized
        let ext = Self.extensionForMime(mime)
        let target = uniqueURL(in: documentsDirectory, name: finalName, ext: ext)
        do {
            try bytes.write(to: target, options: .atomic)
            completion?(target)
            return target
        } catch {
            completion?(nil)
            return nil
        }
    }

    static func sanitize(_ name: String) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._ ()-")
        return name.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }.reduce(into: "") { $0.append($1) }
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func extensionForMime(_ mime: String) -> String {
        switch mime.lowercased() {
        case "application/pdf": return "pdf"
        case "image/png": return "png"
        case "image/jpeg", "image/jpg": return "jpg"
        case "image/webp": return "webp"
        case "text/csv": return "csv"
        case "application/zip": return "zip"
        case "text/plain": return "txt"
        default: return ""
        }
    }

    private static func uniqueURL(in directory: URL, name: String, ext: String) -> URL {
        var candidate = directory.appendingPathComponent(ext.isEmpty ? name : "\(name).\(ext)")
        var counter = 1
        while FileManager.default.fileExists(atPath: candidate.path) {
            let base = (name as NSString).deletingPathExtension
            candidate = directory.appendingPathComponent("\(base) (\(counter))\(ext.isEmpty ? "" : ".\(ext)")")
            counter += 1
        }
        return candidate
    }
}

// MARK: - WKDownloadDelegate bridge (iOS 14.5+)

@available(iOS 14.5, *)
final class ZylodDownloadDelegate: NSObject, WKDownloadDelegate {

    static let shared = ZylodDownloadDelegate()
    var onSaved: ((URL?) -> Void)?
    private var lastDestination: URL?

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let sanitized = DownloadHandler.sanitize(suggestedFilename)
        let target = DownloadHandler.documentsDirectory.appendingPathComponent(sanitized.isEmpty ? "zylod_download" : sanitized)
        try? FileManager.default.createDirectory(at: DownloadHandler.documentsDirectory, withIntermediateDirectories: true)
        lastDestination = target
        completionHandler(target)
    }

    func downloadDidFinish(_ download: WKDownload) {
        onSaved?(lastDestination)
        lastDestination = nil
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        onSaved?(nil)
        lastDestination = nil
    }
}
