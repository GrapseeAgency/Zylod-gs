import SwiftUI
import PhotosUI
import UIKit

// Faithful port of src/components/pages/register-supplier-page.tsx (§3.5).
// 4 steps: Company Info → NID Upload → Trade License & TIN → Bank Details.
// The 3 KYC images go through PHPicker (PhotosPicker), are validated
// (8 MB, jpg/png/webp — anything else is re-encoded to JPEG so the server's
// Content-Type allowlist accepts it), uploaded to POST /api/uploads/kyc
// (multipart file+kind; TOP-LEVEL url in the response), then the register
// call carries the exact field list from register/route.ts:32-34.

struct RegisterSupplierView: View {
    var push: (AuthRoute) -> Void
    var pop: () -> Void
    var onAuthenticated: () -> Void

    enum Step: Int {
        case company = 1, nid, license, bank
    }

    // Step 1
    @State private var fullName = ""
    @State private var companyName = ""
    @State private var city = ""
    @State private var businessType = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    // Step 2
    @State private var nidNumber = ""
    @State private var nidFrontImage: UIImage?
    @State private var nidBackImage: UIImage?
    // Step 3
    @State private var tradeLicenseNumber = ""
    @State private var tradeLicenseImage: UIImage?
    @State private var tinNumber = ""
    // Step 4
    @State private var bankName = ""
    @State private var bankAccountName = ""
    @State private var bankAccountNumber = ""
    @State private var bankBranch = ""

    @State private var step: Step = .company
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var uploadStatus: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                progress
                VStack(alignment: .leading, spacing: 14) {
                    if let errorMessage {
                        errorBanner(errorMessage)
                    }
                    switch step {
                    case .company: companyForm
                    case .nid: nidForm
                    case .license: licenseForm
                    case .bank: bankForm
                    }
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
                loginLink
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .zylodEntrance()
    }

    // MARK: Chrome

    private var header: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(ZylodColor.primary)
                    .frame(width: 46, height: 46)
                Image(systemName: "storefront")
                    .font(ZylodFont.scaled(20, relativeTo: .title3))
                    .foregroundColor(ZylodColor.onPrimary)
            }
            Text("Register as Supplier")
                .font(ZylodFont.scaled(22, .bold, relativeTo: .title3))
                .foregroundColor(ZylodColor.onBackground)
            Text("Start selling on the B2B wholesale marketplace")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
        }
    }

    private var progress: some View {
        VStack(spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(ZylodColor.muted)
                    Capsule()
                        .fill(ZylodColor.primary)
                        .frame(width: geo.size.width * CGFloat(step.rawValue) / 4)
                }
            }
            .frame(height: 8)
            HStack {
                Text("Company Info")
                Text("NID Upload")
                Text("License & TIN")
                Text("Bank Details")
            }
            .font(ZylodFont.scaled(9, relativeTo: .caption2))
            .foregroundColor(ZylodColor.onMuted)
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
            .foregroundColor(ZylodColor.destructive)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
    }

    private var loginLink: some View {
        HStack(spacing: 4) {
            Text("Already have an account?")
                .foregroundColor(ZylodColor.onMuted)
            Button(action: pop) {
                Text("Log In")
                    .foregroundColor(ZylodColor.primary)
            }
        }
        .font(ZylodFont.scaled(12, relativeTo: .footnote))
    }

    // MARK: Step forms

    private var companyForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZylodTextField(label: "Full Name (as on NID) *", placeholder: "Your full legal name", text: $fullName, autocapitalization: .words)
            ZylodTextField(label: "Company/Shop Name *", placeholder: "Your company name", text: $companyName, autocapitalization: .words)
            pickerRow(label: "City", options: ["dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh"], selection: $city)
            pickerRow(label: "Business Type", options: ["manufacturer", "wholesaler", "trading", "factory"], selection: $businessType)
            ZylodTextField(label: "Email Address *", placeholder: "your@email.com", text: $email, keyboardType: .emailAddress)
            ZylodTextField(label: "Phone Number *", placeholder: "+880 1700-000000", text: $phone, keyboardType: .phonePad)
            ZylodPasswordField(label: "Password *", placeholder: "Minimum 8 characters", text: $password)
            ZylodButton(title: "Next: NID Upload", systemImage: "arrow.right") {
                guard !fullName.isEmpty, !companyName.isEmpty, !email.isEmpty, !phone.isEmpty, !password.isEmpty else {
                    errorMessage = "Please fill all required fields"
                    return
                }
                errorMessage = nil
                step = .nid
            }
        }
    }

    private var nidForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZylodTextField(label: "NID Number *", placeholder: "National ID number", text: $nidNumber)
            kycPicker(title: "NID Front Photo", kind: "nid-front", image: $nidFrontImage)
            kycPicker(title: "NID Back Photo", kind: "nid-back", image: $nidBackImage)
            HStack(spacing: 8) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(ZylodFont.scaled(12, relativeTo: .caption))
                    .foregroundColor(ZylodColor.primary)
                Text("Your NID will be verified by our admin team before you can start selling.")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
            HStack(spacing: 10) {
                ZylodOutlineButton(title: "Back", systemImage: "chevron.left", tint: ZylodColor.onMuted) { step = .company }
                ZylodButton(title: "Next: Trade License") {
                    if nidNumber.isEmpty { errorMessage = "Please enter NID number"; return }
                    errorMessage = nil
                    step = .license
                }
            }
        }
    }

    private var licenseForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZylodTextField(label: "Trade License Number *", placeholder: "Trade license number", text: $tradeLicenseNumber)
            kycPicker(title: "Trade License Document", kind: "trade-license", image: $tradeLicenseImage)
            ZylodTextField(label: "TIN Number *", placeholder: "Tax Identification Number", text: $tinNumber)
            HStack(spacing: 10) {
                ZylodOutlineButton(title: "Back", systemImage: "chevron.left", tint: ZylodColor.onMuted) { step = .nid }
                ZylodButton(title: "Next: Bank Details") {
                    if tradeLicenseNumber.isEmpty || tinNumber.isEmpty {
                        errorMessage = "Please fill required fields"
                        return
                    }
                    errorMessage = nil
                    step = .bank
                }
            }
        }
    }

    private var bankForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZylodTextField(label: "Bank Name *", placeholder: "Bank name", text: $bankName, autocapitalization: .words)
            ZylodTextField(label: "Account Holder Name *", placeholder: "Name on bank account", text: $bankAccountName, autocapitalization: .words)
            ZylodTextField(label: "Account Number *", placeholder: "Bank account number", text: $bankAccountNumber, keyboardType: .numberPad)
            ZylodTextField(label: "Branch Name", placeholder: "Branch name", text: $bankBranch, autocapitalization: .words)
            HStack(spacing: 8) {
                Image(systemName: "banknote")
                    .font(ZylodFont.scaled(12, relativeTo: .caption))
                    .foregroundColor(ZylodColor.primary)
                Text("Your bank details will be used for receiving payments from buyer orders.")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
            if isLoading, let uploadStatus {
                HStack(spacing: 8) {
                    ProgressView()
                    Text(uploadStatus)
                        .font(ZylodFont.scaled(11, relativeTo: .caption))
                        .foregroundColor(ZylodColor.onMuted)
                }
            }
            HStack(spacing: 10) {
                ZylodOutlineButton(title: "Back", systemImage: "chevron.left", tint: ZylodColor.onMuted) { step = .license }
                ZylodButton(title: "Create Account & Submit", loading: isLoading) {
                    Task { await submit() }
                }
            }
        }
    }

    // MARK: Reusable pieces

    private func pickerRow(label: String, options: [String], selection: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(options, id: \.self) { option in
                        Button {
                            selection.wrappedValue = option
                        } label: {
                            Text(option.capitalized)
                                .font(ZylodFont.scaled(11, .medium, relativeTo: .caption))
                                .foregroundColor(selection.wrappedValue == option ? ZylodColor.onPrimary : ZylodColor.onMuted)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Capsule().fill(selection.wrappedValue == option ? ZylodColor.primary : ZylodColor.muted.opacity(0.5)))
                        }
                    }
                }
            }
        }
    }

    private func kycPicker(title: String, kind: String, image: Binding<UIImage?>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
            if let current = image.wrappedValue {
                Image(uiImage: current)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 120)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(alignment: .bottom) {
                        Text("Tap to change")
                            .font(ZylodFont.scaled(10, relativeTo: .caption2))
                            .foregroundColor(ZylodColor.onMuted)
                            .padding(4)
                    }
                    .onTapGesture { }
            }
            PhotosPicker(
                selection: Binding(
                    get: { nil },
                    set: { newValue in
                        guard let newValue else { return }
                        Task { await loadAndValidate(newValue, into: image, kind: kind) }
                    }
                ),
                matching: .images
            ) {
                VStack(spacing: 6) {
                    Image(systemName: "square.and.arrow.up")
                        .font(ZylodFont.scaled(20, relativeTo: .title3))
                        .foregroundColor(ZylodColor.onMuted)
                    Text(image.wrappedValue == nil ? "Select from your photo library" : "Choose a different image")
                        .font(ZylodFont.scaled(11, relativeTo: .caption))
                        .foregroundColor(ZylodColor.onMuted)
                    Text("JPG, PNG or WebP · max 8MB")
                        .font(ZylodFont.scaled(9, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onMuted)
                }
                .frame(maxWidth: .infinity, minHeight: image.wrappedValue == nil ? 90 : 44)
                .background(
                    // iOS 16-safe dashed frame: fill() returns a plain View, so the
                    // strokeBorder goes on an overlay shape (fill→strokeBorder chain
                    // only exists on the iOS 17 typed FillShapeView).
                    RoundedRectangle(cornerRadius: 8)
                        .fill(ZylodColor.background)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [5]))
                                .foregroundColor(ZylodColor.border)
                        )
                )
            }
        }
    }

    /// Loads the picked item, validates the 8MB limit, and re-encodes to JPEG
    /// so the server's jpg/png/webp Content-Type allowlist accepts it.
    private func loadAndValidate(_ item: PhotosPickerItem, into target: Binding<UIImage?>, kind: String) async {
        errorMessage = nil
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            errorMessage = "Could not read the selected image"
            return
        }
        if data.count > 8 * 1024 * 1024 {
            errorMessage = "Document too large (max 8MB)"
            return
        }
        guard let image = UIImage(data: data) else {
            errorMessage = "Unsupported image format"
            return
        }
        // Re-encode to JPEG (server rejects HEIC etc.) with a downscale guard
        // for very large photos.
        let maxDimension: CGFloat = 2400
        var working = image
        let longest = max(image.size.width, image.size.height)
        if longest > maxDimension {
            let scale = maxDimension / longest
            let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: newSize)
            working = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: newSize))
            }
        }
        target.wrappedValue = working
    }

    // MARK: - Submit (register-supplier-page.tsx:79-162)

    private func submit() async {
        guard !bankName.isEmpty, !bankAccountName.isEmpty, !bankAccountNumber.isEmpty else {
            errorMessage = "Please fill all required fields"
            return
        }
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                return
            }

            var nidFrontUrl: String?
            var nidBackUrl: String?
            var tradeLicenseUrl: String?

            if let front = nidFrontImage {
                uploadStatus = "Uploading NID front…"
                nidFrontUrl = try await upload(client, image: front, kind: "nid-front")
            }
            if let back = nidBackImage {
                uploadStatus = "Uploading NID back…"
                nidBackUrl = try await upload(client, image: back, kind: "nid-back")
            }
            if let license = tradeLicenseImage {
                uploadStatus = "Uploading trade license…"
                tradeLicenseUrl = try await upload(client, image: license, kind: "trade-license")
            }

            uploadStatus = "Creating account…"
            let response = try await client.register(.init(
                userType: "supplier",
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                phone: phone.trimmingCharacters(in: .whitespaces),
                password: password,
                authProvider: "email",
                fullName: fullName.trimmingCharacters(in: .whitespaces),
                businessName: companyName.trimmingCharacters(in: .whitespaces),
                businessType: businessType.isEmpty ? nil : businessType,
                city: city.isEmpty ? nil : city,
                nidNumber: nidNumber,
                nidFrontImageUrl: nidFrontUrl,
                nidBackImageUrl: nidBackUrl,
                tradeLicenseNumber: tradeLicenseNumber,
                tradeLicenseImageUrl: tradeLicenseUrl,
                tinNumber: tinNumber,
                bankName: bankName,
                bankAccountName: bankAccountName,
                bankAccountNumber: bankAccountNumber,
                branch: bankBranch.isEmpty ? nil : bankBranch,
                isPhoneVerified: nil,
                isEmailVerified: nil
            ))

            if let token = response.token, response.user != nil {
                AuthSession.profileFromRegistration(
                    user: response.user,
                    token: token,
                    fullName: fullName,
                    businessName: companyName,
                    completionPct: 30
                )
                ToastCenter.shared.show("Account created! Your profile is pending verification.", tone: .success)
                // onAuthenticated routes supplier → supplier-dashboard WebView.
                onAuthenticated()
            } else {
                errorMessage = "Registration failed"
            }
        } catch let failure as ApiFailure {
            errorMessage = failure.error
        } catch {
            errorMessage = "An unexpected error occurred. Please try again."
        }
    }

    /// Writes the JPEG to a temp file and streams it via multipart
    /// URLSession uploadTask. Response `url` is TOP-LEVEL (uploads/kyc/route.ts).
    private func upload(_ client: ApiClient, image: UIImage, kind: String) async throws -> String {
        guard let jpeg = image.jpegData(compressionQuality: 0.85) else {
            throw ApiFailure(status: 0, error: "Could not encode the image")
        }
        if jpeg.count > 8 * 1024 * 1024 {
            throw ApiFailure(status: 0, error: "Document too large (max 8MB)")
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(kind)-\(UUID().uuidString).jpg")
        try jpeg.write(to: url, options: .atomic)
        defer { try? FileManager.default.removeItem(at: url) }
        let response = try await client.uploadKyc(fileURL: url, kind: kind)
        guard let link = response.url, !link.isEmpty else {
            throw ApiFailure(status: response.success == true ? 200 : 500, error: "Upload did not return a URL")
        }
        return link
    }
}
