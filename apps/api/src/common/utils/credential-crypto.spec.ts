import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from './credential-crypto';

// REQ-SEC-002 §14: a Secret Credential Value is stored encrypted and is
// never readable without the app-level key.
describe('credential-crypto', () => {
  const KEY = randomBytes(32).toString('base64');
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    process.env.CREDENTIAL_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIAL_ENCRYPTION_KEY = previousKey;
    }
  });

  it('round-trips a secret', () => {
    const secret = 's3cret-p@ssword';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('round-trips a long Bearer token and non-ASCII characters', () => {
    const token = `eyJ${'a'.repeat(4000)}`;
    expect(decryptSecret(encryptSecret(token))).toBe(token);
    expect(decryptSecret(encryptSecret('mật khẩu — ✓'))).toBe('mật khẩu — ✓');
  });

  it('never stores the plaintext in the ciphertext', () => {
    const secret = 'plaintext-marker';
    const encrypted = encryptSecret(secret);
    expect(Buffer.from(encrypted.ciphertext).toString('utf8')).not.toContain(secret);
    expect(Buffer.from(encrypted.ciphertext).toString('base64')).not.toContain(
      Buffer.from(secret).toString('base64'),
    );
  });

  it('uses a fresh IV per encryption, so the same secret never yields the same ciphertext', () => {
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it('rejects a tampered ciphertext or auth tag rather than returning garbage', () => {
    const encrypted = encryptSecret('s3cret');

    const tamperedCiphertext = { ...encrypted, ciphertext: new Uint8Array(encrypted.ciphertext) };
    tamperedCiphertext.ciphertext[0] ^= 0xff;
    expect(() => decryptSecret(tamperedCiphertext)).toThrow();

    const tamperedTag = { ...encrypted, authTag: new Uint8Array(encrypted.authTag) };
    tamperedTag.authTag[0] ^= 0xff;
    expect(() => decryptSecret(tamperedTag)).toThrow();
  });

  it('cannot decrypt with a different key — the key is not derivable from the stored bytes', () => {
    const encrypted = encryptSecret('s3cret');
    process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it('refuses to operate without a correctly sized key', () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    expect(() => encryptSecret('s3cret')).toThrow('CREDENTIAL_ENCRYPTION_KEY is not configured');

    process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(16).toString('base64');
    expect(() => encryptSecret('s3cret')).toThrow(
      'CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte (AES-256) key',
    );
  });
});
