import SwiftUI

/// Modal URL-entry sheet used for both "add a new group" and
/// "attach a store to an existing group". The two modes differ only in
/// which API endpoint the sheet calls on submit.
struct AddURLSheet: View {
    enum Mode {
        case createGroup
        case attachTo(groupId: Int)
    }

    let mode: Mode
    let onSuccess: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                TextField("https://…", text: $url, axis: .vertical)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .submitLabel(.go)
                    .focused($focused)
                    .font(.largeTitle.weight(.light))
                    .lineLimit(3)
                    .padding(.vertical)
                    .onSubmit(submit)
                    .overlay(
                        Rectangle()
                            .frame(height: 1)
                            .foregroundStyle(.quaternary),
                        alignment: .bottom
                    )

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()
            }
            .padding()
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Button("Add", action: submit)
                            .disabled(url.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Button {
                        if let pasted = UIPasteboard.general.url?.absoluteString
                            ?? UIPasteboard.general.string {
                            url = pasted
                        }
                    } label: {
                        Label("Paste", systemImage: "doc.on.clipboard")
                    }
                    Spacer()
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { focused = true }
    }

    private var title: String {
        switch mode {
        case .createGroup: return "Track a product"
        case .attachTo: return "Add a store"
        }
    }

    private func submit() {
        let trimmed = url.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        Task {
            defer { isSubmitting = false }
            do {
                switch mode {
                case .createGroup:
                    _ = try await APIClient.shared.createGroup(url: trimmed)
                case .attachTo(let groupId):
                    _ = try await APIClient.shared.addListing(groupId: groupId, url: trimmed)
                }
                onSuccess()
                dismiss()
            } catch let NetworkError.api(api, _) {
                errorMessage = api.userMessage
            } catch {
                errorMessage = (error as? NetworkError)?.description
                    ?? error.localizedDescription
            }
        }
    }
}
