import Foundation

// Wire contracts for Phase 1 screens. Every struct is a faithful mirror of the
// route.ts response shapes verified against source (see file:line notes).

// MARK: - Typed failure (§7-D error model)

/// Decoded error body: `{error, code?, attemptsRemaining?, accountLocked?,
/// lockedUntil?, suspension{reason,reference,suspendedAt}, stockAvailable?, moq?}`
/// — thrown by ApiClient for non-2xx responses.
struct ApiFailure: Error, LocalizedError {
    struct Suspension: Codable {
        var reason: String?
        var reference: String?
        var suspendedAt: String?
    }

    var status: Int
    var error: String
    var code: String?
    var attemptsRemaining: Int?
    var accountLocked: Bool?
    var lockedUntil: Double?
    var suspension: Suspension?
    var stockAvailable: Int?
    var moq: Int?

    var errorDescription: String? { error }

    /// Decodable mirror of the wire body — `status` is client-side only, so a
    /// straight `decode(ApiFailure.self)` would always throw on the missing key.
    private struct Body: Decodable {
        var error: String?
        var code: String?
        var attemptsRemaining: Int?
        var accountLocked: Bool?
        var lockedUntil: Double?
        var suspension: Suspension?
        var stockAvailable: Int?
        var moq: Int?
    }

    static func decode(status: Int, data: Data) -> ApiFailure {
        if let body = try? JSONDecoder().decode(Body.self, from: data), let message = body.error, !message.isEmpty {
            return ApiFailure(
                status: status,
                error: message,
                code: body.code,
                attemptsRemaining: body.attemptsRemaining,
                accountLocked: body.accountLocked,
                lockedUntil: body.lockedUntil,
                suspension: body.suspension,
                stockAvailable: body.stockAvailable,
                moq: body.moq
            )
        }
        return ApiFailure(status: status, error: "Request failed (HTTP \(status))")
    }
}

// MARK: - Auth DTOs

/// POST /api/auth/login 200 body (login/route.ts:167-182).
struct LoginResponse: Codable {
    var success: Bool?
    var token: String?
    var requires2FA: Bool?
    var userId: String?
    var methods: [String]?
    var hasPhone: Bool?
    var maskedPhone: String?
    var user: AuthUser?
}

/// User block shared by login / register / otp-verify / 2fa-verify.
struct AuthUser: Codable {
    var id: String
    var userType: String?
    var email: String?
    var phone: String?
    var authProvider: String?
    var accountStatus: String?
    var isEmailVerified: Bool?
    var isPhoneVerified: Bool?
    var requires2FA: Bool?
    var fullName: String?
    var businessName: String?
}

/// POST /api/auth/otp/send (otp/send/route.ts:58-65) — devCode is dev-only and
/// must never be displayed (Phase 1 rule).
struct OtpSendResponse: Codable {
    var success: Bool?
    var message: String?
    var otpCode: String?
    var devCode: String?
    var expiresAt: String?
}

/// POST /api/auth/otp/verify (otp/verify/route.ts) — token when a session was
/// minted (existing user), resetToken for reset_password, neither for
/// pre-registration.
struct OtpVerifyResponse: Codable {
    var success: Bool?
    var verified: Bool?
    var message: String?
    var token: String?
    var resetToken: String?
    var user: AuthUser?
}

/// POST /api/auth/register 201 (register/route.ts:137-152).
struct RegisterResponse: Codable {
    var success: Bool?
    var token: String?
    var user: AuthUser?
}

/// POST /api/auth/2fa/verify (2fa/verify/route.ts:82-96).
struct TwoFactorVerifyResponse: Codable {
    var success: Bool?
    var message: String?
    var token: String?
    var user: AuthUser?
}

/// POST /api/auth/refresh (refresh/route.ts:54-64).
struct RefreshResponse: Codable {
    var success: Bool?
    var token: String?
    var expiresIn: Int?
    var user: AuthUser?
}

/// POST /api/auth/forgot-password — success + generic message (+devToken dev-only).
struct ForgotPasswordResponse: Codable {
    var success: Bool?
    var message: String?
    var devToken: String?
}

// MARK: - Product detail DTOs (products/[id]/route.ts:39-96)

struct ProductDetail: Codable {
    var id: String
    var name: String
    var slug: String?
    var description: String?
    var brand: String?
    var unit: String?
    var basePrice: Double?
    var currency: String?
    var moq: Int?
    var maxOrderQty: Int?
    var stockQuantity: Int?
    var thumbnailUrl: String?
    var ratingAvg: Double?
    var reviewCount: Int?
    var soldCount: Int?
    var isCustomizable: Bool?
    var isActive: Bool?
    var supplier: ProductSupplier?
    var category: ProductCategory?
    var images: [ProductImage]?
    var priceTiers: [PriceTier]?
    var variants: [ProductVariant]?
    var reviews: [ProductReview]?
}

struct ProductSupplier: Codable {
    var id: String
    var companyName: String?
    var slug: String?
    var city: String?
    var ratingAvg: Double?
    var ratingCount: Int?
    var verificationStatus: String?
}

struct ProductCategory: Codable {
    var id: String
    var name: String?
    var slug: String?
    var parentId: String?
}

struct PriceTier: Codable {
    var id: String?
    var minQty: Int
    var maxQty: Int?
    var pricePerUnit: Double
}

struct ProductVariant: Codable, Identifiable {
    var id: String
    var variantName: String?
    var variantValue: String?
    var stockQuantity: Int?
    var priceOverride: Double?
}

struct ProductReview: Codable, Identifiable {
    var id: String
    var rating: Int
    var comment: String?
    var images: [String]?
    var verifiedPurchase: Bool?
    var createdAt: String?
    var buyer: ReviewBuyer?
    var replies: [ProductReview]?

    var displayName: String? {
        if let fullName = buyer?.buyerProfile?.fullName, !fullName.isEmpty { return fullName }
        return nil
    }
}

struct ReviewBuyer: Codable {
    var id: String
    var buyerProfile: ReviewBuyerProfile?
}

struct ReviewBuyerProfile: Codable {
    var fullName: String?
    var businessName: String?
}

/// GET /api/products/[id]/specifications — data.groupedSpecifications
/// (specifications/route.ts:68-84).
struct SpecificationsResponse: Codable {
    var success: Bool?
    var data: SpecificationsData?
}

struct SpecificationsData: Codable {
    var groupedSpecifications: [String: [SpecificationItem]]?
}

struct SpecificationItem: Codable {
    var specName: String
    var specValue: String
}

/// GET /api/products/[id]/similar — data.similarProducts (similar/route.ts:94-104).
struct SimilarResponse: Codable {
    var success: Bool?
    var data: SimilarData?
}

struct SimilarData: Codable {
    var currentProduct: SimilarCurrentProduct?
    var similarProducts: [SimilarProduct]?
}

struct SimilarCurrentProduct: Codable {
    var id: String
    var name: String?
}

struct SimilarProduct: Codable, Identifiable {
    var id: String
    var name: String
    var basePrice: Double?
    var unit: String?
    var moq: Int?
    var thumbnailUrl: String?
    var image: String?
    var matchPercentage: Int?
}

/// GET /api/products/[id]/frequently-bought (frequently-bought/route.ts:141+).
struct FrequentlyBoughtResponse: Codable {
    var success: Bool?
    var data: FrequentlyBoughtData?
}

struct FrequentlyBoughtData: Codable {
    var frequentlyBoughtTogether: [BoughtTogetherProduct]?
    var totalBundlePrice: Double?
    var bundleDiscount: Double?
}

struct BoughtTogetherProduct: Codable, Identifiable {
    var id: String
    var name: String
    var basePrice: Double?
    var unit: String?
    var isCurrent: Bool?
    var image: String?
    var thumbnailUrl: String?
}

/// GET /api/products/[id]/qa — data is an array of Q&A rows (qa/route.ts:37-46).
struct QAResponse: Codable {
    var success: Bool?
    var data: [QAItem]?
}

struct QAItem: Codable, Identifiable {
    var id: String
    var question: String?
    var answer: String?
    var answeredBy: String?
    var answeredAt: String?
}

// MARK: - Cart DTOs (cart/route.ts:71-79, [itemId]/route.ts)

/// GET /api/cart data — server-authoritative grouping by supplier.
struct ServerCart: Codable {
    var cartId: String?
    var totalItems: Int?
    var totalAmount: Double?
    var suppliers: [ServerCartSupplier]?
}

struct ServerCartSupplier: Codable {
    var supplierId: String
    var supplierName: String?
    var items: [ServerCartItem]
    var subtotal: Double?
}

struct ServerCartItem: Codable {
    var id: String
    var productId: String
    var variantId: String?
    var quantity: Int
    var supplierId: String?
    var product: ServerCartProduct?
    var variant: ServerCartVariant?
}

struct ServerCartProduct: Codable {
    var id: String?
    var name: String?
    var slug: String?
    var basePrice: Double?
    var unit: String?
    var moq: Int?
    var thumbnailUrl: String?
    var images: [ProductImage]?
    var supplier: SupplierBrief?
    var priceTiers: [PriceTier]?
}

struct ServerCartVariant: Codable {
    var id: String?
    var variantName: String?
    var variantValue: String?
    var priceOverride: Double?
}

// MARK: - Orders / wishlist / profile

/// POST /api/orders/create-direct 201 data (create-direct/route.ts:75-85).
struct DirectOrder: Codable {
    var orderId: String
    var orderNumber: String
    var totalAmount: Double?
    var paymentStatus: String?
    var subOrderId: String?
    var estimatedDelivery: String?
}

/// GET /api/profile/me data (profile/me/route.ts:39-79) — subset consumed for
/// auth-store.refreshProfile-equivalent hydration.
struct ProfileMe: Codable {
    var id: String
    var userType: String?
    var email: String?
    var phone: String?
    var fullName: String?
    var avatarUrl: String?
    var isProfileComplete: Bool?
    var profileCompletionPct: Int?
    var buyerProfile: BuyerProfileBlock?
    var supplierProfile: SupplierProfileBlock?
}

struct BuyerProfileBlock: Codable {
    var fullName: String?
    var businessName: String?
    var businessType: String?
}

struct SupplierProfileBlock: Codable {
    var companyName: String?
    var contactPersonName: String?
    var verificationStatus: String?
    var rejectionReason: String?
    var slug: String?
    var ratingAvg: Double?
    var ratingCount: Int?
}

/// POST /api/uploads/kyc — response puts `url` at TOP level, not data.url
/// (uploads/kyc/route.ts:46-51 — known backend quirk, do not "fix" client-side).
struct KycUploadResponse: Codable {
    var success: Bool?
    var url: String?
    var kind: String?
    var size: Int?
}
