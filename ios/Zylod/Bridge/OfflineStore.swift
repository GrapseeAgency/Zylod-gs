import Foundation

// §7.1 offline store — Room + WorkManager parity for iOS.
//
// - Products: Documents/offline-products.json (rows shaped like Android's
//   OfflineProduct; the web pushes /api/products rows via
//   cacheOfflineProducts and reads them back via searchOfflineProducts).
// - Queue:     Documents/offline-queue.json; drained with ONE POST per action
//   to `/api/native/offline-sync` carrying
//   {actionType, entityType, payloadJson, clientCreatedAt (epoch ms),
//   retryCount} + Bearer from SessionManager — byte-for-byte the Android
//   OfflineSyncWorker.kt:67-99 replay contract (HTTP 2xx → delete; 4xx →
//   retryCount+1, drop after MAX_RETRIES; transport error → keep for later).

struct OfflineProduct: Codable, Equatable {
    var id: String
    var title: String
    var slug: String
    var priceBDT: Double?
    var minOrderQuantity: Int
    var supplierName: String?
    var imageUrl: String?
    var categoryName: String?
    var stock: Int
    var unit: String
}

struct SyncQueueItem: Codable, Equatable {
    var id: String
    var actionType: String
    var entityType: String
    var payloadJson: String
    var createdAt: Double        // epoch milliseconds (Android Long parity)
    var retryCount: Int
    var isSynced: Bool
}

final class OfflineStore {
    static let maxRetries = 5

    private let productsURL: URL
    private let queueURL: URL
    private let ioQueue = DispatchQueue(label: "com.zylod.offlinestore", qos: .utility)
    private let defaults: UserDefaults

    var onQueueChanged: (() -> Void)?

    init(defaults: UserDefaults = .standard) {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        productsURL = documents.appendingPathComponent("offline-products.json")
        queueURL = documents.appendingPathComponent("offline-queue.json")
        self.defaults = defaults
    }

    // MARK: - Products

    @discardableResult
    func cacheProducts(json: String) -> Int {
        guard let data = json.data(using: .utf8),
              let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return -1
        }
        let mapped = rows.compactMap(Self.mapOfflineProduct)
        guard !mapped.isEmpty else { return 0 }
        ioQueue.sync {
            var existing = (try? readJSON([OfflineProduct].self, from: productsURL)) ?? []
            var byId = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
            for product in mapped { byId[product.id] = product }
            existing = Array(byId.values)
            if let out = try? JSONEncoder().encode(existing) {
                try? out.write(to: productsURL, options: .atomic)
                defaults.set(existing.count, forKey: "zylod_offline_product_count")
            }
        }
        return mapped.count
    }

    /// Case-insensitive contains search on title/slug/supplier/category
    /// (Room LIKE '%q%' parity).
    func search(query: String) -> [OfflineProduct] {
        let all = ioQueue.sync { (try? readJSON([OfflineProduct].self, from: productsURL)) ?? [] }
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return all }
        return all.filter {
            $0.title.lowercased().contains(trimmed)
                || $0.slug.lowercased().contains(trimmed)
                || ($0.supplierName ?? "").lowercased().contains(trimmed)
                || ($0.categoryName ?? "").lowercased().contains(trimmed)
        }
    }

    func productCount() -> Int {
        ioQueue.sync { (try? readJSON([OfflineProduct].self, from: productsURL))?.count ?? -1 }
    }

    func clearProducts() {
        ioQueue.sync {
            try? FileManager.default.removeItem(at: productsURL)
            defaults.removeObject(forKey: "zylod_offline_product_count")
        }
    }

    /// Maps an /api/products row onto the offline entity, tolerating shape
    /// drift — verbatim port of WebAppBridge.toOfflineProducts (WebAppBridge.kt:367-397).
    static func mapOfflineProduct(_ obj: [String: Any]) -> OfflineProduct? {
        let id = string(obj["id"])
        let title = string(obj["name"]).isEmpty ? string(obj["title"]) : string(obj["name"])
        guard !id.isEmpty, !title.isEmpty else { return nil }
        let supplier = obj["supplier"] as? [String: Any]
        let category = obj["category"] as? [String: Any]
        let basePrice = double(obj["basePrice"]) ?? double(obj["price"])
        let supplierName = string(supplier?["companyName"]).isEmpty ? string(obj["supplierName"]) : string(supplier?["companyName"])
        let categoryName = string(category?["name"]).isEmpty ? string(obj["categoryName"]) : string(category?["name"])
        let imageUrl = string(obj["thumbnailUrl"]).isEmpty ? string(obj["imageUrl"]) : string(obj["thumbnailUrl"])
        return OfflineProduct(
            id: id,
            title: title,
            slug: string(obj["slug"]).isEmpty ? id : string(obj["slug"]),
            priceBDT: basePrice,
            minOrderQuantity: int(obj["moq"]) ?? int(obj["minOrderQuantity"]) ?? 1,
            supplierName: supplierName.isEmpty ? nil : supplierName,
            imageUrl: imageUrl.isEmpty ? nil : imageUrl,
            categoryName: categoryName.isEmpty ? nil : categoryName,
            stock: int(obj["stockQuantity"]) ?? int(obj["stock"]) ?? 0,
            unit: string(obj["unit"]).isEmpty ? "pcs" : string(obj["unit"])
        )
    }

    // MARK: - Queue

    @discardableResult
    func enqueue(actionType: String, entityType: String, payloadJson: String) -> Bool {
        guard !actionType.isEmpty, !entityType.isEmpty else { return false }
        let item = SyncQueueItem(
            id: UUID().uuidString,
            actionType: actionType,
            entityType: entityType,
            payloadJson: payloadJson,
            createdAt: Date().timeIntervalSince1970 * 1000,
            retryCount: 0,
            isSynced: false
        )
        ioQueue.sync {
            var items = (try? readJSON([SyncQueueItem].self, from: queueURL)) ?? []
            items.append(item)
            if let out = try? JSONEncoder().encode(items) {
                try? out.write(to: queueURL, options: .atomic)
            }
        }
        onQueueChanged?()
        return true
    }

    func queueCount() -> Int {
        ioQueue.sync { (try? readJSON([SyncQueueItem].self, from: queueURL))?.filter { !$0.isSynced }.count ?? 0 }
    }

    /// Replays pending actions (Android OfflineSyncWorker parity). Fire-and-
    /// forget; safe to call repeatedly (network regain, after enqueue).
    func drainQueue() {
        let pending: [SyncQueueItem] = ioQueue.sync {
            (try? readJSON([SyncQueueItem].self, from: queueURL))?
                .filter { !$0.isSynced && $0.retryCount < Self.maxRetries } ?? []
        }
        guard !pending.isEmpty else { return }

        Task.detached { [weak self] in
            guard let self else { return }
            var syncedIds: [String] = []
            var bumped: [(String, Int)] = []

            for item in pending {
                struct SyncEvent: Codable {
                    var actionType: String
                    var entityType: String
                    var payloadJson: String
                    var clientCreatedAt: Double
                    var retryCount: Int
                }
                let event = SyncEvent(
                    actionType: item.actionType,
                    entityType: item.entityType,
                    payloadJson: item.payloadJson,
                    clientCreatedAt: item.createdAt,
                    retryCount: item.retryCount
                )
                guard let body = try? JSONEncoder().encode(event) else { continue }
                // Cache-first resolution (parity with WebViewScreen.resolveAndLoad).
                let base = ServerConfig.cached() ?? await ServerConfig.resolve()
                guard let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/native/offline-sync") else { continue }
                var request = URLRequest(url: url, timeoutInterval: 20)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue("ZylodNative/2.5.0", forHTTPHeaderField: "User-Agent")
                if let token = SessionManager.token() {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                request.httpBody = body
                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                    if (200...299).contains(status) {
                        syncedIds.append(item.id)
                    } else if (400...499).contains(status) {
                        bumped.append((item.id, item.retryCount + 1))
                    }
                    // 5xx / others: leave for a later drain.
                } catch {
                    // Transient — keep for later.
                }
            }

            guard !syncedIds.isEmpty || !bumped.isEmpty else { return }
            self.ioQueue.sync {
                var items = (try? self.readJSON([SyncQueueItem].self, from: self.queueURL)) ?? []
                items.removeAll { item in syncedIds.contains(item.id) }
                for item in items.indices {
                    if let match = bumped.first(where: { $0.0 == items[item].id }) {
                        items[item].retryCount = match.1
                    }
                }
                if let out = try? JSONEncoder().encode(items) {
                    try? out.write(to: self.queueURL, options: .atomic)
                }
            }
            self.onQueueChanged?()
        }
    }

    // MARK: - File helpers

    private func readJSON<T: Decodable>(_ type: T.Type, from url: URL) throws -> T {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func string(_ any: Any?) -> String {
        switch any {
        case let s as String: return s
        case let n as NSNumber: return n.stringValue
        default: return ""
        }
    }

    private static func int(_ any: Any?) -> Int? {
        (any as? NSNumber)?.intValue
    }

    private static func double(_ any: Any?) -> Double? {
        (any as? NSNumber)?.doubleValue
    }
}
