import Foundation

// Wire contracts mirroring android/data/api — frozen in platform-contracts.md.
// Envelope: { success, data?, pagination?, error? } · pagination: { page, limit, total, totalPages }
//
// Phase 1 extension: auth suite + product detail + cart + wishlist +
// orders/create-direct + KYC upload + profile/me + session refresh.
// §7-D: every JSON POST goes through `postJson`, which decodes non-2xx bodies
// into a typed ApiFailure and performs ONE refresh-rotation retry on 401.

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

struct Category: Codable, Identifiable {
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

    // MARK: Request plumbing

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

    /// GET an envelope, mapping non-2xx into ApiFailure.
    private func getEnvelope<Envelope: Codable>(_ path: String, query: [URLQueryItem] = []) async throws -> Envelope {
        let (data, response) = try await session.data(for: request(path, query: query))
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ApiFailure.decode(status: http.statusCode, data: data)
        }
        return try decoder.decode(Envelope.self, from: data)
    }

    /// JSON POST with the §7-D 401 contract: on 401, attempt ONE refresh
    /// rotation (POST api/auth/refresh with the current Bearer — the route
    /// reads `Authorization` as the refresh token, refresh/route.ts:19-23);
    /// on rotation success the new token is stored and the call retried once;
    /// on rotation failure the session is cleared and `zylodSessionExpired`
    /// is posted. Never loops.
    private func send<Body: Encodable, Out: Codable>(_ path: String, method: String = "POST", body: Body, retryOn401: Bool = true) async throws -> Out {
        var httpRequest = try request(path)
        httpRequest.httpMethod = method
        httpRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        httpRequest.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: httpRequest)

        if let http = response as? HTTPURLResponse, http.statusCode == 401, retryOn401,
           let expired = SessionManager.token(), !expired.isEmpty {
            if let renewed = try? await Self.refreshSession(base: base, expiredToken: expired) {
                SessionManager.setToken(renewed)
                return try await send(path, method: method, body: body, retryOn401: false)
            }
            SessionManager.signOut()
            await MainActor.run {
                NotificationCenter.default.post(name: .zylodSessionExpired, object: nil)
            }
            throw ApiFailure.decode(status: 401, data: data)
        }

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ApiFailure.decode(status: http.statusCode, data: data)
        }
        return try decoder.decode(Out.self, from: data)
    }

    private func sendRaw<Out: Codable>(_ path: String, method: String, body: Data, contentType: String) async throws -> Out {
        var httpRequest = try request(path)
        httpRequest.httpMethod = method
        httpRequest.setValue(contentType, forHTTPHeaderField: "Content-Type")
        httpRequest.httpBody = body
        let (data, response) = try await session.data(for: httpRequest)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ApiFailure.decode(status: http.statusCode, data: data)
        }
        return try decoder.decode(Out.self, from: data)
    }

    // MARK: Home (Phase 0 endpoints — unchanged)

    func categories() async throws -> ApiEnvelope<[Category]> {
        try await getEnvelope("api/categories")
    }

    func products(page: Int, limit: Int = 20) async throws -> ApiEnvelope<[Product]> {
        try await getEnvelope("api/products", query: [
            URLQueryItem(name: "sortBy", value: "soldCount"),
            URLQueryItem(name: "sortOrder", value: "desc"),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "page", value: String(page)),
        ])
    }

    func deals(limit: Int = 8) async throws -> ApiEnvelope<DealsData> {
        try await getEnvelope("api/deals", query: [
            URLQueryItem(name: "type", value: "flash"),
            URLQueryItem(name: "limit", value: String(limit)),
        ])
    }

    func productCount() async throws -> CountEnvelope {
        try await getEnvelope("api/products", query: [URLQueryItem(name: "limit", value: "1")])
    }

    func supplierCount() async throws -> CountEnvelope {
        try await getEnvelope("api/suppliers", query: [URLQueryItem(name: "limit", value: "1")])
    }

    // MARK: Auth suite (§5.2)

    struct LoginBody: Codable { var email: String?; var phone: String?; var password: String }
    func login(email: String?, phone: String?, password: String) async throws -> LoginResponse {
        try await send("api/auth/login", body: LoginBody(email: email?.lowercased(), phone: phone, password: password))
    }

    struct SocialBody: Codable { var googleId: String?; var facebookId: String?; var email: String; var name: String }
    /// Simulated-consent exchange (social-auth.ts:86-124): googleId keeps the
    /// `g-` prefix; facebookId strips the `fb-` prefix.
    func socialLogin(provider: String, providerId: String, email: String, name: String) async throws -> LoginResponse {
        let body: SocialBody
        if provider == "google" {
            body = SocialBody(googleId: providerId, facebookId: nil, email: email, name: name)
        } else {
            let stripped = providerId.hasPrefix("fb-") ? String(providerId.dropFirst(3)) : providerId
            body = SocialBody(googleId: nil, facebookId: stripped, email: email, name: name)
        }
        return try await send("api/auth/\(provider)", body: body)
    }

    struct OtpSendBody: Codable { var phoneOrEmail: String; var purpose: String }
    func otpSend(phoneOrEmail: String, purpose: String) async throws -> OtpSendResponse {
        try await send("api/auth/otp/send", body: OtpSendBody(phoneOrEmail: phoneOrEmail, purpose: purpose))
    }

    struct OtpVerifyBody: Codable { var phoneOrEmail: String; var code: String }
    func otpVerify(phoneOrEmail: String, code: String) async throws -> OtpVerifyResponse {
        try await send("api/auth/otp/verify", body: OtpVerifyBody(phoneOrEmail: phoneOrEmail, code: code))
    }

    /// Registration payload — the exact field list the register route reads
    /// (register/route.ts:32-34). Optional fields serialize as null.
    struct RegisterBody: Codable {
        var userType: String
        var email: String?
        var phone: String?
        var password: String?
        var authProvider: String
        var fullName: String?
        var businessName: String?
        var businessType: String?
        var city: String?
        var nidNumber: String?
        var nidFrontImageUrl: String?
        var nidBackImageUrl: String?
        var tradeLicenseNumber: String?
        var tradeLicenseImageUrl: String?
        var tinNumber: String?
        var bankName: String?
        var bankAccountName: String?
        var bankAccountNumber: String?
        var branch: String?
        var isPhoneVerified: Bool?
        var isEmailVerified: Bool?
    }
    func register(_ body: RegisterBody) async throws -> RegisterResponse {
        try await send("api/auth/register", body: body)
    }

    struct TwoFactorBody: Codable { var userId: String; var code: String; var method: String }
    func twoFactorVerify(userId: String, code: String, method: String = "authenticator") async throws -> TwoFactorVerifyResponse {
        try await send("api/auth/2fa/verify", body: TwoFactorBody(userId: userId, code: code, method: method))
    }

    struct ForgotPasswordBody: Codable { var email: String }
    func forgotPassword(email: String) async throws -> ForgotPasswordResponse {
        try await send("api/auth/forgot-password", body: ForgotPasswordBody(email: email.lowercased()))
    }

    struct ResetPasswordBody: Codable { var token: String; var password: String; var confirmPassword: String }
    struct GenericMessageResponse: Codable { var success: Bool?; var message: String? }
    func resetPassword(token: String, password: String, confirmPassword: String) async throws -> GenericMessageResponse {
        try await send("api/auth/reset-password", body: ResetPasswordBody(token: token, password: password, confirmPassword: confirmPassword))
    }

    /// Single-use session rotation. The refresh route accepts the CURRENT
    /// session token via the Authorization header (refresh/route.ts:19-23) —
    /// body.refreshToken and the auth-token cookie are alternates; native has
    /// no cookies, so Bearer is the honest path.
    static func refreshSession(base: URL, expiredToken: String) async throws -> String {
        var request = URLRequest(url: base.appendingPathComponent("api/auth/refresh"), timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(expiredToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = Data("{}".utf8)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw ApiFailure.decode(status: (response as? HTTPURLResponse)?.statusCode ?? 0, data: data)
        }
        let decoded = try JSONDecoder().decode(RefreshResponse.self, from: data)
        guard let token = decoded.token, !token.isEmpty else {
            throw ApiFailure(status: 200, error: "Refresh returned no token")
        }
        return token
    }

    // MARK: Product detail (§3.9)

    func productDetail(_ id: String) async throws -> ApiEnvelope<ProductDetail> {
        try await getEnvelope("api/products/\(id)")
    }

    func productSpecifications(_ id: String) async throws -> SpecificationsResponse {
        try await getEnvelope("api/products/\(id)/specifications")
    }

    func productSimilar(_ id: String) async throws -> SimilarResponse {
        try await getEnvelope("api/products/\(id)/similar", query: [URLQueryItem(name: "limit", value: "8")])
    }

    func productQA(_ id: String) async throws -> QAResponse {
        try await getEnvelope("api/products/\(id)/qa")
    }

    func productFrequentlyBought(_ id: String) async throws -> FrequentlyBoughtResponse {
        try await getEnvelope("api/products/\(id)/frequently-bought", query: [URLQueryItem(name: "limit", value: "4")])
    }

    // MARK: Cart (§3.10 — buyer-only server-side)

    func serverCart() async throws -> ApiEnvelope<ServerCart> {
        try await getEnvelope("api/cart")
    }

    struct CartAddBody: Codable {
        var productId: String
        var variantId: String?
        var quantity: Int
        var supplierId: String
    }
    func cartAdd(_ body: CartAddBody) async throws -> ApiEnvelope<ServerCartItem> {
        try await send("api/cart", body: body)
    }

    struct CartUpdateBody: Codable { var quantity: Int }
    func cartUpdate(itemId: String, quantity: Int) async throws -> ApiEnvelope<ServerCartItem> {
        try await send("api/cart/\(itemId)", method: "PUT", body: CartUpdateBody(quantity: quantity))
    }

    func cartDelete(itemId: String) async throws -> GenericMessageResponse {
        struct Empty: Codable {}
        return try await send("api/cart/\(itemId)", method: "DELETE", body: Empty())
    }

    // MARK: Wishlist (§3.9 — auth-gated toggle)

    struct WishlistAddBody: Codable { var productId: String }
    func wishlistAdd(productId: String) async throws -> GenericMessageResponse {
        try await send("api/wishlist", body: WishlistAddBody(productId: productId))
    }

    func wishlistRemove(productId: String) async throws -> GenericMessageResponse {
        var httpRequest = try request("api/wishlist", query: [URLQueryItem(name: "productId", value: productId)])
        httpRequest.httpMethod = "DELETE"
        let (data, response) = try await session.data(for: httpRequest)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ApiFailure.decode(status: http.statusCode, data: data)
        }
        return try decoder.decode(GenericMessageResponse.self, from: data)
    }

    // MARK: Buy-now (§3.9 — follow web handler exactly, product-detail-page.tsx:398-409)

    struct CreateDirectOrderBody: Codable {
        var productId: String
        var quantity: Int
        var unitPrice: Double
        var supplierId: String
        var variantId: String?
        var paymentMethod: String
    }
    func createDirectOrder(_ body: CreateDirectOrderBody) async throws -> ApiEnvelope<DirectOrder> {
        try await send("api/orders/create-direct", body: body)
    }

    // MARK: Profile (§7.4 hydration)

    func profileMe() async throws -> ApiEnvelope<ProfileMe> {
        try await getEnvelope("api/profile/me")
    }

    // MARK: KYC upload (multipart, §3.5)

    /// Streams the file body via URLSession uploadTask. Response puts `url`
    /// at TOP level (uploads/kyc/route.ts:46-51).
    func uploadKyc(fileURL: URL, kind: String) async throws -> KycUploadResponse {
        var httpRequest = try request("api/uploads/kyc")
        httpRequest.httpMethod = "POST"

        let boundary = "zylod.kyc.\(UUID().uuidString)"
        httpRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let fileName = fileURL.lastPathComponent
        var fileData: Data
        do {
            fileData = try Data(contentsOf: fileURL, options: .mappedIfSafe)
        } catch {
            throw ApiFailure(status: 0, error: "Could not read the selected image")
        }

        var body = Data()
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"kind\"\r\n\r\n".utf8))
        body.append(Data("\(kind)\r\n".utf8))
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".utf8))
        body.append(Data("Content-Type: image/jpeg\r\n\r\n".utf8))
        body.append(fileData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))

        return try await withCheckedThrowingContinuation { continuation in
            let task = session.uploadTask(with: httpRequest, from: body) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                let payload = data ?? Data()
                if !(200...299).contains(status) {
                    continuation.resume(throwing: ApiFailure.decode(status: status, data: payload))
                    return
                }
                do {
                    continuation.resume(returning: try self.decoder.decode(KycUploadResponse.self, from: payload))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
            task.resume()
        }
    }
}
