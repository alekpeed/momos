import Foundation
import CryptoKit
import CommonCrypto
import Security

/// Client-side encryption for the private vault.
///
/// Mirrors the web engine: PBKDF2-SHA256 (150k iterations) derives a 256-bit
/// key from the passphrase + a per-record random salt, and AES-GCM seals the
/// plaintext. Only the sealed box and salt are ever persisted. The app cannot
/// recover a forgotten passphrase — there is no key escrow by design.
enum VaultCrypto {

    static let iterations: Int = 150_000
    static let saltByteCount = 16

    enum VaultError: Error { case badPassphrase, corrupted, encoding }

    /// Encrypts `plaintext` and returns the sealed box plus the salt used.
    static func encrypt(_ plaintext: String, passphrase: String) throws -> (ciphertext: Data, salt: Data) {
        guard let data = plaintext.data(using: .utf8) else { throw VaultError.encoding }
        let salt = randomBytes(saltByteCount)
        let key = try deriveKey(passphrase: passphrase, salt: salt)
        let sealed = try AES.GCM.seal(data, using: key)
        guard let combined = sealed.combined else { throw VaultError.corrupted }
        return (combined, salt)
    }

    /// Decrypts a record's sealed box. Throws `badPassphrase` on a wrong key
    /// (the GCM tag fails to verify) — plaintext is never revealed on failure.
    static func decrypt(ciphertext: Data, salt: Data, passphrase: String) throws -> String {
        let key = try deriveKey(passphrase: passphrase, salt: salt)
        do {
            let box = try AES.GCM.SealedBox(combined: ciphertext)
            let opened = try AES.GCM.open(box, using: key)
            guard let text = String(data: opened, encoding: .utf8) else { throw VaultError.corrupted }
            return text
        } catch is CryptoKitError {
            throw VaultError.badPassphrase
        }
    }

    // MARK: - Internals

    private static func deriveKey(passphrase: String, salt: Data) throws -> SymmetricKey {
        guard let passphraseData = passphrase.data(using: .utf8) else { throw VaultError.encoding }
        var derived = Data(count: 32)
        let status = derived.withUnsafeMutableBytes { derivedBytes in
            salt.withUnsafeBytes { saltBytes in
                passphraseData.withUnsafeBytes { passphraseBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passphraseBytes.baseAddress?.assumingMemoryBound(to: Int8.self),
                        passphraseData.count,
                        saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        derivedBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        32
                    )
                }
            }
        }
        guard status == Int32(kCCSuccess) else { throw VaultError.corrupted }
        return SymmetricKey(data: derived)
    }

    private static func randomBytes(_ count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes)
    }
}
