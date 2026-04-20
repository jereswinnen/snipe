import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            VStack(spacing: 8) {
                Image(systemName: "tag.fill")
                    .font(.system(size: 48, weight: .light))
                    .foregroundStyle(.tint)
                Text("Snipe")
                    .font(.largeTitle.bold())
                Text("Sign in to keep tabs on prices.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .onSubmit(submit)
                    .padding()
                    .background(.thinMaterial, in: .rect(cornerRadius: 14))

                Button(action: submit) {
                    Group {
                        if isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Text("Sign in").fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                }
                .buttonStyle(.borderedProminent)
                .disabled(password.isEmpty || isSubmitting)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal)

            Spacer()
        }
        .padding()
    }

    private func submit() {
        guard !password.isEmpty, !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        Task {
            defer { isSubmitting = false }
            do {
                let token = try await APIClient.shared.login(password: password)
                await session.signIn(with: token)
            } catch let NetworkError.api(api, _) {
                errorMessage = api.userMessage
            } catch NetworkError.unauthorized {
                errorMessage = "Wrong password."
            } catch {
                errorMessage = "Couldn't reach the server."
            }
        }
    }
}
