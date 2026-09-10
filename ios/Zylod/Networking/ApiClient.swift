import Foundation

// Wire contracts mirroring android/data/api — frozen in platform-contracts.md.
// Envelope: { success, data?, pagination?, error? } · pagination: { page, limit, total, totalPages }

struct ApiEnvelope<Data: Codable>: Codable {
    var success: Bool?
    var data: Data?
    var pagination: Pagination?
    var error: String?
}

struct CountEnvelope: Codable {
    var success: Bool?
    var pagination: Pagination?
}

struct Pagination: Codable {
    var page: Int?
    var limit: Int?
    var total: Int?
    var totalPages: Int?
}

enum ApiError: Error, LocalizedError {
    case http(Int)
    case badUrl(String)

    var errorDescription: String? {
        switch self {
        case .http(let status): return "Server returned HTTP \(status)"
        case .badUrl(let raw): return "Invalid server address: \(raw)"
        }
    }
}

struct Category: Codable {
    let id: String
    let name: String
    var slug: String?
    var productCount: Int?
    var children: [Category]?
}

struct SupplierBrief: Codable {
    var companyName: String?
}

// Real API shape: images are objects with relative imageUrl paths, ordered by sortOrder.
struct ProductImage: Codable {
    var imageUrl: String?
    var sortOrder: Int?
}

struct Product: Codable {
    let id: String
    let name: String
    var slug: String?
    var basePrice: Double?
    var thumbnailUrl: String?
    var images: [ProductImage]?
    var unit: String?
    var moq: Int?
    var soldCount: Int?
    var ratingAvg: Double?
    var reviewCount: Int?
    var supplier: SupplierBrief?

    var firstImage: String? {
        let usable = (images ?? []).filter { !($0.imageUrl ?? "").isEmpty }
        return usable.min { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }?.imageUrl ?? thumbnailUrl
    }
}

struct Deal: Codable {
    var productId: String?
    var productName: String?
    var dealPrice: Double?
    var productThumbnail: String?
    var product: Product?

    var effectiveId: String? { productId ?? product?.id }
    var effectiveName: String? { productName ?? product?.name }
    var effectivePrice: Double { dealPrice ?? product?.basePrice ?? 0 }
    var effectiveImage: String? { productThumbnail ?? product?.thumbnailUrl }
}

// /api/deals returns data as { flashDeals: [...], dailyDeals: [...] }
struct DealsData: Codable {
    var flashDeals: [Deal]?
    var dailyDeals: [Deal]?

    var all: [Deal] { (flashDeals ?? []) + (dailyDeals ?? []) }
}

struct Stats {
    var productCount = 0
    var supplierCount = 0
}

final class ApiClient {
    private let base: URL
    private let session = URLSession.shared
    private let decoder = JSONDecoder()

    /// Failable: a corrupted `native_base_url` (UserDefaults is user-editable
    /// via instrumentation) must surface as nil, never crash at init (D2 fix).
    init?(base: String) {
        let normalized = base.hasSuffix("/") ? base : base + "/"
        guard let url = URL(string: normalized) else { return nil }
        self.base = url
    }

    private func request(_ path: String, query: [URLQueryItem] = []) throws -> URLRequest {
        guard var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw ApiError.badUrl(path)
        }
        if !query.isEmpty {
            components.queryItems = query
        }
        guard let url = components.url else {
            throw ApiError.badUrl(path)
        }
        var request = URLRequest(url: url, timeoutInterval: 20)
        if let token = SessionManager.token() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("ZylodNative/2.5.0", forHTTPHeaderField: "User-Agent")
        return request
    }

    private func get<Envelope: Codable>(_ path: String, query: [URLQueryItem] = []) async throws -> Envelope {
        let (data, response) = try await session.data(for: request(path, query: query))
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ApiError.http(http.statusCode)
        }
        return try decoder.decode(Envelope.self, from: data)
    }

    func categories() async throws -> ApiEnvelope<[Category]> {
        try await get("api/categories")
    }

    func products(page: Int, limit: Int = 20) async throws -> ApiEnvelope<[Product]> {
        try await get("api/products", query: [
            URLQueryItem(name: "sortBy", value: "soldCount"),
            URLQueryItem(name: "sortOrder", value: "desc"),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "page", value: String(page)),
        ])
    }

    func deals(limit: Int = 8) async throws -> ApiEnvelope<DealsData> {
        try await get("api/deals", query: [
            URLQueryItem(name: "type", value: "flash"),
            URLQueryItem(name: "limit", value: String(limit)),
        ])
    }

    func productCount() async throws -> CountEnvelope {
        try await get("api/products", query: [URLQueryItem(name: "limit", value: "1")])
    }

    func supplierCount() async throws -> CountEnvelope {
        try await get("api/suppliers", query: [URLQueryItem(name: "limit", value: "1")])
    }
}
